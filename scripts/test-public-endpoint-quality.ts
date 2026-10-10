import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizePublicDisplayCandidate,
  normalizePublicProcedureCandidate,
  isCanonicalPublicDescriptionMarkdown,
  normalizePublicClient,
  pickCanonicalPublicDescriptionMarkdown,
  pickValidatedPublicCandidate,
  pickValidatedPublicProcedure,
  pickValidatedPublicLocationForTender,
  projectPublicDisplayFields,
  projectPublicTenderRecord,
} from "@/lib/public-content-quality";
import { detectAccessPage } from "@/lib/access-page-detector";
import {
  buildPublicAccessLimitedDescriptionMarkdown,
  extractPublicPortalFacts,
  getPublicAccessLimitedFallback,
} from "@/lib/public-tender-scraper";
import { buildTenderIndexDocument, projectTenderSearchHit } from "@/lib/meilisearch";
import { normalizeStructured } from "@/lib/structurer";
import { readPublicTenderMeta } from "@/lib/tender-meta";
import { projectPublicTenderDetailFallback } from "@/lib/public-tender-detail-fallback";

// Document-summary cache and generation use this shared normalization before display.
assert.equal(normalizePublicDisplayCandidate("## Bekanntmachung"), null);
assert.equal(normalizePublicDisplayCandidate(""), null);
assert.equal(normalizePublicDisplayCandidate("SERVICE.BUND.DE - Aktuelle Ausschreibungen"), null);
assert.equal(normalizePublicDisplayCandidate("Anmelden erforderlich, um Zugriff zu erhalten"), null);
assert.equal(normalizePublicDisplayCandidate("Dokumentierte Bauleistungen in Mainz"), "Dokumentierte Bauleistungen in Mainz");
assert.equal(
  normalizePublicDisplayCandidate("Die Unterlagen beschreiben die auszuführenden Bauarbeiten."),
  "Die Unterlagen beschreiben die auszuführenden Bauarbeiten.",
);
assert.equal(normalizePublicProcedureCandidate("Offenes Verfahren (sangaben)"), "Offenes Verfahren");
assert.equal(normalizePublicProcedureCandidate("Verhandlungsvergabe mit öffentlichem"), "Verhandlungsvergabe");
assert.equal(
  normalizePublicProcedureCandidate("Verhandlungsvergabe mit öffentlichem Teilnahmewettbewerb"),
  "Verhandlungsvergabe mit öffentlichem Teilnahmewettbewerb",
);
assert.equal(normalizePublicProcedureCandidate("(Losangaben)"), null);
assert.equal(pickValidatedPublicProcedure("(Losangaben)", "Nichtoffenes Verfahren"), "Nichtoffenes Verfahren");

// Similar cards must fall back from artifacts and reject title/client-derived locations.
assert.equal(pickValidatedPublicCandidate("## Bekanntmachung") || "Ausschreibung #42", "Ausschreibung #42");
const cardTitle = pickValidatedPublicCandidate("## Bekanntmachung") || "Ausschreibung #42";
const cardClient = normalizePublicClient("Anmelden erforderlich, um Zugriff zu erhalten");
assert.equal(
  pickValidatedPublicLocationForTender(cardTitle, cardClient, "## Bekanntmachung", "Erneuerung Energiezentrale in Bautzen"),
  "Erneuerung Energiezentrale in Bautzen",
);
assert.equal(
  pickValidatedPublicLocationForTender("Erneuerung Energiezentrale in Bautzen", "Stadt Bautzen", "Erneuerung Energiezentrale in Bautzen"),
  "",
);
assert.equal(pickValidatedPublicLocationForTender("Sanierung in Mainz", "Stadt Mainz", "00023 Anzahl Lose"), "");

const accessMetadata = readPublicTenderMeta(JSON.stringify({
  access_limited: true,
  description: "Für „Sanierung der Turnhalle in Mainz“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Öffentlich sichtbar sind: Auftraggeber: Stadt Mainz; Verfahren: Offenes Verfahren (sangaben); Angebotsfrist: 03.08.2026 08:00. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.",
  procedure: "Offenes Verfahren (sangaben)",
}), { title: "Sanierung der Turnhalle in Mainz", source: "dtvp" });
assert.equal(accessMetadata.accessLimited, true);
assert.equal(accessMetadata.procedure, "Offenes Verfahren");
assert.doesNotMatch(accessMetadata.description, /sangaben|Losangaben/i);
assert.equal(detectAccessPage("Anmelden erforderlich, um Zugriff zu erhalten").blocked, true);

const generatedAccessProcedure = readPublicTenderMeta({
  access_limited: true,
  description: "Für „Auswahlverfahren Ausbildung / Studium ab EJ 2027“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. Öffentlich sichtbar sind: Verfahren: Verhandlungsvergabe mit öffentlichem; Angebotsfrist: 03.08.2026 10:00. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.",
  procedure: "Verhandlungsvergabe mit öffentlichem",
}, { title: "Auswahlverfahren Ausbildung / Studium ab EJ 2027", source: "dtvp" });
assert.equal(generatedAccessProcedure.procedure, "Verhandlungsvergabe");
assert.doesNotMatch(generatedAccessProcedure.description, /Verhandlungsvergabe mit öffentlichem/);

