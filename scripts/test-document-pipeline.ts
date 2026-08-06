import assert from "node:assert/strict";
import {
  buildFetchDocumentsJobKey,
  buildResourceFingerprint,
  classifyResourceCandidate,
  decideDocumentPersistence,
  isFetchableResourceCandidate,
  mergeResourceCandidates,
  type ResourceCandidateRecord,
} from "../lib/pipeline";
import { buildSafeRequestHeaders } from "../lib/storage";

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

assert.equal(isFetchableResourceCandidate(combinedCandidate), true, "extensionless download resources are fetchable");
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

console.log("Document pipeline tests passed.");
