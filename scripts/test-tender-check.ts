import assert from "node:assert/strict";
import { buildDocumentAnalysis, type AnalyzedDocument } from "../lib/document-analysis";
import { buildTenderCheck } from "../lib/tender-check";
import { buildTenderCalendarIcs, calendarFilename } from "../lib/tender-calendar";

const completeDocuments = [
  {
    id: 101,
    filename: "Bekanntmachung.pdf",
    role: "bekanntmachung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "[Seite 1]\nAbgabefrist: 15.08.2026, 10:00 Uhr\nMit dem Angebot einzureichen ist die Eigenerklärung. Mindestens drei Referenzen sind vorzulegen. Vertragslaufzeit: 12 Monate. Bindefrist bis 30.08.2026. Preis 60 %.",
    pageCount: 1,
    roleConfidence: 0.9,
  },
  {
    id: 102,
    filename: "Leistungsbeschreibung.pdf",
    role: "leistungsbeschreibung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "[Seite 3]\nAbgabefrist: 20.08.2026, 10:00 Uhr\nVertragslaufzeit: 24 Monate. Qualität 40 %.",
    pageCount: 3,
    roleConfidence: 0.9,
  },
];

const structured = {
  decision_relevant: {
    mandatory_documents: ["Eigenerklärung", "Eigenerklärung"],
    requirements: ["Technische Beschreibung"],
  },
  procurement: {
    participation_requirements: ["Mindestens drei Referenzen"],
  },
};

const serviceBundPdfTemplateFragment = "Auftragsbekanntmachung © Ausgabe 03/2020 Seite 2 von 2 Vergabeunterlagen werden elektronisch zur Verfügung gestellt. Maßnahmen zum Schutz vertraulicher Informationen";
const serviceBundOfferSubmissionTemplateFragment = "Zugelassene Angebotsabgabe elektronisch in Textform mit fortgeschrittener/m Signatur/Siegel. mit qualifizierter/m Signatur/Siegel. schriftlich; Maßnahmen zum Schutz vertraulicher Informationen: Abgabe Verschwiegenheitserklärung";
const populatedVhbNotice = "[Seite 1]\nVHB-VOL NRW VOL 3a 01/2015 Vergabebekanntmachung Öffentliche Ausschreibung Bekanntmachung Aktenzeichen: Vergabe-Nr.: 1088_044-FL Bezeichnung des Verfahrens: Erneuerung der Fahrleitungsmaste an der Hafenstraße in Krefeld 1. Art der Vergabe 2. Bezeichnung der zur Angebotsabgabe auffordernden Stelle Bezeichnung SWK MOBIL GmbH Postanschrift Telefon-Nummer Telefax-Nummer E-Mail-Adresse\n[Seite 2]\nAblauf der Angebotsfrist 18.11.2099 14:00 Uhr. Leistungsbeschreibung: Rodungsarbeiten.";
const populatedNoticeCheck = buildTenderCheck({
  tenderId: 900,
  tenderDeadlineAt: null,
  structured: null,
  documents: [{
    id: 900,
    filename: "Bekanntmachung.pdf",
    role: "bekanntmachung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: populatedVhbNotice,
    pageCount: 2,
    roleConfidence: 0.9,
  }],
});
assert.equal(populatedNoticeCheck.coverage.parsed, 1, "a populated VHB notice must be usable by tender checks");
assert.ok(populatedNoticeCheck.events.some((event) => event.type === "submission"), "a populated VHB notice must provide submission-date facts");
const portalPointerCheck = buildTenderCheck({
  tenderId: 901,
  tenderDeadlineAt: null,
  structured: null,
  documents: [{
    id: 901,
    filename: "Hinweis auf Bekanntmachungsorte.pdf",
    role: "bekanntmachung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "[Seite 1]\nVMS © 2024 cosinex GmbH Die Bekanntmachung für dieses Vergabeverfahren finden Sie auf folgenden Vergabeplattformen: Ted - tenders electronical daily https://ted.europa.eu/TED/search/search.do Bekanntmachungsservice Öffentliche Vergabe https://www.oeffentlichevergabe.de/ui/de/advancedSearch",
    pageCount: 1,
    roleConfidence: 0.9,
  }],
});
assert.equal(portalPointerCheck.coverage.parsed, 0, "a Cosinex portal pointer must remain unusable by tender checks");
assert.equal(portalPointerCheck.events.length, 0, "a Cosinex portal pointer must not create document events");

