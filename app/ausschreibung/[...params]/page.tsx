import { db } from "@/lib/db";
import { documents, tenderResources, tenders, structuredData, scores, companyProfiles } from "@/lib/schema";
import { eq, and, ne, or, gt, isNull, inArray, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
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
  LockKeyhole,
} from "lucide-react";
import { cleanDescription } from "@/lib/public-tender-scraper";
import { looksMangled } from "@/lib/structurer";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { deriveBundesland, deriveCity, BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { CITY_SLUG_MAP } from "@/lib/cities";
import { normalizeAgencySlug } from "@/lib/agencies";
import { generateTenderSlug } from "@/lib/tender-slug";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { PdfDocumentLink } from "@/components/PdfDocumentLink";
import { auth } from "@/lib/auth";
import { getBillingStatus } from "@/lib/entitlements";
import { buildDocumentAnalysis, type AnalyzedDocument } from "@/lib/document-analysis";
import { ROLE_LABELS_DE } from "@/lib/document-classifier";
import { normalizeResourceUrl } from "@/lib/resource-discovery";
import { readTenderMeta } from "@/lib/tender-meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

// SEO: Catch-all route handles both /ausschreibung/[id] and /ausschreibung/[id]/[slug].
// Old numeric-only URLs redirect (301) to keyword-rich slug URLs for better long-tail SEO.
interface PageProps {
  params: Promise<{ params: string[] }>;
}

function parseParams(params: { params: string[] }): { id: string; slug: string | null } {
  const arr = params.params;
  if (arr.length === 0) return { id: "", slug: null };
  if (arr.length === 1) return { id: arr[0], slug: null };
  return { id: arr[0], slug: arr[1] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, slug } = parseParams(await params);
  const numericId = parseInt(id, 10);
  if (!Number.isFinite(numericId)) return { title: "Ausschreibung nicht gefunden", robots: { index: false, follow: true } };

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
      qualityStatus: tenders.qualityStatus,
    })
    .from(tenders)
    .where(eq(tenders.id, numericId))
    .limit(1);

  if (rows.length === 0) return { title: "Ausschreibung nicht gefunden", robots: { index: false, follow: true } };

  const row = rows[0];
  const meta = (typeof row.metadataJson === "object" && row.metadataJson !== null
    ? row.metadataJson
    : {}) as Record<string, unknown>;
  const location = typeof meta.location === "string" ? meta.location.split(",")[0] : "";
  const client = typeof meta.client === "string" ? meta.client : "";

  const deadline = row.deadlineAt
    ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const categoryLabel = CATEGORY_LABELS[row.category ?? "Sonstiges"] ?? row.category ?? "";
  const rawTitle = row.title ?? `Ausschreibung #${id}`;
  const enrichedTitle = [rawTitle, categoryLabel, location].filter(Boolean).join(" – ");
  const title = enrichedTitle.length <= 80 ? enrichedTitle : rawTitle;

  const descParts = [client, location, deadline].filter(Boolean).join(", ");
  const description = `${rawTitle}. ${descParts ? descParts + ". " : ""}Öffentliche Ausschreibung aus ${row.source}. Alle Details, Anforderungen und Fristen.`;

  // Canonical slug: prefer persisted DB slug, fall back to live computation for legacy rows
  const expectedSlug = row.slug ?? generateTenderSlug(rawTitle, location);
  const canonicalSlug = slug || expectedSlug;

  return {
    title,
    description,
    alternates: { canonical: `/ausschreibung/${id}/${canonicalSlug}`, languages: { "de-DE": `/ausschreibung/${id}/${canonicalSlug}` } },
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
  const numericId = parseInt(id, 10);
  if (!Number.isFinite(numericId)) notFound();

  const rows = await db
    .select()
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(eq(tenders.id, numericId))
    .limit(1);

  if (rows.length === 0) notFound();

  const row = rows[0];
  const tender = row.tenders;
  const sd = row.structured_data;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const hasPremiumDocuments = session?.user?.id ? (await getBillingStatus(session.user.id)).active : false;
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
    .where(eq(documents.tenderId, tender.id));
  const documentAnalysis = buildDocumentAnalysis(documentRows as AnalyzedDocument[]);

  // Status-Page statt Redirect: expired/rejected Tenders bleiben indexable,
  // erhalten aber einen prominenten Status-Banner und Cross-Links zu aktiven Tenders.
  const isExpired = Boolean(tender.deadlineAt && new Date(tender.deadlineAt) < new Date());
  const isRejected = tender.qualityStatus === "rejected" || tender.qualityStatus === "duplicate";
  const readinessLabel: Record<string, string> = {
    pending: "Analyse wartet",
    partial: "Analyse teilweise verfügbar",
    ready: "Analyse verfügbar",
    blocked: "Dokumentzugriff blockiert",
    failed: "Analyse fehlgeschlagen",
    manual_review: "Manuelle Prüfung erforderlich",
  };
  const readinessStatus = tender.readinessStatus ?? "pending";
  const readinessTone = readinessStatus === "ready"
    ? { background: "#f0fdf4", border: "#bbf7d0", text: "#166534" }
    : readinessStatus === "blocked" || readinessStatus === "failed"
      ? { background: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : { background: "#fffbeb", border: "#fde68a", text: "#92400e" };

  const meta = (typeof tender.metadataJson === "object" && tender.metadataJson !== null
    ? tender.metadataJson
    : {}) as Record<string, unknown>;

  const blob = sd?.jsonBlob as Record<string, unknown> | null;
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
    .where(eq(tenderResources.tenderId, tender.id));
  const tenderMeta = readTenderMeta(meta, tender.rawText);
  const structuredMeta = readTenderMeta(blob);
  const resourceUrl = (value: string | null | undefined): string | null => normalizeResourceUrl(value, tender.url);
  const resourceKey = (value: string | null | undefined): string | null => resourceUrl(value);
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
  };
  const documentByUrl = new Map<string, { id: number; filename: string | null }>();
  for (const document of documentRows) {
    const key = resourceKey(document.url);
    if (key) documentByUrl.set(key, { id: document.id, filename: document.filename });
  }
  const resourceByUrl = new Map<string, DisplayResource>();
  const addResource = (resource: DisplayResource): void => {
    const key = resourceKey(resource.url) ?? resource.url;
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
    if (existing.status === "discovered" || existing.status === "unknown") existing.status = resource.status;
  };
  for (const document of documentRows) {
    addResource({
      id: null,
      documentId: document.id,
      url: resourceUrl(document.url),
      label: document.filename ?? "",
      filename: document.filename,
      resourceType: "document",
      roles: [
        ...(Array.isArray(document.roles) ? document.roles : []),
        document.role,
      ].filter((role): role is string => typeof role === "string" && role.length > 0)
        .filter((role, index, roles) => roles.indexOf(role) === index),
      status: document.downloadStatus ?? "unknown",
      sourcePageUrl: null,
      contentType: document.contentType,
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
      label: resource.label || resource.filename || "",
      filename: resource.filename,
      resourceType: resource.resourceType || "unknown",
      roles: Array.isArray(resource.roleHints) ? resource.roleHints.filter((role): role is string => typeof role === "string") : [],
      status: resource.status || "discovered",
      sourcePageUrl: resourceUrl(resource.sourcePageUrl),
      contentType: resource.contentType,
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
      label: resource.label || resource.text || resource.filename || "",
      filename: resource.filename,
      resourceType: resource.resourceType || resource.type || "unknown",
      roles: resource.roleHints,
      status: typeof resource.status === "string" ? resource.status : "discovered",
      sourcePageUrl: resourceUrl(resource.sourcePageUrl),
      contentType: resource.contentType,
    });
  }
  const allResources = [...resourceByUrl.values()]
    .filter((resource) => resource.url && resource.url !== resourceUrl(tender.url))
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

  const title = tender.title ?? `Ausschreibung #${tender.id}`;
  const categoryLabel = CATEGORY_LABELS[tender.category ?? "Sonstiges"] ?? tender.category ?? "Diverse Leistungen";
  const categorySlug = CATEGORY_SLUGS[tender.category ?? "Sonstiges"] ?? "diverse";

  // Pick the first non-empty candidate that does not look like mangled text
  // (HTML→text conversion that lost whitespace between block elements produces
  // labels glued to values, e.g. "HüpstedtVergabeartBeschränkte..."). This guard
  // prevents the duplicate mangled caption that previously appeared in Key Facts
  // and Beschreibung.
  const pickFirstClean = (...candidates: Array<unknown>): string => {
    for (const c of candidates) {
      const v = String(c ?? "").trim();
      if (v.length === 0) continue;
      if (looksMangled(v)) continue;
      return v;
    }
    return "";
  };

  // Description: prefer the LLM-extracted `meta.description` (clean prose) over
  // `blob.summary` (which historically echoed `rawText.slice(0, 3000)`).
  const description = cleanDescription(
    pickFirstClean(blob?.description, meta.description, blob?.summary, tender.rawText),
  );
  const scope = String(blob?.scope ?? "").trim();
  const hardFacts = (blob?.hard_facts ?? {}) as Record<string, unknown>;
  const client = pickFirstClean(
    blob?.client,
    typeof hardFacts.buyer === "string" ? hardFacts.buyer : null,
    meta.client,
  )
    .replace(/^\/\s*/, "")
    .replace(/Ausschreibende[rn]?\s*Stelle\s*/i, "")
    .replace(/\s+Ausschreibungs-?\s*$/, "")
    .trim();
  const location = pickFirstClean(
    blob?.location,
    typeof hardFacts.location === "string" ? hardFacts.location : null,
    meta.location,
  );
  const contactInfo = String(blob?.contact ?? "").trim();
  const estimatedValue = String(blob?.estimatedValue ?? "").trim();
  const referenceNumber = String(blob?.referenceNumber ?? "").trim();
  const procedure = String(blob?.procedure ?? tender.procedureType ?? "").trim();
  const duration = String(blob?.duration ?? "").trim();

  // SEO: Canonical slug from DB (stable, never drifts). Fallback to live computation for legacy rows.
  const expectedSlug = tender.slug ?? generateTenderSlug(title, location);
  if (!slug || slug !== expectedSlug) {
    redirect(`/ausschreibung/${tender.id}/${expectedSlug}`);
  }

  const requirements = Array.isArray(blob?.requirements)
    ? (blob.requirements as string[]).filter((r) => r.trim().length > 5)
    : [];
  const awardCriteria = Array.isArray(blob?.awardCriteria)
    ? (blob.awardCriteria as string[]).filter((r) => r.trim().length > 5)
    : [];
  const deadline = tender.deadlineAt
    ? new Date(tender.deadlineAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const deadlineISO = tender.deadlineAt ? new Date(tender.deadlineAt).toISOString() : null;
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

  const now = new Date();

  const similarRows = await db
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
        inArray(tenders.qualityStatus, ["qualified", "candidate"]),
        or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
      ),
    )
    .orderBy(desc(tenders.createdAt))
    .limit(4);

  const similarTenders = similarRows.map((t) => {
    const m = (typeof t.metadataJson === "object" && t.metadataJson !== null
      ? t.metadataJson
      : {}) as Record<string, unknown>;
    const tLocation = typeof m.location === "string" ? m.location : "";
    // Use DB slug with fallback for similar tenders cross-links
    const tSlug = t.slug ?? generateTenderSlug(t.title ?? "", tLocation);
    return {
      id: t.id,
      slug: tSlug,
      title: t.title ?? `Ausschreibung #${t.id}`,
      category: CATEGORY_LABELS[t.category ?? "Sonstiges"] ?? t.category ?? categoryLabel,
      client: typeof m.client === "string" ? m.client : "",
      location: typeof m.location === "string" ? m.location.split(",")[0] : "",
      deadline: t.deadlineAt
        ? new Date(t.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      source: t.source,
    };
  });

  const scoredCompanyRows = await db
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
    .limit(5);

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
  const agencySlug = client ? normalizeAgencySlug(client) : null;

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
    image: `${siteUrl}${tenderUrl}/opengraph-image`,
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
    color: "#2d3544",
    mb: 1.25,
    lineHeight: 1.25,
  };
  const sectionSx = { mb: { xs: 4, md: 5 }, scrollMarginTop: 24 };
  const tenderStatus = isRejected
    ? { label: "Prüfhinweis", color: "#991b1b", background: "#fef2f2" }
    : isExpired
      ? { label: "Frist abgelaufen", color: "#92400e", background: "#fffbeb" }
      : deadline
        ? { label: "Offene Frist", color: "#b34d3d", background: "#f8d8d2" }
        : { label: "Frist unbekannt", color: "#667288", background: "#e8eff5" };
  const missingRolesLabel = documentAnalysis.coverage.missingRoles
    .map((role) => ROLE_LABELS_DE[role] ?? role)
    .join(", ");
  const keyFacts = [
    { label: "Auftraggeber", value: client, Icon: Building2 },
    { label: "Ort", value: location, Icon: MapPin },
    { label: "Vergabeart", value: procedure, Icon: FileText },
    { label: "Frist", value: deadline ?? "", Icon: Calendar },
    { label: "Veröffentlicht", value: publishedAt ?? "", Icon: Clock },
    { label: "Laufzeit", value: duration, Icon: Clock },
    { label: "Geschätzter Wert", value: contractValue, Icon: Euro },
    { label: "Referenz", value: referenceNumber, Icon: Briefcase },
  ].filter((fact) => Boolean(fact.value));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "#f0f4f8" }}>
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
                <Link href={link.href} style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
                  {link.label}
                </Link>
                {index < breadcrumbLinks.length - 1 && <ChevronRight size={14} color="#94a3b8" aria-hidden="true" />}
              </Box>
            ))}
            <ChevronRight size={14} color="#94a3b8" aria-hidden="true" />
            <Typography
              component="span"
              aria-current="page"
              sx={{
                color: "#2d3544",
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
                    bgcolor: "#e8eff5",
                    color: "#2d3544",
                    borderRadius: 1.5,
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
                    borderRadius: 1.5,
                    bgcolor: tenderStatus.background,
                    color: tenderStatus.color,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {isExpired || isRejected ? <AlertCircle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                  {tenderStatus.label}
                </Box>
              </Stack>

              <Typography
                component="h1"
                sx={{
                  maxWidth: { lg: "23ch" },
                  color: "#2d3544",
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
                    <Building2 size={16} color="#667288" aria-hidden="true" />
                    <Typography variant="body2" sx={{ color: "#4b5565", fontWeight: 600, overflowWrap: "anywhere" }}>
                      {client}
                    </Typography>
                  </Stack>
                )}
                {location && (
                  <Stack direction="row" spacing={0.65} alignItems="center" sx={{ minWidth: 0 }}>
                    <MapPin size={16} color="#667288" aria-hidden="true" />
                    <Typography variant="body2" sx={{ color: "#4b5565", fontWeight: 600, overflowWrap: "anywhere" }}>
                      {location}
                    </Typography>
                  </Stack>
                )}
                {deadline && (
                  <Stack direction="row" spacing={0.65} alignItems="center">
                    <Calendar size={16} color="#b34d3d" aria-hidden="true" />
                    <Typography component="time" dateTime={deadlineISO ?? undefined} variant="body2" sx={{ color: "#b34d3d", fontWeight: 700 }}>
                      Frist: {deadline}
                    </Typography>
                  </Stack>
                )}
              </Stack>

              {(isExpired || isRejected) && (
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
                  <AlertCircle size={18} color={tenderStatus.color} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Box>
                    <Typography sx={{ color: tenderStatus.color, fontSize: "0.875rem", fontWeight: 700 }}>
                      {isRejected ? "Verfahrensinformation nicht abschließend bewertet" : "Angebotsfrist abgelaufen"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25, color: tenderStatus.color, lineHeight: 1.55 }}>
                      {isRejected
                        ? "Diese Ausschreibung wurde aus dem qualifizierten Bestand entfernt. Die Originaldaten bleiben aus Transparenzgründen verfügbar."
                        : `Diese Ausschreibung endete am ${deadline ?? "unbekanntem Datum"}. Die Angaben dienen als Archiv.`}
                    </Typography>
                    {categorySlug && (
                      <Link
                        href={`/ausschreibungen/${categorySlug}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, color: tenderStatus.color, textDecoration: "none", fontWeight: 700, fontSize: "0.8125rem" }}
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
                sx={{ mt: 3.5, p: { xs: 1.5, sm: 2 }, borderRadius: 2.5, bgcolor: "#e8eff5" }}
              >
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.1fr 1fr 1.25fr" }, gap: { xs: 1.5, sm: 2 } }}>
                  <Box>
                    <Typography id="analyse-status-heading" variant="caption" sx={{ color: "#667288", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Analyse
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.35 }}>
                      {readinessStatus === "ready" ? <CheckCircle2 size={17} color={readinessTone.text} aria-hidden="true" /> : <AlertCircle size={17} color={readinessTone.text} aria-hidden="true" />}
                      <Typography sx={{ color: readinessTone.text, fontSize: "0.9375rem", fontWeight: 700 }}>
                        {readinessLabel[readinessStatus] ?? readinessLabel.pending}
                      </Typography>
                    </Stack>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#667288", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Dokumente
                    </Typography>
                    <Typography sx={{ mt: 0.35, color: "#2d3544", fontSize: "0.9375rem", fontWeight: 700 }}>
                      {documentAnalysis.coverage.parsed}/{documentAnalysis.coverage.discovered} analysiert
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#667288" }}>
                      {downloadedResources}/{downloadableResources.length} geladen, {coverageStatusLabel[resourceCoverageStatus] ?? "unbekannt"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#667288", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Fehlende Unterlagen
                    </Typography>
                    <Typography sx={{ mt: 0.35, color: "#2d3544", fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.4 }}>
                      {missingRolesLabel || "Keine Pflichtunterlagen offen"}
                    </Typography>
                  </Box>
                </Box>
                {(tender.readinessReason && readinessStatus !== "ready") || (hasPremiumDocuments && documentAnalysis.evidence.length > 0) ? (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid rgba(102, 114, 136, 0.22)" }}>
                    {tender.readinessReason && readinessStatus !== "ready" && (
                      <Typography variant="body2" sx={{ color: readinessTone.text, lineHeight: 1.55 }}>
                        {tender.readinessReason}
                      </Typography>
                    )}
                    {hasPremiumDocuments && documentAnalysis.evidence.length > 0 && (
                      <Stack spacing={0.5} sx={{ mt: tender.readinessReason && readinessStatus !== "ready" ? 1 : 0 }}>
                        {documentAnalysis.evidence.slice(0, 4).map((evidence) => (
                          <Typography key={`${evidence.field}-${evidence.documentId}`} variant="caption" sx={{ color: "#4b5565", lineHeight: 1.5 }}>
                            Beleg {evidence.field}: „{evidence.quote}&quot;{evidence.page ? ` (Seite ${evidence.page})` : ""}
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
                bgcolor: "#fbfcfd",
                boxShadow: "0 4px 12px rgba(45, 53, 68, 0.04)",
              }}
            >
              <Typography variant="overline" sx={{ color: "#667288", fontWeight: 700, letterSpacing: "0.08em" }}>
                Entscheidungsübersicht
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, mb: 1 }}>
                <Briefcase size={14} color="#667288" aria-hidden="true" />
                <Typography id="vergabedetails-heading" component="span" variant="caption" sx={{ color: "#7a8594", fontWeight: 500, fontSize: "0.75rem", lineHeight: 1.4 }}>
                  Quelle:
                </Typography>
                <Typography component="span" variant="caption" sx={{ color: "#667288", fontWeight: 500, fontSize: "0.75rem", lineHeight: 1.4 }}>
                  {tender.source}
                </Typography>
              </Stack>

              <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: deadline ? "#fcebea" : "#eef3f6" }}>
                <Typography variant="caption" sx={{ display: "block", mb: 1, color: "#667288", fontWeight: 700, fontSize: "0.6875rem", lineHeight: 1.2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Angebotsfrist
                </Typography>
                <Typography
                  component={deadline ? "time" : "span"}
                  dateTime={deadlineISO ?? undefined}
                  sx={{ display: "block", color: deadline ? "#ad5b4e" : "#4b5565", fontSize: "1.0625rem", fontWeight: 700, lineHeight: 1.3 }}
                >
                  {deadline ?? "Nicht angegeben"}
                </Typography>
              </Box>

              <Stack divider={<Divider flexItem sx={{ borderColor: "rgba(102, 114, 136, 0.12)" }} />} sx={{ mt: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ py: 1 }}>
                  <FileText size={17} color="#667288" aria-hidden="true" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ display: "block", color: "#667288", fontSize: "0.6875rem", lineHeight: 1.3 }}>Vergabeart</Typography>
                    <Typography variant="body2" sx={{ display: "block", mt: 1, color: "#2d3544", fontWeight: 700, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                      {procedure || "Nicht angegeben"}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ py: 1 }}>
                  <Calendar size={17} color="#667288" aria-hidden="true" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ display: "block", color: "#667288", fontSize: "0.6875rem", lineHeight: 1.3 }}>Veröffentlicht</Typography>
                    <Typography component={publishedAt ? "time" : "span"} dateTime={publishedAtISO ?? undefined} variant="body2" sx={{ display: "block", mt: 1, color: "#2d3544", fontWeight: 700, lineHeight: 1.4, overflowWrap: "anywhere" }}>
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
              {description && (
                <Box component="section" aria-labelledby="beschreibung-heading" sx={sectionSx}>
                  <Typography id="beschreibung-heading" component="h2" sx={sectionHeadingSx}>
                    Beschreibung
                  </Typography>
                  <Typography sx={{ maxWidth: "72ch", color: "#4b5565", fontSize: "1rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                    {description}
                  </Typography>
                </Box>
              )}

              {scope && scope !== description && (
                <Box component="section" aria-labelledby="leistungsumfang-heading" sx={sectionSx}>
                  <Typography id="leistungsumfang-heading" component="h2" sx={sectionHeadingSx}>
                    Leistungsumfang
                  </Typography>
                  <Typography sx={{ maxWidth: "72ch", color: "#4b5565", fontSize: "1rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
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
                      borderRadius: 2.5,
                      bgcolor: "#e8eff5",
                    }}
                  >
                    {keyFacts.map(({ label, value, Icon }) => (
                      <Stack key={label} direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                        <Icon size={17} color="#667288" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: "#667288", display: "block" }}>{label}</Typography>
                          <Typography sx={{ color: "#2d3544", fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                            {value}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Box>
                </Box>
              )}

              {(requirements.length > 0 || awardCriteria.length > 0 || contactInfo) && (
                <Box component="section" aria-labelledby="vergabedetails-section-heading" sx={sectionSx}>
                  <Typography id="vergabedetails-section-heading" component="h2" sx={sectionHeadingSx}>
                    Vergabedetails
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 3, md: 4 }, p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, bgcolor: "#fbfcfd" }}>
                    {requirements.length > 0 && (
                      <Box>
                        <Typography component="h3" sx={{ color: "#2d3544", fontSize: "1rem", fontWeight: 700, mb: 1 }}>
                          Anforderungen
                        </Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.25, color: "#4b5565", "& li + li": { mt: 0.75 } }}>
                          {requirements.map((req, i) => (
                            <li key={`${req}-${i}`}>
                              <Typography component="span" sx={{ fontSize: "0.9375rem", lineHeight: 1.55 }}>{req}</Typography>
                            </li>
                          ))}
                        </Box>
                      </Box>
                    )}
                    {awardCriteria.length > 0 && (
                      <Box>
                        <Typography component="h3" sx={{ color: "#2d3544", fontSize: "1rem", fontWeight: 700, mb: 1 }}>
                          Zuschlagskriterien
                        </Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.25, color: "#4b5565", "& li + li": { mt: 0.75 } }}>
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
                        <Typography component="h3" sx={{ color: "#2d3544", fontSize: "1rem", fontWeight: 700, mb: 1 }}>
                          Kontakt / Vergabestelle
                        </Typography>
                        <Typography sx={{ color: "#4b5565", fontSize: "0.9375rem", lineHeight: 1.6, whiteSpace: "pre-line" }}>
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
                  {hasPremiumDocuments ? (
                    <Box sx={{ overflow: "hidden", borderRadius: 2.5, bgcolor: "#fbfcfd" }}>
                      <Stack divider={<Divider flexItem sx={{ borderColor: "rgba(102, 114, 136, 0.16)" }} />}>
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
                  ) : (
                    <>
                      <Typography sx={{ maxWidth: "68ch", color: "#4b5565", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                        {allResources.length} Ressource{allResources.length === 1 ? "" : "n"} entdeckt. Verfügbarkeit: {coverageStatusLabel[resourceCoverageStatus] ?? "unbekannt"}.
                      </Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                        {allResources.slice(0, 8).map((resource, i) => (
                          <Chip
                            key={`${resource.url}-${i}`}
                            size="small"
                            label={[resource.label || resource.filename || "Ressource", ...resource.roles.map((role) => ROLE_LABELS_DE[role] ?? role)].join(" · ")}
                            sx={{ maxWidth: "100%", bgcolor: "#e8eff5", color: "#4b5565", borderRadius: 1.5, ".MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }}
                          />
                        ))}
                      </Stack>
                      <Box sx={{ display: "flex", alignItems: { sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mt: 2.5, p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, bgcolor: "#e8eff5" }}>
                        <Box sx={{ width: 40, height: 40, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 2, bgcolor: "#fbfcfd", color: "#4b5565" }}>
                          <LockKeyhole size={19} aria-hidden="true" />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="overline" sx={{ color: "#667288", fontWeight: 700, letterSpacing: "0.06em" }}>
                            Tenderhunter Pro
                          </Typography>
                          <Typography component="h3" sx={{ mt: -0.5, color: "#2d3544", fontSize: "1.0625rem", fontWeight: 700 }}>
                            Unterlagen in eine klare Entscheidung übersetzen
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, color: "#4b5565", lineHeight: 1.55 }}>
                            Prüfen Sie Go/No-Go, fehlende Anforderungen und die nächsten Schritte direkt anhand der Originalunterlagen.
                          </Typography>
                          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            {['Originalunterlagen', 'Go-/No-Go-Check', 'Offene Anforderungen'].map((benefit) => (
                              <Stack key={benefit} direction="row" spacing={0.4} alignItems="center">
                                <CheckCircle2 size={14} color="#4b5565" aria-hidden="true" />
                                <Typography variant="caption" sx={{ color: "#4b5565", fontWeight: 700 }}>{benefit}</Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                        <Button component={Link} href="/upgrade" variant="contained" endIcon={<ArrowRight size={16} />} sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}>
                          Unterlagen freischalten
                        </Button>
                      </Box>
                    </>
                  )}
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
                        <Box sx={{ height: "100%", p: { xs: 1.5, sm: 2 }, borderRadius: 2.5, bgcolor: "#fbfcfd", transition: "background-color 180ms ease-out", "&:hover": { bgcolor: "#e8eff5" } }}>
                          <Typography variant="caption" sx={{ color: "#667288", fontWeight: 700 }}>{similarTender.category}</Typography>
                          <Typography component="h3" sx={{ mt: 0.4, color: "#2d3544", fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {similarTender.title}
                          </Typography>
                          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
                            {similarTender.client && (
                              <Stack direction="row" spacing={0.35} alignItems="center">
                                <Building2 size={13} color="#667288" aria-hidden="true" />
                                <Typography variant="caption" sx={{ color: "#667288" }}>{similarTender.client.slice(0, 50)}</Typography>
                              </Stack>
                            )}
                            {similarTender.location && (
                              <Stack direction="row" spacing={0.35} alignItems="center">
                                <MapPin size={13} color="#667288" aria-hidden="true" />
                                <Typography variant="caption" sx={{ color: "#667288" }}>{similarTender.location}</Typography>
                              </Stack>
                            )}
                            {similarTender.deadline && (
                              <Stack direction="row" spacing={0.35} alignItems="center">
                                <Calendar size={13} color="#b34d3d" aria-hidden="true" />
                                <Typography variant="caption" sx={{ color: "#b34d3d", fontWeight: 700 }}>{similarTender.deadline}</Typography>
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                      </Link>
                    ))}
                  </Box>
                </Box>
              )}

              <Box component="aside" aria-labelledby="weitere-ausschreibungen-heading" sx={{ mt: { xs: 5, md: 6 }, pt: { xs: 3, md: 4 }, borderTop: "1px solid #d1d5db" }}>
                <Typography id="weitere-ausschreibungen-heading" component="h2" sx={{ color: "#667288", fontSize: "0.9375rem", fontWeight: 700, mb: 1.25 }}>
                  Weitere Ausschreibungen entdecken
                </Typography>
                <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                  <Link href={`/ausschreibungen/${categorySlug}`} style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
                    Alle {categoryLabel}-Ausschreibungen
                  </Link>
                  {bundeslandSlug && tenderBundesland && (
                    <Link href={`/ausschreibungen/region/${bundeslandSlug}`} style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
                      Ausschreibungen in {tenderBundesland}
                    </Link>
                  )}
                  {bundeslandSlug && tenderBundesland && (
                    <Link href={`/ausschreibungen/region/${bundeslandSlug}/${categorySlug}`} style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
                      {categoryLabel} in {tenderBundesland}
                    </Link>
                  )}
                  {citySlug && tenderCity && (
                    <Link href={`/ausschreibungen/stadt/${citySlug}`} style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
                      Ausschreibungen in {tenderCity}
                    </Link>
                  )}
                  {citySlug && tenderCity && (
                    <Link href={`/ausschreibungen/stadt/${citySlug}/${categorySlug}`} style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
                      {categoryLabel} in {tenderCity}
                    </Link>
                  )}
                  {agencySlug && client && (
                    <Link href={`/auftraggeber/${agencySlug}`} style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
                      Alle Ausschreibungen von {client.slice(0, 40)}
                    </Link>
                  )}
                  <Link href="/ausschreibungen" style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
                    Alle Kategorien
                  </Link>
                </Stack>

                {scoredCompanies.length > 0 && (
                  <Box sx={{ mt: 2.5 }}>
                    <Typography component="h3" sx={{ color: "#667288", fontSize: "0.875rem", fontWeight: 700, mb: 1 }}>
                      Passende Auftraggeber
                    </Typography>
                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      {scoredCompanies.map((company) => (
                        <Link key={company.slug} href={`/p/${company.slug}`} style={{ color: "#667288", textDecoration: "none", fontSize: "0.8125rem" }}>
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