const accessFacts = extractPublicPortalFacts(accessMetadata.description);
const accessMarkdown = buildPublicAccessLimitedDescriptionMarkdown("Sanierung der Turnhalle in Mainz", accessFacts);
const projectedAccessDisplay = projectPublicTenderRecord({
  title: "Sanierung der Turnhalle in Mainz",
  metadata: JSON.stringify({ access_limited: true, description: accessMetadata.description }),
  structured: { summary: "Dokumentierte Bauleistungen in Mainz", hard_facts: { buyer: "Stadt Mainz" } },
  summaryFallbacks: ["Für den Zugriff ist eine Teilnahme erforderlich."],
});
assert.equal(projectedAccessDisplay.summary, "Dokumentierte Bauleistungen in Mainz");
assert.equal(pickCanonicalPublicDescriptionMarkdown("## ungeprüft", accessMarkdown), accessMarkdown);

// One access-limited fixture must project the same safe text through list,
// Meilisearch, modal and server-rendered detail consumers.
const accessFixtureText = [
  "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen.",
  "Auftraggeber: Stadt Mainz",
  "Vergabeart: Offenes Verfahren",
  "Angebotsfrist: 03.08.2026 08:00",
  "Erfüllungsort: 55116 Mainz",
].join("\n");
const accessFixtureTitle = "Sanierung der Turnhalle in Mainz";
const accessFixtureMetadata = {
  access_limited: true,
  description: accessFixtureText,
  client: "Stadt Mainz",
  procedure: "Offenes Verfahren",
  location: "55116 Mainz",
};
const accessFixtureStructured = { summary: "## Bekanntmachung" };
const accessFixtureFallback = getPublicAccessLimitedFallback({
  title: accessFixtureTitle,
  factsText: accessFixtureText,
  evidenceText: accessFixtureText,
  explicitlyAccessLimited: true,
});
assert.ok(accessFixtureFallback);
assert.doesNotMatch(accessFixtureFallback.description, /müssen Sie am Vergabeverfahren teilnehmen/i);
assert.match(accessFixtureFallback.description, /Auftraggeber: Stadt Mainz/);
assert.match(accessFixtureFallback.description, /Verfahren: Offenes Verfahren/);
const normalizedAccessFixture = normalizeStructured(accessFixtureStructured, accessFixtureTitle, {
  buyer: "Stadt Mainz",
  procedure: "Offenes Verfahren",
  location: "55116 Mainz",
});
const listAccessProjection = projectPublicTenderRecord({
  title: accessFixtureTitle,
  metadata: accessFixtureMetadata,
  structured: normalizedAccessFixture,
  summaryFallbacks: [accessFixtureFallback.description],
  descriptionMarkdownFallbacks: [accessFixtureFallback.descriptionMarkdown],
});
const modalAccessProjection = projectPublicDisplayFields({
  title: accessFixtureTitle,
  client: [accessFixtureMetadata.client],
  location: [accessFixtureMetadata.location],
  summary: [accessFixtureFallback.description],
  descriptionMarkdown: [accessFixtureFallback.descriptionMarkdown],
});
const ssrAccessProjection = projectPublicTenderRecord({
  title: accessFixtureTitle,
  metadata: accessFixtureMetadata,
  structured: normalizedAccessFixture,
  summaryFallbacks: [accessFixtureFallback.description],
  descriptionMarkdownFallbacks: [accessFixtureFallback.descriptionMarkdown],
});
const meiliAccessHit = buildTenderIndexDocument({
  id: 902,
  title: accessFixtureTitle,
  source: "dtvp",
  sourceKey: "dtvp",
  url: "https://example.test/tender/902",
  deadlineAt: null,
  firstSeenAt: null,
  category: "Bauarbeiten",
  metadataJson: accessFixtureMetadata,
  structuredJson: accessFixtureStructured,
  rawText: accessFixtureText,
  contractValueMax: null,
  slug: null,
  readinessStatus: "pending",
});
const projectedMeiliAccessHit = projectTenderSearchHit(meiliAccessHit, {
  title: accessFixtureTitle,
  source: "dtvp",
  url: "https://example.test/tender/902",
  metadataJson: accessFixtureMetadata,
  structuredJson: accessFixtureStructured,
  rawText: accessFixtureText,
});
const crossSurfaceFields = (projection: typeof listAccessProjection) => ({
  title: projection.title,
  client: projection.client,
  location: projection.location,
  description: projection.description,
});
const crossSurfaceExpected = crossSurfaceFields(listAccessProjection);
assert.deepEqual(crossSurfaceFields(modalAccessProjection), crossSurfaceExpected);
assert.deepEqual(crossSurfaceFields(ssrAccessProjection), crossSurfaceExpected);
assert.deepEqual({
  title: projectedMeiliAccessHit.title,
  client: projectedMeiliAccessHit.client,
  location: projectedMeiliAccessHit.location,
  description: projectedMeiliAccessHit.description,
}, crossSurfaceExpected);
assert.ok(isCanonicalPublicDescriptionMarkdown(accessFixtureFallback.descriptionMarkdown));
assert.equal(projectedMeiliAccessHit.description, accessFixtureFallback.description);

