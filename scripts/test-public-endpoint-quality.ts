import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizePublicDisplayCandidate,
  normalizePublicProcedureCandidate,
  isCanonicalPublicDescriptionMarkdown,
  hasCanonicalPublicDescriptionSection,
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
  buildPublicAccessLimitedDescription,
  buildPublicAccessLimitedDescriptionMarkdown,
  extractPublicPortalFacts,
  getPublicAccessLimitedFallback,
} from "@/lib/public-tender-scraper";
import {
  buildTenderIndexDocument,
  projectTenderSearchHit,
  selectTenderSearchFallbackResults,
} from "@/lib/meilisearch";
import { normalizeStructured } from "@/lib/structurer";
import { readPublicTenderMeta } from "@/lib/tender-meta";
import { projectPublicTenderDetailFallback } from "@/lib/public-tender-detail-fallback";
import { resolvePublicTenderDisplayFacts } from "@/lib/public-tender-display-facts";
import { resolvePublicDeadlineRepair } from "@/lib/public-deadline-backfill";
import { formatDeadlineDE, parseDeadlineDate } from "@/lib/date-utils";

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
const serviceBundOfferSubmissionTemplateFragment = "Zugelassene Angebotsabgabe elektronisch in Textform mit fortgeschrittener/m Signatur/Siegel. mit qualifizierter/m Signatur/Siegel. schriftlich; Maßnahmen zum Schutz vertraulicher Informationen: Abgabe Verschwiegenheitserklärung";
const liveTemplateMarkdown = `- **Anforderungen:** ${serviceBundOfferSubmissionTemplateFragment}`;
const cleanTenderMarkdown = "- **Leistungsumfang:** Lieferung von Schulungsmaterial an Schulen.\n- **Anforderungen:** Mindestens drei vergleichbare Referenzen sind mit dem Angebot vorzulegen.";
const liveDetailMarkdownProjection = projectPublicDisplayFields({
  descriptionMarkdown: [liveTemplateMarkdown, cleanTenderMarkdown],
});
assert.equal(normalizePublicDisplayCandidate(serviceBundOfferSubmissionTemplateFragment), null);
assert.equal(liveDetailMarkdownProjection.descriptionMarkdown, cleanTenderMarkdown);
assert.doesNotMatch(liveDetailMarkdownProjection.descriptionMarkdown ?? "", /fortgeschrittener\/m|qualifizierter\/m|Verschwiegenheitserklärung/);
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

