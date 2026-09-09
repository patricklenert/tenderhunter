import assert from "node:assert/strict";
import { processDetailQueue } from "../lib/public-tender-scraper";
import type { PublicDetailReference } from "../lib/public-pagination";

const reference: PublicDetailReference = {
  key: "detail-1",
  url: "https://example.test/detail-1",
  attempts: 0,
};

const main = async () => {
  const retryResult = await processDetailQueue([reference], 1, async () => ({ tender: null }));
  assert.equal(retryResult.tenders.length, 0);
  assert.equal(retryResult.pendingDetails.length, 1);
  assert.equal(retryResult.pendingDetails[0]?.attempts, 1);
  assert.equal(retryResult.pendingDetails[0]?.blocked, false);
  assert.ok(retryResult.pendingDetails[0]?.nextAttemptAt);

  const terminalResult = await processDetailQueue([reference], 1, async () => ({ tender: null, terminal: true }));
  assert.equal(terminalResult.pendingDetails.length, 0);
  assert.equal(terminalResult.detailFailed, 0);

  console.log("Public detail queue tests passed.");
};

void main();
