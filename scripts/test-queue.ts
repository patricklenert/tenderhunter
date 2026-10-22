import assert from "node:assert/strict";
import { buildJobKey, CRITICAL_JOB_TYPES, getApiAnalysisStatusAfterFailure, getCriticalJobTypeOrder, getEffectiveQueuePriority, getJobMaxRuntimeMs, isCriticalJobType, isJobRuntimeStale, JOB_PRIORITIES, PUBLIC_CONTINUATION_PRIORITY, queueJobsConflict, shouldReapJobForRuntimeTimeout, shouldReuseCompletedJob } from "../lib/queue";

assert.equal(buildJobKey("parse_documents", 42), "parse_documents:42");
assert.equal(buildJobKey("parse_documents", 42, "refresh"), "parse_documents:42:refresh");

assert.equal(shouldReuseCompletedJob("done"), true);
assert.equal(shouldReuseCompletedJob("done", false), false);
assert.equal(shouldReuseCompletedJob("pending", false), false);
assert.equal(shouldReuseCompletedJob("failed"), false);
assert.equal(getApiAnalysisStatusAfterFailure(1, 3), "processing", "API analyses stay processing while queue retries remain");
assert.equal(getApiAnalysisStatusAfterFailure(4, 3), "failed", "API analyses fail only after the retry budget is exhausted");

assert.equal(isCriticalJobType("parse_documents"), true);
assert.equal(isCriticalJobType("structure_tender"), true);
assert.equal(isCriticalJobType("scrape_public_tenders"), false);
assert.equal(isCriticalJobType("scrape_us_tenders"), true);
assert.equal(isCriticalJobType("sync_meilisearch"), false);
assert.equal(JOB_PRIORITIES.scrape_public_tenders, 105);
assert.equal(JOB_PRIORITIES.scrape_us_tenders, 115);
assert.equal(JOB_PRIORITIES.cache_detail, 120);
assert.equal(JOB_PRIORITIES.fetch_documents, 115);
assert.equal(PUBLIC_CONTINUATION_PRIORITY, 100);
const fullPublicScrape = { type: "scrape_public_tenders", payload: {}, groupKey: "public-scrape" };
const dtvpContinuation = { type: "scrape_public_tenders", payload: { source: "dtvp" }, groupKey: "public-scrape" };
const dtvpNextPage = { type: "scrape_public_tenders", payload: { source: "dtvp" }, groupKey: "public-scrape" };
const tedContinuation = { type: "scrape_public_tenders", payload: { source: "ted" }, groupKey: "public-scrape" };
assert.equal(queueJobsConflict(fullPublicScrape, dtvpContinuation), true, "full runs exclude every source continuation");
assert.equal(queueJobsConflict(dtvpContinuation, fullPublicScrape), true, "source continuations exclude a running full run");
assert.equal(queueJobsConflict(dtvpContinuation, dtvpNextPage), true, "one source cannot process concurrent cursor updates");
assert.equal(queueJobsConflict(dtvpContinuation, tedContinuation), false, "independent source cursors may progress concurrently");
assert.equal(queueJobsConflict(
  dtvpContinuation,
  { ...dtvpNextPage, groupKey: "public-source:dtvp" },
), true, "reprocess jobs still share the source cursor lock");
assert.equal(queueJobsConflict(
  { ...dtvpContinuation, payload: { source: " dtvp " } },
  dtvpNextPage,
), true, "source keys are normalized before applying the cursor lock");
assert.equal(queueJobsConflict(
  { ...dtvpContinuation, payload: { source: 42 } },
  tedContinuation,
), true, "invalid source payloads are treated as full runs");
assert.equal(queueJobsConflict(
  { type: "cache_detail", payload: {}, groupKey: "tender:1" },
  { type: "parse_documents", payload: {}, groupKey: "tender:1" },
), true, "ordinary jobs in the same group remain exclusive");
assert.equal(queueJobsConflict(
  { type: "cache_detail", payload: {}, groupKey: "tender:1" },
  { type: "parse_documents", payload: {}, groupKey: "tender:2" },
), false, "ordinary jobs in different groups remain concurrent");
assert.equal(queueJobsConflict(
  dtvpContinuation,
  { type: "cache_detail", payload: {}, groupKey: "public-scrape" },
), true, "the legacy public group remains exclusive across job types");
const priorityNow = Date.parse("2026-08-31T15:00:00.000Z");
assert.equal(getEffectiveQueuePriority(140, new Date(priorityNow - 48 * 60 * 60 * 1_000), priorityNow), 150);
assert.equal(getEffectiveQueuePriority(100, new Date(priorityNow - 48 * 60 * 60 * 1_000), priorityNow), 150);
assert.equal(getEffectiveQueuePriority(100, new Date(priorityNow), priorityNow), 100);
assert.equal(isCriticalJobType("generate_insight"), false);
assert.equal(isCriticalJobType("notify_company"), false);
assert.equal(getCriticalJobTypeOrder(null), undefined);
const criticalTypeOrder = getCriticalJobTypeOrder(CRITICAL_JOB_TYPES[1]);
assert.equal(criticalTypeOrder?.[0], CRITICAL_JOB_TYPES[2]);
assert.equal(criticalTypeOrder?.at(-1), CRITICAL_JOB_TYPES[1]);
assert.equal(new Set(criticalTypeOrder).size, CRITICAL_JOB_TYPES.length);

assert.equal(getJobMaxRuntimeMs("fetch_documents"), 20 * 60 * 1_000);
assert.equal(getJobMaxRuntimeMs("scrape_public_tenders"), 300 * 60 * 1_000);
assert.equal(isJobRuntimeStale(new Date(Date.now() - 21 * 60 * 1_000), "fetch_documents"), true);
assert.equal(isJobRuntimeStale(new Date(Date.now() - 19 * 60 * 1_000), "fetch_documents"), false);
const staleRuntime = new Date(Date.now() - 21 * 60 * 1_000);
assert.equal(shouldReapJobForRuntimeTimeout(staleRuntime, "fetch_documents", false), false);
assert.equal(shouldReapJobForRuntimeTimeout(staleRuntime, "fetch_documents", true), true);

console.log("Queue policy tests passed.");