// A non-null but invalid metadata description must not shadow valid structured
// prose in the index, list/detail projection, or modal's shared projection.
const qualityFixtureTitle = "Energetische Sanierung der Grundschule Mainz";
const qualityFixtureSummary = "Die Grundschule erhält eine neue Heizungsanlage und eine verbesserte Wärmedämmung.";
const invalidPortalSummary = "- Verfahren - - - Lose - Ergebnisse - Verträge - - - -";
const qualityFixtureMetadata = { description: invalidPortalSummary, location: "##", client: "Stadt Mainz" };
const qualityFixtureStructured = {
  summary: qualityFixtureSummary,
  hard_facts: { buyer: "Stadt Mainz", location: "55116 Mainz" },
  decision_relevant: { scope: ["Energetische Sanierung der Grundschule"] },
};
const qualityFixtureNormalized = normalizeStructured(qualityFixtureStructured, qualityFixtureTitle);
const qualityFixtureList = projectPublicTenderRecord({
  title: qualityFixtureTitle,
  metadata: qualityFixtureMetadata,
  structured: qualityFixtureNormalized,
});
const qualityFixtureDetail = projectPublicTenderDetailFallback({
  title: qualityFixtureTitle,
  metadataJson: qualityFixtureMetadata,
  staleStructuredJson: qualityFixtureStructured,
  fallbackFacts: {},
}).display;
const qualityFixtureModal = projectPublicDisplayFields({
  title: qualityFixtureDetail.title,
  client: qualityFixtureDetail.client,
  location: qualityFixtureDetail.location,
  summary: qualityFixtureDetail.description,
});
const qualityFixtureIndex = buildTenderIndexDocument({
  id: 907,
  title: qualityFixtureTitle,
  source: "dtvp",
  sourceKey: "dtvp",
  url: "https://example.test/tender/907",
  deadlineAt: null,
  firstSeenAt: null,
  category: "Bauarbeiten",
  metadataJson: qualityFixtureMetadata,
  structuredJson: qualityFixtureStructured,
  rawText: qualityFixtureSummary,
  contractValueMax: null,
  slug: null,
  readinessStatus: "pending",
});
const qualityFixtureSearchHit = projectTenderSearchHit(qualityFixtureIndex, {
  title: qualityFixtureTitle,
  source: "dtvp",
  url: "https://example.test/tender/907",
  metadataJson: qualityFixtureMetadata,
  structuredJson: qualityFixtureStructured,
  rawText: qualityFixtureSummary,
});
const publicFields = (projection: {
  title: string | null;
  client: string | null;
  location: string | null;
  description: string | null;
}) => ({
  title: projection.title,
  client: projection.client,
  location: projection.location,
  description: projection.description,
});
const qualityFixtureExpected = publicFields(qualityFixtureList);
assert.equal(qualityFixtureExpected.location, "55116 Mainz");
assert.equal(qualityFixtureExpected.description, qualityFixtureSummary);
assert.deepEqual(publicFields(qualityFixtureDetail), qualityFixtureExpected);
assert.deepEqual(publicFields(qualityFixtureModal), qualityFixtureExpected);
assert.deepEqual(publicFields(qualityFixtureIndex), qualityFixtureExpected);
assert.deepEqual(publicFields(qualityFixtureSearchHit), qualityFixtureExpected);
const truncatedScopeTitle = "2000-9 Besucherleitsystem, LRA Heidelberg VG, Bodenbelagsarbeiten RNK_EBBAU-2026-0029";
const truncatedScopeFallback = "Ausschreibung von Bodenbelagsarbeiten für das Landratsamt Rhein-Neckar-Kreis in Heidelberg.";
const truncatedScopeMetadata = {
  description: truncatedScopeFallback,
  client: "Landratsamt Rhein-Neckar-Kreis",
  location: "69115 Heidelberg",
};
const truncatedScopeStructured = {
  summary: "Fliesenarbeiten",
  hard_facts: { buyer: "Landratsamt Rhein-Neckar-Kreis", location: "69115 Heidelberg" },
  decision_relevant: { scope: ["Fliesenarbeiten", "Epoxidharzbeschichtung", "(GTL"] },
};
const truncatedScopeList = projectPublicTenderRecord({
  title: truncatedScopeTitle,
  metadata: truncatedScopeMetadata,
  structured: normalizeStructured(truncatedScopeStructured, truncatedScopeTitle),
});
const truncatedScopeDetail = projectPublicTenderDetailFallback({
  title: truncatedScopeTitle,
  metadataJson: truncatedScopeMetadata,
  staleStructuredJson: truncatedScopeStructured,
  fallbackFacts: {},
}).display;
const truncatedScopeModal = projectPublicDisplayFields({
  title: truncatedScopeDetail.title,
  client: truncatedScopeDetail.client,
  location: truncatedScopeDetail.location,
  summary: truncatedScopeDetail.description,
});
const truncatedScopeIndex = buildTenderIndexDocument({
  id: 908,
  title: truncatedScopeTitle,
  source: "dtvp",
  sourceKey: "dtvp",
  url: "https://example.test/tender/908",
  deadlineAt: null,
  firstSeenAt: null,
  category: "Bauarbeiten",
  metadataJson: truncatedScopeMetadata,
  structuredJson: truncatedScopeStructured,
  rawText: truncatedScopeFallback,
  contractValueMax: null,
  slug: null,
  readinessStatus: "partial",
});
const truncatedScopeSearchHit = projectTenderSearchHit(truncatedScopeIndex, {
  title: truncatedScopeTitle,
  source: "dtvp",
  url: "https://example.test/tender/908",
  metadataJson: truncatedScopeMetadata,
  structuredJson: truncatedScopeStructured,
  rawText: truncatedScopeFallback,
});
const truncatedScopeExpected = publicFields(truncatedScopeList);
assert.equal(truncatedScopeExpected.description, truncatedScopeFallback);
assert.deepEqual(publicFields(truncatedScopeDetail), truncatedScopeExpected);
assert.deepEqual(publicFields(truncatedScopeModal), truncatedScopeExpected);
assert.deepEqual(publicFields(truncatedScopeIndex), truncatedScopeExpected);
assert.deepEqual(publicFields(truncatedScopeSearchHit), truncatedScopeExpected);
assert.equal(normalizePublicDisplayCandidate("- Verfahren - - - Lose - Ergebnisse - Verträge - - - -"), null);
assert.equal(normalizePublicDisplayCandidate("## Bekanntmachung"), null);
const duplicateFactMarkdown = "- **Auftraggeber:** Stadt Mainz\n- **Leistungsort:** 55116 Mainz";
assert.equal(hasCanonicalPublicDescriptionSection(duplicateFactMarkdown, "Auftraggeber"), true);
assert.equal(hasCanonicalPublicDescriptionSection(duplicateFactMarkdown, "Leistungsort"), true);
assert.equal(hasCanonicalPublicDescriptionSection("## Ungeprüft", "Auftraggeber"), false);
assert.equal(
  projectPublicDisplayFields({
    location: ["##", "55116 Mainz"],
    summary: ["- Verfahren - - - Lose - Ergebnisse - Verträge - - - -", qualityFixtureSummary],
  }).description,
  qualityFixtureSummary,
  "invalid first candidates must not block a valid later fallback",
);

