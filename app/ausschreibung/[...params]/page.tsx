import { db } from "@/lib/db";
import { documents, tenderResources, tenders, structuredData, scores, companyProfiles, tenderDeepDives } from "@/lib/schema";
import { eq, and, ne, or, gt, isNull, desc } from "drizzle-orm";
import { notFound, permanentRedirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  Box,
  Container,
  Typography,
  Stack,
  Chip,
  Paper,
  Button,
  Divider,
} from "@mui/material";
import {
  Building2,
  MapPin,
  Calendar,
  Euro,
  FileText,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Briefcase,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { getPublicAccessLimitedFallback } from "@/lib/public-tender-scraper";
import { normalizeStructured } from "@/lib/structurer";
import { resolvePublicTenderDeadline, resolvePublicTenderDisplayFacts } from "@/lib/public-tender-display-facts";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { deriveBundesland, deriveCity, BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { CITY_SLUG_MAP } from "@/lib/cities";
import { getIndexableAgency } from "@/lib/agencies";
import { isSmallVendorTenderModeEnabled } from "@/lib/small-vendor";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { PdfDocumentLink } from "@/components/PdfDocumentLink";
import { TenderQuickCheck } from "@/components/TenderQuickCheck";
import { SmallVendorDeepDive, type DeepDiveState } from "@/components/SmallVendorDeepDive";
import type { DeepDiveResult } from "@/lib/small-vendor-deep-dive";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { buildDocumentAnalysis, documentAnalysisFieldLabel, type AnalyzedDocument } from "@/lib/document-analysis";
import { buildTenderCheck } from "@/lib/tender-check";
import { ROLE_LABELS_DE } from "@/lib/document-classifier";
import { normalizeResourceUrl } from "@/lib/resource-discovery";
import { isGenericPortalNavigationResource, isPortalActionUrl } from "@/lib/resource-url";
import { deduplicateDocumentRows, documentIdentityKey, isHtmlContentType, isHtmlDocumentResource } from "@/lib/document-identity";
import { optionalPublicRows } from "@/lib/public-route-resilience";
import { repairKnownGermanEncoding } from "@/lib/text-normalization";
import { readPublicTenderMeta } from "@/lib/tender-meta";
import { buildTenderDescriptionMarkdown } from "@/lib/tender-description";
import { hasQueryParameters, NOINDEX_FOLLOW, type SeoSearchParams } from "@/lib/seo-indexability";
import { getCanonicalTenderSlug, isCanonicalTenderId } from "@/lib/tender-canonical";
import {
  hasCanonicalPublicDescriptionSection,
  normalizePublicClient,
  pickValidatedPublicCandidate,
  pickValidatedPublicLocationForTender,
  normalizePublicDisplayCandidate,
  pickCanonicalPublicDescriptionMarkdown,
  projectPublicDisplayFields,
  projectPublicTenderRecord,
} from "@/lib/public-content-quality";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

// SEO: Catch-all route handles both /ausschreibung/[id] and /ausschreibung/[id]/[slug].
// Old numeric-only URLs redirect (301) to keyword-rich slug URLs for better long-tail SEO.
interface PageProps {
  params: Promise<{ params: string[] }>;
  searchParams: Promise<SeoSearchParams>;
}

function parseParams(params: { params: string[] }): { id: string; slug: string | null } {
  const arr = params.params;
  if (arr.length === 0) return { id: "", slug: null };
  if (arr.length === 1) return { id: arr[0], slug: null };
  return { id: arr[0], slug: arr[1] };
}

function parseTenderId(id: string): number {
  return /^\d+$/.test(id) ? Number(id) : Number.NaN;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id, slug } = parseParams(await params);
  const resolvedSearchParams = await searchParams;
  const numericId = parseTenderId(id);
  if (!Number.isFinite(numericId)) notFound();

  const rows = await db
    .select({
      title: tenders.title,
      slug: tenders.slug,
      category: tenders.category,
      source: tenders.source,
      deadlineAt: tenders.deadlineAt,
      createdAt: tenders.createdAt,
       updatedAt: tenders.updatedAt,
       metadataJson: tenders.metadataJson,
       rawText: tenders.rawText,
        qualityStatus: tenders.qualityStatus,
       structuredJson: structuredData.jsonBlob,
     })
      .from(tenders)
      .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(eq(tenders.id, numericId), eq(tenders.qualityStatus, "qualified")))
    .limit(1);

  if (rows.length === 0) notFound();

  const row = rows[0];
  const meta = readPublicTenderMeta(row.metadataJson, {
    title: row.title,
    source: row.source,
  });
  const metaDisplay = projectPublicDisplayFields({
    title: row.title,
    client: meta.client,
    location: meta.location,
  });
  const rawTitle = metaDisplay.title || `Ausschreibung #${id}`;
  const client = metaDisplay.client || "";
  const location = metaDisplay.location || "";

  const deadline = row.deadlineAt
    ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const categoryLabel = CATEGORY_LABELS[row.category ?? "Sonstiges"] ?? row.category ?? "";
  const enrichedTitle = [rawTitle, categoryLabel, location].filter(Boolean).join(" – ");
  const title = enrichedTitle.length <= 80 ? enrichedTitle : rawTitle;

  const descParts = [client, location, deadline].filter(Boolean).join(", ");
  const description = `${rawTitle}. ${descParts ? descParts + ". " : ""}Öffentliche Ausschreibung aus ${row.source}. Alle Details, Anforderungen und Fristen.`;

  // Canonical slug: prefer persisted DB slug, fall back to live computation for legacy rows
   const canonicalSlug = getCanonicalTenderSlug(
      row.slug,
      row.title,
      row.metadataJson,
      row.rawText?.trim() ? row.structuredJson : null,
   );
  if (!isCanonicalTenderId(id, numericId) || !slug || slug !== canonicalSlug) {
    permanentRedirect(`/ausschreibung/${numericId}/${canonicalSlug}`);
  }

  return {
    title,
    description,
    alternates: { canonical: `/ausschreibung/${id}/${canonicalSlug}`, languages: { "de-DE": `/ausschreibung/${id}/${canonicalSlug}` } },
    robots: hasQueryParameters(resolvedSearchParams) ? NOINDEX_FOLLOW : undefined,
    openGraph: {
      title,
      description,
      type: "article",
      locale: "de_DE",
      publishedTime: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
      modifiedTime: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      tags: row.category ? [row.category] : undefined,
    },
  };
}

