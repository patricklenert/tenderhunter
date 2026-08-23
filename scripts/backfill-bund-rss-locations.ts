import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { markCatalogDirty } from "../lib/catalog";
import { tenders } from "../lib/schema";
import { extractBundRssLocation } from "../lib/public-tender-scraper";
import { enqueueJob } from "../lib/queue";
import { JOB_SYNC_MEILI } from "../lib/types";

async function main(): Promise<void> {
  const rows = await db
    .select({ id: tenders.id, metadataJson: tenders.metadataJson, rawText: tenders.rawText })
    .from(tenders)
    .where(eq(tenders.source, "bund-rss"));

  let updated = 0;
  for (const row of rows) {
    const metadata = row.metadataJson && typeof row.metadataJson === "object" && !Array.isArray(row.metadataJson)
      ? row.metadataJson as Record<string, unknown>
      : {};
    if (typeof metadata.location === "string" && metadata.location.trim()) continue;

    const location = extractBundRssLocation(row.rawText ?? "");
    if (!location) continue;

    await db.update(tenders)
      .set({ metadataJson: { ...metadata, location }, updatedAt: new Date() })
      .where(eq(tenders.id, row.id));
    updated += 1;
  }

  if (updated > 0) {
    await markCatalogDirty();
    await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
  }

  console.log(`[backfill-bund-rss-locations] ${updated} Standorte ergänzt.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
