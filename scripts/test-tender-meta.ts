import assert from "node:assert/strict";
import { readTenderMeta } from "../lib/tender-meta";

const meta = readTenderMeta({
  pdf_urls: ["https://example.test/legacy.pdf"],
  resources: [{ url: "/notice/42", label: "Bekanntmachung", roleHints: ["bekanntmachung"] }],
  resource_candidates: [{ url: "/download/42", label: "Leistungsbeschreibung", resourceType: "download" }],
  description_markdown: "- **Auftraggeber:** Example",
  source_url: "https://example.test/notice/42",
});

assert.deepEqual(meta.pdfUrls, ["https://example.test/legacy.pdf"]);
assert.equal(meta.resources.length, 1);
assert.equal(meta.resources[0].label, "Bekanntmachung");
assert.equal(meta.resourceCandidates.length, 2);
assert.equal(meta.resourceCandidates[1].resourceType, "download");
assert.equal(meta.sourceUrl, "https://example.test/notice/42");
assert.equal(meta.descriptionMarkdown, "- **Auftraggeber:** Example");

console.log("Tender metadata tests passed.");