const templateAndTenderDocument: AnalyzedDocument & { filename: string } = {
  id: 105,
  filename: "Bekanntmachung.pdf",
  role: "bekanntmachung",
  roles: ["bekanntmachung", "leistungsbeschreibung"],
  parseStatus: "parsed",
  downloadStatus: "downloaded",
  errorMessage: null,
  extractedText: `[Seite 1]\nLeistungsumfang: ${serviceBundPdfTemplateFragment}\nAnforderungen: ${serviceBundOfferSubmissionTemplateFragment}\n[Seite 2]\nAbgabefrist: 30.06.2027, 10:00 Uhr. Leistungsbeschreibung: Wartung der Heizungsanlage an drei Standorten. Mindestanforderung: Mindestens drei vergleichbare Referenzen sind mit dem Angebot vorzulegen. Formblatt 1 ist einzureichen.`,
  pageCount: 2,
  roleConfidence: 0.9,
};
const templateDocumentAnalysis = buildDocumentAnalysis([templateAndTenderDocument]);
assert.equal(templateDocumentAnalysis.coverage.parsed, 1, "a tender document containing a template fragment remains usable");
assert.equal(buildDocumentAnalysis([{
  ...templateAndTenderDocument,
  id: 107,
  extractedText: `[Seite 2] ${serviceBundPdfTemplateFragment}`,
}]).coverage.parsed, 0, "a template-only PDF remains classified as boilerplate");
const templateScopeEvidence = templateDocumentAnalysis.evidence.find((evidence) => evidence.field === "scope");
assert.ok(templateScopeEvidence);
assert.equal(templateScopeEvidence.page, 2, "boilerplate evidence is skipped in favor of substantive evidence elsewhere in the document");
assert.match(templateScopeEvidence.quote, /Leistungsbeschreibung: Wartung der Heizungsanlage/);
assert.doesNotMatch(templateScopeEvidence.quote, /Auftragsbekanntmachung © Ausgabe 03\/2020/);
assert.ok(templateDocumentAnalysis.evidence.some((evidence) => evidence.field === "deadline" && /30\.06\.2027/.test(evidence.quote)));

const filteredTemplateCheck = buildTenderCheck({
  tenderId: 105,
  tenderDeadlineAt: null,
  structured: {
    decision_relevant: {
      mandatory_documents: ["Formblatt 1", serviceBundPdfTemplateFragment, serviceBundOfferSubmissionTemplateFragment, { text: "Ungeprüfte Pflichtunterlage" }, 42],
      requirements: [
        "Mindestens drei vergleichbare Referenzen sind mit dem Angebot vorzulegen.",
        serviceBundPdfTemplateFragment,
        serviceBundOfferSubmissionTemplateFragment,
        { text: "Ungeprüfte Anforderung" },
      ],
    },
  },
  documents: [templateAndTenderDocument],
});
const filteredTitles = filteredTemplateCheck.checklist.map((item) => item.title);
assert.ok(filteredTitles.includes("Formblatt 1"), "a contextually valid standalone form remains a checklist item");
assert.ok(filteredTitles.includes("Mindestens drei vergleichbare Referenzen sind mit dem Angebot vorzulegen."));
assert.ok(!filteredTitles.some((item) => item.includes("Auftragsbekanntmachung © Ausgabe 03/2020")));
assert.ok(!filteredTitles.includes(serviceBundOfferSubmissionTemplateFragment));
assert.ok(!filteredTitles.includes("Ungeprüfte Pflichtunterlage") && !filteredTitles.includes("Ungeprüfte Anforderung"));
assert.ok(filteredTemplateCheck.events.some((event) => event.type === "submission" && event.source?.quote.includes("30.06.2027")));
assert.ok(filteredTemplateCheck.checklist.every((item) => !item.source?.quote.includes("Auftragsbekanntmachung © Ausgabe 03/2020")));
assert.ok(filteredTemplateCheck.checklist.every((item) => !item.source?.quote.includes(serviceBundOfferSubmissionTemplateFragment)));
assert.ok(filteredTemplateCheck.checklist.every((item) => !/fortgeschrittener\/m|qualifizierter\/m|Abgabe Verschwiegenheitserklärung/iu.test(item.source?.quote ?? "")));

