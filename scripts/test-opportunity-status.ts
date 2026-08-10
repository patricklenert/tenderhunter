import assert from "node:assert/strict";
import { classifyOpportunityStatus } from "../lib/opportunity-status";

const dwiRawFixture = [
  "DWI Deutsches Weininstitut GmbH",
  "Bekanntmachung vergebener Auftr\u00e4ge",
  "Gegenstand des Auftrags: Kommunikationsleistungen.",
  "Der Auftrag wurde bereits vergeben.",
].join("\n");

const dwiStatus = classifyOpportunityStatus("DWI Kommunikationsleistungen", dwiRawFixture);
assert.equal(dwiStatus.isAwarded, true, "DWI award notice must be classified as awarded");
assert.match(dwiStatus.reason, /Bekanntmachung vergebener Auftraege/);

const awardedVariants = [
  {
    name: "ASCII award notice",
    title: "Bekanntmachung vergebener Auftraege",
    rawText: "Auftraggeber: Stadt Musterstadt",
  },
  {
    name: "ex-post notice",
    title: "Ex-post-Bekanntmachung",
    rawText: "Vergabestelle: Stadt Musterstadt",
  },
  {
    name: "already awarded contract",
    title: "Kommunikationsleistungen",
    rawText: "Der Auftrag wurde bereits vergeben.",
  },
  {
    name: "award issued",
    title: "Kommunikationsleistungen",
    rawText: "Status: Zuschlag erteilt am 15.06.2026.",
  },
  {
    name: "contract assigned",
    title: "Kommunikationsleistungen",
    rawText: "Auftrag vergeben an: Muster GmbH.",
  },
];

for (const fixture of awardedVariants) {
  const status = classifyOpportunityStatus(fixture.title, fixture.rawText);
  assert.equal(status.isAwarded, true, `${fixture.name} must be classified as awarded`);
  assert.notEqual(status.reason, "", `${fixture.name} must provide a reason`);
}

const activeTenderStatus = classifyOpportunityStatus(
  "Offene Ausschreibung fuer Kommunikationsleistungen",
  [
    "Bekanntmachung",
    "Auftraggeber: Stadt Musterstadt",
    "Angebotsfrist: 31.12.2099 12:00 Uhr",
    "Die Entscheidung, welchem Bieter der Zuschlag erteilt wird, erfolgt nach den Zuschlagskriterien.",
    "Den Zuschlag erteilt der Auftraggeber dem wirtschaftlichsten Angebot.",
    "Der Auftrag wird an den wirtschaftlichsten Bieter vergeben.",
  ].join("\n"),
);
assert.equal(activeTenderStatus.isAwarded, false, "active tender wording must not be classified as awarded");
assert.match(activeTenderStatus.reason, /Kein belastbarer Hinweis/);

console.log("Opportunity-status tests passed.");
