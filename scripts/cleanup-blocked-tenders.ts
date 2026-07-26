import { asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { insights, scores, structuredData, tenders } from "../lib/schema";
import { detectAccessPage } from "../lib/access-page-detector";
import { enqueueJob } from "../lib/queue";
import { JOB_SYNC_MEILI } from "../lib/types";

const BATCH_SIZE = 250;
const applyChanges = process.argv.includes("--apply");

const counts = new Map<string, number>();
let lastId = 0;
let scanned = 0;
let blocked = 0;
let changed = 0;

const increment = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);

async function main(): Promise<void> {
  while (true) {
    const rows = await db
      .select({
        tender: tenders,
        structured: structuredData.jsonBlob,
      })
      .from(tenders)
      .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(gt(tenders.id, lastId))
      .orderBy(asc(tenders.id))
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    const blockedIds: number[] = [];
    for (const row of rows) {
      lastId = row.tender.id;
      scanned += 1;

      const metadata = row.tender.metadataJson && typeof row.tender.metadataJson === "object"
        ? JSON.stringify(row.tender.metadataJson)
        : "";
      const structured = row.structured ? JSON.stringify(row.structured) : "";
      const detection = detectAccessPage(
        [row.tender.title, row.tender.rawText, metadata, structured].filter(Boolean).join("\n"),
        { title: row.tender.title ?? undefined, url: row.tender.url },
      );

      if (!detection.blocked) continue;
      blocked += 1;
      increment(`${row.tender.source}:${detection.reason ?? "unknown"}`);

      if (row.tender.qualityStatus === "candidate" || row.tender.qualityStatus === "qualified") {
        blockedIds.push(row.tender.id);
        changed += 1;
      }
    }

    if (applyChanges && blockedIds.length > 0) {
      await db.transaction(async (tx) => {
        await tx.delete(structuredData).where(inArray(structuredData.tenderId, blockedIds));
        await tx.delete(insights).where(inArray(insights.tenderId, blockedIds));
        await tx.delete(scores).where(inArray(scores.tenderId, blockedIds));
        await tx
          .update(tenders)
          .set({
            qualityStatus: "rejected",
            qualityReason: "Zugriffsschutz erkannt: bestehender Inhalt wurde bereinigt",
            rawText: null,
            contentFingerprint: null,
            duplicateOfTenderId: null,
            updatedAt: new Date(),
          })
          .where(inArray(tenders.id, blockedIds));
      });
    }

    if (rows.length < BATCH_SIZE) break;
  }

  console.log(`[cleanup-blocked] Modus: ${applyChanges ? "APPLY" : "DRY-RUN"}`);
  console.log(`[cleanup-blocked] Geprueft: ${scanned}, blockiert: ${blocked}, bereinigbar: ${changed}`);
  for (const [key, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`[cleanup-blocked] ${count} ${key}`);
  }
  if (!applyChanges && changed > 0) {
    console.log("[cleanup-blocked] Keine Daten geändert. Mit --apply erneut ausführen.");
  }
  if (applyChanges && changed > 0) {
    await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI });
    console.log("[cleanup-blocked] Meilisearch-Synchronisierung eingereiht.");
  }
}

main().catch((error: unknown) => {
  console.error("[cleanup-blocked] Fehler:", error);
  process.exitCode = 1;
});
