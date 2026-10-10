import { db } from "@/lib/db";
import { documents, tenderResources, tenders, structuredData } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isSmallVendorTenderModeEnabled, analyzeTenderForSmallVendor } from "@/lib/small-vendor";
import { buildTenderPipelineGroupKey, enqueueJob } from "@/lib/queue";
import { JOB_CACHE_DETAIL } from "@/lib/types";
import { extractPublicPortalFacts, getPublicAccessLimitedFallback, normalizePublicClient } from "@/lib/public-tender-scraper";
import { formatDeadlineDE, sanitizeTenderUrl } from "@/lib/date-utils";
import { detectAccessPage } from "@/lib/access-page-detector";
import { buildDocumentAnalysis, type AnalyzedDocument } from "@/lib/document-analysis";
import { deduplicateDocumentRows, documentIdentityKey, isHtmlContentType, isHtmlDocumentResource } from "@/lib/document-identity";
import { normalizeStructured } from "@/lib/structurer";
import { projectPublicTenderDetailFallback } from "@/lib/public-tender-detail-fallback";
import { normalizeResourceUrl } from "@/lib/resource-discovery";
import { isPortalActionUrl } from "@/lib/resource-url";
import { readPublicTenderMeta, type TenderResourceMeta } from "@/lib/tender-meta";
import { repairKnownGermanEncoding } from "@/lib/text-normalization";
import {
  normalizePublicDisplayCandidate,
  pickCanonicalPublicDescriptionMarkdown,
  pickValidatedPublicProcedure,
  projectPublicTenderRecord,
} from "@/lib/public-content-quality";

export const runtime = "nodejs";

const isActiveTender = (deadlineAt: Date | null): boolean =>
  !deadlineAt || deadlineAt.getTime() > Date.now();

const SENSITIVE_FIELD = /^(?:authorization|cookie|set-cookie|proxy-authorization|headers?|request[-_]?headers|response[-_]?headers|raw[-_]?headers|x-api-key|api-key)$/i;

const sanitizeStructuredValue = (value: unknown): unknown => {
  if (typeof value === "string") return repairKnownGermanEncoding(value);
  if (Array.isArray(value)) return value.map(sanitizeStructuredValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_FIELD.test(key))
      .map(([key, nested]) => [key, sanitizeStructuredValue(nested)]),
  );
};

const safeResourceUrl = (value: string | null | undefined, baseUrl: string): string | null =>
  normalizeResourceUrl(value, baseUrl);

const normalizedResourceKey = (value: string | null | undefined, baseUrl: string): string | null => {
  const normalized = safeResourceUrl(value, baseUrl);
  return normalized;
};

interface SafeDocumentMetadata {
  id: number;
  url: string | null;
  filename: string | null;
  contentType: string | null;
  downloadStatus: string | null;
  parseStatus: string | null;
  role: string | null;
  roles: string[];
  roleSource: string | null;
  roleConfidence: number | null;
  pageCount: number | null;
  available: boolean;
  summary: string | null;
  downloadUrl?: string;
}

const safeDocumentMetadata = (
  document: {
    id: number;
    url: string | null;
    filename: string | null;
    contentType: string | null;
    downloadStatus: string | null;
    parseStatus: string | null;
    role: string | null;
    roles: unknown;
    roleSource: string | null;
    roleConfidence: number | null;
    pageCount: number | null;
    aiSummary: string | null;
  },
  tenderUrl: string,
): SafeDocumentMetadata => {
  const roles = [
    ...(Array.isArray(document.roles) ? document.roles : []),
    document.role,
  ].filter((role): role is string => typeof role === "string" && role.trim().length > 0)
    .filter((role, index, values) => values.indexOf(role) === index);
  const metadata: SafeDocumentMetadata = {
    id: document.id,
    url: safeResourceUrl(document.url, tenderUrl),
    filename: document.filename ? repairKnownGermanEncoding(document.filename) : document.filename,
    contentType: document.contentType,
    downloadStatus: document.downloadStatus,
    parseStatus: document.parseStatus,
    role: document.role,
    roles,
    roleSource: document.roleSource,
    roleConfidence: document.roleConfidence,
    pageCount: document.pageCount,
    available: document.downloadStatus === "downloaded",
    summary: normalizePublicDisplayCandidate(document.aiSummary),
  };
  if (metadata.available) {
    metadata.downloadUrl = `/api/tenders/public/download?documentId=${document.id}`;
  }
  return metadata;
};

