import { db } from "@/lib/db";
import { documents, tenderResources, tenders, structuredData } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { and, eq } from "drizzle-orm";
import { enqueueJob } from "@/lib/queue";
import { JOB_CACHE_DETAIL } from "@/lib/types";
import { extractPublicPortalFacts } from "@/lib/public-tender-scraper";
import { formatDeadlineDE, sanitizeTenderUrl } from "@/lib/date-utils";
import { detectAccessPage } from "@/lib/access-page-detector";
import { auth } from "@/lib/auth";
import { hasPremiumAccess } from "@/lib/entitlements";
import { buildDocumentAnalysis, type AnalyzedDocument } from "@/lib/document-analysis";
import { normalizeStructured } from "@/lib/structurer";
import { normalizeResourceUrl } from "@/lib/resource-discovery";
import { readTenderMeta, type TenderResourceMeta } from "@/lib/tender-meta";

export const runtime = "nodejs";

const isActiveTender = (deadlineAt: Date | null): boolean =>
  !deadlineAt || deadlineAt.getTime() > Date.now();

const SENSITIVE_FIELD = /^(?:authorization|cookie|set-cookie|proxy-authorization|headers?|request[-_]?headers|response[-_]?headers|raw[-_]?headers|x-api-key|api-key)$/i;

