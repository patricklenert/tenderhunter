import "dotenv/config";
import fs from "node:fs";
import { and, eq, like } from "drizzle-orm";
import { db } from "../lib/db";
import { documents, tenderResources } from "../lib/schema";
import { extractTextFromFile } from "../lib/parser";
import { objectAbsolutePath } from "../lib/storage";
import { repairKnownGermanEncoding } from "../lib/text-normalization";
import { markCatalogDirty } from "../lib/catalog";
import { enqueueJob } from "../lib/queue";
import { JOB_STRUCTURE, JOB_SYNC_MEILI } from "../lib/types";

const replacementCharacter = "\uFFFD";

const parseText = (result: Awaited<ReturnType<typeof extractTextFromFile>>): string =>
  (result.pages.length > 0
    ? result.pages.map((page, index) => `[Seite ${index + 1}]\n${page}`).join("\n\n")
    : result.text)
    .replace(/\u0000/g, "")
    .trim();

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: documents.id,
      tenderId: documents.tenderId,
      storagePath: documents.storagePath,
      contentType: documents.contentType,
      extractedText: documents.extractedText,
    })
    .from(documents)
    .where(and(
      like(documents.extractedText, `%${replacementCharacter}%`),
      eq(documents.contentType, "text/html"),
    ));

  const changedTenderIds = new Set<number>();
  let repairedDocuments = 0;
  for (const row of rows) {
    const current = repairKnownGermanEncoding(row.extractedText ?? "");
    let repaired = current;
    const absolutePath = objectAbsolutePath(row.storagePath);
    if (fs.existsSync(absolutePath)) {
      try {
        repaired = repairKnownGermanEncoding(parseText(await extractTextFromFile(absolutePath, row.contentType)));
      } catch {
        // Keep the current text when a legacy object can no longer be parsed.
      }
    }
    if (!repaired || repaired === current) continue;

    await db.update(documents).set({
      extractedText: repaired,
      parseStatus: repaired.length >= 20 ? "parsed" : "empty",
      updatedAt: new Date(),
    }).where(eq(documents.id, row.id));
    repairedDocuments += 1;
    changedTenderIds.add(row.tenderId);
  }

  const resourceRows = await db
    .select({ id: tenderResources.id, label: tenderResources.label })
    .from(tenderResources)
    .where(like(tenderResources.label, `%${replacementCharacter}%`));
  let repairedResources = 0;
  for (const row of resourceRows) {
    const label = repairKnownGermanEncoding(row.label ?? "");
    if (label === row.label) continue;
    await db.update(tenderResources).set({ label, updatedAt: new Date() }).where(eq(tenderResources.id, row.id));
    repairedResources += 1;
  }

  if (repairedDocuments > 0 || repairedResources > 0) {
    await markCatalogDirty();
    for (const tenderId of changedTenderIds) {
      await enqueueJob(JOB_STRUCTURE, { tender_id: tenderId }, {
        jobKey: `structure:encoding-backfill:${tenderId}`,
        dedupeCompleted: false,
      });
    }
    await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
  }

  console.log(JSON.stringify({
    scannedDocuments: rows.length,
    repairedDocuments,
    repairedResources,
    queuedStructures: changedTenderIds.size,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
