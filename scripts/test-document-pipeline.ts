import assert from "node:assert/strict";
import {
  buildFetchDocumentsJobKey,
  buildResourceFingerprint,
  classifyResourceCandidate,
  decideDocumentPersistence,
  isFetchableResourceCandidate,
  isPermanentResourceFailure,
  mergeMetadata,
  mergeParsedTenderText,
  mergeResourceCandidates,
  shouldUseRenderedResourceDiscovery,
  type ResourceCandidateRecord,
} from "../lib/pipeline";
import { buildSafeRequestHeaders } from "../lib/storage";
import { decodeTextBuffer } from "../lib/text-normalization";
import { deduplicateDocumentRows, documentIdentityKey } from "../lib/document-identity";

const combinedCandidate: ResourceCandidateRecord = {
  url: "https://example.test/download?id=42",
  canonicalUrl: "https://example.test/download?id=42",
  label: "Bekanntmachung und Leistungsbeschreibung",
  filename: null,
  resourceType: "download",
  roleHints: ["bekanntmachung", "leistungsbeschreibung"],
  sourcePageUrl: "https://example.test/tender/42",
  discoveryMethod: "dom",
  method: "GET",
  contentType: null,
  contentDisposition: null,
};

const canonicalMarkdown = "- **Auftraggeber:** Stadt Mainz";
assert.equal(
  mergeMetadata({ descriptionMarkdown: canonicalMarkdown }, { descriptionMarkdown: "## Ungeprüft" })?.descriptionMarkdown,
  canonicalMarkdown,
  "invalid incoming markdown must preserve canonical markdown",
);
assert.equal(
  mergeMetadata({ descriptionMarkdown: canonicalMarkdown }, { description_markdown: "- Rohtext" })?.descriptionMarkdown,
  canonicalMarkdown,
  "invalid incoming legacy markdown must preserve canonical markdown",
);
assert.equal(
  mergeMetadata({ description: "## Bekanntmachung" }, { description: "" })?.description,
  undefined,
  "invalid persisted descriptions must not survive a metadata merge",
);
assert.equal(
  mergeMetadata({ description: "Gute Leistungsbeschreibung" }, { description: "## Bekanntmachung" })?.description,
  "Gute Leistungsbeschreibung",
  "invalid incoming descriptions must not replace a valid persisted description",
);

assert.equal(isFetchableResourceCandidate(combinedCandidate), true, "extensionless download resources are fetchable");
assert.equal(isPermanentResourceFailure("Dokument konnte nicht geladen werden: 401"), true, "authentication-required resources are not retried forever");
assert.equal(isPermanentResourceFailure("Zugriffsblockierte Seite statt Dokument (participation_required)"), true, "participation-required resources are permanent without user access");
assert.equal(isPermanentResourceFailure("Timeout beim Abruf"), false, "transient resource failures remain retryable");
assert.equal(shouldUseRenderedResourceDiscovery([combinedCandidate]), false, "a known download does not need browser discovery");
assert.equal(shouldUseRenderedResourceDiscovery([{ ...combinedCandidate, resourceType: "page", url: "https://example.test/tender/42" }]), true, "page-only resources retain browser fallback");
assert.equal(isFetchableResourceCandidate({
  ...combinedCandidate,
  url: "https://example.test/projectForwarding.do?pid=42",
  canonicalUrl: "https://example.test/projectForwarding.do?pid=42",
  resourceType: "document",
  contentType: null,
}), false, "portal action endpoints are not treated as documents");
assert.equal(isFetchableResourceCandidate({
  ...combinedCandidate,
  url: "https://example.test/download.do?id=42",
  canonicalUrl: "https://example.test/download.do?id=42",
  resourceType: "document",
  contentType: "application/pdf",
}), true, "a portal action returning a PDF remains fetchable");
const classification = classifyResourceCandidate(combinedCandidate);
assert.equal(classification.role, "leistungsbeschreibung");
assert.deepEqual(classification.roles.slice(0, 2), ["leistungsbeschreibung", "bekanntmachung"]);

const merged = mergeResourceCandidates(
  [combinedCandidate],
  [{
    ...combinedCandidate,
    resourceType: "document",
    label: "Unterlagen",
    roleHints: ["anlage"],
    contentType: "application/pdf",
  }],
);
assert.equal(merged.length, 1, "resources are deduplicated by canonical URL");
assert.equal(merged[0].resourceType, "download");
assert.deepEqual(merged[0].roleHints, ["bekanntmachung", "leistungsbeschreibung", "anlage"]);

assert.equal(decideDocumentPersistence(null, null, "sha-new"), "insert");
assert.equal(decideDocumentPersistence({ downloadStatus: "failed", sha256: "failed:url" }, null, "sha-new"), "update");
assert.equal(decideDocumentPersistence({ downloadStatus: "downloaded", sha256: "sha-new" }, null, "sha-new"), "skip");
assert.equal(decideDocumentPersistence(null, { downloadStatus: "downloaded" }, "sha-new"), "skip");

