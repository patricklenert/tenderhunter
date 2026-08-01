import assert from "node:assert/strict";
import { getGermanLastThreeDaysUnixRange } from "../lib/date-utils";

const cases = [
  {
    name: "normal Berlin three-day window",
    now: "2026-01-15T12:00:00.000Z",
    from: "2026-01-12T23:00:00.000Z",
    to: "2026-01-15T23:00:00.000Z",
    hours: 72,
  },
  {
    name: "Berlin spring DST transition",
    now: "2026-03-29T12:00:00.000Z",
    from: "2026-03-26T23:00:00.000Z",
    to: "2026-03-29T22:00:00.000Z",
    hours: 71,
  },
  {
    name: "Berlin autumn DST transition",
    now: "2026-10-25T12:00:00.000Z",
    from: "2026-10-22T22:00:00.000Z",
    to: "2026-10-25T23:00:00.000Z",
    hours: 73,
  },
] as const;

for (const testCase of cases) {
  const range = getGermanLastThreeDaysUnixRange(new Date(testCase.now));
  const expectedFrom = Math.floor(Date.parse(testCase.from) / 1000);
  const expectedTo = Math.floor(Date.parse(testCase.to) / 1000);

  assert.equal(new Date(range.from * 1000).toISOString(), testCase.from, `${testCase.name} start`);
  assert.equal(new Date(range.to * 1000).toISOString(), testCase.to, `${testCase.name} end`);
  assert.equal(range.from, expectedFrom, `${testCase.name} start Unix timestamp`);
  assert.equal(range.to, expectedTo, `${testCase.name} end Unix timestamp`);
  assert.ok(range.from < range.to, `${testCase.name} must have from < to`);
  assert.equal(range.to - range.from, testCase.hours * 60 * 60, `${testCase.name} duration`);

  const includes = (timestamp: number) => timestamp >= range.from && timestamp < range.to;
  assert.equal(includes(range.from), true, `${testCase.name} includes its start`);
  assert.equal(includes(range.to - 1), true, `${testCase.name} includes the final second`);
  assert.equal(includes(range.to), false, `${testCase.name} excludes its end`);
}

console.log("Last-three-days date range tests passed.");