// An expired structured row is still a normalized public fallback, after the
// current metadata candidates have been validated and rejected.
const detailFallbackTitle = "Energetische Sanierung der Grundschule Mainz";
const invalidDetailMetadata = {
  client: "Anmelden erforderlich, um Zugriff zu erhalten",
  location: "00023 Anzahl Lose",
  description: "## Bekanntmachung",
  descriptionMarkdown: "## ungeprüfte Portalnotiz",
};
const staleDetailStructured = {
  title: detailFallbackTitle,
  summary: "Die Grundschule wird energetisch saniert und erhält eine neue Heizungsanlage.",
  hard_facts: { buyer: "Stadt Mainz", location: "55116 Mainz" },
  decision_relevant: { scope: ["Energetische Sanierung der Grundschule"] },
};
const invalidDetailFallbackFacts = {
  buyer: invalidDetailMetadata.client,
  location: invalidDetailMetadata.location,
  summary: invalidDetailMetadata.description,
};
const staleDetailFallback = projectPublicTenderDetailFallback({
  title: detailFallbackTitle,
  metadataJson: invalidDetailMetadata,
  staleStructuredJson: staleDetailStructured,
  source: "dtvp",
  sourceUrl: "https://example.test/tender/stale",
  fallbackFacts: invalidDetailFallbackFacts,
});
const staleDetailNormalized = normalizeStructured(
  staleDetailStructured,
  detailFallbackTitle,
  invalidDetailFallbackFacts,
);
const staleDetailSsrProjection = projectPublicTenderRecord({
  title: detailFallbackTitle,
  metadata: invalidDetailMetadata,
  structured: staleDetailNormalized,
});
const displayFields = (projection: typeof staleDetailFallback.display) => ({
  title: projection.title,
  client: projection.client,
  location: projection.location,
  summary: projection.summary,
  description: projection.description,
  descriptionMarkdown: projection.descriptionMarkdown,
});
assert.deepEqual(displayFields(staleDetailFallback.display), displayFields(staleDetailSsrProjection));
assert.equal(staleDetailFallback.display.title, detailFallbackTitle);
assert.equal(staleDetailFallback.display.client, "Stadt Mainz");
assert.equal(staleDetailFallback.display.location, "55116 Mainz");
assert.equal(
  staleDetailFallback.display.summary,
  "Die Grundschule wird energetisch saniert und erhält eine neue Heizungsanlage.",
);
assert.equal(staleDetailFallback.display.description, staleDetailFallback.display.summary);
assert.ok(isCanonicalPublicDescriptionMarkdown(staleDetailFallback.display.descriptionMarkdown));

// Without a stale row, the same route helper keeps the normal metadata fallback.
const currentDetailMetadata = {
  client: "Landeshauptstadt Mainz",
  location: "55116 Mainz",
  description: "Die Stadt Mainz erneuert die Beleuchtung einer Schule.",
};
const metadataDetailFallback = projectPublicTenderDetailFallback({
  title: "Erneuerung der Schulbeleuchtung",
  metadataJson: currentDetailMetadata,
  source: "dtvp",
  sourceUrl: "https://example.test/tender/current",
  fallbackFacts: {
    buyer: currentDetailMetadata.client,
    location: currentDetailMetadata.location,
    summary: currentDetailMetadata.description,
  },
});
assert.equal(metadataDetailFallback.display.title, "Erneuerung der Schulbeleuchtung");
assert.equal(metadataDetailFallback.display.client, currentDetailMetadata.client);
assert.equal(metadataDetailFallback.display.location, currentDetailMetadata.location);
assert.equal(metadataDetailFallback.display.summary, currentDetailMetadata.description);
assert.equal(metadataDetailFallback.display.description, currentDetailMetadata.description);

const listRouteSource = readFileSync("app/api/tenders/public/list/route.ts", "utf8");
const detailRouteSource = readFileSync("app/api/tenders/public/detail/route.ts", "utf8");
const ssrPageSource = readFileSync("app/ausschreibung/[...params]/page.tsx", "utf8");
const detailModalSource = readFileSync("components/AusschreibungenSection.tsx", "utf8");
assert.match(listRouteSource, /getPublicAccessLimitedFallback/);
assert.match(detailRouteSource, /getPublicAccessLimitedFallback/);
assert.match(ssrPageSource, /getPublicAccessLimitedFallback/);
assert.match(detailModalSource, /projectPublicDisplayFields/);

console.log("Public endpoint quality tests passed.");