const sanitizeStructuredValue = (value: unknown): unknown => {
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
  },
  tenderUrl: string,
  hasDocumentsAccess: boolean,
): SafeDocumentMetadata => {
  const roles = [
    ...(Array.isArray(document.roles) ? document.roles : []),
    document.role,
  ].filter((role): role is string => typeof role === "string" && role.trim().length > 0)
    .filter((role, index, values) => values.indexOf(role) === index);
  const metadata: SafeDocumentMetadata = {
    id: document.id,
    url: hasDocumentsAccess ? safeResourceUrl(document.url, tenderUrl) : null,
    filename: document.filename,
    contentType: document.contentType,
    downloadStatus: document.downloadStatus,
    parseStatus: document.parseStatus,
    role: document.role,
    roles,
    roleSource: document.roleSource,
    roleConfidence: document.roleConfidence,
    pageCount: document.pageCount,
    available: document.downloadStatus === "downloaded",
  };
  if (hasDocumentsAccess && metadata.available) {
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
  hasDocumentsAccess: boolean,
): { resources: SafeResourceMetadata[]; coverage: Record<string, number | string> } => {
  const documentByUrl = new Map<string, { id: number; filename: string | null }>();
  for (const document of documents) {
    const key = normalizedResourceKey(document.url, tenderUrl);
    if (key) documentByUrl.set(key, document);
  }

  const byUrl = new Map<string, SafeResourceMetadata>();
  const add = (resource: SafeResourceMetadata): void => {
    const key = resource.canonicalUrl ?? resource.url;
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
    const url = safeResourceUrl(row.url, tenderUrl);
    const canonicalUrl = safeResourceUrl(row.canonicalUrl, tenderUrl) ?? url;
    if (!url && !canonicalUrl) continue;
    const document = documentByUrl.get(canonicalUrl ?? url ?? "");
    add({
      id: row.id,
      url,
      canonicalUrl,
      label: row.label || row.filename || "",
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
    const url = safeResourceUrl(candidate.url, tenderUrl);
    const canonicalUrl = safeResourceUrl(candidate.canonicalUrl, tenderUrl) ?? url;
    if (!url && !canonicalUrl) continue;
    const document = documentByUrl.get(canonicalUrl ?? url ?? "");
    add({
      id: null,
      url,
      canonicalUrl,
      label: candidate.label || candidate.text || candidate.filename || "",
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
    resources: resources.map((resource) => {
      if (hasDocumentsAccess || !["document", "download"].includes(resource.resourceType)) return resource;
      return {
        ...resource,
        url: null,
        canonicalUrl: null,
        sourcePageUrl: null,
      };
    }),
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
    const session = await auth.api.getSession({ headers: request.headers });
    const hasDocumentsAccess = session?.user?.id ? await hasPremiumAccess(session.user.id) : false;
    const documentRows = await db
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
      })
      .from(documents)
      .where(eq(documents.tenderId, tenderId));
    const documentAnalysis = buildDocumentAnalysis(documentRows as AnalyzedDocument[]);
    const publicDocumentAnalysis = hasDocumentsAccess
      ? documentAnalysis
      : { ...documentAnalysis, evidence: [] };
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
    const tenderMeta = readTenderMeta(tender.metadataJson, tender.rawText);
    const portalFacts = extractPublicPortalFacts([tender.rawText, tenderMeta.description].filter(Boolean).join("\n"));
    const fallbackFacts = {
      buyer: portalFacts.client || tenderMeta.client || null,
      procedure: portalFacts.procedure || tenderMeta.procedure || tender.procedureType || null,
      deadline: portalFacts.deadline || (tender.deadlineAt ? formatDeadlineDE(tender.deadlineAt) : null),
      location: portalFacts.location || tenderMeta.location || null,
      scope: portalFacts.subject || tenderMeta.subject || null,
    };
    const documentsPayload = documentRows.map((document) => safeDocumentMetadata(document, tender.url, hasDocumentsAccess));
    const resourcesPayload = buildResourceMetadata(
      tender.url,
      resourceRows,
      [...tenderMeta.resourceCandidates, ...legacyPdfCandidates(tenderMeta.pdfUrls)],
      documentRows,
      hasDocumentsAccess,
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

    if (cached.length > 0) {
      const age = Date.now() - new Date(cached[0].updatedAt).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (age < sevenDays) {
        const blob = sanitizeStructuredValue(cached[0].jsonBlob) as Record<string, unknown>;
        const accessPage = detectAccessPage(JSON.stringify(blob), { title: tender.title ?? undefined, url: tender.url });
        if (accessPage.blocked) {
          await db.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
        } else {
          const normalized = normalizeStructured(blob, tender.title ?? "", fallbackFacts);
          const cachedMeta = readTenderMeta(blob);
          if (!hasDocumentsAccess) {
            delete blob.pdfUrls;
            delete blob.pdf_urls;
          }
          if (typeof blob.sourceUrl === "string") {
            blob.sourceUrl = sanitizeTenderUrl(blob.sourceUrl, blob.sourceUrl as string) ?? "";
          }
          const descriptionMarkdown = normalized.descriptionMarkdown ?? null;
          const cachedResources = buildResourceMetadata(
            tender.url,
            resourceRows,
            [
              ...tenderMeta.resourceCandidates,
              ...cachedMeta.resourceCandidates,
              ...legacyPdfCandidates(hasDocumentsAccess ? cachedMeta.pdfUrls : []),
            ],
            documentRows,
            hasDocumentsAccess,
          );
           return json({
             ...blob,
             title: normalized.title,
             summary: normalized.summary,
             description: normalized.summary,
             descriptionMarkdown,
             client: normalized.hard_facts.buyer ?? "",
             deadline: normalized.hard_facts.deadline,
             location: normalized.hard_facts.location ?? "",
             procedure: normalized.procurement.procedure_type,
             requirements: normalized.decision_relevant.requirements,
             scope: normalized.decision_relevant.scope.join(" "),
             awardCriteria: normalized.decision_relevant.award_criteria,
             commercialBrief: normalized.commercialBrief,
            ...coveragePayload,
            resourceCoverage: cachedResources.coverage,
            resources: cachedResources.resources,
            resourceCandidates: cachedResources.resources,
            readinessStatus: tender.readinessStatus,
            readinessReason: tender.readinessReason,
            documentAnalysis: publicDocumentAnalysis,
            cached: true,
            documentsLocked: !hasDocumentsAccess,
            scrapedAt: cached[0].updatedAt,
          });
        }
      }
    }

    // 3. No cache — return DB data INSTANTLY, queue LLM enrichment in background
    const meta = tender.metadataJson
      ? sanitizeStructuredValue(tender.metadataJson) as Record<string, unknown>
      : {};
    const accessPage = detectAccessPage(
      `${String(meta.description ?? "")} ${tender.rawText ?? ""}`,
      { title: tender.title ?? undefined, url: tender.url },
    );
    if (accessPage.blocked) {
      console.warn(`[tender-detail] Quelle vorübergehend blockiert für ${tenderId} (${accessPage.reason}), starte Reprocessing`);
    }
    const fallbackStructured = normalizeStructured(meta, tender.title ?? "", fallbackFacts);

    const result = {
      title: fallbackStructured.title,
      client: fallbackStructured.hard_facts.buyer || "Unbekannt",
      deadline: tender.deadlineAt ? formatDeadlineDE(tender.deadlineAt) : null,
      deadlineISO: tender.deadlineAt ? new Date(tender.deadlineAt).toISOString() : null,
      description: fallbackStructured.summary,
      descriptionMarkdown: fallbackStructured.descriptionMarkdown ?? null,
      commercialBrief: fallbackStructured.commercialBrief,
      requirements: fallbackStructured.decision_relevant.requirements,
      scope: fallbackStructured.decision_relevant.scope.join(" "),
      contact: "",
      procedure: fallbackStructured.procurement.procedure_type,
      awardCriteria: fallbackStructured.decision_relevant.award_criteria,
      duration: tender.contractDurationMonths ? `${tender.contractDurationMonths} Monate` : "",
      location: fallbackStructured.hard_facts.location,
      referenceNumber: tenderMeta.referenceNumber,
      pdfUrls: tenderMeta.pdfUrls,
      estimatedValue: tender.contractValueMax ? `${tender.contractValueMax} EUR` : null,
      divisible: null,
      sourceUrl: sanitizeTenderUrl(tender.url, tenderMeta.sourceUrl) ?? "",
      cached: false,
      enriching: true,
      documentsLocked: !hasDocumentsAccess,
      readinessStatus: tender.readinessStatus,
      readinessReason: tender.readinessReason,
      documentAnalysis: publicDocumentAnalysis,
      ...coveragePayload,
      scrapedAt: new Date().toISOString(),
    };
    const responsePayload = hasDocumentsAccess
      ? result
      : Object.fromEntries(Object.entries(result).filter(([key]) => key !== "pdfUrls"));

    // 4. Queue background enrichment (LLM extraction) — ALWAYS
    if (tender.url) {
      enqueueJob(JOB_CACHE_DETAIL, { tender_id: tenderId }, { jobKey: `${JOB_CACHE_DETAIL}:${tenderId}`, dedupeCompleted: false }).catch((e: unknown) =>
        console.error(`[tender-detail] Enqueue failed for ${tenderId}:`, e)
      );
    }

    return json(responsePayload);
  } catch (error) {
    console.error("[tender-detail] Fehler:", error);
    return errorResponse(error);
  }
}
