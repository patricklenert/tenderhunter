import assert from "node:assert/strict";
import { buildDocumentAnalysis, withEvidenceValues } from "../lib/document-analysis";

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

console.log("Document analysis tests passed.");
