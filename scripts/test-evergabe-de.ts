import assert from "node:assert/strict";
import { mapEvergabeDeItems, parseTedApiListing } from "../lib/public-tender-scraper";
import { projectPublicDisplayFields } from "../lib/public-content-quality";
import {
  getPublicSourceDefinition,
  inferPublicSourceKey,
  resolvePublicSourceKey,
} from "../lib/public-source-registry";
import { getTenderSourceDefinition } from "../lib/tender-sources";

const futureIso = (days: number): string => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const pastIso = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const item = (overrides: Partial<ImportedEvergabeDeItem> = {}): ImportedEvergabeDeItem => ({
  T_ID: 600124,
  TIDGUID: "a770bc67-c654-41be-8c05-ad6bd4ebebdc",
  Aktenzeichen: null,
  Titel: "100 Lizenzen für Atlassian Jira Service Management Cloud Enterprise Version<br/><small>Öffentliche Ausschreibung</small>",
  VSTName: "ÜSTRA Hannoversche Verkehrsbetriebe Aktiengesellschaft",
  Public_DateStr: pastIso(2),
  Bidding_DateStr: futureIso(8),
  TTLongName: "Öffentliche Ausschreibung",
  POVord: "UVO",
  CPVCodes: null,
  APLZ: "30159",
  ...overrides,
});

type ImportedEvergabeDeItem = {
  T_ID: number;
  TIDGUID: string;
  Aktenzeichen: string | null;
  Titel: string;
  VSTName: string;
  Public_DateStr: string;
  Bidding_DateStr: string;
  TTLongName: string;
  POVord: string;
  CPVCodes: string | null;
  APLZ: string;
};

// Mapping: title cleaning, deadline, client, location, category, identity.
const mapped = mapEvergabeDeItems(
  [
    item(),
    // Bayern tender: same platform, must be excluded.
    item({ T_ID: 555001, Titel: "Software für Busdepot Hannover", APLZ: "30159" }),
    // Duplicate ID (endpoint may ignore startid): must be deduplicated.
    item(),
    // Expired deadline: kept without deadline, not dropped (pipeline filters).
    item({ T_ID: 600999, Titel: "Rahmenvertrag Wartung und Pflege einer Software inklusive Hotline", Bidding_DateStr: pastIso(1) }),
    // Non-IT title falls back to a generic category.
    item({ T_ID: 601001, Titel: "Lieferung von Winterdienstfahrzeugen für das Depot Jena", APLZ: "07745" }),
    // Junk title: skipped.
    item({ T_ID: 601002, Titel: "ab" }),
  ],
  new Set(["555001"]),
);
assert.equal(mapped.length, 3);

const itTender = mapped[0];
assert.equal(itTender.externalId, "600124");
assert.ok(itTender.title.startsWith("100 Lizenzen für Atlassian Jira"), itTender.title);
assert.ok(!itTender.title.includes("<"));
assert.equal(itTender.client, "ÜSTRA Hannoversche Verkehrsbetriebe Aktiengesellschaft");
assert.ok(itTender.deadline && new Date(itTender.deadline) > new Date());
assert.equal(itTender.category, "IT-Dienstleistungen");
assert.equal(itTender.location, "30159");
assert.equal(itTender.source, "evergabe-de");
assert.equal(itTender.sourceUrl, "https://portal.deutsche-evergabe.de/Dashboards/Dashboard_off?BL=#T_ID=600124");

assert.equal(mapped[1].externalId, "600999");
assert.equal(mapped[1].deadline, null);
assert.equal(mapped[1].category, "IT-Dienstleistungen");
assert.equal(mapped[2].category, "Lieferung");

// Beschreibung muss die Pipeline-Validierung überleben: „Feld: Wert“-Ketten
for (const candidate of mapped) {
  const display = projectPublicDisplayFields({
    title: candidate.title,
    client: candidate.client,
    location: candidate.location,
    summary: [candidate.description, candidate.scope],
  });
  assert.ok(
    display.description && display.description.length >= 40,
    `Beschreibung verworfen für "${candidate.title}": ${JSON.stringify(candidate.description)}`,
  );
}
assert.ok(itTender.description.startsWith("Gegenstand der Ausschreibung ist"), itTender.description);
assert.ok(itTender.description.includes("als Öffentliche Ausschreibung"), itTender.description);
const minimal = mapEvergabeDeItems(
  [item({ T_ID: 601555, VSTName: "", Aktenzeichen: null, APLZ: "", TTLongName: "" })],
  new Set(),
);
assert.ok(
  minimal[0]?.description.includes("öffentlichen Vergabeverfahren"),
  minimal[0]?.description,
);

// Registry: aliases, definition and host inference.
assert.equal(resolvePublicSourceKey("deutsche-evergabe"), "evergabe-de");
assert.equal(resolvePublicSourceKey("evergabe-de"), "evergabe-de");
assert.equal(inferPublicSourceKey(null, "https://www.deutsche-evergabe.de/suche"), "evergabe-de");
assert.equal(
  inferPublicSourceKey(null, "https://portal.deutsche-evergabe.de/Dashboards/Dashboard_off?BL=#T_ID=600124"),
  "evergabe-de",
);
assert.equal(getPublicSourceDefinition("evergabe-de")?.label, "deutsche-eVergabe (bundesweit)");
assert.equal(getPublicSourceDefinition("evergabe-de")?.supportsContinuation, true);
assert.equal(getTenderSourceDefinition("deutsche-evergabe.de")?.key, "evergabe-de");

// TED API listing parser: keep valid publication numbers, drop junk, dedupe, carry total.
const tedListing = parseTedApiListing({
  totalNoticeCount: 1832,
  notices: [
    { "publication-number": "123456-2026" },
    { "publication-number": "123456-2026" },
    { "publication-number": "not-a-number" },
    { "publication-number": "" },
    {},
    { "publication-number": " 789012-2026 " },
  ],
});
assert.deepEqual(tedListing.ids, ["123456-2026", "789012-2026"]);
assert.equal(tedListing.total, 1832);

console.log("test-evergabe-de: alle Pruefungen bestanden");