const quoteOnlyDocument = {
  ...templateAndTenderDocument,
  id: 106,
  extractedText: `[Seite 2] ${serviceBundPdfTemplateFragment}`,
};
const analysisWithUnvalidatedQuote = {
  ...buildDocumentAnalysis([quoteOnlyDocument]),
  evidence: [{
    field: "requirements" as const,
    value: null,
    documentId: quoteOnlyDocument.id,
    role: "bekanntmachung" as const,
    page: 1,
    quote: serviceBundPdfTemplateFragment,
    confidence: 0.9,
    source: "parsed_document" as const,
  }],
};
const unvalidatedEvidenceCheck = buildTenderCheck({
  tenderId: 106,
  tenderDeadlineAt: null,
  structured: { decision_relevant: { requirements: ["Eine technische Mindestanforderung"] } },
  documents: [quoteOnlyDocument],
  documentAnalysis: analysisWithUnvalidatedQuote,
});
assert.equal(unvalidatedEvidenceCheck.checklist[0]?.source, null, "unvalidated boilerplate quotes cannot become visible evidence");

const offerTemplateQuoteDocument = {
  ...templateAndTenderDocument,
  id: 109,
  extractedText: `[Seite 1]\n${serviceBundOfferSubmissionTemplateFragment}\n[Seite 2]\nAbgabefrist: 30.06.2027. Auftraggeber: Stadt Mainz.`,
};
const analysisWithOfferTemplateQuote = {
  ...buildDocumentAnalysis([offerTemplateQuoteDocument]),
  evidence: [{
    field: "requirements" as const,
    value: null,
    documentId: offerTemplateQuoteDocument.id,
    role: "bekanntmachung" as const,
    page: 1,
    quote: serviceBundOfferSubmissionTemplateFragment,
    confidence: 0.9,
    source: "parsed_document" as const,
  }],
};
const offerTemplateEvidenceCheck = buildTenderCheck({
  tenderId: 109,
  tenderDeadlineAt: null,
  structured: { decision_relevant: { requirements: ["Mindestens drei vergleichbare Referenzen"] } },
  documents: [offerTemplateQuoteDocument],
  documentAnalysis: analysisWithOfferTemplateQuote,
});
assert.equal(offerTemplateEvidenceCheck.checklist[0]?.source, null, "Service-Bund signatory boilerplate cannot become a source quote");

const ungroundedQuoteDocument = {
  ...templateAndTenderDocument,
  id: 108,
  extractedText: "Allgemeine Angaben ohne passende Stelle für dieses Verfahren.",
};
const analysisWithUngroundedQuote = {
  ...buildDocumentAnalysis([ungroundedQuoteDocument]),
  evidence: [{
    field: "requirements" as const,
    value: null,
    documentId: ungroundedQuoteDocument.id,
    role: "bekanntmachung" as const,
    page: 1,
    quote: "Nicht belegter, aber formal sauberer Belegtext.",
    confidence: 0.9,
    source: "parsed_document" as const,
  }],
};
const ungroundedEvidenceCheck = buildTenderCheck({
  tenderId: 108,
  tenderDeadlineAt: null,
  structured: { decision_relevant: { requirements: ["Eine technische Mindestanforderung"] } },
  documents: [ungroundedQuoteDocument],
  documentAnalysis: analysisWithUngroundedQuote,
});
assert.equal(ungroundedEvidenceCheck.checklist[0]?.source, null, "quotes not present in a parsed document cannot become visible evidence");

