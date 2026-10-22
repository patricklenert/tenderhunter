import assert from "node:assert/strict";
import {
  buildTenderStageJobKey,
  buildFetchDocumentsJobKey,
  buildResourceFingerprint,
  hasResourceSnapshotChanged,
  classifyResourceCandidate,
  decideDocumentPersistence,
  isFetchableResourceCandidate,
  isPermanentResourceFailure,
  mergeMetadata,
  mergeParsedTenderText,
  mergeResourceCandidates,
  removeParsedDocumentSections,
  shouldIncludeParsedDocumentText,
  shouldUseRenderedResourceDiscovery,
  findHtmlResponseDocument,
  getAccessLimitedCacheResult,
  isMissingStoredDocumentError,
  isStoredDocumentFileMissing,
  isTerminalCacheDetailFailure,
  resolveEffectiveRawText,
  shouldRecoverFailedPipelineStage,
  shouldRetryLowConfidenceStructure,
  isTenderDocumentRefreshDue,
  mergeUsTenderMetadata,
  pipelineVersionPayload,
  isCurrentPipelineVersion,
  isPipelineJobCompatibleWithVersion,
  type ResourceCandidateRecord,
} from "../lib/pipeline";
import { ColdStorageError } from "../lib/object-store-cold";
import { buildSafeRequestHeaders, isDocumentTooLargeError } from "../lib/storage";
import { readResponseBodyBounded } from "../lib/firecrawl";
import { decodeTextBuffer } from "../lib/text-normalization";
import { deduplicateDocumentRows, documentIdentityKey, isHtmlContentType, isHtmlDocumentResource } from "../lib/document-identity";
import { deduplicateParsedDocuments } from "../lib/document-aggregation";

assert.equal(resolveEffectiveRawText(undefined), undefined, "omitted rawText must not update the existing snapshot");
assert.equal(resolveEffectiveRawText(null), null, "explicit null rawText must clear the snapshot");
assert.equal(resolveEffectiveRawText(""), null, "an explicit empty rawText snapshot must clear the snapshot");
assert.equal(resolveEffectiveRawText("  \n  "), null, "whitespace-only rawText must clear the snapshot");
assert.equal(resolveEffectiveRawText("public snapshot"), "public snapshot", "non-empty rawText must be retained");
assert.deepEqual(
  pipelineVersionPayload({ pipeline_version: 7, tender_id: 42 }),
  { pipeline_version: 7 },
  "downstream stages carry the generation they actually processed",
);
assert.deepEqual(pipelineVersionPayload({ pipeline_version: 0 }), {}, "invalid generations are not propagated");
assert.equal(isCurrentPipelineVersion({ pipeline_version: "7" }, 7), true, "numeric generation strings compare correctly");
assert.equal(isCurrentPipelineVersion({ pipeline_version: 6 }, 7), false, "stale generations are rejected");
assert.equal(isCurrentPipelineVersion({ pipeline_version: 7 }, null), false, "deleted tenders are never current");
assert.equal(isCurrentPipelineVersion({}, null), false, "legacy jobs for deleted tenders are never current");
assert.equal(isPipelineJobCompatibleWithVersion({ pipeline_version: 7 }, 7), true, "current fetch jobs may be reused");
assert.equal(isPipelineJobCompatibleWithVersion({ pipeline_version: 6 }, 7), false, "stale pending fetch jobs must not suppress the current generation");
assert.equal(isPipelineJobCompatibleWithVersion({}, 7), true, "legacy unversioned fetch jobs read the current tender row");
assert.notEqual(
  buildTenderStageJobKey("parse_documents", 42, 6),
  buildTenderStageJobKey("parse_documents", 42, 7),
  "analysis stages from different tender versions must not share an active job key",
);
assert.equal(
  hasResourceSnapshotChanged(
    "https://example.test/tender/1",
    { pdf_urls: ["https://example.test/old.pdf"], description: "alt" },
    "https://example.test/tender/1",
    { pdf_urls: ["https://example.test/new.pdf"], description: "neu" },
  ),
  true,
  "changed resource links invalidate previously parsed attachment content",
);
assert.equal(
  hasResourceSnapshotChanged(
    "https://example.test/tender/1",
    { pdf_urls: ["https://example.test/current.pdf"], description: "alt" },
    "https://example.test/tender/1",
    { pdf_urls: ["https://example.test/current.pdf"], description: "neu" },
  ),
  false,
  "description-only changes preserve reusable documents",
);

