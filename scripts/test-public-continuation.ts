import assert from "node:assert/strict";
import {
  shouldSchedulePublicContinuation,
  type PublicDetailReference,
  type PublicSourceCursor,
} from "../lib/public-pagination";

const now = new Date("2026-08-16T12:00:00.000Z");
const due = new Date(now.getTime() - 60_000).toISOString();
const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

const reference = (overrides: Partial<PublicDetailReference> = {}): PublicDetailReference => ({
  key: "source:url:https://example.test/detail",
  url: "https://example.test/detail",
  attempts: 1,
  ...overrides,
});

const cursorWith = (pendingDetails: PublicDetailReference[]): PublicSourceCursor => ({
  version: 2,
  pendingDetails,
  position: { nextUrl: "https://example.test/list?page=2" },
  strategy: "generic",
  exhausted: false,
});

// 1. Exhausted or not-required cursors never continue.
assert.equal(shouldSchedulePublicContinuation(cursorWith([]), true, false, "partial", null, now), false);
assert.equal(shouldSchedulePublicContinuation(cursorWith([]), false, false, "success", null, now), false);

// 2. A retryable detail that is due now schedules the continuation.
assert.equal(
  shouldSchedulePublicContinuation(cursorWith([reference({ nextAttemptAt: due })]), false, true, "partial", null, now),
  true,
);
assert.equal(
  shouldSchedulePublicContinuation(cursorWith([reference({})]), false, true, "partial", null, now),
  true,
);

// 3. Backoff-deferred retries must NOT schedule a continuation — the old
//    predicate requeued these every scheduler tick and starved the analysis queue.
assert.equal(
  shouldSchedulePublicContinuation(cursorWith([reference({ nextAttemptAt: future })]), false, true, "partial", null, now),
  false,
);

// 4. Blocked-only pending details cannot progress and must not requeue.
assert.equal(
  shouldSchedulePublicContinuation(cursorWith([reference({ blocked: true })]), false, true, "partial", null, now),
  false,
);

// 5. Permanent source errors park the cursor.
assert.equal(shouldSchedulePublicContinuation(cursorWith([]), false, true, "failed", "HTTP 404", now), false);

// 6. Empty queue + incomplete listing: a clean partial run may continue;
//    old failed cursors are retried, while errored partial runs stay parked.
assert.equal(shouldSchedulePublicContinuation(cursorWith([]), false, true, "success", null, now), true);
assert.equal(shouldSchedulePublicContinuation(cursorWith([]), false, true, "partial", null, now), true);
assert.equal(shouldSchedulePublicContinuation(cursorWith([]), false, true, "partial", "listing made no progress", now), false);
assert.equal(shouldSchedulePublicContinuation(cursorWith([]), false, true, "failed", null, now), true);
assert.equal(shouldSchedulePublicContinuation(cursorWith([]), true, true, "failed", null, now), true);
assert.equal(
  shouldSchedulePublicContinuation({ ...cursorWith([]), sourceFailureRetryAt: future }, false, true, "failed", "HTTP 503", now),
  false,
);
assert.equal(
  shouldSchedulePublicContinuation({ ...cursorWith([]), sourceFailureRetryAt: due }, false, true, "failed", "HTTP 503", now),
  true,
);
assert.equal(
  shouldSchedulePublicContinuation(
    { ...cursorWith([reference({ nextAttemptAt: due })]), sourceFailureRetryAt: future },
    false,
    true,
    "failed",
    "HTTP 503",
    now,
  ),
  false,
  "source backoff must also park due detail retries",
);

// 7. Mixed queue with one future and one blocked reference stays parked.
assert.equal(
  shouldSchedulePublicContinuation(
    cursorWith([reference({ key: "a", url: "https://example.test/a", nextAttemptAt: future }), reference({ key: "b", url: "https://example.test/b", blocked: true })]),
    false,
    true,
    "partial",
    null,
    now,
  ),
  false,
);

// 8. Mixed queue where the second reference becomes due schedules.
assert.equal(
  shouldSchedulePublicContinuation(
    cursorWith([reference({ key: "a", url: "https://example.test/a", nextAttemptAt: future }), reference({ key: "b", url: "https://example.test/b", nextAttemptAt: due })]),
    false,
    true,
    "partial",
    null,
    now,
  ),
  true,
);

console.log("Public-continuation scheduling tests passed.");
