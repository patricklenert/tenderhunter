import assert from "node:assert/strict";
import { classifyDocumentRole, rolePriority, ROLE_LABELS_DE } from "../lib/document-classifier";

const tests: Array<{ name: string; input: Parameters<typeof classifyDocumentRole>[0]; expectedRole: string; expectedSource?: string }> = [
  // Filename-based classification
  { name: "filename: bekanntmachung.pdf", input: { filename: "Bekanntmachung.pdf" }, expectedRole: "bekanntmachung", expectedSource: "filename" },
  { name: "filename: leistungsbeschreibung.pdf", input: { filename: "Leistungsbeschreibung.pdf" }, expectedRole: "leistungsbeschreibung", expectedSource: "filename" },
  { name: "filename: lv.pdf", input: { filename: "LV.pdf" }, expectedRole: "leistungsverzeichnis", expectedSource: "filename" },
  { name: "filename: eignungsnachweise.pdf", input: { filename: "Eignungsnachweise.pdf" }, expectedRole: "eignung", expectedSource: "filename" },
  { name: "filename: zuschlagskriterien.pdf", input: { filename: "Zuschlagskriterien.pdf" }, expectedRole: "zuschlagskriterien", expectedSource: "filename" },
  { name: "filename: formblatt.pdf", input: { filename: "Formblatt_Eigenerklaerung.pdf" }, expectedRole: "formblatt", expectedSource: "filename" },
  { name: "filename: nachtrag.pdf", input: { filename: "Nachtrag_01.pdf" }, expectedRole: "nachtrag", expectedSource: "filename" },
  { name: "filename: anlage.pdf", input: { filename: "Anlage_3_Plan.pdf" }, expectedRole: "anlage", expectedSource: "filename" },
  // URL-based classification
  { name: "url: /download/bekanntmachung", input: { url: "https://example.de/download/bekanntmachung?id=123" }, expectedRole: "bekanntmachung", expectedSource: "url" },
  { name: "url: /docs/leistungsbeschreibung", input: { url: "https://portal.de/docs/leistungsbeschreibung.pdf" }, expectedRole: "leistungsbeschreibung", expectedSource: "url" },
  // Linktext-based classification
  { name: "linktext: Bekanntmachung herunterladen", input: { linkText: "Bekanntmachung herunterladen" }, expectedRole: "bekanntmachung", expectedSource: "linktext" },
  { name: "linktext: Leistungsverzeichnis", input: { linkText: "Leistungsverzeichnis (LV)" }, expectedRole: "leistungsverzeichnis", expectedSource: "linktext" },
  // Content-based classification
  { name: "content: Leistungsbeschreibung text", input: { textSample: "Leistungsbeschreibung für Reinigungsleistungen im Rahmen der Unterhaltung..." }, expectedRole: "leistungsbeschreibung", expectedSource: "content" },
  { name: "content: Eignung text", input: { textSample: "Eignungsnachweise: Fachkunde, Leistungsfähigkeit und Zuverlässigkeit..." }, expectedRole: "eignung", expectedSource: "content" },
  // Fallback
  { name: "unclassified: document.pdf", input: { filename: "document.pdf", url: "https://example.de/file.pdf" }, expectedRole: "other" },
  // Priority order: filename > url > linktext > content
  { name: "priority: filename beats url", input: { filename: "bekanntmachung.pdf", url: "https://x.de/leistungsbeschreibung" }, expectedRole: "bekanntmachung", expectedSource: "filename" },
];

let passed = 0;
for (const test of tests) {
  const result = classifyDocumentRole(test.input);
  assert.equal(result.role, test.expectedRole, `${test.name}: expected role "${test.expectedRole}", got "${result.role}"`);
  if (test.expectedSource) {
    assert.equal(result.source, test.expectedSource, `${test.name}: expected source "${test.expectedSource}", got "${result.source}"`);
  }
  console.log(`  ✓ ${test.name} → role=${result.role}, source=${result.source}, confidence=${result.confidence}`);
  passed++;
}

// Role priority
assert.ok(rolePriority("leistungsbeschreibung") < rolePriority("bekanntmachung"), "LB should have higher priority than Bekanntmachung");
assert.ok(rolePriority("bekanntmachung") < rolePriority("other"), "Bekanntmachung should have higher priority than other");
console.log("  ✓ role priority order correct");

// Labels
assert.equal(ROLE_LABELS_DE["leistungsbeschreibung"], "Leistungsbeschreibung");
assert.equal(ROLE_LABELS_DE["other"], "Sonstiges");
console.log("  ✓ role labels correct");

console.log(`\n${passed}/${tests.length} classifier tests passed.`);