const recoveryNow = Date.parse("2026-10-05T12:00:00.000Z");
assert.equal(
  shouldRecoverFailedPipelineStage({ status: "failed", finishedAt: new Date(recoveryNow - 30 * 60 * 1000) }, recoveryNow),
  false,
  "failed stages stay parked during the recovery cooldown",
);
assert.equal(
  shouldRecoverFailedPipelineStage({ status: "failed", finishedAt: new Date(recoveryNow - 60 * 60 * 1000) }, recoveryNow),
  true,
  "failed stages become recoverable when the cooldown expires",
);
assert.equal(
  shouldRecoverFailedPipelineStage({ status: "pending", finishedAt: null }, recoveryNow),
  false,
  "a pending stage is not a recovery candidate",
);
assert.equal(
  shouldRetryLowConfidenceStructure({
    qualityStatus: "rejected",
    rawText: null,
    finishedAt: new Date(recoveryNow - 2 * 60 * 60 * 1_000),
    confidence: 0.14,
  }, recoveryNow),
  false,
  "rejected tenders without listing text must not get low-confidence structure retries",
);
assert.equal(
  shouldRetryLowConfidenceStructure({
    qualityStatus: "qualified",
    rawText: "  \n ",
    finishedAt: new Date(recoveryNow - 2 * 60 * 60 * 1_000),
    confidence: 0.14,
  }, recoveryNow),
  false,
  "structure recovery requires non-empty tender text",
);
assert.equal(
  shouldRetryLowConfidenceStructure({
    qualityStatus: "qualified",
    rawText: "Tender description and scope",
    finishedAt: new Date(recoveryNow - 2 * 60 * 60 * 1_000),
    confidence: 0.14,
  }, recoveryNow),
  true,
  "low-confidence tenders with usable text remain eligible after cooldown",
);
assert.equal(isTerminalCacheDetailFailure("Detailseite vorübergehend nicht verfügbar (login_required)"), true);
assert.equal(isTerminalCacheDetailFailure("Portal returned navigation_page without tender details"), true);
assert.equal(isTerminalCacheDetailFailure("temporary network timeout"), false);
assert.equal(isStoredDocumentFileMissing(process.execPath), false, "an existing file must not be refetched");
assert.equal(isStoredDocumentFileMissing(process.cwd()), true, "a directory is not a stored document file");
assert.equal(
  isStoredDocumentFileMissing(`${process.execPath}.missing-${process.pid}`),
  true,
  "missing local objects must be routed back through download",
);
assert.equal(isMissingStoredDocumentError({ code: "NotFound" }), true);
assert.equal(isMissingStoredDocumentError({ code: "NoSuchKey" }), true);
assert.equal(
  isMissingStoredDocumentError(new ColdStorageError("Hydration abgeschlossen, Datei fehlt weiterhin: tenders/1/doc.pdf")),
  true,
);
assert.equal(isMissingStoredDocumentError(new ColdStorageError("Hydration abgebrochen: Lock-Timeout")), false);
assert.equal(isMissingStoredDocumentError(new ColdStorageError("SHA256 des Archivs stimmt nicht überein")), false);
assert.equal(isMissingStoredDocumentError({ code: "ECONNRESET", statusCode: 503 }), false);
assert.equal(isTenderDocumentRefreshDue(null, recoveryNow, 72 * 60 * 60 * 1_000), true, "a tender with no completed fetch needs document discovery");
assert.equal(
  isTenderDocumentRefreshDue(new Date(recoveryNow - 71 * 60 * 60 * 1_000), recoveryNow, 72 * 60 * 60 * 1_000),
  false,
  "recently fetched documents must not be refreshed early",
);
assert.equal(
  isTenderDocumentRefreshDue(new Date(recoveryNow - 72 * 60 * 60 * 1_000), recoveryNow, 72 * 60 * 60 * 1_000),
  true,
  "completed document fetches become eligible at the configured refresh interval",
);