interface SafeResourceMetadata {
  id: number | null;
  url: string | null;
  canonicalUrl: string | null;
  label: string;
  filename: string | null;
  resourceType: string;
  roleHints: string[];
  sourcePageUrl: string | null;
  discoveryMethod: string | null;
  method: string | null;
  status: string;
  contentType: string | null;
  documentId: number | null;
}

const resourceStatus = (value: string | number | null | undefined): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return "observed";
  return "discovered";
};

const buildResourceMetadata = (
  tenderUrl: string,
  rows: Array<{
    id: number;
    url: string;
    canonicalUrl: string;
    label: string;
    filename: string | null;
    resourceType: string;
    roleHints: string[] | null;
    sourcePageUrl: string | null;
    discoveryMethod: string;
    method: string;
    status: string;
    contentType: string | null;
  }>,
  candidates: TenderResourceMeta[],
  documents: Array<{ id: number; url: string | null; filename: string | null }>,
): { resources: SafeResourceMetadata[]; coverage: Record<string, number | string> } => {
  const documentByUrl = new Map<string, { id: number; filename: string | null }>();
  for (const document of documents) {
    const key = documentIdentityKey(document) ?? normalizedResourceKey(document.url, tenderUrl);
    if (key) documentByUrl.set(key, document);
  }

  const byUrl = new Map<string, SafeResourceMetadata>();
  const add = (resource: SafeResourceMetadata): void => {
    const key = documentIdentityKey({
      url: resource.canonicalUrl ?? resource.url,
      filename: resource.filename,
      contentType: resource.contentType,
      resourceType: resource.resourceType,
    }) ?? resource.canonicalUrl ?? resource.url;
    if (!key) return;
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, resource);
      return;
    }
    existing.label ||= resource.label;
    existing.filename ||= resource.filename;
    existing.resourceType = existing.resourceType === "unknown" ? resource.resourceType : existing.resourceType;
    existing.roleHints = [...existing.roleHints, ...resource.roleHints]
      .filter((role, index, roles) => roles.indexOf(role) === index);
    existing.documentId ||= resource.documentId;
    if (existing.status === "discovered" || existing.status === "observed") existing.status = resource.status;
  };

  for (const row of rows) {
    if (isHtmlDocumentResource(row)) continue;
    const url = safeResourceUrl(row.url, tenderUrl);
    const canonicalUrl = safeResourceUrl(row.canonicalUrl, tenderUrl) ?? url;
    if (!url && !canonicalUrl) continue;
    const document = documentByUrl.get(documentIdentityKey({
      url: canonicalUrl ?? url,
      filename: row.filename,
      contentType: row.contentType,
      resourceType: row.resourceType,
    }) ?? canonicalUrl ?? url ?? "");
    add({
      id: row.id,
      url,
      canonicalUrl,
      label: repairKnownGermanEncoding(row.label || row.filename || ""),
      filename: row.filename,
      resourceType: row.resourceType || "unknown",
      roleHints: Array.isArray(row.roleHints) ? row.roleHints.filter((role): role is string => typeof role === "string") : [],
      sourcePageUrl: safeResourceUrl(row.sourcePageUrl, tenderUrl),
      discoveryMethod: row.discoveryMethod || null,
      method: row.method || null,
      status: resourceStatus(row.status),
      contentType: row.contentType,
      documentId: document?.id ?? null,
    });
  }

  for (const candidate of candidates) {
    if (isHtmlDocumentResource(candidate)) continue;
    const url = safeResourceUrl(candidate.url, tenderUrl);
    const canonicalUrl = safeResourceUrl(candidate.canonicalUrl, tenderUrl) ?? url;
    if (!url && !canonicalUrl) continue;
    const document = documentByUrl.get(documentIdentityKey({
      url: canonicalUrl ?? url,
      filename: candidate.filename,
      contentType: candidate.contentType,
      resourceType: candidate.resourceType,
    }) ?? canonicalUrl ?? url ?? "");
    add({
      id: null,
      url,
      canonicalUrl,
      label: repairKnownGermanEncoding(candidate.label || candidate.text || candidate.filename || ""),
      filename: candidate.filename,
      resourceType: candidate.resourceType || candidate.type || "unknown",
      roleHints: candidate.roleHints,
      sourcePageUrl: safeResourceUrl(candidate.sourcePageUrl, tenderUrl),
      discoveryMethod: candidate.discoveryMethod,
      method: candidate.method,
      status: resourceStatus(candidate.status),
      contentType: candidate.contentType,
      documentId: document?.id ?? null,
    });
  }

  const resources = [...byUrl.values()];
  const downloadable = resources.filter((resource) => ["document", "download"].includes(resource.resourceType));
  const downloaded = downloadable.filter((resource) => resource.status === "downloaded").length;
  const failed = downloadable.filter((resource) => ["failed", "blocked"].includes(resource.status)).length;
  const pending = downloadable.filter((resource) => !["downloaded", "failed", "blocked", "skipped"].includes(resource.status)).length;
  const status = downloadable.length === 0
    ? "unknown"
    : failed > 0 && downloaded === 0 && pending === 0
      ? "blocked"
      : downloaded === downloadable.length
        ? "complete"
        : "partial";

  return {
    resources,
    coverage: {
      status,
      discovered: resources.length,
      downloadable: downloadable.length,
      downloaded,
      failed,
      pending,
    },
  };
};

