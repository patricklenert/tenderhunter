import assert from "node:assert/strict";
import { buildDocumentAnalysis } from "../lib/document-analysis";
import { evaluateTenderReadiness, isScorableReadiness } from "../lib/tender-readiness";

const completeAnalysis = buildDocumentAnalysis([
  { id: 1, role: "bekanntmachung", parseStatus: "parsed", downloadStatus: "downloaded", errorMessage: null, extractedText: "Bekanntmachung Abgabefrist 15.08.2026", pageCount: 1, roleConfidence: 0.85 },
  { id: 2, role: "leistungsbeschreibung", parseStatus: "parsed", downloadStatus: "downloaded", errorMessage: null, extractedText: "Leistungsbeschreibung Dacharbeiten", pageCount: 1, roleConfidence: 0.85 },
]);

assert.equal(evaluateTenderReadiness({
  qualityStatus: "qualified",
  rawText: "[ROLLE: bekanntmachung] Inhalt",
  structuredExists: true,
  structuredConfidence: 0.8,
  documentAnalysis: completeAnalysis,
}).status, "ready");

assert.equal(evaluateTenderReadiness({
  qualityStatus: "qualified",
  rawText: "Ausschreibung mit Leistungsumfang und Angebotsfrist",
  structuredExists: true,
  structuredConfidence: 0.8,
  documentAnalysis: buildDocumentAnalysis([]),
}).status, "ready");

assert.match(evaluateTenderReadiness({
  qualityStatus: "qualified",
  rawText: "Ausschreibung mit Leistungsumfang und Angebotsfrist",
  structuredExists: true,
  structuredConfidence: 0.34,
  documentAnalysis: buildDocumentAnalysis([]),
}).reason, /zu geringe Konfidenz/);

assert.equal(evaluateTenderReadiness({
  qualityStatus: "candidate",
  rawText: "Ausschreibung mit Leistungsumfang und Angebotsfrist",
  structuredExists: true,
  structuredConfidence: 0.8,
  documentAnalysis: buildDocumentAnalysis([]),
}).status, "pending");

assert.equal(evaluateTenderReadiness({
  qualityStatus: "qualified",
  rawText: "Titel",
  structuredExists: true,
  structuredConfidence: 0.8,
  documentAnalysis: null,
  accessBlocked: true,
}).status, "blocked");

assert.equal(evaluateTenderReadiness({
  qualityStatus: "rejected",
  rawText: "Titel",
  structuredExists: true,
  structuredConfidence: 0.8,
  documentAnalysis: completeAnalysis,
}).status, "manual_review");

assert.equal(isScorableReadiness("ready"), true);
assert.equal(isScorableReadiness("partial"), true);
assert.equal(isScorableReadiness("pending"), false);
assert.equal(isScorableReadiness("manual_review"), false);

console.log("Tender readiness tests passed.");
