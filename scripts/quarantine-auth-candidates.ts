import "dotenv/config";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { jobs, scores, structuredData, tenders } from "../lib/schema";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const limitArg = Number.parseInt(process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? "5000", 10);
const limit = Number.isFinite(limitArg) ? Math.max(1, Math.min(limitArg, 20000)) : 5000;

/**
 * Quarantines DTVP Keycloak login pages that were persisted as candidate
 * tenders before the access-page detector learned the final-redirect URL.
 * Mirrors lib/pipeline.ts rejectBlockedTender():
 *   - qualityStatus rejected, readiness blocked, rawText cleared
 *   - structured data + scoring removed
 *   - pending analysis jobs cancelled so the queue drains real work
 */
const main = async (): Promise<void> => {
  const authShape = or(
    sql`${tenders.url} ILIKE '%/realms/%'`,
    sql`${tenders.url} ILIKE '%openid-connect/auth%'`,
    sql`${tenders.title} ILIKE 'Anmeldung für Unternehmen%'`,
  );

  const rows = await db
    .select({ id: tenders.id, url: tenders.url, title: tenders.title, qualityStatus: tenders.qualityStatus })
    .from(tenders)
    .where(and(eq(tenders.qualityStatus, "candidate"), authShape))
    .limit(limit);

  console.log(`[auth-quarantine] Modus: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`[auth-quarantine] Auth-geformte Kandidaten: ${rows.length}`);
  for (const row of rows.slice(0, 10)) {
    console.log(`  #${row.id}: ${(row.title ?? "").slice(0, 60)} -> ${row.url.slice(0, 90)}`);
  }
  if (rows.length > 10) console.log(`  ... und ${rows.length - 10} weitere`);

  if (!apply || rows.length === 0) return;

  const ids = rows.map((row) => row.id);

  await db.delete(structuredData).where(inArray(structuredData.tenderId, ids));
  await db.delete(scores).where(inArray(scores.tenderId, ids));
  await db
    .update(tenders)
    .set({
      qualityStatus: "rejected",
      qualityReason: "Zugriffsschutz erkannt: login_required (Keycloak-Redirect)",
      readinessStatus: "blocked",
      readinessReason: "Zugriffsschutz erkannt: login_required (Keycloak-Redirect)",
      readinessUpdatedAt: new Date(),
      rawText: null,
      contentFingerprint: null,
      duplicateOfTenderId: null,
      updatedAt: new Date(),
    })
    .where(inArray(tenders.id, ids));

  const cancelled = await db
    .update(jobs)
    .set({
      status: "failed",
      finishedAt: new Date(),
      updatedAt: new Date(),
      lastError: "abgebrochen: Auth-Quarantaene (login_required)",
    })
    .where(
      and(
        eq(jobs.status, "pending"),
        inArray(jobs.type, ["fetch_documents", "parse_documents", "structure_tender", "score_tender", "cache_detail"]),
        sql`(${jobs.payload} ->> 'tender_id')::int IN ${sql.raw(`(${ids.join(",")})`)}`,
      ),
    )
    .returning({ id: jobs.id });

  console.log(`[auth-quarantine] Kandidaten abgelehnt: ${rows.length}, Analyse-Jobs abgebrochen: ${cancelled.length}`);
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end({ timeout: 5 }).catch(() => undefined);
  });
