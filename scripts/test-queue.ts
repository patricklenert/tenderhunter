import assert from "node:assert/strict";
import { buildJobKey, CRITICAL_JOB_TYPES, getCriticalJobTypeOrder, getEffectiveQueuePriority, getJobMaxRuntimeMs, isCriticalJobType, isJobRuntimeStale, JOB_PRIORITIES, PUBLIC_CONTINUATION_PRIORITY, shouldReapJobForRuntimeTimeout, shouldReuseCompletedJob } from "../lib/queue";

assert.equal(buildJobKey("parse_documents", 42), "parse_documents:42");
assert.equal(buildJobKey("parse_documents", 42, "refresh"), "parse_documents:42:refresh");

assert.equal(shouldReuseCompletedJob("done"), true);
assert.equal(shouldReuseCompletedJob("done", false), false);
assert.equal(shouldReuseCompletedJob("pending", false), false);
assert.equal(shouldReuseCompletedJob("failed"), false);

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
