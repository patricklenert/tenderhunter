import { computeScores } from "../lib/scoring";
import type { StructuredData } from "../lib/structurer";

const company = {
  capabilities_json: JSON.stringify([
    "Gartenbau", "Landschaftsbau", "Galabau", "Zaunbau", "Pflasterarbeiten", "Transporte",
  ]),
  certifications_json: "[]",
  regions_json: JSON.stringify(["Pirmasens", "Rheinland-Pfalz", "Deutschland"]),
  team_size: null,
  industry: "Garten- und Landschaftsbau",
};

const structured = (scope: string, location = "Rheinland-Pfalz"): StructuredData => ({
  title: scope,
  summary: scope,
  confidence: 0.9,
  hard_facts: { location, deadline: null, budget: null, buyer: null, contract_type: null },
  decision_relevant: { scope: [scope], requirements: [], mandatory_documents: [], award_criteria: [] },
  procurement: { contract_value: { min: null, max: null, currency: "EUR" }, contract_duration: { months: null, renewal: false }, award_criteria_detailed: [], participation_requirements: [], cpv_codes: [], procedure_type: "offen" },
});

const relevant = computeScores("Grün- und Außenanlagenpflege mit Zaunbau", structured("Pflege von Grünanlagen, Außenanlagen und Winterdienst"), company, 0.85);
const unrelated = computeScores("Softwareentwicklung und Cybersecurity", structured("Entwicklung einer digitalen Plattform und IT-Betrieb", "Bayern"), company, 0.9);

if (relevant.fit <= unrelated.fit || relevant.fit < 45 || unrelated.fit > 25) {
  throw new Error(`Scoring-Regressionsfehler: relevant=${relevant.fit}, unrelated=${unrelated.fit}`);
}

console.log(`Scoring: relevant=${relevant.fit}, unrelated=${unrelated.fit} OK`);
