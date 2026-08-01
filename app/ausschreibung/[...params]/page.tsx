import { db } from "@/lib/db";
import { tenders, structuredData, scores, companyProfiles } from "@/lib/schema";
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
import { cleanDescription } from "@/lib/public-tender-scraper";
import { looksMangled } from "@/lib/structurer";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { deriveBundesland, deriveCity, BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { CITY_SLUG_MAP } from "@/lib/cities";
import { normalizeAgencySlug } from "@/lib/agencies";
import { generateTenderSlug } from "@/lib/tender-slug";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { PdfDocumentLink } from "@/components/PdfDocumentLink";
import { PageFooter } from "@/components/profile/PageFooter";
import { PaywallPanel } from "@/components/billing/PaywallPanel";
import { auth } from "@/lib/auth";
import { getBillingStatus } from "@/lib/entitlements";

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

  // Status-Page statt Redirect: expired/rejected Tenders bleiben indexable,
  // erhalten aber einen prominenten Status-Banner und Cross-Links zu aktiven Tenders.
  const isExpired = Boolean(tender.deadlineAt && new Date(tender.deadlineAt) < new Date());
  const isRejected = tender.qualityStatus === "rejected" || tender.qualityStatus === "duplicate";

  const meta = (typeof tender.metadataJson === "object" && tender.metadataJson !== null
    ? tender.metadataJson
    : {}) as Record<string, unknown>;

  const blob = sd?.jsonBlob as Record<string, unknown> | null;

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
  const pdfUrls = Array.isArray(blob?.pdfUrls)
    ? (blob.pdfUrls as string[])
    : Array.isArray(meta.pdf_urls)
      ? (meta.pdf_urls as string[])
      : [];

  const deadline = tender.deadlineAt
    ? new Date(tender.deadlineAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const deadlineISO = tender.deadlineAt ? new Date(tender.deadlineAt).toISOString() : null;

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
    fontWeight: 600,
    color: "#1e293b",
    mb: 1,
    lineHeight: 1.2,
  };

  const sectionCardSx = {
    p: { xs: 1.5, md: 2 },
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "6px",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
        <Container maxWidth={false} sx={{ maxWidth: "1120px", mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, md: 4 } }}>
          {/* Breadcrumbs */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mb: 2,
              fontSize: "0.8125rem",
              flexWrap: "wrap",
            }}
          >
            {breadcrumbLinks.map((link, i) => (
              <Box key={link.href} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Link
                  href={link.href}
                  style={{
                    color: "#475569",
                    textDecoration: "none",
                  }}
                >
                  {link.label}
                </Link>
                <ChevronRight size={14} color="#94a3b8" />
              </Box>
            ))}
            <Typography
              component="span"
              sx={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#1e293b",
              }}
            >
              {title}
            </Typography>
          </Box>

          {/* Title */}
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "1.75rem", md: "2rem" },
              fontWeight: 600,
              lineHeight: 1.2,
              color: "#1e293b",
              mb: 1.5,
            }}
          >
            {title}
          </Typography>

          {/* Status Banner — replaces redirect/noindex for expired or rejected tenders */}
          {(isExpired || isRejected) && (
            <Box
              sx={{
                mb: 3,
                p: 2,
                borderRadius: 2,
                bgcolor: isRejected ? "#fef2f2" : "#fffbeb",
                border: 1,
                borderColor: isRejected ? "#fecaca" : "#fde68a",
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
              }}
            >
              <AlertCircle
                size={20}
                color={isRejected ? "#dc2626" : "#d97706"}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600, color: isRejected ? "#991b1b" : "#92400e", mb: 0.5 }}>
                  {isRejected
                    ? "Verfahrensinformation nicht abschließend bewertet"
                    : "Angebotsfrist abgelaufen"}
                </Typography>
                <Typography variant="body2" sx={{ color: isRejected ? "#7f1d1d" : "#78350f", lineHeight: 1.6 }}>
                  {isRejected
                    ? "Diese Ausschreibung wurde aus dem qualifizierten Bestand entfernt. Die Originaldaten sind aus Gründen der Transparenz weiterhin verfügbar."
                    : `Diese Ausschreibung endete am ${deadline ?? "unbekanntem Datum"}. Die nachstehenden Angaben dienen als Archiv — aktuelle Vergaben finden Sie unten auf dieser Seite.`}
                </Typography>
                {categorySlug && (
                  <Link
                    href={`/ausschreibungen/${categorySlug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 8,
                      color: isRejected ? "#dc2626" : "#d97706",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    Aktuelle {categoryLabel}-Ausschreibungen ansehen
                    <ArrowRight size={14} />
                  </Link>
                )}
              </Box>
            </Box>
          )}

          {/* Key Facts - compact metadata line */}
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
              {client && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Building2 size={13} color="#475569" />
                  <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                    {client}
                  </Typography>
                </Box>
              )}
              {location && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <MapPin size={13} color="#475569" />
                  <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                    {location}
                  </Typography>
                </Box>
              )}
              {procedure && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <FileText size={13} color="#475569" />
                  <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                    {procedure}
                  </Typography>
                </Box>
              )}
              {deadline && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Calendar size={13} color="#475569" />
                  <Typography
                    variant="caption"
                    sx={{ color: "#475569", fontSize: "0.8125rem" }}
                    component="time"
                    dateTime={deadlineISO ?? undefined}
                  >
                    {deadline}
                  </Typography>
                </Box>
              )}
              {contractValue && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Euro size={13} color="#475569" />
                  <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                    {contractValue}
                  </Typography>
                </Box>
              )}
              {duration && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  <Clock size={13} color="#475569" />
                  <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.8125rem" }}>
                    {duration}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>

          {/* Tags */}
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
            <Chip
              label={categoryLabel}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.6875rem",
                fontWeight: 600,
                bgcolor: "#f1f5f9",
                color: "#334155",
                borderRadius: "4px",
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
            <Chip
              label={tender.source}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.6875rem",
                fontWeight: 500,
                bgcolor: "#f8fafc",
                color: "#475569",
                borderRadius: "4px",
                border: "1px solid #e2e8f0",
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
            {referenceNumber && (
              <Chip
                label={`Ref: ${referenceNumber}`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  bgcolor: "#f8fafc",
                  color: "#475569",
                  borderRadius: "4px",
                  border: "1px solid #e2e8f0",
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            )}
          </Stack>

          {/* Description */}
          {description && (
            <Box sx={{ mb: 2.5 }}>
              <Typography component="h2" sx={sectionHeadingSx}>
                Beschreibung
              </Typography>
              <Paper elevation={0} sx={sectionCardSx}>
                <Typography variant="body2" sx={{ lineHeight: 1.5, color: "#334155", whiteSpace: "pre-line", fontSize: "0.9375rem" }}>
                  {description}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Scope */}
          {scope && scope !== description && (
            <Box sx={{ mb: 2.5 }}>
              <Typography component="h2" sx={sectionHeadingSx}>
                Leistungsumfang
              </Typography>
              <Paper elevation={0} sx={sectionCardSx}>
                <Typography variant="body2" sx={{ lineHeight: 1.5, color: "#334155", whiteSpace: "pre-line", fontSize: "0.9375rem" }}>
                  {scope}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Requirements */}
          {requirements.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography component="h2" sx={sectionHeadingSx}>
                Anforderungen
              </Typography>
              <Paper elevation={0} sx={sectionCardSx}>
                <Stack spacing={1}>
                  {requirements.map((req, i) => (
                    <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        component="span"
                        sx={{
                          mt: 0.625,
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          bgcolor: "#94a3b8",
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", color: "#334155" }}>
                        {req}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Box>
          )}

          {/* Award Criteria */}
          {awardCriteria.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography component="h2" sx={sectionHeadingSx}>
                Zuschlagskriterien
              </Typography>
              <Paper elevation={0} sx={sectionCardSx}>
                <Stack spacing={1}>
                  {awardCriteria.map((crit, i) => (
                    <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        component="span"
                        sx={{
                          mt: 0.625,
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          bgcolor: "#94a3b8",
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" sx={{ lineHeight: 1.5, fontSize: "0.9375rem", color: "#334155" }}>
                        {crit}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Box>
          )}

          {/* Contact */}
          {contactInfo && (
            <Box sx={{ mb: 2.5 }}>
              <Typography component="h2" sx={sectionHeadingSx}>
                Kontakt / Vergabestelle
              </Typography>
              <Paper elevation={0} sx={sectionCardSx}>
                <Typography variant="body2" sx={{ lineHeight: 1.5, whiteSpace: "pre-line", fontSize: "0.9375rem", color: "#334155" }}>
                  {contactInfo}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Documents */}
          {pdfUrls.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography component="h2" sx={sectionHeadingSx}>
                Vergabeunterlagen
              </Typography>
              {hasPremiumDocuments ? (
                <Stack spacing={1}>
                  {pdfUrls.map((pdfUrl, i) => (
                    <PdfDocumentLink key={i} url={pdfUrl} index={i} />
                  ))}
                </Stack>
              ) : (
                <PaywallPanel
                  feature="Dokumente"
                  title="Vergabeunterlagen freischalten"
                  description="Die Originalunterlagen sind nur die Quelle. Pro prüft die Ausschreibung gegen dein Unternehmen und macht Go-/No-Go, offene Anforderungen und nächste Schritte sichtbar."
                />
              )}
            </Box>
          )}

          {/* Source Link */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, md: 1.5 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "6px",
              mb: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Briefcase size={14} color="#475569" />
              <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                Quelle: {tender.source}
              </Typography>
            </Box>
            <Box
              component="a"
              href={tender.url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                color: "primary.main",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.8125rem",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Original-Anzeige
              <ArrowUpRight size={14} />
            </Box>
          </Paper>

          {/* CTA */}
          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              mb: 3,
              textAlign: "center",
              bgcolor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <Typography variant="subtitle1" component="h2" fontWeight={600} sx={{ mb: 0.5, fontSize: "1rem", color: "#1e293b" }}>
              Passende Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5, fontSize: "0.8125rem", color: "#475569" }}>
              Scannen Sie Ihre Website und finden Sie automatisch Ausschreibungen, die zu Ihren Leistungen passen.
            </Typography>
            <Box
              component="a"
              href="/#app"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "primary.main",
                color: "#fff",
                px: 2,
                py: 0.75,
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "0.8125rem",
                textDecoration: "none",
                "&:hover": { opacity: 0.88 },
              }}
            >
              Jetzt Website analysieren
              <ArrowRight size={15} />
            </Box>
          </Box>

          {/* Similar Tenders */}
          {similarTenders.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography component="h2" sx={sectionHeadingSx}>
                Ähnliche Ausschreibungen
              </Typography>
              <Stack spacing={1}>
                {similarTenders.map((t) => (
                  <Link
                    key={t.id}
                    href={`/ausschreibung/${t.id}/${t.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: { xs: 1.5, md: 2 },
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        transition: "border-color 0.15s, background-color 0.15s",
                        "&:hover": {
                          borderColor: "grey.400",
                          bgcolor: "grey.25",
                          "& .chevron": { transform: "translateX(2px)", opacity: 1 },
                        },
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="subtitle2"
                          component="h3"
                          fontWeight={600}
                          sx={{
                            mb: 0.25,
                            fontSize: "0.875rem",
                            lineHeight: 1.35,
                            color: "#1e293b",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {t.title}
                        </Typography>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                          {t.client && (
                            <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                              {t.client.slice(0, 50)}
                            </Typography>
                          )}
                          {t.location && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                              <MapPin size={12} color="#475569" />
                              <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                                {t.location}
                              </Typography>
                            </Box>
                          )}
                          {t.deadline && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                              <Calendar size={12} color="#475569" />
                              <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.75rem" }}>
                                {t.deadline}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Box>
                      <ChevronRight
                        size={18}
                        className="chevron"
                        style={{ opacity: 0.3, transition: "all 0.15s", flexShrink: 0 }}
                        color="#475569"
                      />
                    </Paper>
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {/* SEO: Contextual internal links to category and region pages */}
          <Box sx={{ mb: 3 }}>
            <Typography component="h2" sx={sectionHeadingSx}>
              Weitere Ausschreibungen
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Link
                href={`/ausschreibungen/${categorySlug}`}
                style={{ textDecoration: "none" }}
              >
                <Chip
                  clickable
                  label={`Alle ${categoryLabel} Ausschreibungen`}
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 600, height: 24, fontSize: "0.75rem", borderRadius: "4px" }}
                />
              </Link>
              {bundeslandSlug && tenderBundesland && (
                <Link
                  href={`/ausschreibungen/region/${bundeslandSlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`Ausschreibungen in ${tenderBundesland}`}
                    variant="outlined"
                    sx={{ fontWeight: 500, height: 24, fontSize: "0.75rem", borderRadius: "4px" }}
                  />
                </Link>
              )}
              {bundeslandSlug && tenderBundesland && (
                <Link
                  href={`/ausschreibungen/region/${bundeslandSlug}/${categorySlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`${categoryLabel} in ${tenderBundesland}`}
                    variant="outlined"
                    sx={{ fontWeight: 500, height: 24, fontSize: "0.75rem", borderRadius: "4px" }}
                  />
                </Link>
              )}
              {citySlug && tenderCity && (
                <Link
                  href={`/ausschreibungen/stadt/${citySlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`Ausschreibungen in ${tenderCity}`}
                    variant="outlined"
                    sx={{ fontWeight: 500, height: 24, fontSize: "0.75rem", borderRadius: "4px" }}
                  />
                </Link>
              )}
              {citySlug && tenderCity && (
                <Link
                  href={`/ausschreibungen/stadt/${citySlug}/${categorySlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`${categoryLabel} in ${tenderCity}`}
                    variant="outlined"
                    sx={{ fontWeight: 500, height: 24, fontSize: "0.75rem", borderRadius: "4px" }}
                  />
                </Link>
              )}
              {agencySlug && client && (
                <Link
                  href={`/auftraggeber/${agencySlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`Alle Ausschreibungen von ${client.slice(0, 40)}`}
                    variant="outlined"
                    sx={{ fontWeight: 500, height: 24, fontSize: "0.75rem", borderRadius: "4px" }}
                  />
                </Link>
              )}
              <Link href="/ausschreibungen" style={{ textDecoration: "none" }}>
                <Chip
                  clickable
                  label="Alle Kategorien"
                  variant="outlined"
                  sx={{ fontWeight: 500, height: 24, fontSize: "0.75rem", borderRadius: "4px" }}
                />
              </Link>
            </Stack>
          </Box>

          {/* Scored Companies */}
          {scoredCompanies.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography component="h2" sx={sectionHeadingSx}>
                Passende Auftraggeber
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {scoredCompanies.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/p/${c.slug}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Chip
                      clickable
                      label={`${c.name}${c.industry ? ` – ${c.industry}` : ""}`}
                      variant="outlined"
                      sx={{ fontWeight: 500, height: 24, fontSize: "0.75rem", borderRadius: "4px" }}
                    />
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          <PageFooter />
        </Container>
      </Box>
      <SiteFooter containerMaxWidth="1120px" />
    </>
  );
}
