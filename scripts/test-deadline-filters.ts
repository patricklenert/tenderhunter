import assert from "node:assert/strict";
import {
  formatDeadlineDE,
  getBerlinCalendarDayRange,
  getBerlinDateInputRange,
  resolveTenderDeadlineFilter,
} from "../lib/date-utils";

const now = new Date("2026-09-09T12:00:00.000Z");

assert.deepEqual(resolveTenderDeadlineFilter("all", null, null, now), {});
assert.deepEqual(resolveTenderDeadlineFilter("missing", null, null, now), { hasDeadline: false });

for (const [filter, days] of [["minimum3", 3], ["minimum7", 7], ["minimum14", 14]] as const) {
  assert.deepEqual(
    resolveTenderDeadlineFilter(filter, null, null, now),
    { hasDeadline: true, deadlineAtFrom: getBerlinCalendarDayRange(days, now).from },
    `${filter} must start on the requested Berlin calendar day`,
  );
}

for (const [filter, days] of [["next7", 7], ["next30", 30]] as const) {
  assert.deepEqual(
    resolveTenderDeadlineFilter(filter, null, null, now),
    {
      hasDeadline: true,
      deadlineAtFrom: Math.floor(now.getTime() / 1000),
      deadlineAtTo: getBerlinCalendarDayRange(days, now).to,
    },
    `${filter} must use an inclusive Berlin calendar window`,
  );
}

const customFrom = getBerlinDateInputRange("2026-09-20");
const customTo = getBerlinDateInputRange("2026-09-27");
assert.ok(customFrom && customTo);
assert.deepEqual(
  resolveTenderDeadlineFilter("custom", "2026-09-20", "2026-09-27", now),
  { hasDeadline: true, deadlineAtFrom: customFrom.from, deadlineAtTo: customTo.to },
);

assert.throws(
  () => resolveTenderDeadlineFilter("custom", "2026-02-30", null, now),
  /Ungültiges Startdatum/,
);
assert.throws(
  () => resolveTenderDeadlineFilter("custom", "2026-09-28", "2026-09-27", now),
  /Enddatum/,
);

assert.equal(formatDeadlineDE("2026-10-28T11:00:00.000Z"), "28.10.2026");

const autumnDay = getBerlinDateInputRange("2026-10-25");
assert.ok(autumnDay);
assert.equal(new Date(autumnDay.from * 1000).toISOString(), "2026-10-24T22:00:00.000Z");
assert.equal(new Date(autumnDay.to * 1000).toISOString(), "2026-10-25T23:00:00.000Z");

console.log("Deadline filter tests passed.");