const fallbackSearchDocument = (
  overrides: Partial<typeof qualityFixtureIndex>,
) => ({
  ...qualityFixtureIndex,
  deadlineAt: 5_000,
  firstSeenAt: 200,
  hasDeadline: true,
  bundesland: "Rheinland-Pfalz",
  city: "Mainz",
  category: "Bauarbeiten",
  source: "dtvp",
  smallVendorFit: 60,
  ...overrides,
});
const fallbackSearchDocuments = [
  fallbackSearchDocument({ id: 920, firstSeenAt: 300, deadlineAt: 900, smallVendorFit: 80 }),
  fallbackSearchDocument({ id: 921, firstSeenAt: 250, deadlineAt: 950, smallVendorFit: 70, source: "service-bund" }),
  fallbackSearchDocument({ id: 922, firstSeenAt: 250, deadlineAt: 950, smallVendorFit: 95, city: "Koblenz" }),
  fallbackSearchDocument({ id: 923, firstSeenAt: 250, deadlineAt: 700, smallVendorFit: 95 }),
  fallbackSearchDocument({ id: 924, firstSeenAt: 250, deadlineAt: 950, smallVendorFit: 95, source: "other" }),
];
const fallbackSearchParams = {
  query: "Grundschule Mainz",
  bundesland: "Rheinland-Pfalz",
  city: "Mainz",
  category: "Bauarbeiten",
  source: ["dtvp", "service-bund"],
  firstSeenAtFrom: 200,
  firstSeenAtTo: 400,
  hasDeadline: true,
  deadlineAtFrom: 800,
  deadlineAtTo: 1_000,
  smallVendorFitMin: 65,
  sort: "smallVendorFit" as const,
  limit: 1,
  page: 1,
};
const fallbackSearchPage = selectTenderSearchFallbackResults(
  fallbackSearchParams,
  fallbackSearchDocuments,
  100,
);
assert.equal(fallbackSearchPage.estimatedTotalHits, 2);
assert.equal(fallbackSearchPage.hits[0]?.id, 920);
assert.equal(fallbackSearchPage.hits[0]?.description, qualityFixtureSummary);
assert.equal(fallbackSearchPage.hits[0]?.location, "55116 Mainz");
const fallbackSearchPageTwo = selectTenderSearchFallbackResults(
  { ...fallbackSearchParams, page: 2 },
  fallbackSearchDocuments,
  100,
);
assert.equal(fallbackSearchPageTwo.hits[0]?.id, 921, "DB fallback applies the same ordering and page offset");
assert.equal(
  selectTenderSearchFallbackResults({ ...fallbackSearchParams, source: [] }, fallbackSearchDocuments, 100).estimatedTotalHits,
  0,
  "an explicitly empty source filter returns no fallback matches",
);

