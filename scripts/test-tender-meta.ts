import assert from "node:assert/strict";
import { pickPublicTenderDescription, readPublicTenderIndexMeta, readPublicTenderMeta, readTenderMeta } from "../lib/tender-meta";
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
assert.deepEqual(
  readPublicTenderIndexMeta({
    hard_facts: { buyer: "Stadt Mainz", location: "55116 Mainz" },
  }, { title: "Sanierung Turnhalle", source: "Beispielportal" }),
  { client: "Stadt Mainz", location: "55116 Mainz" },
  "the sitemap's lightweight public metadata reader must preserve normalized buyer and location",
);
assert.deepEqual(
  readPublicTenderIndexMeta({ city: "55116 Mainz", hardFacts: { buyer: "Stadt Mainz" } }, { title: "Sanierung Turnhalle" }),
  { client: readPublicTenderMeta({ city: "55116 Mainz", hardFacts: { buyer: "Stadt Mainz" } }, { title: "Sanierung Turnhalle" }).client, location: "55116 Mainz" },
  "the sitemap metadata reader must preserve legacy camelCase aliases",
);

const portalProcedureMeta = readTenderMeta({
  procedure: "(Losangaben)",
  procedureType: "Offenes Verfahren (sangaben)",
});
assert.equal(portalProcedureMeta.procedure, "Offenes Verfahren");

const invalidProcedureMeta = readTenderMeta({ procedure: "(Losangaben)" });
assert.equal(invalidProcedureMeta.procedure, "");

const structuredSummaryFallback = readTenderMeta({
  description: "Bekanntmachung",
  summary: "Sanierung der Turnhalle in Mainz",
});
assert.equal(structuredSummaryFallback.description, "Sanierung der Turnhalle in Mainz");

const emptyMetadataDescription = readTenderMeta({
  description: "",
  summary: "Strukturiertes Summary ohne Metadatenbeschreibung",
});
assert.equal(emptyMetadataDescription.description, "Strukturiertes Summary ohne Metadatenbeschreibung");

for (const invalidDescription of [undefined, "   ", "## Bekanntmachung"]) {
  assert.equal(
    readTenderMeta({
      description: invalidDescription,
      summary: "Gültiger Metadaten-Summary-Fallback",
    }).description,
    "Gültiger Metadaten-Summary-Fallback",
    "absent, empty, or invalid metadata descriptions must fall through to a valid summary",
  );
}

const aliasMeta = readTenderMeta({
  description: "## Bekanntmachung",
  summary: "Dokumentierte Leistungsbeschreibung",
  city: "55116 Mainz",
  hardFacts: { buyer: "Stadt Mainz", location: "" },
  procurement: { procedureType: "Offenes Verfahren" },
  pdf_urls: [],
  pdfUrls: ["https://example.test/camel.pdf"],
});
assert.equal(aliasMeta.description, "Dokumentierte Leistungsbeschreibung");
assert.equal(aliasMeta.client, "Stadt Mainz");
assert.equal(aliasMeta.location, "55116 Mainz");
assert.equal(aliasMeta.procedure, "Offenes Verfahren");
assert.deepEqual(aliasMeta.pdfUrls, ["https://example.test/camel.pdf"]);

assert.equal(
  pickPublicTenderDescription({
    structured: {
      summary: "## Bekanntmachung",
      decision_relevant: { scope: ["Dokumentierter Leistungsumfang"] },
    },
    metadata: { description: "## location", summary: "Metadaten-Fallback" },
  }),
  "Dokumentierter Leistungsumfang",
  "the shared description picker must skip invalid candidates before later fallbacks",
);
assert.equal(
  pickPublicTenderDescription({
    structured: {
      summary: "## Bekanntmachung",
      description: "Strukturierter Beschaffungsgegenstand",
    },
    metadata: { description: "" },
  }),
  "Strukturierter Beschaffungsgegenstand",
  "an invalid structured summary must not block its valid description alias",
);

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
