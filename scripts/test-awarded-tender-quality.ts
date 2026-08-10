import assert from "node:assert/strict";
import { assessTenderQuality } from "@/lib/tender-quality";
import type { StructuredData } from "@/lib/structurer";

const structured: StructuredData = {
  title: "IT Security Awareness",
  summary: "Lernplattform für IT Security Awareness und virtuelle Schulungen.",
  confidence: 0.9,
  hard_facts: { deadline: "31.12.2099", budget: null, location: "Berlin", buyer: "DWI", contract_type: "dienstleistung" },
  decision_relevant: { scope: ["Lernplattform und virtuelle Schulungen"], requirements: [], award_criteria: [], mandatory_documents: [] },
  procurement: { contract_value: { min: null, max: null, currency: "EUR" }, contract_duration: { months: null, renewal: false }, award_criteria_detailed: [], participation_requirements: [], cpv_codes: [], procedure_type: "offen" },
};

const awarded = assessTenderQuality(
  "DWI_2026_004: IT Security Awareness",
  "https://evergabe.nrw.de/example",
  "Bekanntmachung vergebener Aufträge nach UVgO § 30 Abs. 1. Auftrag vergeben an SoSafe SE.",
  structured,
);
assert.equal(awarded.status, "rejected");
assert.match(awarded.reason, /vergebener Auftrag/i);

const active = assessTenderQuality(
  "IT Security Awareness",
  "https://evergabe.nrw.de/example",
  "Öffentliche Ausschreibung für eine Lernplattform. Angebotsfrist 31.12.2099. Vergabeunterlagen und Leistungsbeschreibung liegen vor.",
  structured,
);
assert.equal(active.status, "qualified");

console.log("Awarded tender quality tests passed.");