// A source portal's Bundesland is not evidence of the tender's performance
// location and must not leak into the list/modal display as one.
const portalRegionOnlyTitle = "Rahmenzeitvertragsarbeiten 2027 - 2030";
const portalRegionOnlySummary = "Instandhaltungsarbeiten an Gebäuden und technischen Anlagen.";
const portalRegionOnlyMetadata = { description: portalRegionOnlySummary, location: "##" };
const portalRegionOnlyStructured = { summary: portalRegionOnlySummary, hard_facts: { location: "##" } };
const portalRegionOnlyIndex = buildTenderIndexDocument({
  id: 906,
  title: portalRegionOnlyTitle,
  source: "brandenburg",
  sourceKey: "brandenburg",
  url: "https://example.test/tender/906",
  deadlineAt: null,
  firstSeenAt: null,
  category: "Bauarbeiten",
  metadataJson: portalRegionOnlyMetadata,
  structuredJson: portalRegionOnlyStructured,
  rawText: portalRegionOnlySummary,
  contractValueMax: null,
  slug: null,
  readinessStatus: "partial",
});
const portalRegionOnlySearchHit = projectTenderSearchHit({
  ...portalRegionOnlyIndex,
  bundesland: "Mecklenburg-Vorpommern",
}, {
  title: portalRegionOnlyTitle,
  source: "brandenburg",
  url: "https://example.test/tender/906",
  metadataJson: portalRegionOnlyMetadata,
  structuredJson: portalRegionOnlyStructured,
  rawText: portalRegionOnlySummary,
});
const portalRegionOnlyDetail = projectPublicTenderDetailFallback({
  title: portalRegionOnlyTitle,
  metadataJson: portalRegionOnlyMetadata,
  staleStructuredJson: portalRegionOnlyStructured,
  source: "brandenburg",
  sourceUrl: "https://example.test/tender/906",
  fallbackFacts: {},
});
const portalRegionOnlyList = projectPublicDisplayFields({
  title: portalRegionOnlySearchHit.title,
  client: portalRegionOnlySearchHit.client,
  location: portalRegionOnlySearchHit.location,
  summary: portalRegionOnlySearchHit.description,
});
const portalRegionOnlyModal = projectPublicDisplayFields({
  title: portalRegionOnlyDetail.display.title,
  client: portalRegionOnlyDetail.display.client,
  location: [portalRegionOnlyDetail.display.location, portalRegionOnlySearchHit.location],
  summary: portalRegionOnlyDetail.display.description,
});
const portalRegionOnlySsr = projectPublicTenderRecord({
  title: portalRegionOnlyTitle,
  metadata: portalRegionOnlyMetadata,
  structured: normalizeStructured(portalRegionOnlyStructured, portalRegionOnlyTitle),
});
assert.equal(portalRegionOnlyIndex.bundesland, "Brandenburg");
assert.equal(portalRegionOnlySearchHit.bundesland, "Brandenburg", "current trusted source region replaces a stale indexed region");
assert.equal(portalRegionOnlySearchHit.location, "");
assert.equal(portalRegionOnlyList.location, null);
assert.equal(portalRegionOnlyModal.location, null);
assert.equal(portalRegionOnlySsr.location, null);

// Parsed public location facts must have the same fallback on list/index and
// detail surfaces, even when the explicit location field is an artifact.
const parsedLocationFallback = buildPublicAccessLimitedDescription(accessFixtureTitle, {
  client: "Stadt Mainz",
  procedure: null,
  deadline: null,
  location: "55116 Mainz",
  subject: null,
});
assert.equal(extractPublicPortalFacts(parsedLocationFallback).location, "55116 Mainz");
const parsedLocationMetadata = {
  access_limited: true,
  description: parsedLocationFallback,
  client: "Stadt Mainz",
  location: "##",
};
const parsedLocationStructured = { summary: "## Bekanntmachung", hard_facts: { location: "##" } };
const parsedLocationIndex = buildTenderIndexDocument({
  id: 903,
  title: accessFixtureTitle,
  source: "dtvp",
  sourceKey: "dtvp",
  url: "https://example.test/tender/903",
  deadlineAt: null,
  firstSeenAt: null,
  category: "Bauarbeiten",
  metadataJson: parsedLocationMetadata,
  structuredJson: parsedLocationStructured,
  rawText: "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen.",
  contractValueMax: null,
  slug: null,
  readinessStatus: "pending",
});
assert.equal(parsedLocationIndex.location, "55116 Mainz");
const parsedLocationFacts = extractPublicPortalFacts(parsedLocationFallback);
const normalizedParsedLocation = normalizeStructured(parsedLocationStructured, accessFixtureTitle, {
  buyer: parsedLocationMetadata.client,
  location: parsedLocationFacts.location,
});
const parsedLocationListProjection = projectPublicTenderRecord({
  title: accessFixtureTitle,
  metadata: parsedLocationMetadata,
  structured: normalizedParsedLocation,
  locationFallbacks: [parsedLocationFacts.location],
});
const parsedLocationModalProjection = projectPublicDisplayFields({
  title: accessFixtureTitle,
  client: [parsedLocationMetadata.client],
  location: [parsedLocationMetadata.location, parsedLocationFacts.location],
  summary: [parsedLocationStructured.summary, parsedLocationMetadata.description],
});
const parsedLocationDetailProjection = projectPublicTenderRecord({
  title: accessFixtureTitle,
  metadata: parsedLocationMetadata,
  structured: normalizedParsedLocation,
  locationFallbacks: [parsedLocationFacts.location],
});
const parsedLocationSurfaceFields = (projection: {
  title: string | null;
  client: string | null;
  location: string | null;
  description: string | null;
}) => ({
  title: projection.title,
  client: projection.client,
  location: projection.location,
  description: projection.description,
});
const parsedLocationExpected = parsedLocationSurfaceFields(parsedLocationListProjection);
assert.equal(parsedLocationExpected.location, "55116 Mainz");
assert.deepEqual(parsedLocationSurfaceFields(parsedLocationModalProjection), parsedLocationExpected);
assert.deepEqual(parsedLocationSurfaceFields(parsedLocationDetailProjection), parsedLocationExpected);
assert.deepEqual({
  title: parsedLocationIndex.title,
  client: parsedLocationIndex.client,
  location: parsedLocationIndex.location,
  description: parsedLocationIndex.description,
}, parsedLocationExpected);