const metadataA = {
  pdf_urls: ["https://example.test/a.pdf"],
  resources: [{ url: "/download?id=42", label: "Leistungsbeschreibung", resourceType: "download" }],
};
const metadataB = {
  resources: [{ resourceType: "download", label: "Leistungsbeschreibung", url: "/download?id=42" }],
  pdf_urls: ["https://example.test/a.pdf"],
};
assert.equal(
  buildResourceFingerprint("https://example.test/tender/42", metadataA),
  buildResourceFingerprint("https://example.test/tender/42", metadataB),
  "resource fingerprints are stable across metadata ordering",
);
assert.notEqual(
  buildResourceFingerprint("https://example.test/tender/42", { ...metadataA, pdf_urls: [...metadataA.pdf_urls, "https://example.test/b.pdf"] }),
  buildResourceFingerprint("https://example.test/tender/42", metadataA),
  "a changed resource set gets a new fingerprint",
);
assert.notEqual(
  buildFetchDocumentsJobKey(42, buildResourceFingerprint("https://example.test/tender/42", metadataA)),
  buildFetchDocumentsJobKey(42, buildResourceFingerprint("https://example.test/tender/42", { pdf_urls: ["https://example.test/b.pdf"] })),
);
assert.notEqual(
  buildFetchDocumentsJobKey(42, buildResourceFingerprint("https://example.test/tender/42", metadataA), 1),
  buildFetchDocumentsJobKey(42, buildResourceFingerprint("https://example.test/tender/42", metadataA), 2),
  "changed tender versions must start a new document pipeline",
);

const listingText = "Ausschreibung für Straßenbau";
const parsedSections = "[ROLLEN: leistungsbeschreibung] [ROLLE: leistungsbeschreibung] [DOKUMENT-ID: 7]\nUmfang: 500 Meter Straße\n\n[ROLLEN: anlage] [ROLLE: anlage] [DOKUMENT-ID: 8]\n";
const partialText = mergeParsedTenderText(listingText, parsedSections, true);
assert.match(partialText, /Umfang: 500 Meter Straße/, "successful documents remain available on partial parses");
assert.equal(
  mergeParsedTenderText(partialText, parsedSections, true),
  partialText,
  "partial parse retries do not duplicate document sections",
);
assert.equal(mergeParsedTenderText(listingText, parsedSections, false), parsedSections.trim(), "complete parses replace the listing snapshot");

const safeHeaders = buildSafeRequestHeaders({
  headers: {
    Accept: "application/pdf",
    Authorization: "Bearer must-not-be-forwarded",
    Cookie: "session=must-not-be-forwarded",
  },
  referer: "https://example.test/tender/42",
  userAgent: "Mozilla/5.0 test",
});
assert.equal(safeHeaders.Accept, "application/pdf");
assert.equal(safeHeaders.Referer, "https://example.test/tender/42");
assert.equal(safeHeaders["User-Agent"], "Mozilla/5.0 test");
assert.equal(Object.keys(safeHeaders).some((key) => /authorization|cookie/i.test(key)), false);

const legacyHtml = Buffer.from(
  `<html><head>${" ".repeat(2_200)}<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1"></head><body>Bedürfnisse Baugrundstück</body></html>`,
  "latin1",
);
assert.match(decodeTextBuffer(legacyHtml), /Bedürfnisse Baugrundstück/, "late ISO-8859-1 declarations are honored");

assert.equal(
  documentIdentityKey({ url: "https://example.test/eforms?-1.-form", filename: "eforms.html", resourceType: "page" }),
  "https://example.test/eforms",
  "page state query parameters do not create a second document identity",
);
assert.notEqual(
  documentIdentityKey({ url: "https://example.test/download?id=1", filename: "notice.pdf", resourceType: "document" }),
  documentIdentityKey({ url: "https://example.test/download?id=2", filename: "notice.pdf", resourceType: "document" }),
  "download query parameters remain part of document identity",
);

const deduplicated = deduplicateDocumentRows([
  { id: 2, url: "https://example.test/eforms?-1.-form", filename: "eforms.html", role: "anlage", roles: ["anlage"], downloadStatus: "downloaded", parseStatus: "parsed", extractedText: "text", pageCount: null, roleConfidence: 0.75, errorMessage: null },
  { id: 1, url: "https://example.test/eforms", filename: "eforms.html", role: "leistungsbeschreibung", roles: ["leistungsbeschreibung"], downloadStatus: "downloaded", parseStatus: "parsed", extractedText: "text", pageCount: null, roleConfidence: 0.75, errorMessage: null },
]);
assert.equal(deduplicated.length, 1, "page query variants collapse into one document row");
assert.deepEqual(deduplicated[0].roles, ["leistungsbeschreibung", "anlage"], "duplicate roles are retained");

console.log("Document pipeline tests passed.");
