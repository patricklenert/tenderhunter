import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { jobs, structuredData, tenders } from "../lib/schema";
import { recoverTenderProcessing } from "../lib/pipeline";

const apply = process.argv.includes("--apply");

const loadCandidates = async (): Promise<number[]> => {
  const rows = await db
    .select({ id: tenders.id })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      eq(tenders.qualityStatus, "qualified"),
      sql`(
        ${structuredData.tenderId} IS NULL
        OR (
          ${tenders.readinessStatus} = 'ready'
          AND NOT EXISTS (
            SELECT 1 FROM jobs score_job
            WHERE score_job.type = 'score_tender'
              AND score_job.status = 'done'
              AND score_job.payload ->> 'tender_id' = ${tenders.id}::text
          )
        )
      )`,
    ));
  return rows.map((row) => row.id);
};

const main = async (): Promise<void> => {
  const candidates = await loadCandidates();
  console.log(`[recover-tender-pipeline] Modus: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`[recover-tender-pipeline] Kandidaten: ${candidates.length}`);
  console.log(candidates.join(", ") || "Keine Kandidaten.");

  if (apply) {
    for (const tenderId of candidates) {
      await recoverTenderProcessing(tenderId);
      console.log(`[recover-tender-pipeline] Tender #${tenderId} geprüft.`);
    }
  }
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end({ timeout: 5 }).catch(() => undefined);
  });