const staleIndexedLocation = projectTenderSearchHit({
  ...meiliAccessHit,
  id: 904,
  bundesland: "Brandenburg",
  location: "55116 Mainz",
  city: "Mainz",
}, {
  title: accessFixtureTitle,
  source: "dtvp",
  url: "https://example.test/tender/904",
  metadataJson: { location: "##" },
  structuredJson: { summary: "## Bekanntmachung", hard_facts: { location: "##" } },
});
assert.equal(staleIndexedLocation.location, "", "a stale indexed location must not outlive the current DB projection");
assert.equal(staleIndexedLocation.city, null);
assert.equal(staleIndexedLocation.bundesland, null, "a stale indexed region must not outlive current location/source evidence");

const neubrandenburgTitle = "Gefährdungsbeurteilung";
const neubrandenburgMetadata = { location: "17033 Neubrandenburg" };
const neubrandenburgStructured = { hard_facts: { location: "17033 Neubrandenburg" } };
const neubrandenburgIndex = buildTenderIndexDocument({
  id: 14706,
  title: neubrandenburgTitle,
  source: "dtvp",
  sourceKey: "dtvp",
  url: "https://example.test/tender/14706",
  deadlineAt: null,
  firstSeenAt: null,
  category: "Bauarbeiten",
  metadataJson: neubrandenburgMetadata,
  structuredJson: neubrandenburgStructured,
  rawText: "Ausführungsort: 17033 Neubrandenburg",
  contractValueMax: null,
  slug: null,
  readinessStatus: "pending",
});
assert.equal(neubrandenburgIndex.location, "17033 Neubrandenburg");
assert.equal(neubrandenburgIndex.bundesland, "Mecklenburg-Vorpommern");
const staleNeubrandenburgSearchHit = projectTenderSearchHit({
  ...neubrandenburgIndex,
  bundesland: "Brandenburg",
}, {
  title: neubrandenburgTitle,
  source: "dtvp",
  url: "https://example.test/tender/14706",
  metadataJson: neubrandenburgMetadata,
  structuredJson: neubrandenburgStructured,
  rawText: "Ausführungsort: 17033 Neubrandenburg",
});
assert.equal(staleNeubrandenburgSearchHit.bundesland, "Mecklenburg-Vorpommern");
const mecklenburgVorpommernSearchPage = selectTenderSearchFallbackResults(
  { query: "", bundesland: "Mecklenburg-Vorpommern" },
  [neubrandenburgIndex],
  0,
);
const brandenburgSearchPage = selectTenderSearchFallbackResults(
  { query: "", bundesland: "Brandenburg" },
  [neubrandenburgIndex],
  0,
);
assert.deepEqual(mecklenburgVorpommernSearchPage.hits.map(({ id }) => id), [14706]);
assert.deepEqual(brandenburgSearchPage.hits, []);

const mvRegionSource = {
  title: "Erneuerung der Ausstattung",
  source: "net-mecklenburg-vorpommern",
  sourceKey: "net-mecklenburg-vorpommern",
  url: "https://vergabe.mv-regierung.de/tender/location-regression",
  deadlineAt: null,
  firstSeenAt: null,
  category: "Bauarbeiten",
  contractValueMax: null,
  slug: null,
  readinessStatus: "pending",
};
const buildMvRegionIndex = (id: number, location: string | null) => buildTenderIndexDocument({
  ...mvRegionSource,
  id,
  metadataJson: location ? { location } : {},
  structuredJson: location ? { hard_facts: { location } } : {},
  rawText: location ? `Ausführungsort: ${location}` : null,
});
const reprojectMvRegionHit = (
  hit: ReturnType<typeof buildTenderIndexDocument>,
  location: string | null,
  staleBundesland: string | null,
) => projectTenderSearchHit({
  ...hit,
  bundesland: staleBundesland,
}, {
  title: mvRegionSource.title,
  source: mvRegionSource.source,
  url: mvRegionSource.url,
  metadataJson: location ? { location } : {},
  structuredJson: location ? { hard_facts: { location } } : {},
  rawText: location ? `Ausführungsort: ${location}` : null,
});