const usAttachmentUrl = "https://example.test/opportunity/files/bid.pdf";
const usAnalysisMetadata = {
  attachments: [{ name: "Bid package", url: usAttachmentUrl, status: "parsed", document_id: 9 }],
  attachment_analysis: [{ url: usAttachmentUrl, status: "parsed", document_id: 9 }],
  attachment_analysis_at: "2026-10-01T12:00:00.000Z",
  discovered_at: "2026-09-01T12:00:00.000Z",
};
const refreshedUsMetadata = mergeUsTenderMetadata(usAnalysisMetadata, {
  attachments: [{ name: "Bid package", url: usAttachmentUrl }],
  discovered_at: "2026-10-05T12:00:00.000Z",
});
assert.deepEqual(
  refreshedUsMetadata.attachments,
  [{ name: "Bid package", url: usAttachmentUrl, status: "parsed", document_id: 9 }],
  "rediscovery must not discard document status for unchanged attachments",
);
assert.deepEqual(
  refreshedUsMetadata.attachment_analysis,
  usAnalysisMetadata.attachment_analysis,
  "rediscovery must preserve analysis metadata until the attachment set changes",
);
assert.equal(refreshedUsMetadata.attachment_analysis_at, usAnalysisMetadata.attachment_analysis_at);
const changedUsMetadata = mergeUsTenderMetadata(usAnalysisMetadata, {
  attachments: [{ name: "Updated bid package", url: "https://example.test/opportunity/files/new-bid.pdf" }],
});
assert.equal(
  Object.prototype.hasOwnProperty.call(changedUsMetadata, "attachment_analysis"),
  false,
  "a changed attachment set must invalidate stale analysis metadata",
);

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
const richerDescription = "Der Auftrag umfasst die umfassende Planung und Ausführung von Straßenbauarbeiten im Stadtgebiet Mainz. Dazu gehören die Erneuerung der Fahrbahndecke, Anpassungen an Gehwegen und Entwässerungsanlagen sowie die Einrichtung einer sicheren Verkehrsführung während der Bauzeit. Die Leistungen sind abschnittsweise zu erbringen und mit den örtlichen Versorgungsträgern abzustimmen. Angebote müssen die vorgesehenen Bauabläufe, eingesetzten Materialien und die Einhaltung der geltenden technischen Regelwerke nachvollziehbar darstellen.";
assert.equal(
  mergeMetadata(
    { description: richerDescription },
    { description: "Straßenbauarbeiten in Mainz." },
  )?.description,
  richerDescription,
  "a materially thinner valid incoming description must not replace the richer stored description",
);
assert.equal(
  mergeMetadata(
    { description: "Straßenbauarbeiten in Mainz." },
    { description: richerDescription },
  )?.description,
  richerDescription,
  "a richer valid incoming description must replace a thinner stored description",
);

assert.equal(isFetchableResourceCandidate(combinedCandidate), true, "extensionless download resources are fetchable");
assert.equal(isPermanentResourceFailure("Dokument konnte nicht geladen werden: 401"), true, "authentication-required resources are not retried forever");
assert.equal(isPermanentResourceFailure("Zugriffsblockierte Seite statt Dokument (participation_required)"), true, "participation-required resources are permanent without user access");
assert.equal(isDocumentTooLargeError(new Error("Dokument zu groß: 52436778 Bytes (Limit: 52428800)")), true, "oversized documents are recognized before browser fallback");
assert.equal(isDocumentTooLargeError(new Error("Dokument zu gross: 52436778 Bytes (Limit: 52428800)")), true, "legacy oversized error spelling is recognized");
assert.equal(isPermanentResourceFailure("Dokument zu groß: 52436778 Bytes (Limit: 52428800)"), true, "oversized resources are skipped instead of retried forever");
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
  buildResourceFingerprint("https://example.test/tender/42", { pdf_urls: [], pdfUrls: ["https://example.test/b.pdf"] }),
  buildResourceFingerprint("https://example.test/tender/42", { pdf_urls: [] }),
  "a populated camelCase alias must not be hidden by an empty snake_case array",
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
const formBoilerplate = "VHB-Bund-Ausgabe 2019 Eigenerklärung zur Eignung und rechtsverbindliche Unterschrift";
if (shouldIncludeParsedDocumentText(formBoilerplate)) {
  throw new Error("PDF-Formularboilerplate wurde als Korpus-Dokument akzeptiert");
}
if (!shouldIncludeParsedDocumentText("Gültige Leistungsbeschreibung für Straßenbau in Mainz")) {
  throw new Error("Gültiger deutscher Dokumenttext wurde aus dem Korpus ausgeschlossen");
}
const partialText = mergeParsedTenderText(listingText, parsedSections, true);
assert.match(partialText, /Umfang: 500 Meter Straße/, "successful documents remain available on partial parses");
assert.equal(
  mergeParsedTenderText(partialText, parsedSections, true),
  partialText,
  "partial parse retries do not duplicate document sections",
);
assert.match(
  mergeParsedTenderText(partialText, parsedSections.replace("500 Meter", "900 Meter"), true),
  /900 Meter Straße/,
  "partial reparses replace stale text for the same document",
);
assert.doesNotMatch(
  mergeParsedTenderText(partialText, parsedSections.replace("500 Meter", "900 Meter"), true),
  /500 Meter Straße/,
  "partial reparses do not retain stale text for the same document",
);
assert.equal(mergeParsedTenderText(listingText, parsedSections, false), parsedSections.trim(), "complete parses replace the listing snapshot");
assert.equal(isHtmlContentType("text/html; charset=utf-8"), true);
assert.equal(isHtmlContentType("application/xhtml+xml"), true);
assert.equal(isHtmlContentType("application/pdf"), false);
assert.equal(isHtmlDocumentResource({ resourceType: "document", contentType: "text/html" }), true);
assert.equal(isHtmlDocumentResource({ resourceType: "page", contentType: "text/html" }), false);
assert.equal(
  removeParsedDocumentSections(
    `${listingText}\n\n[Dokument]\n${parsedSections}`,
    [7],
  ),
  `${listingText}\n\n[ROLLEN: anlage] [ROLLE: anlage] [DOKUMENT-ID: 8]`,
  "stale HTML document sections are removed without losing listing or valid documents",
);
const formSection = `[ROLLEN: formblatt] [ROLLE: formblatt] [DOKUMENT-ID: 9]\n${formBoilerplate}`;
const validSection = "[ROLLEN: leistungsbeschreibung] [ROLLE: leistungsbeschreibung] [DOKUMENT-ID: 10]\nLeistungsumfang: Straßenbau in Mainz";
const tenderRawText = `${listingText}\n\n[Dokument]\n${formSection}\n\n[Dokument]\n${validSection}`;
const corpusRawText = removeParsedDocumentSections(
  tenderRawText,
  [9],
);
assert.match(tenderRawText, /VHB-Bund-Ausgabe/);
assert.equal(
  removeParsedDocumentSections(corpusRawText, [9]),
  corpusRawText,
  "removing form sections remains idempotent",
);
const mergedTenderText = mergeParsedTenderText(corpusRawText, validSection, true);
assert.match(mergedTenderText, /Ausschreibung für Straßenbau/);
assert.match(mergedTenderText, /Leistungsumfang: Straßenbau in Mainz/);
assert.doesNotMatch(mergedTenderText, /VHB-Bund-Ausgabe/);

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
const accessCache = getAccessLimitedCacheResult(
  {
    title: "Straßenbau in Mainz",
    metadataJson: { access_limited: true, summary: "## Bekanntmachung", description: "Öffentliche Ausschreibung für Straßenbau in Mainz." },
    rawText: "",
  },
  { blocked: true, reason: "participation_required", confidence: 1, signals: [] },
  { summary: "Dokumentierter Leistungsumfang", hardFacts: { buyer: "Stadt Mainz" }, decisionRelevant: { scope: ["Straßenbau"] } },
);
assert.equal(accessCache?.summary, "Dokumentierter Leistungsumfang");
assert.equal(accessCache?.description, "Dokumentierter Leistungsumfang");
assert.ok(typeof accessCache?.descriptionMarkdown === "string" && accessCache.descriptionMarkdown.length > 0);
const loginAccessCache = getAccessLimitedCacheResult(
  {
    title: "Straßenbau in Mainz",
    metadataJson: { summary: richerDescription },
    rawText: "",
  },
  { blocked: true, reason: "login_required", confidence: 1, signals: ["login_required"] },
);
assert.equal(loginAccessCache?.access_limited, true, "a login wall can retain a sufficiently detailed public listing description");
assert.equal(loginAccessCache?.summary, richerDescription);

