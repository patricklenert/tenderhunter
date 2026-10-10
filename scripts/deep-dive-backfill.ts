import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { buildTenderPipelineGroupKey, enqueueJob } from "@/lib/queue";
import { JOB_SMALL_VENDOR_DEEP_DIVE } from "@/lib/types";

const DEFAULT_TENDER_IDS = [19317, 21260, 25851, 25825, 25512, 25696, 22894];

async function main(): Promise<void> {
  const argIds = process.argv
    .slice(2)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  const tenderIds = argIds.length > 0 ? argIds : DEFAULT_TENDER_IDS;

  console.log(`[deep-dive] Bearbeite ${tenderIds.length} Ausschreibungs-IDs ...`);
  let eingereiht = 0;

  for (const tenderId of tenderIds) {
    const rows = await db
      .select({ id: tenders.id, qualityStatus: tenders.qualityStatus })
      .from(tenders)
      .where(eq(tenders.id, tenderId))
      .limit(1);
    const tender = rows[0];
    if (!tender || tender.qualityStatus !== "qualified") {
      console.warn(`[deep-dive] Tender ${tenderId}: nicht gefunden oder nicht 'qualified', wird uebersprungen`);
      continue;
    }

    const jobId = await enqueueJob(
      JOB_SMALL_VENDOR_DEEP_DIVE,
      { tender_id: tenderId, force: true },
      {
        jobKey: `small_vendor_deep_dive:${tenderId}:force`,
        groupKey: buildTenderPipelineGroupKey(tenderId),
        dedupeCompleted: false,
        priority: 60,
      },
    );
    console.log(`[deep-dive] Tender ${tenderId}: Job ${jobId} eingereiht`);
    eingereiht += 1;
  }

  console.log(`[deep-dive] ${eingereiht} Tiefenanalysen eingereiht`);
}

main().catch((err) => {
  console.error("[deep-dive] Fehler:", err);
  process.exit(1);
});
