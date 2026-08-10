import assert from "node:assert/strict";
import {
  extractBasicDetailFromHtml,
  extractNetServerTenderTitle,
  extractPublicPortalFacts,
} from "@/lib/public-tender-scraper";
import { deduplicateParsedDocuments } from "@/lib/document-aggregation";
import { extractStructuredData, normalizeStructured } from "@/lib/structurer";

const sourceUrl = "https://vergabe.vmstart.de/NetServer/PublicationControllerServlet?function=Detail";
const title = "Heinrich-Völker-Bad - Bestandsbadehalle - Raumlufttechnische Anlagen 79-2026";
const rawText = [
  "AI Vergabeplattform - Administration Intelligence AG",
  "## Bekanntmachung",
  `## ${title}`,
  "a) Öffentlicher Auftraggeber (Vergabestelle)",
  "Name und Anschrift:",
  "Stadtverwaltung Worms, Abt. 6.4 Zentrale Ausschreibungsstelle und Dienste",
  "b) Vergabeverfahren:",
  "&Ouml;ffentliche Ausschreibung, VOB/A",
  "e) Ort der Ausführung",
  "67549 Worms, Alzeyer Strasse 111",
  "f) Art und Umfang der Leistung, ggf. aufgeteilt nach Losen",
  "Art der Leistung:",
  "Raumlufttechnische Anlagen",
  "Umfang der Leistung:",
  "Aufstellen eines neuen L&uuml;ftungsger&auml;tes im Au&szlig;enbereich vor der Schwimmhalle.",
  "h) Aufteilung in Lose",
  "Vergabe nach Losen",
  "Nein",
  "w) Beurteilung der Eignung",
  "Pr&auml;qualifizierte Unternehmen f&uuml;hren den Nachweis gem&auml;&szlig; &sect; 6a VOB/A.",
  "r) Zuschlagskriterien",
  "Niedrigster Preis",
].join("\n");

const main = async (): Promise<void> => {
  assert.equal(extractNetServerTenderTitle(rawText), title);

  const structured = await extractStructuredData(title, rawText, { useLLM: false });
  assert.equal(structured.hard_facts.buyer, "Stadtverwaltung Worms, Abt. 6.4 Zentrale Ausschreibungsstelle und Dienste");
  assert.ok(structured.decision_relevant.scope.some((value) => value.includes("Lüftungsgerät")));
  assert.ok(structured.decision_relevant.scope.every((value) => !value.includes("Vergabe nach Losen")));
  assert.match(structured.summary, /Lüftungsgerät/);
  assert.doesNotMatch(structured.summary, /AI Vergabeplattform/);
  assert.doesNotMatch(structured.descriptionMarkdown ?? "", /&(?:uuml|Ouml|szlig|sect);/);

  const facts = extractPublicPortalFacts(rawText);
  assert.equal(facts.client, "Stadtverwaltung Worms, Abt. 6.4 Zentrale Ausschreibungsstelle und Dienste");
  assert.equal(facts.procedure, "Öffentliche Ausschreibung, VOB/A");

  const repaired = normalizeStructured({
    title: "ZV - Itzgrund - Generalsanierung Kl&#228;ranlage Itzgrund - Bauarbeiten",
    summary: "SERVICE.BUND.DE - Aktuelle Ausschreibungen Haupt-Navigations-Menü Meta-Navigation Andere Ausschreibungen im Bereich",
    decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
    hard_facts: { deadline: null, budget: null, location: null, buyer: null, contract_type: null },
    procurement: { contract_value: { min: null, max: null, currency: "EUR" }, contract_duration: { months: null, renewal: false }, award_criteria_detailed: [], participation_requirements: [], cpv_codes: [], procedure_type: "offen" },
    confidence: 0.4,
  }, "ZV - Itzgrund - Generalsanierung Kläranlage Itzgrund - Bauarbeiten", {
    buyer: "Stadt Coburg",
    procedure: "Öffentliche Ausschreibung (VOB)",
    deadline: "14.08.2026",
    location: "96274 Itzgrund Bayern",
  });
  assert.equal(repaired.summary, "ZV - Itzgrund - Generalsanierung Kläranlage Itzgrund - Bauarbeiten");
  assert.equal(repaired.hard_facts.buyer, "Stadt Coburg");
  assert.equal(repaired.procurement.procedure_type, "Öffentliche Ausschreibung (VOB)");
  assert.doesNotMatch(repaired.descriptionMarkdown ?? "", /service\.bund|haupt-navigations/i);
  assert.match(repaired.commercialBrief?.rationale ?? "", /Stadt Coburg|Itzgrund|14\.08\.2026/);

  const documents = [
    { id: 1, role: "leistungsbeschreibung" as const, roles: ["leistungsbeschreibung" as const], text: rawText },
    { id: 2, role: "leistungsbeschreibung" as const, roles: ["leistungsbeschreibung" as const], text: rawText },
    { id: 3, role: "eignung" as const, roles: ["eignung" as const], text: `${rawText}\nZusätzliche Referenz` },
  ];
  assert.deepEqual(deduplicateParsedDocuments(documents).map((document) => document.id), [1, 3]);

  const html = `<html><head><title>AI Vergabeplattform - Administration Intelligence AG</title></head><body>
    <h1>AI Vergabeplattform - Administration Intelligence AG</h1>
    <h2>Bekanntmachung</h2><h2>${title}</h2>
    <h3>a) Öffentlicher Auftraggeber (Vergabestelle)</h3>
    <p>Name und Anschrift:</p><p>Stadtverwaltung Worms, Abt. 6.4 Zentrale Ausschreibungsstelle und Dienste</p>
    <p>e) Ort der Ausführung</p><p>67549 Worms, Alzeyer Strasse 111</p>
  </body></html>`;
  const basic = extractBasicDetailFromHtml(html, sourceUrl, "rhein-neckar", [], true);
  assert.ok(basic);
  assert.equal(basic.title, title);
  assert.equal(basic.client, "Stadtverwaltung Worms, Abt. 6.4 Zentrale Ausschreibungsstelle und Dienste");

  console.log("Tender-content quality tests passed.");
};

void main();
