import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { extractTextFromFile, formatExtractedDocumentText, type ExtractedDocument } from "@/lib/parser";

function makeTextPdf(pages: string[]): string {
  const doc = new jsPDF();
  pages.forEach((text, i) => {
    if (i > 0) doc.addPage();
    doc.text(text, 20, 30);
  });
  const buf = Buffer.from(doc.output("arraybuffer"));
  const tmpPath = path.join(fs.mkdtempSync("/tmp/parser-test-"), "test.pdf");
  fs.writeFileSync(tmpPath, buf);
  return tmpPath;
}

function makeXlsx(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([["Position", "Menge", "Einheit"], ["1", "100", "qm"]]);
  XLSX.utils.book_append_sheet(wb, ws, "LV");
  const tmpPath = path.join(fs.mkdtempSync("/tmp/parser-test-"), "test.xlsx");
  XLSX.writeFile(wb, tmpPath);
  return tmpPath;
}

function makeDocx(documentXml: string | null = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Bekanntmachung &amp; Leistungsbeschreibung</w:t></w:r></w:p>
    <w:p><w:r><w:t>Abgabefrist: 15.08.2026</w:t><w:br/><w:t>Weitere Angaben</w:t></w:r></w:p>
  </w:body>
</w:document>`): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  const zip = new AdmZip();
  if (documentXml !== null) zip.addFile("word/document.xml", Buffer.from(documentXml, "utf8"));
  const tmpPath = path.join(fs.mkdtempSync("/tmp/parser-test-"), "test.docx");
  zip.writeZip(tmpPath);
  return tmpPath;
}

assert.equal(
  formatExtractedDocumentText({
    text: "Complete OCR corpus with the tender scope, deadlines, and eligibility criteria.",
    pages: ["Partial native text"],
    method: "ocr",
  }),
  "Complete OCR corpus with the tender scope, deadlines, and eligibility criteria.",
  "OCR text takes precedence over partial native pages",
);
assert.equal(
  formatExtractedDocumentText({
    text: "Flattened native text",
    pages: ["Native page one", "Native page two"],
    method: "native",
  }),
  "[Seite 1]\nNative page one\n\n[Seite 2]\nNative page two",
  "native pages retain their page-based formatting",
);

async function main(): Promise<void> {
  // Test 1: Text-PDF with 2 pages
  const pdfPath = makeTextPdf([
    "Bekanntmachung: Offenes Vergabeverfahren fuer Dachdeckungsarbeiten am Hauptgebaeude. Abgabefrist 15. August 2026.",
    "Eignungskriterien: Jahresumsatz mindestens 500000 Euro. Zuschlagskriterien: Preis 60 Prozent Qualität 40 Prozent.",
  ]);
  try {
    const result: ExtractedDocument = await extractTextFromFile(pdfPath, "application/pdf");
    assert.ok(result.text.length > 50, `text length > 50 (got ${result.text.length})`);
    assert.ok(/Bekanntmachung/i.test(result.text), "text contains Bekanntmachung");
    assert.equal(result.pageCount, 2, `pageCount = 2 (got ${result.pageCount})`);
    assert.equal(result.pages.length, 2, `page text contains 2 pages (got ${result.pages.length})`);
    assert.ok(result.pages[0].includes("Bekanntmachung"), "first page text is retained");
    assert.equal(result.method, "native", `method = native (got ${result.method})`);
    assert.equal(result.truncated, false, "not truncated");
    console.log("Test 1 (text-PDF): PASS —", result.text.length, "Zeichen,", result.pageCount, "Seiten, method:", result.method);
  } finally {
    fs.rmSync(path.dirname(pdfPath), { recursive: true, force: true });
  }

  // Test 2: XLSX extraction
  const xlsxPath = makeXlsx();
  try {
    const result = await extractTextFromFile(xlsxPath, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.ok(result.text.includes("Position"), "xlsx text contains Position");
    assert.ok(result.text.includes("100"), "xlsx text contains quantity");
    assert.equal(result.method, "xlsx", `method = xlsx (got ${result.method})`);
    assert.equal(result.pageCount, null, "xlsx pageCount = null");
    console.log("Test 2 (XLSX): PASS —", result.text.slice(0, 60).replace(/\n/g, " "));
  } finally {
    fs.rmSync(path.dirname(xlsxPath), { recursive: true, force: true });
  }

  // Test 3: Return-type contract (all fields present and correct types)
  const contractPdf = makeTextPdf(["Minimal contract test document with enough text to pass the native extraction threshold easily here."]);
  try {
    const result = await extractTextFromFile(contractPdf, "application/pdf");
    assert.ok(typeof result.text === "string", "text is string");
    assert.ok(Array.isArray(result.pages), "pages is an array");
    assert.ok(result.pageCount === null || typeof result.pageCount === "number", "pageCount is number|null");
    assert.ok(["native", "ocr", "fallback_native", "ocr_skipped_size", "xlsx", "html", "zip", "docx", "doc", "plain"].includes(result.method), "method is valid ExtractionMethod");
    assert.ok(typeof result.truncated === "boolean", "truncated is boolean");
    console.log("Test 3 (contract): PASS —", JSON.stringify({ method: result.method, pageCount: result.pageCount, truncated: result.truncated }));
  } finally {
    fs.rmSync(path.dirname(contractPdf), { recursive: true, force: true });
  }

  // Test 4: HTML extraction
  const htmlTmp = path.join(fs.mkdtempSync("/tmp/parser-test-"), "test.html");
  fs.writeFileSync(htmlTmp, "<html><head><meta charset='utf-8'></head><body><h1>Vergabeunterlagen</h1><p>Bekanntmachung Test</p></body></html>");
  try {
    const result = await extractTextFromFile(htmlTmp, "text/html");
    assert.ok(result.text.includes("Vergabeunterlagen"), "html text extracted");
    assert.equal(result.method, "html", "method = html");
    console.log("Test 4 (HTML): PASS —", result.text.slice(0, 60).replace(/\n/g, " "));
  } finally {
    fs.rmSync(path.dirname(htmlTmp), { recursive: true, force: true });
  }

  // Test 5: DOCX XML extraction
  const docxPath = makeDocx();
  try {
    const result = await extractTextFromFile(docxPath, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.equal(result.method, "docx", "method = docx");
    assert.ok(result.text.includes("Bekanntmachung & Leistungsbeschreibung"), "docx entities are decoded");
    assert.ok(result.text.includes("Abgabefrist: 15.08.2026"), "docx text is extracted");
  } finally {
    fs.rmSync(path.dirname(docxPath), { recursive: true, force: true });
  }
  console.log("Test 5 (DOCX): PASS");

  // Test 6: Empty and malformed DOCX files are safe no-op parses
  const emptyDocxPath = makeDocx(null);
  const malformedDocxPath = path.join(fs.mkdtempSync("/tmp/parser-test-"), "malformed.docx");
  fs.writeFileSync(malformedDocxPath, Buffer.from("not a ZIP archive", "utf8"));
  try {
    const empty = await extractTextFromFile(emptyDocxPath);
    assert.equal(empty.method, "docx", "empty DOCX method = docx");
    assert.equal(empty.text, "", "empty DOCX has no text");
    const malformed = await extractTextFromFile(malformedDocxPath);
    assert.equal(malformed.method, "docx", "malformed DOCX method = docx");
    assert.equal(malformed.text, "", "malformed DOCX has no text");
  } finally {
    fs.rmSync(path.dirname(emptyDocxPath), { recursive: true, force: true });
    fs.rmSync(path.dirname(malformedDocxPath), { recursive: true, force: true });
  }
  console.log("Test 6 (empty/malformed DOCX): PASS");

  // Test 7: Legacy DOC fallback is safe even without external converters
  const docPath = path.join(fs.mkdtempSync("/tmp/parser-test-"), "legacy.doc");
  fs.writeFileSync(docPath, Buffer.from("not a legacy Word document", "utf8"));
  try {
    const result = await extractTextFromFile(docPath);
    assert.equal(result.method, "doc", "method = doc");
    assert.ok(typeof result.text === "string", "DOC fallback returns text");
  } finally {
    fs.rmSync(path.dirname(docPath), { recursive: true, force: true });
  }
  console.log("Test 7 (DOC fallback): PASS");

  console.log("\nAll parser tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