const wittenbergeIndex = buildMvRegionIndex(14707, "19322 Wittenberge");
assert.equal(wittenbergeIndex.location, "19322 Wittenberge");
assert.equal(wittenbergeIndex.bundesland, "Brandenburg");
assert.equal(
  reprojectMvRegionHit(wittenbergeIndex, "19322 Wittenberge", "Mecklenburg-Vorpommern").bundesland,
  "Brandenburg",
  "a current city location must override a stale region and the portal region",
);

const ambiguousPostalIndex = buildMvRegionIndex(14708, "19322");
assert.equal(ambiguousPostalIndex.location, "19322");
assert.equal(ambiguousPostalIndex.bundesland, null);
assert.equal(
  reprojectMvRegionHit(ambiguousPostalIndex, "19322", "Brandenburg").bundesland,
  null,
  "an ambiguous current location must not inherit a portal region or stale indexed region",
);

const absentLocationIndex = buildMvRegionIndex(14709, null);
assert.equal(absentLocationIndex.location, "");
assert.equal(absentLocationIndex.bundesland, "Mecklenburg-Vorpommern");
assert.equal(
  reprojectMvRegionHit(absentLocationIndex, null, "Brandenburg").bundesland,
  "Mecklenburg-Vorpommern",
  "a trusted source may supply a region when the current location is absent",
);

const staleIndexedFacts = projectTenderSearchHit({
  ...meiliAccessHit,
  id: 906,
  client: "Veralteter Auftraggeber",
  deadlineAt: 1,
  hasDeadline: true,
  procedureType: "Veraltetes Verfahren",
}, {
  title: accessFixtureTitle,
  source: "dtvp",
  url: "https://example.test/tender/906",
  metadataJson: { client: "##", description: "##", location: "##", procedure: "##", subject: "##" },
  structuredJson: {
    summary: "## Bekanntmachung",
    hard_facts: { buyer: "##", location: "##", deadline: "##" },
    procurement: { procedure_type: "##" },
    decision_relevant: { scope: ["--"] },
  },
  deadlineAt: null,
  procedureType: "##",
});
assert.equal(staleIndexedFacts.client, "Unbekannt", "a stale indexed client must not replace invalid current values");
assert.equal(staleIndexedFacts.deadlineAt, null, "a stale indexed deadline must not replace invalid current values");
assert.equal(staleIndexedFacts.procedureType, null, "a stale indexed procedure must not replace invalid current values");

// Source-labelled facts in metadata descriptions must resolve identically in
// the live Meilisearch list, modal, and server-rendered detail projections.
const sourceOnlyFacts = {
  client: "Stadt Mainz",
  procedure: "Offenes Verfahren",
  deadline: "04.02.2030 23:59",
  location: "55116 Mainz",
  subject: "Erneuerung der Turnhalle",
};
const legacyServerTimezoneDeadline = new Date("2030-02-04T23:59:00.000Z");
const correctedBerlinDeadline = parseDeadlineDate(sourceOnlyFacts.deadline)!;
const sourceOnlyDescription = buildPublicAccessLimitedDescription(accessFixtureTitle, sourceOnlyFacts);
const sourceOnlyMetadata = readPublicTenderMeta({
  access_limited: true,
  description: sourceOnlyDescription,
  client: "##",
  procedure: "--",
  location: "##",
  subject: "---",
}, { title: accessFixtureTitle, source: "dtvp" });
const sourceOnlyStructured = {
  summary: "## Bekanntmachung",
  hard_facts: { buyer: "##", location: "##", deadline: "##" },
  decision_relevant: { scope: ["-", "--"] },
  procurement: { procedure_type: "--" },
};
const sourceOnlyDisplayFacts = resolvePublicTenderDisplayFacts({
  title: accessFixtureTitle,
  metadata: sourceOnlyMetadata,
  deadlineAt: correctedBerlinDeadline,
  procedureType: "--",
  hasUsableRawText: true,
});
assert.deepEqual(sourceOnlyDisplayFacts.fallbackFacts, {
  buyer: sourceOnlyFacts.client,
  procedure: sourceOnlyFacts.procedure,
  deadline: "04.02.2030",
  location: sourceOnlyFacts.location,
  summary: sourceOnlyDescription,
  scope: sourceOnlyFacts.subject,
});
assert.equal(sourceOnlyDisplayFacts.deadlineAt?.toISOString(), parseDeadlineDate(sourceOnlyFacts.deadline)?.toISOString());
assert.equal(sourceOnlyDisplayFacts.deadlineAt?.toISOString(), "2030-02-04T22:59:00.000Z");
assert.equal(formatDeadlineDE(sourceOnlyDisplayFacts.deadlineAt), "04.02.2030");
const sourceOnlyDeadlineFallback = resolvePublicTenderDisplayFacts({
  title: accessFixtureTitle,
  metadata: sourceOnlyMetadata,
});
assert.equal(sourceOnlyDeadlineFallback.deadlineAt?.toISOString(), correctedBerlinDeadline.toISOString());
const canonicalStoredDeadline = resolvePublicTenderDisplayFacts({
  title: accessFixtureTitle,
  metadata: sourceOnlyMetadata,
  deadlineAt: new Date("2030-02-05T00:00:00.000Z"),
});
assert.equal(canonicalStoredDeadline.deadlineAt?.toISOString(), "2030-02-05T00:00:00.000Z");
assert.equal(canonicalStoredDeadline.fallbackFacts.deadline, "05.02.2030");
assert.equal(
  resolvePublicDeadlineRepair("04.02.2030 23:59", legacyServerTimezoneDeadline)?.toISOString(),
  "2030-02-04T22:59:00.000Z",
);
assert.equal(resolvePublicDeadlineRepair("04.02.2030 23:59", null), null, "do not fill missing deadlines in a timezone-only backfill");
assert.equal(
  resolvePublicDeadlineRepair("16.07.2030 10:30", new Date("2030-07-16T23:59:00.000Z")),
  null,
  "do not replace stored deadlines that do not exactly match the old UTC wall-clock parse",
);
assert.equal(
  resolvePublicDeadlineRepair("04.02.2030 22:59", parseDeadlineDate("04.02.2030 22:59")),
  null,
  "do not rewrite already-correct Berlin deadlines",
);

