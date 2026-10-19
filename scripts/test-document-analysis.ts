import assert from "node:assert/strict";
import { buildDocumentAnalysis, documentAnalysisFieldLabel, withEvidenceValues } from "../lib/document-analysis";

const analysis = buildDocumentAnalysis([
  {
    id: 1,
    role: "bekanntmachung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "[Seite 2]\nAbgabefrist: 15.08.2026",
    pageCount: 2,
    roleConfidence: 0.85,
  },
  {
    id: 2,
    role: "leistungsbeschreibung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "[Seite 1]\nLeistungsbeschreibung: Dachdeckungsarbeiten am Hauptgebäude",
    pageCount: 1,
    roleConfidence: 0.85,
  },
  {
    id: 4,
    role: "bekanntmachung",
    roles: ["bekanntmachung", "leistungsbeschreibung"],
    roleHints: [
      {
        role: "bekanntmachung",
        confidence: 0.9,
        source: "linktext",
        evidence: [{ source: "linktext", match: "bekanntmachung" }],
      },
      {
        role: "leistungsbeschreibung",
        confidence: 0.9,
        source: "linktext",
        evidence: [{ source: "linktext", match: "leistungsbeschreibung" }],
      },
    ],
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "Bekanntmachung und Leistungsbeschreibung: Abgabefrist und Leistungsumfang.",
    pageCount: 1,
    roleConfidence: 0.9,
  },
]);

assert.equal(analysis.coverageStatus, "complete");
assert.equal(analysis.coverage.parsed, 3);
assert.deepEqual(analysis.coverage.missingRoles, []);
assert.deepEqual(analysis.coverage.byRole.bekanntmachung, { total: 2, parsed: 2 });
assert.deepEqual(analysis.coverage.byRole.leistungsbeschreibung, { total: 2, parsed: 2 });
assert.equal(analysis.evidence.length, 2);
assert.equal(analysis.evidence[0].page, 2);
assert.equal(analysis.evidence[0].documentId, 1);
assert.equal(documentAnalysisFieldLabel("scope"), "Leistungsumfang");

const boundaryAnalysis = buildDocumentAnalysis([
  {
    id: 6,
    role: "leistungsbeschreibung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "XXXXXXXXXX elektronische Abgabe (Qualifizierte elektr. Signatur) Ausschreibungs-ID CXP4Y9PMU06 Auftragsgegenstand 71000000-8 Dienstleistungen von Architektur-, Konstruktions- und Ingenieurbüros und Prüfstellen",
    pageCount: 1,
    roleConfidence: 0.85,
  },
]);
const scopeEvidence = boundaryAnalysis.evidence.find((evidence) => evidence.field === "scope");
assert.ok(scopeEvidence);
assert.match(scopeEvidence.quote, /elektronische Abgabe/);
assert.doesNotMatch(scopeEvidence.quote, /^tronische Abgabe/);

const serviceBundOfferSubmissionTemplateFragment = "Zugelassene Angebotsabgabe elektronisch in Textform mit fortgeschrittener/m Signatur/Siegel. mit qualifizierter/m Signatur/Siegel. schriftlich; Maßnahmen zum Schutz vertraulicher Informationen: Abgabe Verschwiegenheitserklärung";
const mixedTemplateAnalysis = buildDocumentAnalysis([{
  id: 8,
  role: "bekanntmachung",
  roles: ["bekanntmachung", "leistungsbeschreibung"],
  parseStatus: "parsed",
  downloadStatus: "downloaded",
  errorMessage: null,
  extractedText: `[Seite 1]\nAnforderungen: ${serviceBundOfferSubmissionTemplateFragment}\n[Seite 2]\nAbgabefrist: 14.08.2027\nLeistungsbeschreibung: Lieferung von Schulungsmaterial an Schulen.\nMindestanforderung: Mindestens drei vergleichbare Referenzen sind mit dem Angebot vorzulegen.`,
  pageCount: 2,
  roleConfidence: 0.9,
}]);
assert.equal(mixedTemplateAnalysis.coverage.parsed, 1, "a PDF with the form fragment and tender facts remains usable");
assert.ok(mixedTemplateAnalysis.evidence.some((evidence) => evidence.field === "deadline" && /14\.08\.2027/.test(evidence.quote)));
assert.ok(mixedTemplateAnalysis.evidence.some((evidence) => evidence.field === "scope" && evidence.page === 2));
assert.ok(mixedTemplateAnalysis.evidence.some((evidence) => evidence.field === "requirements" && evidence.page === 2));
assert.ok(mixedTemplateAnalysis.evidence.every((evidence) => !evidence.quote.includes(serviceBundOfferSubmissionTemplateFragment)));
assert.ok(mixedTemplateAnalysis.evidence.every((evidence) => !/fortgeschrittener\/m|qualifizierter\/m|Abgabe Verschwiegenheitserklärung/iu.test(evidence.quote)));

const enriched = withEvidenceValues(analysis, { deadline: "15.08.2026" });
assert.equal(enriched.evidence.find((evidence) => evidence.field === "deadline")?.value, "15.08.2026");

const partial = buildDocumentAnalysis([
  {
    id: 3,
    role: "bekanntmachung",
    parseStatus: "failed",
    downloadStatus: "failed",
    errorMessage: "Teilnahme erforderlich",
    extractedText: null,
    pageCount: null,
    roleConfidence: 0.85,
  },
]);
assert.equal(partial.coverageStatus, "blocked");
assert.ok(partial.coverage.missingRoles.includes("leistungsbeschreibung"));

const hintedOnly = buildDocumentAnalysis([
  {
    id: 5,
    role: null,
    roleHints: [{
      role: "leistungsbeschreibung",
      confidence: 0.8,
      source: "content",
      evidence: [{ source: "content", match: "leistungsbeschreibung" }],
    }],
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "Leistungsbeschreibung mit ausreichendem Textinhalt.",
    pageCount: 1,
    roleConfidence: null,
  },
]);
assert.equal(hintedOnly.coverage.byRole.leistungsbeschreibung?.parsed, 1);
assert.ok(hintedOnly.coverage.missingRoles.includes("bekanntmachung"));

const htmlOnly = buildDocumentAnalysis([
  {
    id: 7,
    role: "bekanntmachung",
    parseStatus: "parsed",
    downloadStatus: "downloaded",
    errorMessage: null,
    extractedText: "Portal-Login statt Ausschreibungsdokument mit ausreichendem Text.",
    pageCount: 1,
    roleConfidence: 0.85,
    contentType: "text/html; charset=utf-8",
  },
]);
assert.equal(htmlOnly.coverage.discovered, 0);
assert.equal(htmlOnly.evidence.length, 0);

console.log("Document analysis tests passed.");
