import assert from "node:assert/strict";
import { deriveBundesland } from "@/lib/bundesland";
import { computeScores } from "@/lib/scoring";
import { normalizeStructured, type StructuredData } from "@/lib/structurer";
import type { CompanyRow } from "@/lib/scoring";
import { fallbackCompanyProfile } from "@/lib/perplexity";

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
const publicUnknownTenderLocation = computeScores(
  "Pflege von Grünanlagen",
  structured("Pflege von Grünanlagen", "", ["77310000-6"]),
  landscapingCompany,
  1,
  { allowUnknownTenderLocation: true },
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

const propertyCompany: CompanyRow = {
  capabilities_json: JSON.stringify(["Immobilienverwaltung"]),
  certifications_json: "[]",
  regions_json: JSON.stringify(["Deutschland"]),
  team_size: null,
  industry: "Immobilienverwaltung",
};
const propertyTender = computeScores(
  "Verwaltung städtischer Wohnungen",
  structured("Liegenschaftsverwaltung und Mietverwaltung", "Moers", ["70330000-3"]),
  propertyCompany,
  undefined,
  { bundesland: "Nordrhein-Westfalen", city: "Moers" },
);
const cleaningTenderForPropertyCompany = computeScores(
  "Gebäudereinigung von Gemeinschaftsunterkünften",
  structured("Unterhaltsreinigung und Glasreinigung", "Moers", ["90910000-9"]),
  propertyCompany,
  undefined,
  { bundesland: "Nordrhein-Westfalen", city: "Moers" },
);
const propertyBuyerConstructionTender = computeScores(
  "Bayreuth, Casselmannstraße 6, 330-Sonnenschutz",
  normalizeStructured({
    title: "Bayreuth, Casselmannstraße 6, 330-Sonnenschutz",
    summary: "Vergabestelle BA - Gebäude-, Bau- und Immobilienmanagement GmbH",
    description: "Ausschreibung für Bauleistungen im Zusammenhang mit Sonnenschutz.",
    confidence: 0.8,
    hard_facts: { location: "95444 Bayreuth", deadline: null, budget: null, buyer: null, contract_type: "bau" },
    decision_relevant: { scope: ["Bauleistungen", "Sonnenschutzsysteme"], requirements: [], mandatory_documents: [], award_criteria: [] },
    procurement: {
      contract_value: { min: null, max: null, currency: "EUR" },
      contract_duration: { months: null, renewal: false },
      award_criteria_detailed: [],
      participation_requirements: [],
      cpv_codes: [],
      procedure_type: "offen",
    },
  }, "Bayreuth, Casselmannstraße 6, 330-Sonnenschutz"),
  propertyCompany,
  undefined,
  { allowUnknownTenderLocation: true },
);
const misclassifiedCpvConstructionTender = computeScores(
  "Fruchtkasten - Fassadenlamellen Holz",
  normalizeStructured({
    title: "Fruchtkasten - Fassadenlamellen Holz",
    summary: "Fassadenarbeiten aus Holz, CPV 45443000-4",
    description: "Bekanntmachung einer geplanten Vergabe für Fassadenarbeiten (CPV 45443000-4).",
    confidence: 0.8,
    hard_facts: { location: "Herrenberg", deadline: null, budget: null, buyer: null, contract_type: "bau" },
    decision_relevant: { scope: ["Unterkonstruktion aus Stahl", "Fassadenlamellen aus Holz"], requirements: [], mandatory_documents: [], award_criteria: [] },
    procurement: {
      contract_value: { min: null, max: null, currency: "EUR" },
      contract_duration: { months: null, renewal: false },
      award_criteria_detailed: [],
      participation_requirements: [],
      cpv_codes: ["70329240"],
      procedure_type: "beschränkt",
    },
  }, "Fruchtkasten - Fassadenlamellen Holz"),
  propertyCompany,
  undefined,
  { allowUnknownTenderLocation: true },
);
const fallbackProfile = fallbackCompanyProfile(
  "<html><title>Immobilienmakler Moers | Selektive</title><meta name=\"description\" content=\"Immobilienvermittlung und Betreuung von Eigentümern in Moers.\"><body>Hinweise zur Reinigung der Seite finden Sie im Footer.</body></html>",
  "https://www.selektive.de/unternehmen/standorte/immobilienmakler-moers",
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
assert.equal(publicUnknownTenderLocation.kill_switch, false);
assert.ok(publicUnknownTenderLocation.fit > 10, `publicUnknown=${publicUnknownTenderLocation.fit}`);
assert.equal(publicUnknownTenderLocation.details.location_status, "tender_location_unknown");
assert.equal(unknownCompanyLocation.fit, 0);
assert.equal(unknownCompanyLocation.details.location_status, "company_location_unknown");
assert.equal(nationwideCompany.details.location_status, "match");
assert.ok(nationwideCompany.fit > 0, `nationwide=${nationwideCompany.fit}`);
assert.equal(propertyTender.details.domain_status, "match");
assert.equal(propertyTender.kill_switch, false);
assert.ok(propertyTender.fit > 0, `property=${propertyTender.fit}`);
assert.equal(cleaningTenderForPropertyCompany.fit, 0);
assert.equal(cleaningTenderForPropertyCompany.details.domain_status, "mismatch");
assert.equal(propertyBuyerConstructionTender.fit, 0);
assert.notEqual(propertyBuyerConstructionTender.details.domain_status, "match");
assert.equal(misclassifiedCpvConstructionTender.fit, 0);
assert.notEqual(misclassifiedCpvConstructionTender.details.domain_status, "match");
assert.equal(fallbackProfile.industry, "Immobilienverwaltung");
assert.deepEqual(fallbackProfile.capabilities, ["Immobilienverwaltung"]);

assert.deepEqual(portalDump.decision_relevant.scope, []);
assert.equal(portalDump.summary, "");

assert.equal(deriveBundesland("81929"), "Bayern");
assert.equal(deriveBundesland("12099"), "Berlin");
assert.equal(deriveBundesland("Ausführungsort: 12627 Berlin"), "Berlin");

console.log(`Scoring: local=${localTender.fit}, domain and location hard gates OK`);
