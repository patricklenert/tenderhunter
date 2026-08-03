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
]);

assert.equal(analysis.coverageStatus, "complete");
assert.equal(analysis.coverage.parsed, 2);
assert.deepEqual(analysis.coverage.missingRoles, []);
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

console.log("Document analysis tests passed.");
