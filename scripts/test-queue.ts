import assert from "node:assert/strict";
import { buildJobKey, getJobMaxRuntimeMs, isCriticalJobType, isJobRuntimeStale, shouldReuseCompletedJob } from "../lib/queue";

assert.equal(buildJobKey("parse_documents", 42), "parse_documents:42");
assert.equal(buildJobKey("parse_documents", 42, "refresh"), "parse_documents:42:refresh");

assert.equal(shouldReuseCompletedJob("done"), true);
assert.equal(shouldReuseCompletedJob("done", false), false);
assert.equal(shouldReuseCompletedJob("pending", false), false);
assert.equal(shouldReuseCompletedJob("failed"), false);

assert.equal(isCriticalJobType("parse_documents"), true);
assert.equal(isCriticalJobType("structure_tender"), true);
assert.equal(isCriticalJobType("generate_insight"), false);
assert.equal(isCriticalJobType("notify_company"), false);

assert.equal(getJobMaxRuntimeMs("fetch_documents"), 20 * 60 * 1_000);
assert.equal(isJobRuntimeStale(new Date(Date.now() - 21 * 60 * 1_000), "fetch_documents"), true);
assert.equal(isJobRuntimeStale(new Date(Date.now() - 19 * 60 * 1_000), "fetch_documents"), false);

console.log("Queue policy tests passed.");