const check = buildTenderCheck({
  tenderId: 1,
  tenderDeadlineAt: new Date("2026-08-15T10:00:00.000+02:00"),
  structured,
  documents: completeDocuments,
});

assert.equal(check.version, 1);
assert.equal(check.status, "complete");
assert.equal(check.coverage.parsed, 2);
assert.equal(check.checklist.length, 3);
assert.equal(new Set(check.checklist.map((item) => item.key)).size, 3);
assert.ok(check.checklist.every((item) => item.source?.documentId));
assert.ok(check.risks.some((risk) => risk.title === "Abgabefristen unterscheiden sich"));
assert.ok(check.risks.some((risk) => risk.title === "Vertragsdauer prüfen"));
assert.ok(!check.risks.some((risk) => risk.title === "Bewertung prüfen"));
assert.ok(check.events.some((event) => event.type === "submission"));
assert.ok(check.events.some((event) => event.type === "validity"));

const partialCheck = buildTenderCheck({
  tenderId: 2,
  tenderDeadlineAt: new Date("2026-08-15T10:00:00.000+02:00"),
  structured: { decision_relevant: { mandatory_documents: ["Bekanntmachung"] } },
  documents: [
    completeDocuments[0],
    {
      id: 103,
      filename: "Duplikat.pdf",
      role: "bekanntmachung",
      parseStatus: "failed",
      downloadStatus: "failed",
      errorMessage: "Download fehlgeschlagen",
      extractedText: null,
      pageCount: null,
      roleConfidence: 0.8,
    },
  ],
});

assert.equal(partialCheck.status, "partial");
assert.equal(partialCheck.coverage.parsed, 1);
assert.equal(partialCheck.coverage.failed, 1);
assert.equal(partialCheck.risks.length, 0);
assert.ok(partialCheck.limitations.length > 0);

// Regression: escaping must happen after truncation so a trailing backslash
// cannot produce an invalid RegExp during SSR.
const boundaryTitle = `Dokument mit ${"x".repeat(106)}\\`;
const boundaryCheck = buildTenderCheck({
  tenderId: 4,
  tenderDeadlineAt: null,
  structured: { decision_relevant: { mandatory_documents: [boundaryTitle] } },
  documents: [{
    id: 104,
    filename: "Anlage.pdf",
    role: "anlage",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "Dokument mit einer Anlage und weiteren Angaben.",
    pageCount: 1,
    roleConfidence: 0.8,
  }],
});
assert.equal(boundaryCheck.checklist.length, 1);

const noDocuments = buildTenderCheck({
  tenderId: 3,
  tenderDeadlineAt: null,
  structured: {},
  documents: [],
});

assert.equal(noDocuments.status, "unknown");
assert.equal(noDocuments.events.length, 0);
assert.equal(noDocuments.nextEvent, null);
assert.ok(noDocuments.limitations.includes("Es liegen noch keine prüfbaren Dokumente vor."));

const calendar = buildTenderCalendarIcs({
  tenderId: 7,
  title: "Test, Ausschreibung; Berlin",
  url: "https://example.test/tender/7",
  events: [{
    key: "submission:test",
    type: "submission",
    title: "Abgabe des Angebots",
    startsAt: "2026-08-15T10:00:00.000Z",
    datePrecision: "minute",
    source: null,
  }],
  now: new Date("2026-08-01T00:00:00.000Z"),
});

assert.match(calendar, /BEGIN:VCALENDAR/);
assert.match(calendar, /BEGIN:VEVENT/);
assert.match(calendar, /SUMMARY:Abgabe des Angebots - Test\\, Ausschreibung\\; Berlin/);
assert.match(calendar, /DTSTART:20260815T100000Z/);
assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
assert.equal(calendarFilename("Ämter, Berlin / 2026"), "amter-berlin-2026");

console.log("Tender check tests passed.");