const sourceOnlyAccessFallback = getPublicAccessLimitedFallback({
  title: accessFixtureTitle,
  factsText: sourceOnlyMetadata.description,
  evidenceText: "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen.",
  explicitlyAccessLimited: true,
});
assert.ok(sourceOnlyAccessFallback);
const sourceOnlyNormalized = normalizeStructured(sourceOnlyStructured, accessFixtureTitle, sourceOnlyDisplayFacts.fallbackFacts);
assert.deepEqual(sourceOnlyNormalized.decision_relevant.scope, [sourceOnlyFacts.subject]);
const sourceOnlyListProjection = projectPublicTenderRecord({
  title: accessFixtureTitle,
  metadata: sourceOnlyMetadata,
  structured: sourceOnlyNormalized,
  clientFallbacks: [sourceOnlyDisplayFacts.fallbackFacts.buyer],
  locationFallbacks: [sourceOnlyDisplayFacts.fallbackFacts.location],
  summaryFallbacks: [sourceOnlyAccessFallback.description, sourceOnlyDisplayFacts.fallbackFacts.summary, sourceOnlyDisplayFacts.fallbackFacts.scope],
});
const sourceOnlyDetailFallback = projectPublicTenderDetailFallback({
  title: accessFixtureTitle,
  metadataJson: sourceOnlyMetadata,
  source: "dtvp",
  fallbackFacts: sourceOnlyDisplayFacts.fallbackFacts,
  summaryFallbacks: [sourceOnlyAccessFallback.description, sourceOnlyDisplayFacts.fallbackFacts.scope],
  accessLimited: true,
  accessLimitedDescriptionMarkdown: sourceOnlyAccessFallback.descriptionMarkdown,
});
const sourceOnlyModalProjection = projectPublicDisplayFields({
  title: sourceOnlyDetailFallback.display.title,
  client: [sourceOnlyDetailFallback.display.client],
  location: [sourceOnlyDetailFallback.display.location],
  summary: [sourceOnlyDetailFallback.display.description],
  descriptionMarkdown: sourceOnlyDetailFallback.display.descriptionMarkdown,
});
const sourceOnlyIndex = buildTenderIndexDocument({
  id: 905,
  title: accessFixtureTitle,
  source: "dtvp",
  sourceKey: "dtvp",
  url: "https://example.test/tender/905",
  deadlineAt: correctedBerlinDeadline,
  firstSeenAt: null,
  category: "Bauarbeiten",
  metadataJson: sourceOnlyMetadata,
  structuredJson: sourceOnlyStructured,
  rawText: "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen.",
  contractValueMax: null,
  slug: null,
  readinessStatus: "pending",
});
const sourceOnlySearchHit = projectTenderSearchHit({
  ...sourceOnlyIndex,
  deadlineAt: 1,
  client: "Veralteter Auftraggeber",
  procedureType: "Veraltetes Verfahren",
}, {
  title: accessFixtureTitle,
  source: "dtvp",
  url: "https://example.test/tender/905",
  metadataJson: sourceOnlyMetadata,
  structuredJson: sourceOnlyStructured,
  deadlineAt: correctedBerlinDeadline,
  procedureType: null,
  rawText: "Um Zugriff auf dieses Modul zu erhalten müssen Sie am Vergabeverfahren teilnehmen.",
});
const sourceOnlySurfaceFields = (projection: {
  title: string | null;
  client: string | null;
  location: string | null;
  description: string | null;
}) => ({
  title: projection.title,
  client: projection.client,
  location: projection.location,
  description: projection.description,
});
const sourceOnlyExpected = sourceOnlySurfaceFields(sourceOnlyListProjection);
assert.deepEqual(sourceOnlySurfaceFields(sourceOnlyDetailFallback.display), sourceOnlyExpected);
assert.deepEqual(sourceOnlySurfaceFields(sourceOnlyModalProjection), sourceOnlyExpected);
assert.deepEqual({
  title: sourceOnlyIndex.title,
  client: sourceOnlyIndex.client,
  location: sourceOnlyIndex.location,
  description: sourceOnlyIndex.description,
}, sourceOnlyExpected);
assert.deepEqual({
  title: sourceOnlySearchHit.title,
  client: sourceOnlySearchHit.client,
  location: sourceOnlySearchHit.location,
  description: sourceOnlySearchHit.description,
}, sourceOnlyExpected);
assert.equal(sourceOnlyIndex.deadlineAt, Math.floor(sourceOnlyDisplayFacts.deadlineAt!.getTime() / 1000));
assert.equal(sourceOnlySearchHit.deadlineAt, sourceOnlyIndex.deadlineAt);
assert.equal(sourceOnlySearchHit.procedureType, sourceOnlyFacts.procedure);

