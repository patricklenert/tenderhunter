import assert from "node:assert/strict";
import { deriveBundesland } from "@/lib/bundesland";
import { computeScores } from "@/lib/scoring";
import { normalizeStructured, type StructuredData } from "@/lib/structurer";
import type { CompanyRow } from "@/lib/scoring";

const landscapingCompany: CompanyRow = {
  capabilities_json: JSON.stringify([
    "Garten- und Landschaftsbau",
    "Planung von Außenanlagen",
    "Umsetzung von Außenanlagen",
  ]),
  certifications_json: "[]",
  regions_json: JSON.stringify(["Ruhrgebiet"]),
  team_size: null,
  industry: "Garten- und Landschaftsbau",
};

const structured = (scope: string, location = "", cpvCodes: string[] = []): StructuredData => ({
  title: scope,
  summary: scope,
  confidence: 0.9,
  hard_facts: { location, deadline: null, budget: null, buyer: null, contract_type: null },
  decision_relevant: { scope: [scope], requirements: [], mandatory_documents: [], award_criteria: [] },
  procurement: {
    contract_value: { min: null, max: null, currency: "EUR" },
    contract_duration: { months: null, renewal: false },
    award_criteria_detailed: [],
    participation_requirements: [],
    cpv_codes: cpvCodes,
    procedure_type: "offen",
  },
});

const localTender = computeScores(
  "Freianlagenpflege und Landschaftsbau in Dortmund",
  structured("Pflege von Grünanlagen, Außenanlagen und Winterdienst", "Dortmund", ["77310000-6"]),
  landscapingCompany,
  0.85,
  { bundesland: "Nordrhein-Westfalen", city: "Dortmund" },
);
const unrelatedTender = computeScores(
  "Softwareentwicklung und Cybersecurity",
  structured("Entwicklung einer digitalen Plattform und IT-Betrieb", "Dortmund", ["72200000-7"]),
  landscapingCompany,
  1,
  { bundesland: "Nordrhein-Westfalen", city: "Dortmund" },
);
const educationTender = computeScores(
  "Bildungsleistung: Seminare für Führungskräfte",
  structured("Bekanntmachung der Landeshauptstadt. Gartenstraße 194. Unterlagen und Leistung abrufen.", "Münster", ["80400000-8"]),
  landscapingCompany,
  1,
  { bundesland: "Nordrhein-Westfalen", city: "Münster" },
);
const paramedicTender = computeScores(
  "Heimatnahe Ausbildung zur/zum Notfallsanitäter*in 2026",
  structured("Landeshauptstadt Düsseldorf, Unterlagen zur Leistung", "Düsseldorf", ["80500000-9"]),
  landscapingCompany,
  1,
  { bundesland: "Nordrhein-Westfalen", city: "Düsseldorf" },
);
const streetOnlyTender = computeScores(
  "Unklare Dienstleistung",
  structured("Vergabestelle: Gartenstraße 194", "Dortmund"),
  landscapingCompany,
  1,
  { bundesland: "Nordrhein-Westfalen", city: "Dortmund" },
);
const bavariaTender = computeScores(
  "Freianlagenplanung Schulcampus Johanneskirchen",
  structured("Planung von Außenanlagen", "81929", ["45112700-2"]),
  landscapingCompany,
  1,
  { metadataLocation: "81929" },
);
const berlinTender = computeScores(
  "Rahmenvereinbarung für Landschaftsbauarbeiten",
  structured("Ausführungsort: 12627 Berlin", "12627 Berlin", ["77310000-6"]),
  landscapingCompany,
  1,
  { structuredLocation: "Ausführungsort: 12627 Berlin" },
);
const unknownTenderLocation = computeScores(
  "Pflege von Grünanlagen",
  structured("Pflege von Grünanlagen", "", ["77310000-6"]),
  landscapingCompany,
  1,
);
const unknownCompanyLocation = computeScores(
  "Pflege von Grünanlagen",
  structured("Pflege von Grünanlagen", "Dortmund", ["77310000-6"]),
  { ...landscapingCompany, regions_json: "[]" },
  1,
  { bundesland: "Nordrhein-Westfalen", city: "Dortmund" },
);
const nationwideCompany = computeScores(
  "Pflege von Grünanlagen",
  structured("Pflege von Grünanlagen", "81929", ["77310000-6"]),
  { ...landscapingCompany, regions_json: JSON.stringify(["Deutschland"]) },
  1,
  { metadataLocation: "81929" },
);

const portalDump = normalizeStructured({
  title: "Ausbildung",
  summary: "Bekanntmachung Vergabeplattform Postanschrift Impressum Internetadresse",
  decision_relevant: {
    scope: ["Bekanntmachung Vergabeplattform Postanschrift Impressum Internetadresse Gartenstraße 194"],
    requirements: [],
    mandatory_documents: [],
    award_criteria: [],
  },
  hard_facts: { location: null, deadline: null, budget: null, buyer: null, contract_type: null },
  procurement: { contract_value: { min: null, max: null, currency: "EUR" }, contract_duration: { months: null, renewal: false }, award_criteria_detailed: [], participation_requirements: [], cpv_codes: [], procedure_type: "offen" },
}, "Ausbildung");

assert.ok(localTender.fit >= 45, `local=${localTender.fit}`);
assert.equal(localTender.kill_switch, false);
assert.equal(localTender.details.domain_status, "match");
assert.equal(localTender.requirement_coverage, 0, "Missing requirements must not receive a derived score.");

for (const score of [unrelatedTender, educationTender, paramedicTender]) {
  assert.equal(score.fit, 0);
  assert.equal(score.win_probability, 0);
  assert.equal(score.kill_switch, true);
  assert.equal(score.details.domain_status, "mismatch");
}

assert.equal(streetOnlyTender.fit, 0);
assert.equal(streetOnlyTender.details.domain_status, "domain_unknown");

for (const score of [bavariaTender, berlinTender]) {
  assert.equal(score.fit, 0);
  assert.equal(score.win_probability, 0);
  assert.equal(score.kill_switch, true);
  assert.equal(score.details.location_status, "mismatch");
}
assert.equal(bavariaTender.details.tender_bundesland, "Bayern");
assert.equal(berlinTender.details.tender_bundesland, "Berlin");

assert.equal(unknownTenderLocation.fit, 0);
assert.equal(unknownTenderLocation.details.location_status, "tender_location_unknown");
assert.equal(unknownCompanyLocation.fit, 0);
assert.equal(unknownCompanyLocation.details.location_status, "company_location_unknown");
assert.equal(nationwideCompany.details.location_status, "match");
assert.ok(nationwideCompany.fit > 0, `nationwide=${nationwideCompany.fit}`);

assert.deepEqual(portalDump.decision_relevant.scope, []);
assert.equal(portalDump.summary, "Ausbildung");

assert.equal(deriveBundesland("81929"), "Bayern");
assert.equal(deriveBundesland("12099"), "Berlin");
assert.equal(deriveBundesland("Ausführungsort: 12627 Berlin"), "Berlin");

console.log(`Scoring: local=${localTender.fit}, domain and location hard gates OK`);