const legacyPdfCandidates = (urls: string[]): TenderResourceMeta[] => urls.map((url) => ({
  url,
  canonicalUrl: url,
  label: "",
  text: "",
  type: "document",
  resourceType: "document",
  roleHints: [],
  source: null,
  filename: null,
  sourcePageUrl: null,
  discoveryMethod: "legacy_pdf_url",
  method: "GET",
  status: "discovered",
  sameOrigin: null,
  contentType: null,
  contentDisposition: null,
}));

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { tenderId?: number };
    const tenderId = body?.tenderId;

    if (!tenderId || typeof tenderId !== "number") {
      return json({ error: "tenderId ist erforderlich" }, { status: 400 });
    }

    // 1. Load tender from DB
    const rows = await db
      .select()
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.qualityStatus, "qualified")))
      .limit(1);

    if (rows.length === 0) {
      return json({ error: "Ausschreibung nicht gefunden", reason: "stale_index" }, { status: 404 });
    }

    const tender = rows[0];
    const documentRows = deduplicateDocumentRows((await db
      .select({
        id: documents.id,
        url: documents.url,
        filename: documents.filename,
        contentType: documents.contentType,
        role: documents.role,
        roles: documents.roles,
        roleSource: documents.roleSource,
        parseStatus: documents.parseStatus,
        downloadStatus: documents.downloadStatus,
        errorMessage: documents.errorMessage,
        extractedText: documents.extractedText,
        pageCount: documents.pageCount,
        roleConfidence: documents.roleConfidence,
        aiSummary: documents.aiSummary,
      })
      .from(documents)
      .where(eq(documents.tenderId, tenderId)))
      .filter((document) => !isPortalActionUrl(document.url) && !isHtmlContentType(document.contentType)));
    const documentAnalysis = buildDocumentAnalysis(documentRows as AnalyzedDocument[]);
    const resourceRows = await db
      .select({
        id: tenderResources.id,
        url: tenderResources.url,
        canonicalUrl: tenderResources.canonicalUrl,
        label: tenderResources.label,
        filename: tenderResources.filename,
        resourceType: tenderResources.resourceType,
        roleHints: tenderResources.roleHints,
        sourcePageUrl: tenderResources.sourcePageUrl,
        discoveryMethod: tenderResources.discoveryMethod,
        method: tenderResources.method,
        status: tenderResources.status,
        contentType: tenderResources.contentType,
      })
      .from(tenderResources)
      .where(eq(tenderResources.tenderId, tenderId));
    const tenderMeta = readPublicTenderMeta(tender.metadataJson, {
      title: tender.title,
      source: tender.source,
      sourceUrl: tender.url,
    });
    const hasUsableRawText = Boolean(tender.rawText?.trim());
    const portalFacts = extractPublicPortalFacts(tenderMeta.description);
    const accessFallback = getPublicAccessLimitedFallback({
      title: tender.title ?? "",
      factsText: tenderMeta.description,
      evidenceText: tender.rawText,
      explicitlyAccessLimited: tenderMeta.accessLimited,
    });
    const accessLimited = accessFallback !== null;
    const fallbackFacts = {
      buyer: normalizePublicClient(portalFacts.client || tenderMeta.client) || null,
      procedure: portalFacts.procedure || tenderMeta.procedure || (hasUsableRawText ? pickValidatedPublicProcedure(tender.procedureType) : null) || null,
      deadline: portalFacts.deadline || (tender.deadlineAt ? formatDeadlineDE(tender.deadlineAt) : null),
      location: portalFacts.location || tenderMeta.location || null,
      summary: tenderMeta.description || null,
      scope: portalFacts.subject || tenderMeta.subject || null,
    };
    const documentsPayload = documentRows.map((document) => safeDocumentMetadata(document, tender.url));
    const resourcesPayload = buildResourceMetadata(
      tender.url,
      resourceRows,
      [...tenderMeta.resourceCandidates, ...legacyPdfCandidates(tenderMeta.pdfUrls)],
      documentRows,
    );
    const coveragePayload = {
      documentCoverage: {
        status: documentAnalysis.coverageStatus,
        ...documentAnalysis.coverage,
      },
      resourceCoverage: resourcesPayload.coverage,
      documents: documentsPayload,
      resources: resourcesPayload.resources,
      resourceCandidates: resourcesPayload.resources,
    };

    if (tender.deadlineAt && !isActiveTender(tender.deadlineAt)) {
      return json({ error: "Ausschreibung abgelaufen", reason: "expired" }, { status: 410 });
    }

    // 2. Check cached structured data (TTL: 7 days)
    const cached = await db
      .select()
      .from(structuredData)
      .where(eq(structuredData.tenderId, tenderId))
      .limit(1);
    let staleStructuredFallback: unknown;

    if (cached.length > 0) {
      const age = Date.now() - new Date(cached[0].updatedAt).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (age < sevenDays) {
        const blob = sanitizeStructuredValue(cached[0].jsonBlob) as Record<string, unknown>;
         const accessPage = detectAccessPage(
           `${String(tenderMeta.description ?? "")} ${tender.rawText ?? ""}`,
           { title: tender.title ?? undefined, url: tender.url },
         );
         if (accessPage.blocked && !blob.decision_relevant) {
           await db.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
         } else {
           const normalized = normalizeStructured(blob, tender.title ?? "", fallbackFacts);
            const cachedMeta = readPublicTenderMeta(blob, {
              title: tender.title,
              source: tender.source,
              sourceUrl: tender.url,
            });
              const cachedAccess = accessLimited
                 || tenderMeta.accessLimited
                 || cachedMeta.accessLimited
                 || blob.accessLimited === true
                 || blob.access_limited === true;
              const cachedAccessFallback = cachedAccess
                ? getPublicAccessLimitedFallback({
                    title: tender.title ?? "",
                    factsText: tenderMeta.description,
                    evidenceText: tender.rawText,
                    explicitlyAccessLimited: true,
                  })
                : null;
              const descriptionMarkdownCandidate = cachedAccess
                ? cachedAccessFallback?.descriptionMarkdown
                : normalized.descriptionMarkdown;
             const cachedDisplay = projectPublicTenderRecord({
               title: tender.title,
               metadata: [cachedMeta, tenderMeta],
               structured: normalized,
               clientFallbacks: [fallbackFacts.buyer],
               locationFallbacks: [fallbackFacts.location, cachedMeta.location, tenderMeta.location],
               summaryFallbacks: [
                  cachedAccessFallback?.description,
                 portalFacts.subject,
               ],
               descriptionMarkdownFallbacks: [descriptionMarkdownCandidate, cachedMeta.descriptionMarkdown, tenderMeta.descriptionMarkdown],
             });
            const cachedResources = buildResourceMetadata(
            tender.url,
            resourceRows,
            [
              ...tenderMeta.resourceCandidates,
              ...cachedMeta.resourceCandidates,
              ...legacyPdfCandidates(cachedMeta.pdfUrls),
            ],
             documentRows,
           );
              const cachedDeadline = normalized.hard_facts.deadline;
            const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
            const smallVendorMode = isSmallVendorTenderModeEnabled(session?.user ?? null);
            const smallVendor = smallVendorMode
              ? analyzeTenderForSmallVendor(tender.title ?? "", blob)
              : null;
              const cachedDescriptionMarkdown = pickCanonicalPublicDescriptionMarkdown(
                ...(cachedAccess ? [descriptionMarkdownCandidate] : []),
                cachedDisplay.descriptionMarkdown,
                cachedMeta.descriptionMarkdown,
                tenderMeta.descriptionMarkdown,
              );
              return json({
              title: cachedDisplay.title ?? normalized.title,
               summary: cachedDisplay.summary ?? "",
               description: cachedDisplay.description ?? "",
              descriptionMarkdown: cachedDescriptionMarkdown,
              client: cachedDisplay.client || "Unbekannt",
             deadline: cachedDeadline,
             deadlineISO: tender.deadlineAt ? new Date(tender.deadlineAt).toISOString() : null,
              location: cachedDisplay.location || "",
             procedure: normalized.procurement.procedure_type,
             requirements: normalized.decision_relevant.requirements,
             scope: normalized.decision_relevant.scope.join(" "),
             awardCriteria: normalized.decision_relevant.award_criteria,
             hard_facts: normalized.hard_facts,
             decision_relevant: normalized.decision_relevant,
             procurement: normalized.procurement,
             confidence: normalized.confidence,
             contact: "",
              duration: normalized.procurement.contract_duration.months
                ? `${normalized.procurement.contract_duration.months} Monate` : "",
             referenceNumber: cachedMeta.referenceNumber ?? tenderMeta.referenceNumber,
             pdfUrls: cachedMeta.pdfUrls,
             estimatedValue: normalized.hard_facts.budget,
             sourceUrl: sanitizeTenderUrl(tender.url, cachedMeta.sourceUrl || tenderMeta.sourceUrl) ?? "",
             divisible: null,
             ...coveragePayload,
            resourceCoverage: cachedResources.coverage,
            resources: cachedResources.resources,
            resourceCandidates: cachedResources.resources,
              readinessStatus: hasUsableRawText ? tender.readinessStatus : "manual_review",
             readinessReason: tender.readinessReason,
             documentAnalysis,
              cached: true,
            documentsLocked: false,
             scrapedAt: cached[0].updatedAt,
              accessLimited: cachedAccess,
              blockedReason: cachedAccess ? "participation_required" : null,
              ...(smallVendor ? { smallVendor } : {}),
             });
        }
      } else if (age >= sevenDays) {
        staleStructuredFallback = sanitizeStructuredValue(cached[0].jsonBlob);
      }
    }

    // 3. No cache — return DB data INSTANTLY, queue LLM enrichment in background
    const accessPage = detectAccessPage(
      `${String(tenderMeta.description ?? "")} ${tender.rawText ?? ""}`,
      { title: tender.title ?? undefined, url: tender.url },
    );
    if (accessPage.blocked) {
      console.warn(`[tender-detail] Quelle vorübergehend blockiert für ${tenderId} (${accessPage.reason}), starte Reprocessing`);
    }
    const fallback = projectPublicTenderDetailFallback({
      title: tender.title,
      metadataJson: tender.metadataJson,
      staleStructuredJson: staleStructuredFallback,
      source: tender.source,
      sourceUrl: tender.url,
      fallbackFacts,
      summaryFallbacks: [accessFallback?.description, portalFacts.subject],
      descriptionMarkdownFallbacks: [
        accessLimited ? accessFallback?.descriptionMarkdown : undefined,
        tenderMeta.descriptionMarkdown,
      ],
      accessLimited,
      accessLimitedDescriptionMarkdown: accessFallback?.descriptionMarkdown,
    });
    const fallbackStructured = fallback.structured;
    const fallbackSession = await auth.api.getSession({ headers: request.headers }).catch(() => null);
     const fallbackSmallVendor = isSmallVendorTenderModeEnabled(fallbackSession?.user ?? null)
       ? analyzeTenderForSmallVendor(tender.title ?? "", fallbackStructured)
       : null;
     const fallbackDisplay = fallback.display;
      const result = {
        title: fallbackDisplay.title || `Ausschreibung #${tender.id}`,
       client: fallbackDisplay.client || "Unbekannt",
      deadline: tender.deadlineAt ? formatDeadlineDE(tender.deadlineAt) : null,
      deadlineISO: tender.deadlineAt ? new Date(tender.deadlineAt).toISOString() : null,
         summary: fallbackDisplay.summary ?? "",
         description: fallbackDisplay.description ?? "",
         descriptionMarkdown: fallbackDisplay.descriptionMarkdown,
       requirements: fallbackStructured.decision_relevant.requirements,
      scope: fallbackStructured.decision_relevant.scope.join(" "),
      contact: "",
      procedure: fallbackStructured.procurement.procedure_type,
      awardCriteria: fallbackStructured.decision_relevant.award_criteria,
       duration: hasUsableRawText && tender.contractDurationMonths ? `${tender.contractDurationMonths} Monate` : "",
          location: fallbackDisplay.location || "",
      referenceNumber: tenderMeta.referenceNumber,
      pdfUrls: tenderMeta.pdfUrls,
       estimatedValue: hasUsableRawText && tender.contractValueMax ? `${tender.contractValueMax} EUR` : null,
      divisible: null,
      sourceUrl: sanitizeTenderUrl(tender.url, tenderMeta.sourceUrl) ?? "",
      cached: false,
      enriching: true,
      documentsLocked: false,
       readinessStatus: hasUsableRawText ? tender.readinessStatus : "manual_review",
       readinessReason: hasUsableRawText
         ? tender.readinessReason
         : "Keine verwertbaren Ausschreibungsdokumente oder Beschreibung vorhanden.",
      documentAnalysis,
       ...coveragePayload,
      scrapedAt: new Date().toISOString(),
       accessLimited,
       blockedReason: accessLimited ? accessPage.reason ?? "participation_required" : null,
      ...(fallbackSmallVendor ? { smallVendor: fallbackSmallVendor } : {}),
    };
    // 4. Queue background enrichment (LLM extraction) — ALWAYS
    if (tender.url) {
      enqueueJob(JOB_CACHE_DETAIL, {
        tender_id: tenderId,
        pipeline_version: tender.version,
      }, {
        jobKey: `${JOB_CACHE_DETAIL}:${tenderId}:${tender.version}`,
        groupKey: buildTenderPipelineGroupKey(tenderId),
        dedupeCompleted: false,
      }).catch((e: unknown) =>
        console.error(`[tender-detail] Enqueue failed for ${tenderId}:`, e)
      );
    }

    return json(result);
  } catch (error) {
    console.error("[tender-detail] Fehler:", error);
    return errorResponse(error);
  }
}
