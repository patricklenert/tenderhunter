import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatDeadlineDE, getDeadlineState, parseDeadlineDate } from "@/lib/date-utils";
import {
  buildProfileSummary,
  PUBLIC_PROFILE_FALLBACK_CANDIDATE_LIMIT,
  sortProfileTenders,
  truncateProfileText,
  type ProfileTender,
} from "@/lib/public-profile";

const now = new Date("2026-08-06T12:00:00.000Z");

assert.equal(PUBLIC_PROFILE_FALLBACK_CANDIDATE_LIMIT, 250);

const profilePage = readFileSync("app/p/[slug]/page.tsx", "utf8");
const profileHeader = readFileSync("components/profile/CompanyProfileHeader.tsx", "utf8");
assert.match(profileHeader, /component="h1"/, "public profile heading must remain server-rendered independently of tender results");
assert.ok(profilePage.indexOf("<CompanyProfileHeader") < profilePage.indexOf("<Suspense"), "profile identity must render before slow tender matching suspends");
assert.match(profilePage, /<Suspense[\s\S]*?<PublicProfileMatches company=\{company\} \/>/, "tender matching must be isolated behind a streaming boundary");
assert.doesNotMatch(profilePage, /findPublicProfileMatches/, "slow tender match queries must not block the profile shell");

assert.equal(getDeadlineState("05.08.2026", now), "expired");
assert.equal(getDeadlineState("07.08.2026", now), "current");
assert.equal(getDeadlineState(null, now), "missing");
assert.equal(parseDeadlineDate("31.12.2026, 10:00 Uhr")?.toISOString(), "2026-12-31T09:00:00.000Z");
assert.equal(formatDeadlineDE("2026-08-07T08:00:00.000Z"), "07.08.2026");

const tenders: ProfileTender[] = [
  {
    id: 1,
    title: "Gartenbau Berlin",
    description: "",
    location: "Berlin",
    volume: null,
    deadlineAt: "2026-08-20T10:00:00.000Z",
    deadlineDays: 14,
    deadlineState: "current",
    fit: 82,
    winProbability: 70,
    slug: "gartenbau-berlin",
  },
  {
    id: 2,
    title: "Pflege München",
    description: "",
    location: "München",
    volume: null,
    deadlineAt: "2026-08-25T10:00:00.000Z",
    deadlineDays: 19,
    deadlineState: "current",
    fit: 55,
    winProbability: 60,
    slug: "pflege-muenchen",
  },
  {
    id: 3,
    title: "Außenanlagen",
    description: "",
    location: null,
    volume: null,
    deadlineAt: null,
    deadlineDays: null,
    deadlineState: "missing",
    fit: 30,
    winProbability: 40,
    slug: "aussenanlagen",
  },
  {
    id: 4,
    title: "Alte Ausschreibung",
    description: "",
    location: "Hamburg",
    volume: null,
    deadlineAt: "2026-07-20T10:00:00.000Z",
    deadlineDays: -17,
    deadlineState: "expired",
    fit: 92,
    winProbability: 90,
    slug: "alte-ausschreibung",
  },
];

assert.deepEqual(sortProfileTenders(tenders).map((tender) => tender.id), [1, 2, 3, 4]);

const summary = buildProfileSummary(tenders, ["Gartenbau", "Gartenbau", "Pflege"], ["Deutschland"]);
assert.equal(summary.currentCount, 3);
assert.equal(summary.expiredCount, 1);
assert.deepEqual(summary.fitDistribution, { high: 1, medium: 1, low: 1 });
assert.deepEqual(summary.resultRegions, [
  { label: "Berlin", count: 1 },
  { label: "München", count: 1 },
  { label: "Region nicht angegeben", count: 1 },
]);
assert.deepEqual(summary.relevantCapabilities, ["Gartenbau", "Pflege"]);
assert.equal(truncateProfileText("Ein sehr langer Beschreibungstext mit vielen Details zur Ausschreibung und zum Leistungsumfang.", 45), "Ein sehr langer Beschreibungstext mit vielen…");

console.log("Public profile helpers passed.");
