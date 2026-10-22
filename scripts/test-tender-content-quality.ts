import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractBasicDetailFromHtml,
  extractNetServerTenderTitle,
  extractPublicPortalFacts,
  withDescriptionMarkdown,
} from "@/lib/public-tender-scraper";
import { deduplicateParsedDocuments } from "@/lib/document-aggregation";
import { extractStructuredData, groundLLMExtractionAgainstSource, normalizeStructured } from "@/lib/structurer";
import {
  normalizePublicDisplayCandidate,
  normalizePublicTextList,
  pickValidatedPublicCandidate,
  projectPublicTenderRecord,
} from "@/lib/public-content-quality";
import { buildTenderIndexDocument, getStaleIds, projectTenderSearchHit } from "@/lib/meilisearch";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { projectHomeTenderTitle } from "@/components/seo/HomeTenderList";

const sourceUrl = "https://vergabe.vmstart.de/NetServer/PublicationControllerServlet?function=Detail";
const title = "Heinrich-Völker-Bad - Bestandsbadehalle - Raumlufttechnische Anlagen 79-2026";
const portalSupportWall = [
  "Registrierung oder Anmeldung erforderlich;",
  "Sofern größere Datenmengen verwendet werden sollen muss sich der Benutzer innerhalb der Servicezeiten an den Support der Betreiberin wenden.",
  "Ein Anspruch auf die Verwendung größere Datenmengen besteht jedoch nicht.",
].join(" ");
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
  const procurementEvidence = [
    "Geschätzter Auftragswert: 250.000 EUR",
    "Laufzeit: 12 Monate",
    "Zuschlagskriterien: Preis 70 %",
    "Teilnahmevoraussetzung: Nachweis von drei vergleichbaren Referenzen",
    "CPV-Code: 90910000-7",
    "Verfahrensart: Offenes Verfahren",
  ].join(". ");
  const commercialBrief = { action: "verify", headline: "Unverändert", rationale: "Unverändert", nextAction: "Unverändert" };
  const sourceBackedLlm = groundLLMExtractionAgainstSource({
    contract_value: { min: null, max: 250_000, currency: "EUR" },
    contract_duration_months: 12,
    contract_duration_renewal: false,
    award_criteria: [{ criterion: "Preis", weight: 70 }],
    participation_requirements: ["Nachweis von drei vergleichbaren Referenzen"],
    cpv_codes: ["90910000-7"],
    procedure_type: "offen",
    commercial_brief: commercialBrief,
  }, procurementEvidence);
  assert.deepEqual(sourceBackedLlm.contract_value, { min: null, max: 250_000, currency: "EUR" });
  assert.equal(sourceBackedLlm.contract_duration_months, 12);
  assert.deepEqual(sourceBackedLlm.award_criteria, [{ criterion: "Preis", weight: 70 }]);
  assert.deepEqual(sourceBackedLlm.participation_requirements, ["Nachweis von drei vergleichbaren Referenzen"]);
  assert.deepEqual(sourceBackedLlm.cpv_codes, ["90910000-7"]);
  assert.equal(sourceBackedLlm.procedure_type, "offen");
  assert.equal(sourceBackedLlm.commercial_brief, commercialBrief);

  const artifactLlm = groundLLMExtractionAgainstSource({
    contract_value: { min: null, max: null, currency: "EUR" },
    contract_duration_months: null,
    contract_duration_renewal: false,
    award_criteria: [{ criterion: "Meta-Navigation", weight: null }],
    participation_requirements: ["Anmelden erforderlich, um Zugriff zu erhalten"],
    cpv_codes: [],
    procedure_type: "",
    commercial_brief: commercialBrief,
  }, "Zuschlagskriterien: Meta-Navigation\nTeilnahmevoraussetzung: Anmelden erforderlich, um Zugriff zu erhalten");
  assert.deepEqual(artifactLlm.award_criteria, []);
  assert.deepEqual(artifactLlm.participation_requirements, []);

  const unsupportedLlm = groundLLMExtractionAgainstSource({
    contract_value: { min: 50_000, max: 300_000, currency: "EUR" },
    contract_duration_months: 24,
    contract_duration_renewal: true,
    award_criteria: [
      { criterion: "Preis", weight: 90 },
      { criterion: "Innovationskonzept", weight: 10 },
    ],
    participation_requirements: ["Mindestens fünf vergleichbare Referenzen"],
    cpv_codes: ["72260000-5"],
    procedure_type: "beschränkt",
    commercial_brief: commercialBrief,
  }, procurementEvidence);
  assert.deepEqual(unsupportedLlm.contract_value, { min: null, max: null, currency: "EUR" });
  assert.equal(unsupportedLlm.contract_duration_months, null);
  assert.equal(unsupportedLlm.contract_duration_renewal, false);
  assert.deepEqual(unsupportedLlm.award_criteria, [{ criterion: "Preis", weight: null }]);
  assert.deepEqual(unsupportedLlm.participation_requirements, []);
  assert.deepEqual(unsupportedLlm.cpv_codes, []);
  assert.equal(unsupportedLlm.procedure_type, "");

  const regexFallback = await extractStructuredData("Beschaffung von Reinigungsleistungen", procurementEvidence, { useLLM: false });
  assert.equal(regexFallback.procurement.contract_value.max, 250_000);
  assert.equal(regexFallback.procurement.contract_duration.months, 12);
  assert.deepEqual(regexFallback.procurement.cpv_codes, ["90910000-7"]);
  assert.equal(regexFallback.procurement.procedure_type, "offen");

  const summaryAfterInvalidCandidates = await extractStructuredData(
    "Sanierung der Turnhalle in Mainz",
    [
      "Bitte melden Sie sich an, um Zugriff auf die vollständigen Ausschreibungsunterlagen zu erhalten.",
      "VHB-Bund-Ausgabe 2019 Eigenerklärung zur Eignung und rechtsverbindliche Unterschrift",
      "Die ausgeschriebene Leistung umfasst die energetische Sanierung der Turnhalle und den Austausch der Beleuchtungsanlage.",
    ].join("\n"),
    { useLLM: false },
  );
  assert.equal(
    summaryAfterInvalidCandidates.summary,
    "Die ausgeschriebene Leistung umfasst die energetische Sanierung der Turnhalle und den Austausch der Beleuchtungsanlage.",
    "invalid early source lines must not block a later validated summary candidate",
  );

  assert.equal(extractNetServerTenderTitle(rawText), title);
  assert.equal(projectHomeTenderTitle("## Kurzinfo", 91), "Ausschreibung #91");
  assert.equal(projectHomeTenderTitle("Sanierung der Turnhalle in Mainz", 91), "Sanierung der Turnhalle in Mainz");
  assert.equal(pickValidatedPublicCandidate("## Bekanntmachung"), "");
  assert.equal(pickValidatedPublicCandidate("Sanierung der Turnhalle in Mainz"), "Sanierung der Turnhalle in Mainz");

  const directDbListingRoutes = [
    "app/ausschreibungen/[kategorie]/page.tsx",
    "app/ausschreibungen/cpv/[code]/page.tsx",
    "app/ausschreibungen/cpv/[code]/[kategorie]/page.tsx",
    "app/ausschreibungen/verfahren/[type]/page.tsx",
    "app/ausschreibungen/verfahren/[type]/[kategorie]/page.tsx",
  ];
  for (const route of directDbListingRoutes) {
    assert.match(
      readFileSync(route, "utf8"),
      /title:\s*pickValidatedPublicCandidate\(row\.title\)\s*\|\|\s*`Ausschreibung #\$\{row\.id\}`/,
      `${route} must validate DB titles and use the neutral fallback for invalid titles`,
    );
  }

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

  const titleOnlySummaryFallback = normalizeStructured({
    title: "Sanierung der Turnhalle in Mainz",
    summary: "## Bekanntmachung",
    decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
  }, "Sanierung der Turnhalle in Mainz");
  assert.equal(titleOnlySummaryFallback.summary, "");
  const titleEchoWithLaterDescription = normalizeStructured({
    title,
    summary: `  ${title.toLocaleUpperCase("de-DE")}  `,
    description: "Die Raumlufttechnischen Anlagen werden erneuert.",
    decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
  }, title);
  assert.equal(titleEchoWithLaterDescription.summary, "Die Raumlufttechnischen Anlagen werden erneuert.");
  const invalidPortalAndTruncatedContent = normalizeStructured({
    title,
    summary: "Fliesenarbeiten Epoxidharzbeschichtung (GTL",
    decision_relevant: {
      scope: ["Fliesenarbeiten Epoxidharzbeschichtung (GTL"],
      requirements: [portalSupportWall, "Der Auftragnehmer muss die Baustelle während der Ausführung absichern."],
      mandatory_documents: [],
      award_criteria: [],
    },
  }, title);
  assert.equal(invalidPortalAndTruncatedContent.summary, "");
  assert.deepEqual(invalidPortalAndTruncatedContent.decision_relevant.scope, []);
  assert.deepEqual(invalidPortalAndTruncatedContent.decision_relevant.requirements, [
    "Der Auftragnehmer muss die Baustelle während der Ausführung absichern.",
  ]);
  assert.doesNotMatch(invalidPortalAndTruncatedContent.descriptionMarkdown ?? "", /GTL|Registrierung|Support der Betreiberin/i);
  assert.match(invalidPortalAndTruncatedContent.descriptionMarkdown ?? "", /Baustelle während der Ausführung absichern/);
  const truncatedArrayFallback = "Ausschreibung von Bodenbelagsarbeiten für das Landratsamt Rhein-Neckar-Kreis.";
  const tokenizedTruncatedContent = normalizeStructured({
    title: "2000-9 Besucherleitsystem, LRA Heidelberg VG, Bodenbelagsarbeiten RNK_EBBAU-2026-0029",
    summary: ["Fliesenarbeiten", "Epoxidharzbeschichtung", "(GTL"],
    decision_relevant: {
      scope: ["Fliesenarbeiten", "Epoxidharzbeschichtung", "(GTL"],
      requirements: [],
      mandatory_documents: [],
      award_criteria: [],
    },
  }, "2000-9 Besucherleitsystem, LRA Heidelberg VG, Bodenbelagsarbeiten RNK_EBBAU-2026-0029", {
    summary: truncatedArrayFallback,
  });
  assert.equal(tokenizedTruncatedContent.summary, truncatedArrayFallback);
  assert.deepEqual(tokenizedTruncatedContent.decision_relevant.scope, []);
  assert.match(tokenizedTruncatedContent.descriptionMarkdown ?? "", /Bodenbelagsarbeiten für das Landratsamt/);
  assert.doesNotMatch(tokenizedTruncatedContent.descriptionMarkdown ?? "", /Fliesenarbeiten|Epoxidharzbeschichtung|GTL/);
  const rejectedScopeText = normalizeStructured({
    title,
    summary: title,
    decision_relevant: { scope: "## Bekanntmachung", requirements: [], mandatory_documents: [], award_criteria: [] },
  }, title);
  assert.equal(rejectedScopeText.summary, "");
  assert.equal(
    rejectedScopeText.descriptionMarkdown?.includes(title) ?? false,
    false,
    "the tender title must not be rendered as summary or scope",
  );
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

  const validFallbackSummary = normalizeStructured({
    title,
    summary: title,
    decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
  }, title, { summary: "Die Lieferung umfasst Bauleistungen am Bestandsgebäude." });
  assert.equal(validFallbackSummary.summary, "Die Lieferung umfasst Bauleistungen am Bestandsgebäude.");

  const structuredProcedureFallback = normalizeStructured({
    title,
    summary: "Dokumentierte Bauleistungen",
    decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
    procurement: {
      procedure_type: "(Losangaben)",
      procedureType: "Nichtoffenes Verfahren",
    },
  }, title);
  assert.equal(structuredProcedureFallback.procurement.procedure_type, "Nichtoffenes Verfahren");

  const structuredPortalProcedureSummary = normalizeStructured({
    title,
    summary: "Offenes Verfahren (sangaben)",
    decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
    procurement: { procedure_type: "(Losangaben)" },
  }, title);
  assert.equal(structuredPortalProcedureSummary.summary, "Offenes Verfahren");

  const invalidStructuredProcedure = normalizeStructured({
    title,
    summary: "Dokumentierte Bauleistungen",
    decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
    procurement: { procedure_type: "(Losangaben)" },
  }, title);
  assert.equal(invalidStructuredProcedure.procurement.procedure_type, "");

  const camelCaseFallback = normalizeStructured({
    title,
    summary: "## Bekanntmachung",
    decision_relevant: {
      scope: [],
      requirements: [],
      mandatory_documents: [],
      award_criteria: [],
    },
    decisionRelevant: {
      scope: ["CamelCase Leistungsumfang"],
      mandatoryDocuments: ["Formblatt 1"],
      awardCriteria: ["Preis"],
    },
    hard_facts: {},
    hardFacts: { location: "55116 Mainz", buyer: "Stadt Mainz" },
    procurement: {
      contract_value: {},
      contractValue: { max: 1000, currency: "EUR" },
      contract_duration: {},
      contractDuration: { months: 12, renewal: false },
      participation_requirements: [],
      participationRequirements: ["Referenz"],
      award_criteria_detailed: [],
      awardCriteriaDetailed: [{ criterion: "Qualität", weight: 30 }],
      cpv_codes: [],
      cpvCodes: ["90910000"],
      procedure_type: "",
      procedureType: "Offenes Verfahren",
    },
  }, title);
  assert.equal(camelCaseFallback.summary, "CamelCase Leistungsumfang");
  assert.equal(camelCaseFallback.hard_facts.location, "55116 Mainz");
  assert.deepEqual(camelCaseFallback.decision_relevant.mandatory_documents, ["Formblatt 1"]);
  assert.deepEqual(camelCaseFallback.procurement.participation_requirements, ["Referenz"]);
  assert.deepEqual(camelCaseFallback.procurement.cpv_codes, ["90910000"]);
  assert.deepEqual(camelCaseFallback.procurement.award_criteria_detailed, [{ criterion: "Qualität", weight: 30 }]);
  assert.equal(camelCaseFallback.procurement.procedure_type, "Offenes Verfahren");

  const jsonStringStructured = normalizeStructured(JSON.stringify({
    summary: "## Bekanntmachung",
    hardFacts: JSON.stringify({ buyer: "Stadt Mainz", location: "55116 Mainz" }),
    decisionRelevant: JSON.stringify({ scope: ["Dokumentierte Bauleistungen"] }),
    procurement: JSON.stringify({ procedureType: "Offenes Verfahren" }),
  }), title);
  assert.equal(jsonStringStructured.summary, "Dokumentierte Bauleistungen");
  assert.equal(jsonStringStructured.hard_facts.buyer, "Stadt Mainz");
  assert.equal(jsonStringStructured.hard_facts.location, "55116 Mainz");
  assert.equal(jsonStringStructured.procurement.procedure_type, "Offenes Verfahren");

  const flatInvalidAliasFallback = normalizeStructured({
    title,
    client: "Anmelden erforderlich, um Zugriff zu erhalten",
    buyer: "Stadt Bautzen",
    location: "## Bekanntmachung",
    city: "02625 Bautzen",
    description: "## Kurzinfo",
    summary: "Dokumentierte Bauleistungen in Bautzen",
    scope: "## Leistungsumfang",
    subject: "Erneuerung der Energiezentrale",
    procedure: "## Verfahren",
    procedureType: "Offenes Verfahren",
    deadline: "## Frist",
    deadlineAt: "31.12.2026 12:00",
  }, title);
  assert.equal(flatInvalidAliasFallback.hard_facts.buyer, "Stadt Bautzen");
  assert.equal(flatInvalidAliasFallback.hard_facts.location, "02625 Bautzen");
  assert.equal(flatInvalidAliasFallback.summary, "Dokumentierte Bauleistungen in Bautzen");
  assert.ok(flatInvalidAliasFallback.decision_relevant.scope.includes("Erneuerung"));
  assert.equal(flatInvalidAliasFallback.procurement.procedure_type, "Offenes Verfahren");
  assert.equal(flatInvalidAliasFallback.hard_facts.deadline, "31.12.2026 12:00");

  const nestedInvalidAliasFallback = normalizeStructured({
    title,
    summary: "## Bekanntmachung",
    description: "Strukturierte Zusammenfassung der Bauleistungen",
    hard_facts: {
      buyer: "Anmelden erforderlich, um Zugriff zu erhalten",
      client: "Stadt Bautzen",
      location: "## Bekanntmachung",
      city: "02625 Bautzen",
      deadline: "## Frist",
      deadlineAt: "31.12.2026 12:00",
    },
    decision_relevant: {
      scope: "## Leistungsumfang",
      subject: ["Erneuerung der Energiezentrale"],
      requirements: [],
      mandatory_documents: [],
      award_criteria: [],
    },
    procurement: {
      procedure_type: "## Verfahren",
      procedureType: "Offenes Verfahren",
    },
  }, title);
  assert.equal(nestedInvalidAliasFallback.hard_facts.buyer, "Stadt Bautzen");
  assert.equal(nestedInvalidAliasFallback.hard_facts.location, "02625 Bautzen");
  assert.equal(nestedInvalidAliasFallback.summary, "Strukturierte Zusammenfassung der Bauleistungen");
  assert.ok(nestedInvalidAliasFallback.decision_relevant.scope.some((value) => value.includes("Erneuerung")));
  assert.equal(nestedInvalidAliasFallback.procurement.procedure_type, "Offenes Verfahren");
  assert.equal(nestedInvalidAliasFallback.hard_facts.deadline, "31.12.2026 12:00");

  const nestedInvalidListAliasFallback = normalizeStructured({
    title,
    decision_relevant: {
      scope: "## Leistungsumfang",
      requirements: "## Anforderungen",
      mandatory_documents: "## Unterlagen",
      award_criteria: "## Zuschlagskriterien",
    },
    decisionRelevant: {
      subject: ["Erneuerung der Energiezentrale"],
      requirements: ["Nachweis einer Referenz"],
      mandatoryDocuments: ["Formblatt 1"],
      awardCriteria: ["Preis"],
    },
    procurement: {
      participation_requirements: "## Eignung",
      participationRequirements: ["Umsatznachweis"],
      award_criteria_detailed: [{ criterion: "## Zuschlagskriterien" }],
      awardCriteriaDetailed: [{ criterion: "Qualität", weight: 30 }],
      cpv_codes: "## CPV",
      cpvCodes: ["90910000"],
    },
  }, title);
  assert.deepEqual(nestedInvalidListAliasFallback.decision_relevant.scope, ["Erneuerung der Energiezentrale"]);
  assert.deepEqual(nestedInvalidListAliasFallback.decision_relevant.requirements, ["Nachweis einer Referenz"]);
  assert.deepEqual(nestedInvalidListAliasFallback.decision_relevant.mandatory_documents, ["Formblatt 1"]);
  assert.deepEqual(nestedInvalidListAliasFallback.decision_relevant.award_criteria, ["Preis"]);
  assert.deepEqual(nestedInvalidListAliasFallback.procurement.participation_requirements, ["Umsatznachweis"]);
  assert.deepEqual(nestedInvalidListAliasFallback.procurement.award_criteria_detailed, [{ criterion: "Qualität", weight: 30 }]);
  assert.deepEqual(nestedInvalidListAliasFallback.procurement.cpv_codes, ["90910000"]);

  const flatInvalidListAliasFallback = normalizeStructured({
    title,
    requirements: "## Anforderungen",
    participation_requirements: ["Nachweis einer Referenz"],
    awardCriteria: "## Zuschlagskriterien",
    award_criteria: ["Preis"],
    cpvCodes: "## CPV",
    cpv_codes: ["90910000"],
  }, title);
  assert.deepEqual(flatInvalidListAliasFallback.decision_relevant.requirements, ["Nachweis einer Referenz"]);
  assert.deepEqual(flatInvalidListAliasFallback.decision_relevant.award_criteria, ["Preis"]);
  assert.deepEqual(flatInvalidListAliasFallback.procurement.cpv_codes, ["90910000"]);

  const manualTokens24246 = [
    "Benutzerhandbuch", "beschreibt", "den", "gesamten", "Funktionsumfang", "der", "Software", "AI",
    "BIETER", "COCKPIT", "einschließlich", "Vergaberecherche", "und", "Bearbeitung", "der", "Vergabeunterlagen",
  ];
  assert.deepEqual(normalizePublicTextList(manualTokens24246), []);
  assert.deepEqual(normalizePublicTextList(manualTokens24246.slice(3)), []);
  assert.deepEqual(normalizePublicTextList([
    "7 Ausschreibungen 37 7.1 Nachrichten 40 7.2 Vergabeunterlagen 43",
    "7.3 Angebot erstellen 44 7.3.1 Navigation innerhalb der Angebotsdateien 47",
    "Abbildung 7.20: Losauswahl – Ausschnitt",
  ]), []);
  assert.deepEqual(
    normalizePublicTextList(["Eigenerklärung", "Bietercockpit", "Referenznachweis"]),
    ["Eigenerklärung", "Bietercockpit", "Referenznachweis"],
  );
  assert.deepEqual(
    normalizePublicTextList(["Referenz", "Umsatz", "Zertifikat", "ISO", "Bericht"]),
    ["Referenz", "Umsatz", "Zertifikat", "ISO", "Bericht"],
  );
  assert.deepEqual(
    normalizePublicTextList(["Bau", "Lieferung", "Montage", "Wartung", "Prüfung"]),
    ["Bau", "Lieferung", "Montage", "Wartung", "Prüfung"],
  );
  const scrapedListBase = {
    title: "Lieferung von Büromaterial",
    client: "Stadt Mainz",
    deadline: null,
    description: "",
    referenceNumber: null,
    location: "55116 Mainz",
    category: "Lieferung" as const,
    sourceUrl,
    source: "dtvp",
    pdfUrls: [],
  };
  const normalizedScrapedTokens = withDescriptionMarkdown({
    ...scrapedListBase,
    requirements: manualTokens24246,
    awardCriteria: manualTokens24246,
  });
  assert.deepEqual(normalizedScrapedTokens.requirements, []);
  assert.deepEqual(normalizedScrapedTokens.awardCriteria, []);
  const legitimateRequirementPhrases = ["Nachweis einschlägiger Referenzen", "Eigenerklärung zur Eignung"];
  const legitimateAwardPhrases = ["Qualität der Ausführung", "Preis und Betriebskosten"];
  const normalizedScrapedPhrases = withDescriptionMarkdown({
    ...scrapedListBase,
    requirements: legitimateRequirementPhrases,
    awardCriteria: legitimateAwardPhrases,
  });
  assert.deepEqual(normalizedScrapedPhrases.requirements, legitimateRequirementPhrases);
  assert.deepEqual(normalizedScrapedPhrases.awardCriteria, legitimateAwardPhrases);
  const normalized24246 = normalizeStructured({
    title: "AI Bieter-Cockpit Anleitung",
    summary: "beschreibt",
    description: "beschreibt",
    hard_facts: {
      buyer: "nicht innerhalb einer",
      client: "nicht innerhalb einer",
      location: "Vorinformationen",
      city: "nicht innerhalb einer",
      deadline: "nicht innerhalb einer",
      deadlineAt: "nicht innerhalb einer",
      contract_type: "Vorinformationen",
      procedure: "Vorinformationen",
    },
    decision_relevant: {
      scope: manualTokens24246,
      requirements: manualTokens24246,
      mandatory_documents: manualTokens24246,
      award_criteria: [],
    },
    procurement: {
      procedure_type: "Vorinformationen",
      procedureType: "Vorinformationen",
    },
  }, "AI Bieter-Cockpit Anleitung");
  assert.equal(normalized24246.summary, "");
  assert.deepEqual(normalized24246.hard_facts, {
    buyer: null,
    deadline: null,
    budget: null,
    contract_type: null,
    location: null,
  });
  assert.deepEqual(normalized24246.decision_relevant.scope, []);
  assert.deepEqual(normalized24246.decision_relevant.requirements, []);
  assert.deepEqual(normalized24246.decision_relevant.mandatory_documents, []);
  assert.equal(normalized24246.descriptionMarkdown, "");
  const projected24246 = projectPublicTenderRecord({
    title: "AI Bieter-Cockpit Anleitung",
    structured: normalized24246,
  });
  assert.equal(projected24246.description, null);
  assert.equal(projected24246.summary, null);
  assert.equal(projected24246.client, null);
  assert.equal(projected24246.location, null);
  assert.equal(projected24246.descriptionMarkdown, null);
  const projected24246WithMetadataFallback = projectPublicTenderRecord({
    title: "AI Bieter-Cockpit Anleitung",
    structured: normalized24246,
    metadata: {
      description: "Die Lieferung von Schulungsmaterial umfasst Versand und Einrichtung.",
      client: "Stadt Mainz",
      location: "55116 Mainz",
      descriptionMarkdown: "- **Zusammenfassung:** Die Lieferung von Schulungsmaterial umfasst Versand und Einrichtung.",
    },
  });
  assert.equal(projected24246WithMetadataFallback.description, "Die Lieferung von Schulungsmaterial umfasst Versand und Einrichtung.");
  assert.equal(projected24246WithMetadataFallback.summary, projected24246WithMetadataFallback.description);
  assert.equal(projected24246WithMetadataFallback.client, "Stadt Mainz");
  assert.equal(projected24246WithMetadataFallback.location, "55116 Mainz");
  assert.doesNotMatch(projected24246WithMetadataFallback.descriptionMarkdown ?? "", /BIETER|COCKPIT|beschreibt|nicht innerhalb einer/i);

  const portalTokens18257 = "Vorinformationen zu aktuellen Ausschreibungen: Die Plattform ermöglicht die digitale Teilnahme, Einsicht in die Vergabeunterlagen und die elektronische Angebotsabgabe über Bietercockpit.".split(/\s+/u);
  assert.deepEqual(normalizePublicTextList(portalTokens18257), []);
  const normalized18257 = normalizeStructured({
    title: "Vorinformationen",
    summary: "Vorinformationen",
    description: "Vorinformationen",
    hardFacts: {
      buyer: "31.08.2026",
      client: ", bei der die Vergabeunterlagen angefordert/eingesehen werden können: Name und Anschrift zur Anforderung: Stadt Walldorf",
      location: "Vorinformationen",
      city: "nicht innerhalb einer",
      deadline: "nicht innerhalb einer",
      procedure: "Vorinformationen",
    },
    decisionRelevant: {
      scope: portalTokens18257,
      requirements: portalTokens18257,
      mandatoryDocuments: portalTokens18257,
    },
    procurement: { procedureType: "Vorinformationen" },
  }, "Vorinformationen");
  assert.equal(normalized18257.summary, "");
  assert.equal(normalized18257.hard_facts.buyer, null);
  assert.equal(normalized18257.hard_facts.location, null);
  assert.equal(normalized18257.hard_facts.deadline, null);
  assert.equal(normalized18257.hard_facts.contract_type, null);
  assert.equal(normalized18257.procurement.procedure_type, "");
  assert.deepEqual(normalized18257.decision_relevant.scope, []);
  assert.deepEqual(normalized18257.decision_relevant.requirements, []);
  assert.deepEqual(normalized18257.decision_relevant.mandatory_documents, []);
  assert.equal(normalized18257.descriptionMarkdown, "");
  const projected18257WithMetadataFallback = projectPublicTenderRecord({
    title: "Vorinformationen",
    structured: normalized18257,
    metadata: {
      description: "Die Lieferung von Schulungsmaterial für kommunale Bildungsstandorte umfasst Versand und Einrichtung.",
      client: "Stadt Walldorf",
      location: "Walldorf",
      descriptionMarkdown: "- **Zusammenfassung:** Die Lieferung von Schulungsmaterial für kommunale Bildungsstandorte umfasst Versand und Einrichtung.",
    },
  });
  assert.equal(projected18257WithMetadataFallback.description, "Die Lieferung von Schulungsmaterial für kommunale Bildungsstandorte umfasst Versand und Einrichtung.");
  assert.equal(projected18257WithMetadataFallback.client, "Stadt Walldorf");
  assert.equal(projected18257WithMetadataFallback.location, "Walldorf");
  assert.doesNotMatch(projected18257WithMetadataFallback.descriptionMarkdown ?? "", /Vorinformationen|Bietercockpit|nicht innerhalb einer/i);

  const meaningfulStructuredList = normalizeStructured({
    title: "Lieferung von Schulungsmaterial",
    decision_relevant: {
      scope: ["Lieferung von Schulungsmaterial", "Einrichtung und Wartung"],
      requirements: ["Eigenerklärung", "Bietercockpit"],
      mandatory_documents: ["Referenznachweis"],
      award_criteria: [],
    },
  }, "Lieferung von Schulungsmaterial");
  assert.deepEqual(meaningfulStructuredList.decision_relevant.scope, ["Lieferung von Schulungsmaterial", "Einrichtung und Wartung"]);
  assert.deepEqual(meaningfulStructuredList.decision_relevant.requirements, ["Eigenerklärung", "Bietercockpit"]);
  assert.deepEqual(meaningfulStructuredList.decision_relevant.mandatory_documents, ["Referenznachweis"]);
  assert.match(meaningfulStructuredList.descriptionMarkdown ?? "", /Eigenerklärung|Bietercockpit|Lieferung von Schulungsmaterial/);

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
  assert.equal(titleOnly.procurement.procedure_type, "");

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
  assert.equal(
    indexed.slug,
    getCanonicalTenderSlug(null, title, { description: "- Verfahren - - - Lose - Ergebnisse - Verträge - - - -" }, null),
    "Meilisearch must store the same rawText-aware canonical slug as the detail route",
  );

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

  const indexedAliasMetadata = {
    description: "## Bekanntmachung",
    city: "55116 Mainz",
    pdf_urls: [] as string[],
    pdfUrls: ["https://example.test/camel.pdf"],
  };
  const indexedAliasStructured = {
    summary: "## Bekanntmachung",
    description: "Index-Fallback aus strukturierten Daten",
    hard_facts: { buyer: "Stadt Mainz", location: "" },
    hardFacts: { location: "55116 Mainz", city: "Mainz" },
  };
  const indexedAliases = buildTenderIndexDocument({
    id: 45,
    title,
    source: "dtvp",
    sourceKey: "dtvp",
    url: sourceUrl,
    deadlineAt: null,
    firstSeenAt: null,
    category: "Bauarbeiten",
    metadataJson: indexedAliasMetadata,
    structuredJson: indexedAliasStructured,
    rawText: "",
    contractValueMax: null,
    slug: null,
    readinessStatus: "pending",
  });
  assert.equal(indexedAliases.description, "Index-Fallback aus strukturierten Daten");
  assert.equal(indexedAliases.location, "55116 Mainz");
  assert.equal(indexedAliases.city, "Mainz");
  assert.equal(indexedAliases.pdfCount, 1);
  const normalizedAliasStructured = normalizeStructured(indexedAliasStructured, title, { location: "55116 Mainz" });
  const indexedAliasProjection = projectPublicTenderRecord({
    title,
    metadata: indexedAliasMetadata,
    structured: normalizedAliasStructured,
    locationFallbacks: ["55116 Mainz"],
  });
  assert.deepEqual(
    {
      title: indexedAliases.title,
      client: indexedAliases.client,
      location: indexedAliases.location,
      description: indexedAliases.description,
    },
    {
      title: indexedAliasProjection.title,
      client: indexedAliasProjection.client || "Unbekannt",
      location: indexedAliasProjection.location,
      description: indexedAliasProjection.description,
    },
  );

  const currentSearchTender = {
    title: "Lieferung von Schulungsmaterial für kommunale Bildungsstandorte",
    source: "dtvp",
    url: sourceUrl,
    structuredJson: {
      summary: "Strukturierte Zusammenfassung der Lieferung von Schulungsmaterial.",
      hard_facts: { buyer: "Stadt Mainz", location: "55116 Mainz" },
    },
  };
  for (const metaDescription of ["## Bekanntmachung", "   "]) {
    const currentMetadata = {
      description: metaDescription,
      client: "Stadt Mainz",
      location: "55116 Mainz",
    };
    const canonicalSearchProjection = projectPublicTenderRecord({
      title: currentSearchTender.title,
      metadata: currentMetadata,
      structured: currentSearchTender.structuredJson,
    });
    const projectedSearchHit = projectTenderSearchHit({
      ...indexedAliases,
      id: 47,
      title: "## Bekanntmachung",
      client: "Anmelden erforderlich, um Zugriff zu erhalten",
      location: "## Bekanntmachung",
      city: "## Bekanntmachung",
      description: "## Bekanntmachung",
    }, {
      ...currentSearchTender,
      metadataJson: currentMetadata,
    });
    assert.equal(projectedSearchHit.description, currentSearchTender.structuredJson.summary);
    assert.deepEqual(
      {
        title: projectedSearchHit.title,
        client: projectedSearchHit.client,
        location: projectedSearchHit.location,
        description: projectedSearchHit.description,
      },
      {
        title: canonicalSearchProjection.title || "Ausschreibung #47",
        client: canonicalSearchProjection.client || "Unbekannt",
        location: canonicalSearchProjection.location || "",
        description: canonicalSearchProjection.description || "",
      },
    );
  }

  const tokenizedScopeText = "Die Lieferung von Büromaterial umfasst den Versand an mehrere Standorte.";
  const tokenizedSearchStructured = {
    summary: "## Bekanntmachung",
    decision_relevant: { scope: tokenizedScopeText.split(/\s+/u) },
  };
  const rejectedSearchMetadata = {
    description: "## Bekanntmachung",
    client: "Stadt Mainz",
    location: "55116 Mainz",
  };
  const normalizedTokenizedSearch = normalizeStructured(tokenizedSearchStructured, currentSearchTender.title, {
    buyer: "Stadt Mainz",
    location: "55116 Mainz",
    summary: rejectedSearchMetadata.description,
  });
  const tokenizedDetailProjection = projectPublicTenderRecord({
    title: currentSearchTender.title,
    metadata: rejectedSearchMetadata,
    structured: normalizedTokenizedSearch,
  });
  assert.equal(tokenizedDetailProjection.description, null);
  const tokenizedSearchHit = projectTenderSearchHit({
    ...indexedAliases,
    id: 48,
    description: "Veraltete Leistungsbeschreibung aus einem früheren Indexstand.",
  }, {
    ...currentSearchTender,
    metadataJson: rejectedSearchMetadata,
    structuredJson: tokenizedSearchStructured,
  });
  assert.equal(tokenizedSearchHit.description, tokenizedDetailProjection.description || "");

  const currentDescriptionFallback = "Die Lieferung von Büromaterial umfasst Versand an mehrere Standorte.";
  const fallbackSearchMetadata = { ...rejectedSearchMetadata, description: currentDescriptionFallback };
  const normalizedTokenizedFallback = normalizeStructured(tokenizedSearchStructured, currentSearchTender.title, {
    buyer: "Stadt Mainz",
    location: "55116 Mainz",
    summary: currentDescriptionFallback,
  });
  const tokenizedFallbackDetailProjection = projectPublicTenderRecord({
    title: currentSearchTender.title,
    metadata: fallbackSearchMetadata,
    structured: normalizedTokenizedFallback,
  });
  const tokenizedFallbackSearchHit = projectTenderSearchHit({
    ...indexedAliases,
    id: 49,
    description: "Noch älterer Beschreibungstext aus dem Index.",
  }, {
    ...currentSearchTender,
    metadataJson: fallbackSearchMetadata,
    structuredJson: tokenizedSearchStructured,
  });
  assert.equal(tokenizedFallbackSearchHit.description, tokenizedFallbackDetailProjection.description);
  assert.equal(tokenizedFallbackSearchHit.description, currentDescriptionFallback);

  const goodPhraseScope = ["Sanierung des Daches", "Erneuerung der Regenentwässerung"];
  const goodPhraseStructured = {
    summary: "## Bekanntmachung",
    decision_relevant: { scope: goodPhraseScope },
  };
  const normalizedGoodPhraseStructured = normalizeStructured(goodPhraseStructured, currentSearchTender.title);
  const goodPhraseDetailProjection = projectPublicTenderRecord({
    title: currentSearchTender.title,
    structured: normalizedGoodPhraseStructured,
  });
  const goodPhraseSearchHit = projectTenderSearchHit({
    ...indexedAliases,
    id: 50,
    description: "Veraltete Beschreibung.",
  }, {
    ...currentSearchTender,
    metadataJson: {},
    structuredJson: goodPhraseStructured,
  });
  assert.equal(goodPhraseSearchHit.description, goodPhraseDetailProjection.description);
  assert.equal(goodPhraseSearchHit.description, goodPhraseScope[0]);
  assert.deepEqual(normalizedGoodPhraseStructured.decision_relevant.scope, goodPhraseScope);
  assert.deepEqual(getStaleIds([1, 2, 3], new Set([1, 3])), [2]);

  const indexedPortalFallback = buildTenderIndexDocument({
    id: 46,
    title: "EKVO-Kanalbefahrung 2. Abschnitt, Kanalarbeiten 2026_701.32/se",
    source: "rhein-neckar",
    sourceKey: "rhein-neckar",
    url: sourceUrl,
    deadlineAt: new Date("2026-11-02T23:59:00.000Z"),
    firstSeenAt: null,
    category: "Facility Management",
    metadataJson: {
      description: "Kanalreinigung und -inspektion (EKVO-Kanalbefahrung 2. Abschnitt)",
      subject: "Kanalreinigung und -inspektion (EKVO-Kanalbefahrung 2. Abschnitt)",
      client: ", bei der die Vergabeunterlagen angefordert/eingesehen werden können: Name und Anschrift zur Anforderung: Stadt Walldorf",
      location: "69190 Walldorf",
      procedure: "Öffentliche Ausschreibung",
    },
    structuredJson: {
      summary: "Vorinformationen",
      hard_facts: {
        buyer: "31.08.2026",
        location: "Metropolregion Rhein-Neckar (Baden-Württemberg)",
      },
      decision_relevant: {
        scope: ["Vorinformationen", "Plattform", "ermöglicht", "digitale", "Teilnahme", "über", "Bietercockpit."],
        requirements: ["Unrelated portal requirement"],
        mandatory_documents: ["Portal document"],
        award_criteria: [],
      },
      procurement: { procedure_type: "offen" },
    },
    rawText: "",
    contractValueMax: null,
    slug: null,
    readinessStatus: "pending",
  });
  assert.equal(indexedPortalFallback.location, "69190 Walldorf");
  assert.equal(indexedPortalFallback.client, "Unbekannt");
  assert.equal(indexedPortalFallback.procedureType, "Öffentliche Ausschreibung");
  assert.equal(indexedPortalFallback.description, "Kanalreinigung und -inspektion (EKVO-Kanalbefahrung 2. Abschnitt)");

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