export default async function TenderDetailPage({ params }: PageProps) {
  const { id, slug } = parseParams(await params);
  const numericId = parseTenderId(id);
  if (!Number.isFinite(numericId)) notFound();

  const rows = await db
    .select()
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(eq(tenders.id, numericId), eq(tenders.qualityStatus, "qualified")))
    .limit(1);

  if (rows.length === 0) notFound();

  const row = rows[0];
  const tender = row.tenders;
   const sd = row.structured_data;

  const expectedSlug = getCanonicalTenderSlug(
    tender.slug,
    tender.title,
    tender.metadataJson,
    tender.rawText?.trim() ? sd?.jsonBlob : null,
  );
  if (!isCanonicalTenderId(id, numericId) || !slug || slug !== expectedSlug) {
    permanentRedirect(`/ausschreibung/${tender.id}/${expectedSlug}`);
  }

  let smallVendorDeepDiveEnabled = false;
  let deepDiveInitial: DeepDiveState | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    smallVendorDeepDiveEnabled = isSmallVendorTenderModeEnabled(session?.user ?? null);
  } catch {
    smallVendorDeepDiveEnabled = false;
  }
  if (smallVendorDeepDiveEnabled) {
    const deepDiveRows = await optionalPublicRows(() => db
      .select()
      .from(tenderDeepDives)
      .where(eq(tenderDeepDives.tenderId, tender.id))
      .limit(1));
    if (deepDiveRows[0]) {
      deepDiveInitial = {
        status: deepDiveRows[0].status,
        model: deepDiveRows[0].model,
        result: (deepDiveRows[0].resultJson ?? null) as DeepDiveResult | null,
        corpusStats: (deepDiveRows[0].corpusStats ?? null) as Record<string, number> | null,
        error: deepDiveRows[0].error,
        updatedAt: deepDiveRows[0].updatedAt?.toISOString() ?? null,
      };
    }
  }

  const fetchedDocumentRows = await optionalPublicRows(() => db
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
    .where(eq(documents.tenderId, tender.id)));
  const documentRows = deduplicateDocumentRows(fetchedDocumentRows)
    .filter((document) => !isPortalActionUrl(document.url) && !isHtmlContentType(document.contentType));
  const documentAnalysis = buildDocumentAnalysis(documentRows as AnalyzedDocument[]);

  const readinessLabel: Record<string, string> = {
    pending: "Analyse wartet",
    partial: "Analyse teilweise verfügbar",
    ready: "Analyse verfügbar",
    blocked: "Dokumentzugriff blockiert",
    failed: "Analyse fehlgeschlagen",
    manual_review: "Manuelle Prüfung erforderlich",
  };
   const readinessStatus = tender.rawText?.trim() ? tender.readinessStatus ?? "pending" : "manual_review";
  const readinessTone = readinessStatus === "ready"
    ? { background: "success.light", text: "success.dark" }
    : readinessStatus === "blocked" || readinessStatus === "failed"
      ? { background: "error.light", text: "error.dark" }
      : { background: "warning.light", text: "warning.dark" };

  const tenderMeta = readPublicTenderMeta(tender.metadataJson, {
    title: tender.title,
    source: tender.source,
    sourceUrl: tender.url,
  });
  const hasUsableRawText = Boolean(tender.rawText?.trim());
  const publicFacts = resolvePublicTenderDisplayFacts({
    title: tender.title,
    metadata: tenderMeta,
    deadlineAt: tender.deadlineAt,
    procedureType: tender.procedureType,
    hasUsableRawText,
  });
  const fallbackFacts = publicFacts.fallbackFacts;
  const accessFallback = getPublicAccessLimitedFallback({
     title: tender.title ?? "",
     factsText: tenderMeta.description,
     evidenceText: tender.rawText,
     explicitlyAccessLimited: tenderMeta.accessLimited,
  });
  const accessLimited = accessFallback !== null;
  const structuredSource = sd?.jsonBlob ?? tender.metadataJson;
  const normalizedStructured = normalizeStructured(structuredSource, tender.title ?? "", fallbackFacts);
  const tenderCheck = buildTenderCheck({
    tenderId: tender.id,
    tenderDeadlineAt: tender.deadlineAt,
    structured: normalizedStructured,
    rawText: tender.rawText,
    documents: documentRows as AnalyzedDocument[],
    documentAnalysis,
  });
  const resourceRows = (await optionalPublicRows(() => db
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
    .where(eq(tenderResources.tenderId, tender.id))))
    .filter((resource) =>
      !isPortalActionUrl(resource.url)
      && !isGenericPortalNavigationResource({
        url: resource.url,
        canonicalUrl: resource.canonicalUrl,
        label: resource.label,
        filename: resource.filename,
        resourceType: resource.resourceType,
      }),
    );
  const structuredMeta = readPublicTenderMeta(normalizedStructured, {
    title: tender.title,
    source: tender.source,
    sourceUrl: tender.url,
  });
  const resourceUrl = (value: string | null | undefined): string | null => normalizeResourceUrl(value, tender.url);
   const resourceKey = (value: string | null | undefined): string | null =>
     documentIdentityKey({ url: value }) ?? resourceUrl(value);
  type DisplayResource = {
    id: number | null;
    documentId: number | null;
    url: string | null;
    label: string;
    filename: string | null;
    resourceType: string;
    roles: string[];
    status: string;
    sourcePageUrl: string | null;
    contentType: string | null;
    summary: string | null;
    parseStatus: string | null;
  };
  const documentByUrl = new Map<string, { id: number; filename: string | null; summary: string | null; parseStatus: string | null }>();
  for (const document of documentRows) {
    const key = resourceKey(document.url);
    if (key) documentByUrl.set(key, {
      id: document.id,
      filename: document.filename,
      summary: normalizePublicDisplayCandidate(document.aiSummary),
      parseStatus: document.parseStatus,
    });
  }
  const resourceByUrl = new Map<string, DisplayResource>();
  const addResource = (resource: DisplayResource): void => {
     const key = documentIdentityKey({
       url: resource.url,
       filename: resource.filename,
       contentType: resource.contentType,
       resourceType: resource.resourceType,
     }) ?? resource.url;
    if (!key) return;
    const existing = resourceByUrl.get(key);
    if (!existing) {
      resourceByUrl.set(key, resource);
      return;
    }
    existing.label ||= resource.label;
    existing.filename ||= resource.filename;
    existing.resourceType = existing.resourceType === "unknown" ? resource.resourceType : existing.resourceType;
    existing.roles = [...existing.roles, ...resource.roles].filter((role, index, roles) => roles.indexOf(role) === index);
    existing.documentId ||= resource.documentId;
    existing.summary ||= resource.summary;
    existing.parseStatus ||= resource.parseStatus;
    if (existing.status === "discovered" || existing.status === "unknown") existing.status = resource.status;
  };
  for (const document of documentRows) {
    addResource({
      id: null,
      documentId: document.id,
      url: resourceUrl(document.url),
       label: repairKnownGermanEncoding(document.filename ?? ""),
       filename: document.filename ? repairKnownGermanEncoding(document.filename) : document.filename,
      resourceType: "document",
      roles: [
        ...(Array.isArray(document.roles) ? document.roles : []),
        document.role,
      ].filter((role): role is string => typeof role === "string" && role.length > 0)
        .filter((role, index, roles) => roles.indexOf(role) === index),
      status: document.downloadStatus ?? "unknown",
      sourcePageUrl: null,
      contentType: document.contentType,
       summary: normalizePublicDisplayCandidate(document.aiSummary),
      parseStatus: document.parseStatus,
    });
  }
  for (const resource of resourceRows) {
    const url = resourceUrl(resource.url);
    const canonicalUrl = resourceUrl(resource.canonicalUrl) ?? url;
    const document = documentByUrl.get(canonicalUrl ?? "");
    addResource({
      id: resource.id,
      documentId: document?.id ?? null,
      url,
       label: repairKnownGermanEncoding(resource.label || resource.filename || ""),
      filename: resource.filename,
      resourceType: resource.resourceType || "unknown",
      roles: Array.isArray(resource.roleHints) ? resource.roleHints.filter((role): role is string => typeof role === "string") : [],
      status: resource.status || "discovered",
      sourcePageUrl: resourceUrl(resource.sourcePageUrl),
      contentType: resource.contentType,
      summary: document?.summary ?? null,
      parseStatus: document?.parseStatus ?? null,
    });
  }
  for (const resource of [
    ...tenderMeta.resourceCandidates,
    ...structuredMeta.resourceCandidates,
    ...tenderMeta.pdfUrls.map((url) => ({ url, label: "", text: "", type: "document", resourceType: "document", roleHints: [] as string[], filename: null, status: "discovered", sourcePageUrl: null, contentType: null })),
    ...structuredMeta.pdfUrls.map((url) => ({ url, label: "", text: "", type: "document", resourceType: "document", roleHints: [] as string[], filename: null, status: "discovered", sourcePageUrl: null, contentType: null })),
  ]) {
    const url = resourceUrl(resource.url);
    const document = documentByUrl.get(resourceKey(url) ?? "");
    addResource({
      id: null,
      documentId: document?.id ?? null,
      url,
       label: repairKnownGermanEncoding(resource.label || resource.text || resource.filename || ""),
      filename: resource.filename,
      resourceType: resource.resourceType || resource.type || "unknown",
      roles: resource.roleHints,
      status: typeof resource.status === "string" ? resource.status : "discovered",
      sourcePageUrl: resourceUrl(resource.sourcePageUrl),
      contentType: resource.contentType,
      summary: document?.summary ?? null,
      parseStatus: document?.parseStatus ?? null,
    });
  }
  const allResources = [...resourceByUrl.values()]
    .filter((resource) => resource.url && resource.url !== resourceUrl(tender.url))
    .filter((resource) => !isPortalActionUrl(resource.url))
    .filter((resource) => !isGenericPortalNavigationResource(resource))
    .filter((resource) => !isHtmlDocumentResource(resource))
    .slice(0, 40);
  const downloadableResources = allResources.filter((resource) =>
    Boolean(resource.documentId) || ["document", "download"].includes(resource.resourceType),
  );
  const discoveredPageResources = allResources.filter((resource) => !downloadableResources.includes(resource));
  const failedResources = downloadableResources.filter((resource) => ["failed", "blocked"].includes(resource.status)).length;
  const downloadedResources = downloadableResources.filter((resource) => resource.status === "downloaded").length;
  const pendingResources = downloadableResources.filter((resource) => !["downloaded", "failed", "blocked", "skipped"].includes(resource.status)).length;
  const resourceCoverageStatus = downloadableResources.length === 0
    ? "unknown"
    : failedResources > 0 && downloadedResources === 0 && pendingResources === 0
      ? "blocked"
      : downloadedResources === downloadableResources.length
        ? "complete"
        : "partial";
  const coverageStatusLabel: Record<string, string> = {
    complete: "vollständig",
    partial: "teilweise",
    blocked: "blockiert",
    unknown: "unbekannt",
  };
  const resourceStatusLabel: Record<string, string> = {
    discovered: "Entdeckt",
    downloading: "Wird geladen",
    downloaded: "Gespeichert",
    failed: "Fehlgeschlagen",
    blocked: "Blockiert",
    skipped: "Übersprungen",
    unknown: "Unbekannt",
  };

  const baseDisplay = projectPublicTenderRecord({
    title: tender.title,
    metadata: tender.metadataJson,
    structured: normalizedStructured,
    clientFallbacks: [tenderMeta.client, fallbackFacts.buyer],
  });
  const title = baseDisplay.title || `Ausschreibung #${tender.id}`;
  const categoryLabel = CATEGORY_LABELS[tender.category ?? "Sonstiges"] ?? tender.category ?? "Diverse Leistungen";
  const categorySlug = CATEGORY_SLUGS[tender.category ?? "Sonstiges"] ?? "diverse";

  // Pick the first non-empty candidate that does not look like mangled text
  // (HTML→text conversion that lost whitespace between block elements produces
  // labels glued to values, e.g. "HüpstedtVergabeartBeschränkte..."). This guard
  // prevents the duplicate mangled caption that previously appeared in Key Facts
  // and Beschreibung.
  const pickFirstClean = (...candidates: Array<unknown>): string => {
    return pickValidatedPublicCandidate(...candidates);
  };

  const hardFacts = normalizedStructured.hard_facts as Record<string, unknown>;
  const decisionRelevant = normalizedStructured.decision_relevant as Record<string, unknown>;
  const procurement = normalizedStructured.procurement as Record<string, unknown>;
  const display = projectPublicTenderRecord({
    title,
    metadata: tender.metadataJson,
    structured: normalizedStructured,
    clientFallbacks: [baseDisplay.client, tenderMeta.client, fallbackFacts.buyer],
    locationFallbacks: [
      normalizedStructured.hard_facts.location,
      typeof hardFacts.location === "string" ? hardFacts.location : null,
      tenderMeta.location,
      fallbackFacts.location,
    ],
    summaryFallbacks: [accessFallback?.description, fallbackFacts.summary, fallbackFacts.scope],
    descriptionMarkdownFallbacks: [accessFallback?.descriptionMarkdown, normalizedStructured.descriptionMarkdown, tenderMeta.descriptionMarkdown],
  });
  const client = display.client || "";
  const location = display.location || "";
  const displayLocation = location || "–";
  const description = display.description || "";
  const contactInfo = "";
  const estimatedValue = pickFirstClean(hardFacts.budget);
  const referenceNumber = pickFirstClean(tenderMeta.referenceNumber);
  const procedure = pickFirstClean(normalizedStructured.procurement.procedure_type);
  const duration = pickFirstClean((procurement.contract_duration as Record<string, unknown> | undefined)?.months
    ? `${(procurement.contract_duration as Record<string, unknown>).months} Monate`
    : null);

  const requirements = [
    ...(Array.isArray(decisionRelevant.requirements) ? decisionRelevant.requirements : []),
    ...(Array.isArray(decisionRelevant.mandatory_documents) ? decisionRelevant.mandatory_documents : []),
    ...(Array.isArray(procurement.participation_requirements) ? procurement.participation_requirements : []),
  ].map(normalizePublicDisplayCandidate).filter((value, index, values): value is string => value !== null && value.length > 5 && values.indexOf(value) === index);
  const awardCriteria = [
    ...(Array.isArray(decisionRelevant.award_criteria) ? decisionRelevant.award_criteria : []),
    ...((Array.isArray(procurement.award_criteria_detailed) ? procurement.award_criteria_detailed : []) as Array<Record<string, unknown>>).map((value) =>
      value.weight === null || typeof value.weight !== "number" ? value.criterion : `${value.criterion} (${value.weight}%)`),
  ].map(normalizePublicDisplayCandidate).filter((value, index, values): value is string => value !== null && value.length > 5 && values.indexOf(value) === index);
  const scope = pickFirstClean(
    Array.isArray(decisionRelevant.scope) ? decisionRelevant.scope.join(" ") : null,
    fallbackFacts.scope,
  );
  const displayDeadlineAt = resolvePublicTenderDeadline(publicFacts.deadlineAt, hardFacts.deadline);
  const isExpired = Boolean(displayDeadlineAt && displayDeadlineAt.getTime() < Date.now());
  const deadline = displayDeadlineAt
    ? displayDeadlineAt.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const deadlineISO = displayDeadlineAt?.toISOString() ?? null;
  const publishedAt = tender.createdAt
    ? new Date(tender.createdAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;
  const publishedAtISO = tender.createdAt ? new Date(tender.createdAt).toISOString() : null;

  const contractValue = estimatedValue
    || (tender.contractValueMax ? `${tender.contractValueMax.toLocaleString("de-DE", { maximumFractionDigits: 0 })} EUR` : "");

  const descriptionMarkdown = pickCanonicalPublicDescriptionMarkdown(
    ...(accessLimited && accessFallback ? [accessFallback.descriptionMarkdown] : []),
    display.descriptionMarkdown,
    tenderMeta.descriptionMarkdown,
    buildTenderDescriptionMarkdown({
      client,
      procedure,
      deadline,
      location,
      value: contractValue,
      duration,
      reference: referenceNumber,
      summary: description,
      scope,
      requirements,
      awardCriteria,
      cpv: (procurement.cpv_codes ?? procurement.cpvCodes) as unknown,
    }),
  ) ?? "";
  const markdownHasSection = (label: string): boolean => hasCanonicalPublicDescriptionSection(descriptionMarkdown, label);
  const markdownHasScope = markdownHasSection("Leistungsumfang");
  const markdownHasRequirements = markdownHasSection("Anforderungen");
  const markdownHasAwards = markdownHasSection("Zuschlagskriterien");
  const commercialBrief = normalizedStructured.commercialBrief;

  const now = new Date();

  const similarRows = await optionalPublicRows(() => db
    .select({
      id: tenders.id,
      slug: tenders.slug,
      title: tenders.title,
      category: tenders.category,
      source: tenders.source,
      deadlineAt: tenders.deadlineAt,
      metadataJson: tenders.metadataJson,
    })
    .from(tenders)
    .where(
      and(
        eq(tenders.category, tender.category ?? "Sonstiges"),
        ne(tenders.id, tender.id),
        eq(tenders.qualityStatus, "qualified"),
        or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
      ),
    )
    .orderBy(desc(tenders.createdAt))
    .limit(4));

  const similarTenders = similarRows.map((t) => {
    const m = readPublicTenderMeta(t.metadataJson, {
      title: t.title,
      source: t.source,
    });
    const tTitle = pickValidatedPublicCandidate(t.title) || `Ausschreibung #${t.id}`;
    const tClient = normalizePublicClient(m.client);
    const tLocation = pickValidatedPublicLocationForTender(tTitle, tClient, m.location);
    // Use the same validated fallback as the detail URL and sitemap.
    const tSlug = getCanonicalTenderSlug(t.slug, t.title, {
      client: tClient,
      location: tLocation,
    });
    return {
      id: t.id,
      slug: tSlug,
      title: tTitle,
      category: CATEGORY_LABELS[t.category ?? "Sonstiges"] ?? t.category ?? categoryLabel,
      client: tClient,
      location: tLocation ? tLocation.split(",")[0].trim() : "",
      deadline: t.deadlineAt
        ? new Date(t.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      source: t.source,
    };
  });

  const scoredCompanyRows = await optionalPublicRows(() => db
    .select({
      slug: companyProfiles.slug,
      name: companyProfiles.name,
      industry: companyProfiles.industry,
      fit: scores.fit,
    })
    .from(scores)
    .leftJoin(companyProfiles, eq(scores.companyId, companyProfiles.id))
    .where(eq(scores.tenderId, tender.id))
    .orderBy(desc(scores.fit))
    .limit(5));

  const scoredCompanies = scoredCompanyRows
    .filter((c) => c.slug)
    .map((c) => ({
      slug: c.slug!,
      name: c.name,
      industry: c.industry,
      fit: Math.round(c.fit ?? 0),
    }));

  // SEO: Derive Bundesland and city for contextual internal linking
  const tenderBundesland = deriveBundesland(location);
  const bundeslandSlug = tenderBundesland ? BUNDESLAND_SLUGS[tenderBundesland] : null;
  const tenderCity = deriveCity(location);
  const citySlug = tenderCity
    ? Object.values(CITY_SLUG_MAP).find((c) => c.label.toLowerCase() === tenderCity.toLowerCase())?.slug ?? null
    : null;
  const agencySlug = getIndexableAgency(client)?.slug ?? null;

  const tenderUrl = `/ausschreibung/${tender.id}/${expectedSlug}`;

  // SEO: Dual-typed schema — Article for content indexing, GovernmentPermit for procurement semantics
  const spatialCoverageParts = [];
  if (tenderCity) spatialCoverageParts.push({ "@type": "City", name: tenderCity });
  if (tenderBundesland) spatialCoverageParts.push({ "@type": "AdministrativeArea", name: tenderBundesland });
  if (spatialCoverageParts.length === 0) spatialCoverageParts.push({ "@type": "Country", name: "Deutschland" });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["Article", "GovernmentPermit"],
    "@id": `${siteUrl}${tenderUrl}#article`,
    headline: title,
    description: description.slice(0, 300),
    url: `${siteUrl}${tenderUrl}`,
    articleSection: categoryLabel,
    ...(referenceNumber ? { identifier: referenceNumber } : {}),
    keywords: categoryLabel,
    additionalType: "https://schema.org/Tender",
    about: { "@type": "Thing", name: categoryLabel },
    provider: client ? { "@type": "Organization", name: client } : undefined,
    expires: deadlineISO ?? undefined,
    spatialCoverage: spatialCoverageParts.length === 1
      ? spatialCoverageParts[0]
      : spatialCoverageParts,
    author: client ? { "@type": "Organization", name: client } : undefined,
    publisher: { "@id": `${siteUrl}#organization` },
    datePublished: tender.createdAt ? new Date(tender.createdAt).toISOString() : undefined,
    dateModified: tender.updatedAt ? new Date(tender.updatedAt).toISOString() : undefined,
    ...(tender.contractValueMax && tender.contractValueMax > 0
      ? {
          offers: {
            "@type": "Offer",
            price: tender.contractValueMax,
            priceCurrency: "EUR",
            ...(deadlineISO ? { validThrough: deadlineISO } : undefined),
          },
        }
      : undefined),
  };

  // SEO: BreadcrumbList with region level when Bundesland is derivable
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
  ];
  let breadcrumbPos = 3;
  if (tenderBundesland && bundeslandSlug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbPos++,
      name: tenderBundesland,
      item: `${siteUrl}/ausschreibungen/region/${bundeslandSlug}`,
    });
  }
  if (tenderCity && citySlug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbPos++,
      name: tenderCity,
      item: `${siteUrl}/ausschreibungen/stadt/${citySlug}`,
    });
  }
  breadcrumbItems.push(
    { "@type": "ListItem", position: breadcrumbPos++, name: categoryLabel, item: `${siteUrl}/ausschreibungen/${categorySlug}` },
    { "@type": "ListItem", position: breadcrumbPos, name: title, item: `${siteUrl}${tenderUrl}` },
  );
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  const breadcrumbLinks: { href: string; label: string }[] = [
    { href: "/", label: "Start" },
    { href: "/ausschreibungen", label: "Ausschreibungen" },
  ];
  if (bundeslandSlug && tenderBundesland) {
    breadcrumbLinks.push({ href: `/ausschreibungen/region/${bundeslandSlug}`, label: tenderBundesland });
  }
  if (citySlug && tenderCity) {
    breadcrumbLinks.push({ href: `/ausschreibungen/stadt/${citySlug}`, label: tenderCity });
  }
  breadcrumbLinks.push({ href: `/ausschreibungen/${categorySlug}`, label: categoryLabel });

  const sectionHeadingSx = {
    fontSize: { xs: "1.25rem", md: "1.375rem" },
    fontWeight: 700,
    letterSpacing: "-0.015em",
    color: "text.primary",
    mb: 1.25,
    lineHeight: 1.25,
  };
  const sectionSx = { mb: { xs: 4, md: 5 }, scrollMarginTop: 24 };
  const tenderStatus = isExpired
    ? { label: "Frist abgelaufen", color: "warning.dark", background: "warning.light" }
    : deadline
      ? { label: "Offene Frist", color: "warning.dark", background: "warning.light" }
      : { label: "Frist unbekannt", color: "text.secondary", background: "info.light" };
  const missingRolesLabel = documentAnalysis.coverage.missingRoles
    .map((role) => ROLE_LABELS_DE[role] ?? role)
    .join(", ");
  const keyFacts = [
    { label: "Auftraggeber", markdownLabel: "Auftraggeber", value: client, Icon: Building2 },
    { label: "Ort", markdownLabel: "Leistungsort", value: location, Icon: MapPin },
    { label: "Vergabeart", markdownLabel: "Verfahren", value: procedure, Icon: FileText },
    { label: "Frist", markdownLabel: "Angebotsfrist", value: deadline ?? "", Icon: Calendar },
    { label: "Veröffentlicht", markdownLabel: null, value: publishedAt ?? "", Icon: Clock },
    { label: "Laufzeit", markdownLabel: "Laufzeit", value: duration, Icon: Clock },
    { label: "Geschätzter Wert", markdownLabel: "Auftragswert", value: contractValue, Icon: Euro },
    { label: "Referenz", markdownLabel: "Referenz", value: referenceNumber, Icon: Briefcase },
  ].filter((fact) => Boolean(fact.value) && (!fact.markdownLabel || !markdownHasSection(fact.markdownLabel)));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Container
          component="main"
          maxWidth={false}
          sx={{ maxWidth: "1280px", mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 5 } }}
        >
          <Box
            component="nav"
            aria-label="Brotkrümelnavigation"
            sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: { xs: 3, md: 4 }, flexWrap: "wrap" }}
          >
            {breadcrumbLinks.map((link, index) => (
              <Box key={link.href} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                <Link href={link.href} style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                  {link.label}
                </Link>
                {index < breadcrumbLinks.length - 1 && <ChevronRight size={14} color="var(--color-border-subtle)" aria-hidden="true" />}
              </Box>
            ))}
            <ChevronRight size={14} color="var(--color-border-subtle)" aria-hidden="true" />
            <Typography
              component="span"
              aria-current="page"
              sx={{
                 color: "text.primary",
                fontSize: "0.8125rem",
                fontWeight: 600,
                maxWidth: { xs: "100%", sm: 360 },
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </Typography>
          </Box>

          <Box
            component="article"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 340px" },
              columnGap: { lg: 5, xl: 6 },
              rowGap: { xs: 3, lg: 5 },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                <Chip
                  label={categoryLabel}
                  size="small"
                  sx={{
                    height: 26,
                    bgcolor: "var(--color-surface-strong)",
                    color: "text.primary",
                    borderRadius: 1,
                    fontWeight: 700,
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    minHeight: 26,
                    px: 1,
                    borderRadius: 1,
                    bgcolor: tenderStatus.background,
                    color: tenderStatus.color,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                   {isExpired ? <AlertCircle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                  {tenderStatus.label}
                </Box>
              </Stack>

              <Typography
                component="h1"
                sx={{
                  maxWidth: { lg: "23ch" },
                  color: "text.primary",
                  fontSize: { xs: "2rem", sm: "2.25rem", md: "2.5rem" },
                  fontWeight: 700,
                  letterSpacing: "-0.035em",
                  lineHeight: 1.1,
                  textWrap: "balance",
                  overflowWrap: "anywhere",
                }}
              >
                {title}
              </Typography>

              <Stack direction="row" spacing={{ xs: 1.25, sm: 2 }} flexWrap="wrap" useFlexGap sx={{ mt: 2.25 }}>
                {client && (
                  <Stack direction="row" spacing={0.65} alignItems="center" sx={{ minWidth: 0 }}>
                    <Building2 size={16} color="var(--color-text-secondary)" aria-hidden="true" />
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                      {client}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={0.65} alignItems="center" sx={{ minWidth: 0 }}>
                  <MapPin size={16} color="var(--color-text-secondary)" aria-hidden="true" />
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                    {displayLocation}
                  </Typography>
                </Stack>
                {deadline && (
                  <Stack direction="row" spacing={0.65} alignItems="center">
                    <Calendar size={16} color="var(--color-status-warning)" aria-hidden="true" />
                    <Typography component="time" dateTime={deadlineISO ?? undefined} variant="body2" color="warning.dark" sx={{ fontWeight: 700 }}>
                      Frist: {deadline}
                    </Typography>
                  </Stack>
                )}
              </Stack>

              {isExpired && (
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    mt: 3,
                    p: { xs: 1.25, sm: 1.5 },
                    borderRadius: 2,
                    bgcolor: tenderStatus.background,
                  }}
                >
                  <Box component="span" sx={{ color: tenderStatus.color, flexShrink: 0, mt: 0.25 }}>
                    <AlertCircle size={18} aria-hidden="true" />
                  </Box>
                  <Box>
                    <Typography sx={{ color: tenderStatus.color, fontSize: "0.875rem", fontWeight: 700 }}>
                      Angebotsfrist abgelaufen
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25, color: tenderStatus.color, lineHeight: 1.55 }}>
                      {`Diese Ausschreibung endete am ${deadline ?? "unbekanntem Datum"}. Die Angaben dienen als Archiv.`}
                    </Typography>
                    {categorySlug && (
                      <Link
                        href={`/ausschreibungen/${categorySlug}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, color: "var(--color-status-warning)", textDecoration: "none", fontWeight: 700, fontSize: "0.8125rem" }}
                      >
                        Aktuelle {categoryLabel}-Ausschreibungen ansehen
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </Box>
                </Box>
              )}

              <Box
                component="section"
                id="analyse"
                aria-labelledby="analyse-status-heading"
                 sx={{ mt: 3.5, p: { xs: 1.5, sm: 2 }, borderRadius: 2, bgcolor: "var(--color-surface-strong)" }}
              >
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.1fr 1fr 1.25fr" }, gap: { xs: 1.5, sm: 2 } }}>
                  <Box>
                     <Typography id="analyse-status-heading" variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Analyse
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.35 }}>
                       <Box component="span" sx={{ display: "inline-flex", color: readinessTone.text }}>
                         {readinessStatus === "ready" ? <CheckCircle2 size={17} aria-hidden="true" /> : <AlertCircle size={17} aria-hidden="true" />}
                       </Box>
                      <Typography sx={{ color: readinessTone.text, fontSize: "0.9375rem", fontWeight: 700 }}>
                        {readinessLabel[readinessStatus] ?? readinessLabel.pending}
                      </Typography>
                    </Stack>
                  </Box>
                  <Box>
                     <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Dokumente
                    </Typography>
                     <Typography sx={{ mt: 0.35, color: "text.primary", fontSize: "0.9375rem", fontWeight: 700 }}>
                      {documentAnalysis.coverage.parsed}/{documentAnalysis.coverage.discovered} analysiert
                    </Typography>
                     <Typography variant="caption" color="text.secondary">
                      {downloadedResources}/{downloadableResources.length} geladen, {coverageStatusLabel[resourceCoverageStatus] ?? "unbekannt"}
                    </Typography>
                  </Box>
                  <Box>
                     <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Fehlende Unterlagen
                    </Typography>
                     <Typography sx={{ mt: 0.35, color: "text.primary", fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.4 }}>
                      {missingRolesLabel || "Keine Pflichtunterlagen offen"}
                    </Typography>
                  </Box>
                </Box>
                {(tender.readinessReason && readinessStatus !== "ready") || documentAnalysis.evidence.length > 0 ? (
                   <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                    {tender.readinessReason && readinessStatus !== "ready" && (
                      <Typography variant="body2" sx={{ color: readinessTone.text, lineHeight: 1.55 }}>
                        {tender.readinessReason}
                      </Typography>
                    )}
                    {documentAnalysis.evidence.length > 0 && (
                      <Stack spacing={0.5} sx={{ mt: tender.readinessReason && readinessStatus !== "ready" ? 1 : 0 }}>
                        {documentAnalysis.evidence.slice(0, 4).map((evidence) => (
                           <Typography key={`${evidence.field}-${evidence.documentId}`} variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                            Beleg {documentAnalysisFieldLabel(evidence.field)}: „{evidence.quote}&quot;{evidence.page ? ` (Seite ${evidence.page})` : ""}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                  </Box>
                ) : null}
              </Box>
            </Box>

            <Paper
              component="aside"
              elevation={0}
              aria-labelledby="vergabedetails-heading"
              sx={{
                alignSelf: "start",
                gridColumn: { lg: "2" },
                gridRow: { lg: "1 / span 2" },
                position: { lg: "sticky" },
                top: { lg: 24 },
                minWidth: 0,
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
               <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.08em" }}>
                Entscheidungsübersicht
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, mb: 1 }}>
                 <Briefcase size={14} color="var(--color-text-secondary)" aria-hidden="true" />
                 <Typography id="vergabedetails-heading" component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: "0.75rem", lineHeight: 1.4 }}>
                  Quelle:
                </Typography>
                 <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: "0.75rem", lineHeight: 1.4 }}>
                  {tender.source}
                </Typography>
              </Stack>

               <Box sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: deadline ? "warning.light" : "info.light" }}>
                 <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, fontWeight: 700, fontSize: "0.6875rem", lineHeight: 1.2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Angebotsfrist
                </Typography>
                <Typography
                  component={deadline ? "time" : "span"}
                  dateTime={deadlineISO ?? undefined}
                   sx={{ display: "block", color: deadline ? "warning.dark" : "text.secondary", fontSize: "1.0625rem", fontWeight: 700, lineHeight: 1.3 }}
                >
                  {deadline ?? "Nicht angegeben"}
                </Typography>
              </Box>

               <Stack divider={<Divider flexItem sx={{ borderColor: "divider" }} />} sx={{ mt: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ py: 1 }}>
                   <FileText size={17} color="var(--color-text-secondary)" aria-hidden="true" />
                  <Box sx={{ minWidth: 0 }}>
                   <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.6875rem", lineHeight: 1.3 }}>Vergabeart</Typography>
                   <Typography variant="body2" sx={{ display: "block", mt: 1, color: "text.primary", fontWeight: 700, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                      {procedure || "Nicht angegeben"}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ py: 1 }}>
                   <Calendar size={17} color="var(--color-text-secondary)" aria-hidden="true" />
                  <Box sx={{ minWidth: 0 }}>
                   <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.6875rem", lineHeight: 1.3 }}>Veröffentlicht</Typography>
                   <Typography component={publishedAt ? "time" : "span"} dateTime={publishedAtISO ?? undefined} variant="body2" sx={{ display: "block", mt: 1, color: "text.primary", fontWeight: 700, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                      {publishedAt ?? "Nicht angegeben"}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>

              <Button
                component="a"
                href={tender.url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                variant="contained"
                fullWidth
                size="small"
                endIcon={<ArrowUpRight size={16} />}
                sx={{ mt: 2, minHeight: 36 }}
              >
                Original-Anzeige öffnen
              </Button>
            </Paper>

            <Box sx={{ gridColumn: { lg: "1" }, minWidth: 0 }}>
              {smallVendorDeepDiveEnabled && (
                <SmallVendorDeepDive tenderId={tender.id} initial={deepDiveInitial} />
              )}
              {commercialBrief && (
                 <Box component="section" aria-labelledby="geschaeftsentscheidung-heading" sx={{ ...sectionSx, bgcolor: "info.light", borderRadius: 2, p: { xs: 2, sm: 2.5 } }}>
                  <Typography id="geschaeftsentscheidung-heading" component="h2" sx={sectionHeadingSx}>
                    Geschäftsentscheidung
                  </Typography>
                   <Typography sx={{ color: "info.dark", fontSize: "1.0625rem", fontWeight: 700, lineHeight: 1.4 }}>
                    {commercialBrief.headline}
                  </Typography>
                   <Typography sx={{ mt: 0.75, maxWidth: "72ch", color: "text.secondary", lineHeight: 1.65 }}>
                    {commercialBrief.rationale}
                  </Typography>
                   <Typography sx={{ mt: 1.25, color: "info.dark", fontWeight: 700, lineHeight: 1.5 }}>
                    Nächster Schritt: {commercialBrief.nextAction}
                  </Typography>
                  {commercialBrief.unknowns.length > 0 && (
                     <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.5 }}>
                      Offen: {commercialBrief.unknowns.join(" ")}
                    </Typography>
                  )}
                </Box>
              )}
              <TenderQuickCheck key={`quick-check-${tender.id}`} tenderId={tender.id} initialCheck={tenderCheck} />
              <Box component="section" aria-labelledby="beschreibung-heading" sx={sectionSx}>
                <Typography id="beschreibung-heading" component="h2" sx={sectionHeadingSx}>
                  Beschreibung
                </Typography>
                <SafeMarkdown
                  content={descriptionMarkdown}
                   sx={{ maxWidth: "72ch", color: "text.secondary", fontSize: "1rem", lineHeight: 1.7 }}
                  fallback={
                    <Typography sx={{ maxWidth: "72ch", color: "text.secondary", fontSize: "1rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                      {description || "–"}
                    </Typography>
                  }
                />
              </Box>

              {scope && scope !== description && !markdownHasScope && (
                <Box component="section" aria-labelledby="leistungsumfang-heading" sx={sectionSx}>
                  <Typography id="leistungsumfang-heading" component="h2" sx={sectionHeadingSx}>
                    Leistungsumfang
                  </Typography>
                   <Typography sx={{ maxWidth: "72ch", color: "text.secondary", fontSize: "1rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                    {scope}
                  </Typography>
                </Box>
              )}

              {keyFacts.length > 0 && (
                <Box component="section" aria-labelledby="kerndaten-heading" sx={sectionSx}>
                  <Typography id="kerndaten-heading" component="h2" sx={sectionHeadingSx}>
                    Kerndaten
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
                      gap: { xs: 1.75, sm: 2.25 },
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: 2,
                      bgcolor: "var(--color-surface-strong)",
                    }}
                  >
                    {keyFacts.map(({ label, value, Icon }) => (
                      <Stack key={label} direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                         <Icon size={17} color="var(--color-text-secondary)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                        <Box sx={{ minWidth: 0 }}>
                           <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
                           <Typography sx={{ color: "text.primary", fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                            {value}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Box>
                </Box>
              )}

              {((requirements.length > 0 && !markdownHasRequirements) || (awardCriteria.length > 0 && !markdownHasAwards) || contactInfo) && (
                <Box component="section" aria-labelledby="vergabedetails-section-heading" sx={sectionSx}>
                  <Typography id="vergabedetails-section-heading" component="h2" sx={sectionHeadingSx}>
                    Vergabedetails
                  </Typography>
                   <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 3, md: 4 }, p: { xs: 2, sm: 2.5 }, borderRadius: 2, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
                    {requirements.length > 0 && !markdownHasRequirements && (
                      <Box>
                         <Typography component="h3" sx={{ color: "text.primary", fontSize: "1rem", fontWeight: 700, mb: 1 }}>
                          Anforderungen
                        </Typography>
                         <Box component="ul" sx={{ m: 0, pl: 2.25, color: "text.secondary", "& li + li": { mt: 0.75 } }}>
                          {requirements.map((req, i) => (
                            <li key={`${req}-${i}`}>
                              <Typography component="span" sx={{ fontSize: "0.9375rem", lineHeight: 1.55 }}>{req}</Typography>
                            </li>
                          ))}
                        </Box>
                      </Box>
                    )}
                    {awardCriteria.length > 0 && !markdownHasAwards && (
                      <Box>
                         <Typography component="h3" sx={{ color: "text.primary", fontSize: "1rem", fontWeight: 700, mb: 1 }}>
                          Zuschlagskriterien
                        </Typography>
                         <Box component="ul" sx={{ m: 0, pl: 2.25, color: "text.secondary", "& li + li": { mt: 0.75 } }}>
                          {awardCriteria.map((criterion, i) => (
                            <li key={`${criterion}-${i}`}>
                              <Typography component="span" sx={{ fontSize: "0.9375rem", lineHeight: 1.55 }}>{criterion}</Typography>
                            </li>
                          ))}
                        </Box>
                      </Box>
                    )}
                    {contactInfo && (
                      <Box sx={{ gridColumn: { md: requirements.length > 0 || awardCriteria.length > 0 ? "1 / -1" : "auto" } }}>
                         <Typography component="h3" sx={{ color: "text.primary", fontSize: "1rem", fontWeight: 700, mb: 1 }}>
                          Kontakt / Vergabestelle
                        </Typography>
                         <Typography color="text.secondary" sx={{ fontSize: "0.9375rem", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                          {contactInfo}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {allResources.length > 0 && (
                <Box component="section" aria-labelledby="unterlagen-heading" sx={sectionSx}>
                  <Typography id="unterlagen-heading" component="h2" sx={sectionHeadingSx}>
                    Vergabeunterlagen
                  </Typography>
                  <Box
                     sx={{ overflow: "hidden", borderRadius: 2, bgcolor: "background.paper", border: 1, borderColor: "divider" }}
                  >
                    <Stack divider={<Divider flexItem sx={{ borderColor: "divider" }} />}>
                      {downloadableResources.map((resource, i) => (
                        <PdfDocumentLink
                          key={`${resource.documentId ?? resource.id ?? resource.url}-${i}`}
                          variant="detail"
                          url={resource.url}
                          documentId={resource.documentId}
                          tenderId={tender.id}
                          index={i}
                          label={resource.label}
                          filename={resource.filename}
                          roles={resource.roles}
                          status={resource.status}
                          parseStatus={resource.parseStatus}
                          initialSummary={resource.summary}
                        />
                      ))}
                      {discoveredPageResources.slice(0, 8).map((resource, i) => (
                        <Box
                          key={`${resource.id ?? resource.url}-${i}`}
                          component="a"
                          href={resource.url ?? undefined}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          sx={{ p: 1.5, color: "text.primary", textDecoration: "none", "&:hover": { bgcolor: "action.hover" } }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {resource.label || resource.filename || resource.url}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[...resource.roles.map((role) => ROLE_LABELS_DE[role] ?? role), resourceStatusLabel[resource.status] ?? resource.status].filter(Boolean).join(" · ")}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              )}

              {similarTenders.length > 0 && (
                <Box component="section" aria-labelledby="aehnliche-heading" sx={sectionSx}>
                  <Typography id="aehnliche-heading" component="h2" sx={sectionHeadingSx}>
                    Ähnliche Ausschreibungen
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
                    {similarTenders.map((similarTender) => (
                      <Link key={similarTender.id} href={`/ausschreibung/${similarTender.id}/${similarTender.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                         <Box sx={{ height: "100%", p: { xs: 1.5, sm: 2 }, borderRadius: 2, bgcolor: "background.paper", border: 1, borderColor: "divider", transition: "background-color 180ms ease-out", "&:hover": { bgcolor: "var(--color-surface-strong)" } }}>
                           <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{similarTender.category}</Typography>
                           <Typography component="h3" sx={{ mt: 0.4, color: "text.primary", fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {similarTender.title}
                          </Typography>
                          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
                            {similarTender.client && (
                              <Stack direction="row" spacing={0.35} alignItems="center">
                                 <Building2 size={13} color="var(--color-text-secondary)" aria-hidden="true" />
                                 <Typography variant="caption" color="text.secondary">{similarTender.client.slice(0, 50)}</Typography>
                              </Stack>
                            )}
                            {similarTender.location && (
                              <Stack direction="row" spacing={0.35} alignItems="center">
                                 <MapPin size={13} color="var(--color-text-secondary)" aria-hidden="true" />
                                 <Typography variant="caption" color="text.secondary">{similarTender.location}</Typography>
                              </Stack>
                            )}
                            {similarTender.deadline && (
                              <Stack direction="row" spacing={0.35} alignItems="center">
                                 <Calendar size={13} color="var(--color-status-warning)" aria-hidden="true" />
                                 <Typography variant="caption" color="warning.dark" sx={{ fontWeight: 700 }}>{similarTender.deadline}</Typography>
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                      </Link>
                    ))}
                  </Box>
                </Box>
              )}

               <Box component="aside" aria-labelledby="weitere-ausschreibungen-heading" sx={{ mt: { xs: 5, md: 6 }, pt: { xs: 3, md: 4 }, borderTop: 1, borderColor: "divider" }}>
                 <Typography id="weitere-ausschreibungen-heading" component="h2" color="text.secondary" sx={{ fontSize: "0.9375rem", fontWeight: 700, mb: 1.25 }}>
                  Weitere Ausschreibungen entdecken
                </Typography>
                <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                   <Link href={`/ausschreibungen/${categorySlug}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                    Alle {categoryLabel}-Ausschreibungen
                  </Link>
                  {bundeslandSlug && tenderBundesland && (
                     <Link href={`/ausschreibungen/region/${bundeslandSlug}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                      Ausschreibungen in {tenderBundesland}
                    </Link>
                  )}
                  {bundeslandSlug && tenderBundesland && (
                     <Link href={`/ausschreibungen/region/${bundeslandSlug}/${categorySlug}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                      {categoryLabel} in {tenderBundesland}
                    </Link>
                  )}
                  {citySlug && tenderCity && (
                     <Link href={`/ausschreibungen/stadt/${citySlug}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                      Ausschreibungen in {tenderCity}
                    </Link>
                  )}
                  {citySlug && tenderCity && (
                     <Link href={`/ausschreibungen/stadt/${citySlug}/${categorySlug}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                      {categoryLabel} in {tenderCity}
                    </Link>
                  )}
                  {agencySlug && client && (
                     <Link href={`/auftraggeber/${agencySlug}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                      Alle Ausschreibungen von {client.slice(0, 40)}
                    </Link>
                  )}
                   <Link href="/ausschreibungen" style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                    Alle Kategorien
                  </Link>
                </Stack>

                {scoredCompanies.length > 0 && (
                  <Box sx={{ mt: 2.5 }}>
                     <Typography component="h3" color="text.secondary" sx={{ fontSize: "0.875rem", fontWeight: 700, mb: 1 }}>
                      Passende Auftraggeber
                    </Typography>
                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      {scoredCompanies.map((company) => (
                         <Link key={company.slug} href={`/p/${company.slug}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none", fontSize: "0.8125rem" }}>
                          {company.name}{company.industry ? ` · ${company.industry}` : ""}
                        </Link>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
      <SiteFooter containerMaxWidth="1280px" />
    </>
  );
}
