import assert from "node:assert/strict";
import { readTenderMeta } from "../lib/tender-meta";
import { getCanonicalTenderSlug } from "../lib/tender-canonical";

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

const structuredMeta = readTenderMeta({
  summary: "Strukturierte Leistungsbeschreibung",
  hard_facts: {
    buyer: "Stadt Mainz",
    location: "55116 Mainz",
  },
  procurement: {
    procedure_type: "Offenes Verfahren",
  },
});
assert.equal(structuredMeta.description, "Strukturierte Leistungsbeschreibung");
assert.equal(structuredMeta.client, "Stadt Mainz");
assert.equal(structuredMeta.location, "55116 Mainz");
assert.equal(structuredMeta.procedure, "Offenes Verfahren");

const structuredSummaryFallback = readTenderMeta({
  description: "Bekanntmachung",
  summary: "Sanierung der Turnhalle in Mainz",
});
assert.equal(structuredSummaryFallback.description, "Sanierung der Turnhalle in Mainz");

const markdownFallback = readTenderMeta({
  descriptionMarkdown: "## Ungeprüft",
  description_markdown: "- **Auftraggeber:** Example",
});
assert.equal(markdownFallback.descriptionMarkdown, "- **Auftraggeber:** Example");

const legacyTitle = "Erneuerung Energiezentrale in Bautzen";
const legacyStructured = { hard_facts: { location: "02625 Bautzen" } };
assert.equal(
  getCanonicalTenderSlug(null, legacyTitle, { client: "Stadt Bautzen", location: legacyTitle }, legacyStructured),
  "erneuerung-energiezentrale-in-bautzen-02625-bautzen",
);

// Listing fallbacks must reject portal labels/location artifacts just like detail metadata.
assert.equal(
  getCanonicalTenderSlug(null, legacyTitle, {
    client: "Stadt Bautzen",
    location: "Ort der Leistungserbringung: Erneuerung Energiezentrale in Bautzen",
  }, legacyStructured),
  "erneuerung-energiezentrale-in-bautzen-02625-bautzen",
);

console.log("Tender metadata tests passed.");
