import assert from "node:assert/strict";
import {
  extractBasicDetailFromHtml,
  extractNetServerTenderTitle,
  extractPublicPortalFacts,
} from "@/lib/public-tender-scraper";
import { deduplicateParsedDocuments } from "@/lib/document-aggregation";
import { extractStructuredData, normalizeStructured } from "@/lib/structurer";
import { normalizePublicDisplayCandidate } from "@/lib/public-content-quality";
import { buildTenderIndexDocument } from "@/lib/meilisearch";

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
  assert.equal(repaired.summary, "");
  assert.equal(repaired.hard_facts.buyer, "Stadt Coburg");
  assert.equal(repaired.procurement.procedure_type, "Öffentliche Ausschreibung (VOB)");
  assert.doesNotMatch(repaired.descriptionMarkdown ?? "", /service\.bund|haupt-navigations/i);
  assert.equal(normalizePublicDisplayCandidate("## Kurzinfo"), null);
  assert.equal(normalizePublicDisplayCandidate("Verfahrensart: Offenes Verfahren"), null);
  assert.equal(normalizePublicDisplayCandidate("sart"), null);
  assert.equal(normalizePublicDisplayCandidate("vergessen?"), null);
  assert.equal(normalizePublicDisplayCandidate("n, den gesetzlichen Vertreter sowie die Kontaktdaten dieser Unternehmen anzugeben"), null);
  assert.equal(normalizePublicDisplayCandidate("[ROLLEN: bekanntmachung] [ROLLE: bekanntmachung] [DOKUMENT-ID: 51568]"), null);
  assert.equal(normalizePublicDisplayCandidate("Formular — Auftragsbekanntmachung ..."), null);
  assert.equal(normalizePublicDisplayCandidate("Formular 121 — Auftragsbekanntmachung DE 5"), null);
  assert.equal(normalizePublicDisplayCandidate("Formular Nr. 121: Auftragsbekanntmachung"), null);
  assert.equal(normalizePublicDisplayCandidate("Formular 121 Auftragsbekanntmachung"), null);
  assert.equal(normalizePublicDisplayCandidate("Das Formular 121 beschreibt die Auftragsbekanntmachung für das Verfahren."), "Das Formular 121 beschreibt die Auftragsbekanntmachung für das Verfahren.");
  assert.equal(normalizePublicDisplayCandidate("... Dienstleistungen ## CPV-Codes ..."), null);
  assert.equal(normalizePublicDisplayCandidate("Stadtverwaltung Coburg"), "Stadtverwaltung Coburg");
  assert.match(repaired.commercialBrief?.rationale ?? "", /Stadt Coburg|Itzgrund|14\.08\.2026/);

  const malformed = normalizeStructured({
    title: "Beschaffung eines Dienstes",
    summary: "Dokumentierter Leistungsumfang",
    hard_facts: { deadline: null, budget: null, location: null, buyer: "Stadt Coburg", contract_type: null },
    decision_relevant: {
      scope: "Einzelner Leistungsumfang",
      requirements: "Nachweis einer Referenz",
      mandatory_documents: { value: "Formblatt" },
      award_criteria: "Preis",
    },
    procurement: {
      contract_value: null,
      contract_duration: "12 Monate",
      participation_requirements: "Zertifizierung",
      award_criteria_detailed: { criterion: "Qualität", weight: 40 },
      cpv_codes: "90910000",
      procedure_type: "offen",
    },
    confidence: 0.5,
  }, "Beschaffung eines Dienstes");
  assert.deepEqual(malformed.decision_relevant.scope, ["Einzelner Leistungsumfang"]);
  assert.deepEqual(malformed.decision_relevant.requirements, ["Nachweis einer Referenz"]);
  assert.deepEqual(malformed.decision_relevant.mandatory_documents, []);
  assert.deepEqual(malformed.procurement.participation_requirements, ["Zertifizierung"]);
  assert.deepEqual(malformed.procurement.cpv_codes, ["90910000"]);
  assert.deepEqual(malformed.procurement.award_criteria_detailed, [{ criterion: "Qualität", weight: 40 }]);

  const structuredFallback = normalizeStructured({
    title,
    summary: "- Verfahren - - - Lose - Ergebnisse - Verträge - - - -",
    hard_facts: {},
    decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
    procurement: {},
  }, title, { scope: "Dokumentierter Leistungsumfang" });
  assert.equal(structuredFallback.summary, "Dokumentierter Leistungsumfang");

  const invalidFirstStructured = await extractStructuredData(
    "Erneuerung der Energiezentrale in Bautzen",
    [
      "Öffentlicher Auftraggeber",
      "Anmelden erforderlich, um Zugriff zu erhalten",
      "Öffentlicher Auftraggeber",
      "Stadt Bautzen",
      "Ort der Ausführung",
      "Erneuerung der Energiezentrale in Bautzen",
      "Ort der Ausführung",
      "02625 Bautzen",
    ].join("\n"),
    { useLLM: false },
  );
  assert.equal(invalidFirstStructured.hard_facts.buyer, "Stadt Bautzen");
  assert.equal(invalidFirstStructured.hard_facts.location, "02625 Bautzen");

  const flatFallback = normalizeStructured({ title, description: "", scope: "" }, title);
  assert.deepEqual(flatFallback.decision_relevant.scope, []);

  const flatScope = normalizeStructured({
    title,
    description: "",
    scope: "Dokumentierter Leistungsumfang",
  }, title);
  assert.deepEqual(flatScope.decision_relevant.scope, ["Dokumentierter", "Leistungsumfang"]);

  const titleOnly = await extractStructuredData("Kurzer Ausschreibungstitel", "Kurzer Ausschreibungstitel", { useLLM: false });
  assert.equal(titleOnly.summary, "");

  const indexed = buildTenderIndexDocument({
    id: 42,
    title,
    source: "dtvp",
    sourceKey: "dtvp",
    url: sourceUrl,
    deadlineAt: null,
    firstSeenAt: null,
    category: "Bauarbeiten",
    metadataJson: { description: "- Verfahren - - - Lose - Ergebnisse - Verträge - - - -" },
    structuredJson: { summary: "Strukturierte Leistungsbeschreibung", hard_facts: { location: "67549 Worms" } },
    rawText: "",
    contractValueMax: null,
    slug: null,
    readinessStatus: "pending",
  });
  assert.equal(indexed.description, "Strukturierte Leistungsbeschreibung");

  const indexedLegacyDescription = buildTenderIndexDocument({
    id: 43,
    title,
    source: "dtvp",
    sourceKey: "dtvp",
    url: sourceUrl,
    deadlineAt: null,
    firstSeenAt: null,
    category: "Bauarbeiten",
    metadataJson: { description: "## location" },
    structuredJson: { summary: "## Bekanntmachung", description: "Legacy Leistungsbeschreibung" },
    rawText: "",
    contractValueMax: null,
    slug: null,
    readinessStatus: "pending",
  });
  assert.equal(indexedLegacyDescription.description, "Legacy Leistungsbeschreibung");

  const indexedJsonStrings = buildTenderIndexDocument({
    id: 44,
    title,
    source: "dtvp",
    sourceKey: "dtvp",
    url: sourceUrl,
    deadlineAt: null,
    firstSeenAt: null,
    category: "Bauarbeiten",
    metadataJson: JSON.stringify({ description: "## Bekanntmachung" }),
    structuredJson: JSON.stringify({ summary: "JSON strukturierte Leistungsbeschreibung" }),
    rawText: "",
    contractValueMax: null,
    slug: null,
    readinessStatus: "pending",
  });
  assert.equal(indexedJsonStrings.description, "JSON strukturierte Leistungsbeschreibung");

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