const htmlResponseDocument = findHtmlResponseDocument(
  [{ id: 7, url: "https://example.test/eforms?-1.-form", contentType: "text/html", sha256: "x", downloadStatus: "downloaded", storagePath: "x", filename: "eforms.html", updatedAt: new Date() }],
  "https://example.test/eforms?different-state=true",
  "text/html",
);
assert.equal(htmlResponseDocument?.id, 7, "query-variant HTML rows share the canonical document identity");
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

const mergedParsedRoles = deduplicateParsedDocuments([
  { id: 4, role: "leistungsbeschreibung" as const, roles: ["leistungsbeschreibung" as const], text: "Identischer Dokumentinhalt" },
  { id: 5, role: "eignung" as const, roles: ["eignung" as const], text: "Identischer Dokumentinhalt" },
]);
assert.deepEqual(mergedParsedRoles[0]?.roles, ["leistungsbeschreibung", "eignung"], "duplicate parsed text must retain all document roles");

const verifyBoundedBrowserResourceBody = async (): Promise<void> => {
  const oversizedHeaderResponse = new Response(null, { headers: { "content-length": "6" } });
  await assert.rejects(readResponseBodyBounded(oversizedHeaderResponse, 5), /Dokument zu groß/);

  let chunksSent = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunksSent < 3) {
        controller.enqueue(new Uint8Array(3));
        chunksSent += 1;
      } else {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readResponseBodyBounded(new Response(body), 5), /Dokument zu groß/);
  assert.equal(cancelled, true, "unknown-length oversize bodies are cancelled at the configured limit");

  assert.deepEqual(
    await readResponseBodyBounded(new Response(Buffer.from("ok")), 2),
    Buffer.from("ok"),
    "responses at or below the limit remain readable",
  );
};

void verifyBoundedBrowserResourceBody()
  .then(() => console.log("Document pipeline tests passed."))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
