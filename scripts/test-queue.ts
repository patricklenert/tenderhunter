import assert from "node:assert/strict";
import { buildJobKey, isCriticalJobType, shouldReuseCompletedJob } from "../lib/queue";

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

console.log("Queue policy tests passed.");