const invalidDateFacts = resolvePublicTenderDisplayFacts({
  title: "Beschaffung in Mainz",
  metadata: readPublicTenderMeta({ description: "Angebotsfrist: 31.02.2099" }, { title: "Beschaffung in Mainz" }),
});
assert.equal(invalidDateFacts.deadlineAt, null, "an impossible source date is not displayed as a deadline");

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
const searchRouteSource = readFileSync("app/api/tenders/search/route.ts", "utf8");
const meiliSearchSource = readFileSync("lib/meilisearch.ts", "utf8");
const pipelineSource = readFileSync("lib/pipeline.ts", "utf8");
assert.match(listRouteSource, /getPublicAccessLimitedFallback/);
assert.match(listRouteSource, /resolvePublicTenderDisplayFacts\(/);
assert.match(detailRouteSource, /getPublicAccessLimitedFallback/);
assert.match(detailRouteSource, /resolvePublicTenderDisplayFacts\(/);
assert.match(ssrPageSource, /getPublicAccessLimitedFallback/);
assert.match(ssrPageSource, /resolvePublicTenderDisplayFacts\(/);
assert.match(detailModalSource, /projectPublicDisplayFields/);
assert.match(detailModalSource, /location:\s*tender\.location,/);
assert.match(detailModalSource, /location:\s*\[d\.location,\s*t\.location\]/);
assert.doesNotMatch(detailModalSource, /location:\s*\[tender\.location,\s*tender\.city,\s*tender\.bundesland\]/);
assert.doesNotMatch(detailModalSource, /location:\s*\[d\.location,\s*t\.location,\s*t\.city,\s*t\.bundesland\]/);
assert.match(detailModalSource, /const displayLocation = display\.location \?\? "–";/);
assert.match(detailModalSource, /const location = display\.location \?\? "–";/);
assert.match(ssrPageSource, /const displayLocation = location \|\| "–";/);
assert.match(ssrPageSource, /hasCanonicalPublicDescriptionSection\(descriptionMarkdown, label\)/);
assert.match(ssrPageSource, /!markdownHasSection\(fact\.markdownLabel\)/);
assert.match(detailModalSource, /client && !markdownHasSection\("Auftraggeber"\)/);
assert.match(detailModalSource, /!markdownHasSection\("Leistungsort"\) && <Box>/);
assert.match(searchRouteSource, /searchTenders\(/);
assert.match(searchRouteSource, /bundesland:\s*hit\.bundesland/);
assert.match(meiliSearchSource, /\.filter\(\(hit\) => !params\.bundesland \|\| hit\.bundesland === params\.bundesland\)/);
assert.match(pipelineSource, /parseDeadlineDate\(tender\.deadline\)/);

console.log("Public endpoint quality tests passed.");
