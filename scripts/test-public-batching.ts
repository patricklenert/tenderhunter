import assert from "node:assert/strict";
import {
  scrapeAllPublicTenders,
  type ExtractedTender,
  type PublicScraperResult,
} from "../lib/public-tender-scraper";

const events: string[] = [];

const tender = (
  externalId: string,
  sourceUrl: string,
  pdfUrls: string[],
): ExtractedTender => ({
  title: "IT-Dienstleistung für den öffentlichen Auftraggeber",
  client: "Öffentlicher Auftraggeber",
  deadline: null,
  description: "Ausschreibung für IT-Dienstleistungen.",
  descriptionMarkdown: "",
  referenceNumber: null,
  location: null,
  category: "Facility Management",
  sourceUrl,
  source: "Testquelle",
  sourceKey: "ignored",
  externalId,
  pdfUrls,
});

const source = (name: string, tenders: ExtractedTender[]) => ({
  name,
  fn: async (): Promise<PublicScraperResult> => {
    if (name === "second") {
      assert.deepEqual(events, ["scrape:first", "persist:first"], "first source must be persisted before the next scrape starts");
    }
    events.push(`scrape:${name}`);
    return {
      tenders,
      cursorCommit: "commit",
      listingComplete: true,
      continuationRequired: false,
      listedCount: tenders.length,
      detailAttempted: tenders.length,
      detailFailed: 0,
      pendingCount: 0,
      exhausted: true,
    };
  },
});

const run = async (): Promise<void> => {
  const firstPdf = "https://example.test/first.pdf";
  const secondPdf = "https://example.test/second.pdf";
  const result = await scrapeAllPublicTenders(async (sourceKey, batch) => {
    events.push(`persist:${sourceKey}`);
    if (sourceKey === "first") {
      assert.equal(batch.length, 1, "same-source duplicates should be collapsed before persistence");
      assert.deepEqual(batch[0].pdfUrls, [firstPdf, secondPdf], "duplicate resources should be merged into the persisted tender");
    }
  }, undefined, {}, [
    source("first", [
      tender("shared-id", "https://example.test/first/1", [firstPdf]),
      tender("shared-id", "https://example.test/first/2", [secondPdf]),
    ]),
    source("second", [
      tender("second-id", "https://example.test/second/1", []),
    ]),
  ]);

  assert.deepEqual(events, [
    "scrape:first",
    "persist:first",
    "scrape:second",
    "persist:second",
  ]);
  assert.equal(result.totalFound, 3);
  assert.equal(result.afterDedup, 2);
};

void run().then(() => {
  console.log("Public source batching tests passed.");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
