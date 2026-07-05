import { db } from "@/lib/db";
import { tenders, structuredData, scores, companyProfiles } from "@/lib/schema";
import { eq, and, ne, or, gt, isNull, inArray, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Box,
  Container,
  Typography,
  Stack,
  Chip,
  Divider,
  Paper,
  Breadcrumbs,
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
  Home as HomeIcon,
} from "lucide-react";
import { cleanDescription } from "@/lib/public-tender-scraper";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { deriveBundesland, deriveCity, BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { CITY_SLUG_MAP } from "@/lib/cities";
import { normalizeAgencySlug } from "@/lib/agencies";
import { SiteFooter } from "@/components/seo/SiteFooter";

export const revalidate = 3600;
export const runtime = "nodejs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  try {
    const now = new Date();
    const rows = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      );
    return rows.map((row) => ({ id: String(row.id) }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (!Number.isFinite(numericId)) return { title: "Ausschreibung nicht gefunden", robots: { index: false, follow: true } };

  const rows = await db
    .select({
      title: tenders.title,
      category: tenders.category,
      source: tenders.source,
      deadlineAt: tenders.deadlineAt,
      createdAt: tenders.createdAt,
      updatedAt: tenders.updatedAt,
      metadataJson: tenders.metadataJson,
    })
    .from(tenders)
    .where(and(eq(tenders.id, numericId), inArray(tenders.qualityStatus, ["qualified", "candidate"])))
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

  const isExpired = row.deadlineAt && new Date(row.deadlineAt) < new Date();

  return {
    title,
    description,
    alternates: { canonical: `/ausschreibung/${id}`, languages: { "de-DE": `/ausschreibung/${id}` } },
    robots: isExpired ? { index: false, follow: true } : undefined,
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
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (!Number.isFinite(numericId)) notFound();

  const rows = await db
    .select()
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(eq(tenders.id, numericId), inArray(tenders.qualityStatus, ["qualified", "candidate"])))
    .limit(1);

  if (rows.length === 0) notFound();

  const row = rows[0];
  const tender = row.tenders;
  const sd = row.structured_data;

  // SEO: Redirect expired tenders to category page to free crawl budget
  const isExpired = tender.deadlineAt && new Date(tender.deadlineAt) < new Date();
  if (isExpired) {
    const catSlug = CATEGORY_SLUGS[tender.category ?? "Sonstiges"] ?? "diverse";
    redirect(`/ausschreibungen/${catSlug}`);
  }

  const meta = (typeof tender.metadataJson === "object" && tender.metadataJson !== null
    ? tender.metadataJson
    : {}) as Record<string, unknown>;

  const blob = sd?.jsonBlob as Record<string, unknown> | null;

  const title = tender.title ?? `Ausschreibung #${tender.id}`;
  const categoryLabel = CATEGORY_LABELS[tender.category ?? "Sonstiges"] ?? tender.category ?? "Diverse Leistungen";
  const categorySlug = CATEGORY_SLUGS[tender.category ?? "Sonstiges"] ?? "diverse";

  const description = cleanDescription(
    String(blob?.description ?? meta.description ?? tender.rawText ?? "").trim(),
  );
  const scope = String(blob?.scope ?? "").trim();
  const client = String(blob?.client ?? meta.client ?? "").trim();
  const location = String(blob?.location ?? meta.location ?? "").trim();
  const contactInfo = String(blob?.contact ?? "").trim();
  const estimatedValue = String(blob?.estimatedValue ?? "").trim();
  const referenceNumber = String(blob?.referenceNumber ?? "").trim();
  const procedure = String(blob?.procedure ?? tender.procedureType ?? "").trim();
  const duration = String(blob?.duration ?? "").trim();

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
    return {
      id: t.id,
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
  // Look up city slug from the CITY_SLUG_MAP by matching label
  const citySlug = tenderCity
    ? Object.values(CITY_SLUG_MAP).find((c) => c.label.toLowerCase() === tenderCity.toLowerCase())?.slug ?? null
    : null;
  const agencySlug = client ? normalizeAgencySlug(client) : null;

  // SEO: Dual-typed schema — Article for content indexing, GovernmentPermit for procurement semantics
  const spatialCoverageParts = [];
  if (tenderCity) spatialCoverageParts.push({ "@type": "City", name: tenderCity });
  if (tenderBundesland) spatialCoverageParts.push({ "@type": "AdministrativeArea", name: tenderBundesland });
  if (spatialCoverageParts.length === 0) spatialCoverageParts.push({ "@type": "Country", name: "Deutschland" });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["Article", "GovernmentPermit"],
    "@id": `${siteUrl}/ausschreibung/${tender.id}#article`,
    headline: title,
    description: description.slice(0, 300),
    url: `${siteUrl}/ausschreibung/${tender.id}`,
    image: `${siteUrl}/ausschreibung/${tender.id}/opengraph-image`,
    articleSection: categoryLabel,
    ...(referenceNumber ? { identifier: referenceNumber } : {}),
    keywords: categoryLabel,
    // SEO: Custom type for tender-specific structured data extraction
    additionalType: "https://schema.org/Tender",
    // SEO: Category as topical entity for richer SERP understanding
    about: { "@type": "Thing", name: categoryLabel },
    // SEO: Explicit provider (Auftraggeber) for procurement context
    provider: client ? { "@type": "Organization", name: client } : undefined,
    // SEO: Deadline as expiry signal for timely result prioritization
    expires: deadlineISO ?? undefined,
    // SEO: Multi-level spatial coverage (city + Bundesland) for local search signals
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
    { "@type": "ListItem", position: breadcrumbPos, name: title, item: `${siteUrl}/ausschreibung/${tender.id}` },
  );
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          {/* Breadcrumbs */}
          <Breadcrumbs
            sx={{ mb: 3, fontSize: "0.85rem" }}
            separator={<span style={{ color: "#999" }}>/</span>}
          >
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} />
              Start
            </Link>
            <Link href="/ausschreibungen" style={{ color: "#667288", textDecoration: "none" }}>
              Ausschreibungen
            </Link>
            {bundeslandSlug && tenderBundesland && (
              <Link href={`/ausschreibungen/region/${bundeslandSlug}`} style={{ color: "#667288", textDecoration: "none" }}>
                {tenderBundesland}
              </Link>
            )}
            {citySlug && tenderCity && (
              <Link href={`/ausschreibungen/stadt/${citySlug}`} style={{ color: "#667288", textDecoration: "none" }}>
                {tenderCity}
              </Link>
            )}
            <Link href={`/ausschreibungen/${categorySlug}`} style={{ color: "#667288", textDecoration: "none" }}>
              {categoryLabel}
            </Link>
          </Breadcrumbs>

          {/* Title */}
          <Typography
            variant="h4"
            component="h1"
            fontWeight={800}
            sx={{
              mb: 2,
              fontSize: { xs: "1.5rem", md: "2rem" },
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </Typography>

          {/* Key Facts */}
          <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider", mb: 3 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2, sm: 3 }} useFlexGap flexWrap="wrap">
              {client && (
                <Box>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <Building2 size={14} color="#667288" />
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Auftraggeber
                    </Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600}>
                    {client}
                  </Typography>
                </Box>
              )}
              {location && (
                <Box>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <MapPin size={14} color="#667288" />
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Ort
                    </Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600}>
                    {location}
                  </Typography>
                </Box>
              )}
              {deadline && (
                <Box>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <Calendar size={14} color="#667288" />
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Frist
                    </Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600} component="time" dateTime={deadlineISO ?? undefined}>
                    {deadline}
                  </Typography>
                </Box>
              )}
              {contractValue && (
                <Box>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <Euro size={14} color="#667288" />
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Geschätzter Wert
                    </Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600}>
                    {contractValue}
                  </Typography>
                </Box>
              )}
              {procedure && (
                <Box>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <FileText size={14} color="#667288" />
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Verfahren
                    </Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600}>
                    {procedure}
                  </Typography>
                </Box>
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={categoryLabel} size="small" color="primary" variant="outlined" />
              <Chip label={tender.source} size="small" sx={{ opacity: 0.7 }} />
              {referenceNumber && (
                <Chip label={`Ref: ${referenceNumber}`} size="small" variant="outlined" sx={{ opacity: 0.6 }} />
              )}
            </Stack>
          </Paper>

          {/* Description */}
          {description && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1.5 }}>
                Beschreibung
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8, color: "text.primary", whiteSpace: "pre-line" }}>
                {description}
              </Typography>
            </Box>
          )}

          {/* Scope */}
          {scope && scope !== description && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1.5 }}>
                Leistungsumfang
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8, color: "text.primary", whiteSpace: "pre-line" }}>
                {scope}
              </Typography>
            </Box>
          )}

          {/* Requirements */}
          {requirements.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1.5 }}>
                Anforderungen
              </Typography>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
                <Stack spacing={1.5}>
                  {requirements.map((req, i) => (
                    <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        component="span"
                        sx={{
                          mt: 0.5,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          bgcolor: "primary.main",
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
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
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1.5 }}>
                Zuschlagskriterien
              </Typography>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
                <Stack spacing={1.5}>
                  {awardCriteria.map((crit, i) => (
                    <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        component="span"
                        sx={{
                          mt: 0.5,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          bgcolor: "success.main",
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                        {crit}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Box>
          )}

          {/* Duration */}
          {duration && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Clock size={16} color="#667288" />
                <Typography variant="body2" color="text.secondary">
                  <strong>Laufzeit:</strong> {duration}
                </Typography>
              </Stack>
            </Box>
          )}

          {/* Contact */}
          {contactInfo && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1.5 }}>
                Kontakt / Vergabestelle
              </Typography>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
                <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>
                  {contactInfo}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Documents */}
          {pdfUrls.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1.5 }}>
                Vergabeunterlagen
              </Typography>
              <Stack spacing={1}>
                {pdfUrls.map((pdfUrl, i) => (
                  <Box
                    key={i}
                    component="a"
                    href={pdfUrl}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1.5,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      textDecoration: "none",
                      color: "text.primary",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <FileText size={18} color="#e9644d" />
                    <Typography variant="body2" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pdfUrl.split("/").pop() ?? `Dokument ${i + 1}`}
                    </Typography>
                    <ArrowUpRight size={16} color="#667288" />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Source Link */}
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: "divider", mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                <Briefcase size={16} color="#667288" />
                <Typography variant="caption" color="text.secondary">
                  Quelle: {tender.source}
                </Typography>
              </Stack>
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
                  fontSize: "0.85rem",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Original-Anzeige
                <ArrowUpRight size={14} />
              </Box>
            </Stack>
          </Paper>

          {/* CTA */}
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              mb: 4,
              textAlign: "center",
              bgcolor: "primary.light",
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
                px: 3,
                py: 1.25,
                borderRadius: 2,
                fontWeight: 700,
                textDecoration: "none",
                "&:hover": { opacity: 0.88 },
              }}
            >
              Jetzt Website analysieren
              <ArrowRight size={16} />
            </Box>
          </Box>

          {/* Similar Tenders */}
          {similarTenders.length > 0 && (
            <Box>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Ähnliche Ausschreibungen
              </Typography>
              <Stack spacing={1.5}>
                {similarTenders.map((t) => (
                  <Link
                    key={t.id}
                    href={`/ausschreibung/${t.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: "divider",
                        "&:hover": { borderColor: "primary.main" },
                        transition: "border-color 0.15s",
                      }}
                    >
                      <Typography variant="subtitle2" component="h3" fontWeight={600} sx={{ mb: 0.5, "&:hover": { color: "primary.main" } }}>
                        {t.title}
                      </Typography>
                      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                        {t.client && (
                          <Typography variant="caption" color="text.secondary">
                            {t.client.slice(0, 50)}
                          </Typography>
                        )}
                        {t.location && (
                          <Typography variant="caption" color="text.secondary">
                            {t.location}
                          </Typography>
                        )}
                        {t.deadline && (
                          <Typography variant="caption" color="text.secondary">
                            Frist: {t.deadline}
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {/* SEO: Contextual internal links to category and region pages */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weitere Ausschreibungen
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Link
                href={`/ausschreibungen/${categorySlug}`}
                style={{ textDecoration: "none" }}
              >
                <Chip
                  clickable
                  label={`Alle ${categoryLabel} Ausschreibungen`}
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
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
                    sx={{ fontWeight: 600 }}
                  />
                </Link>
              )}
              {/* SEO: Cross-link to Region×Category long-tail page */}
              {bundeslandSlug && tenderBundesland && (
                <Link
                  href={`/ausschreibungen/region/${bundeslandSlug}/${categorySlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`${categoryLabel} in ${tenderBundesland}`}
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </Link>
              )}
              {/* SEO: Cross-link to city landing page */}
              {citySlug && tenderCity && (
                <Link
                  href={`/ausschreibungen/stadt/${citySlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`Ausschreibungen in ${tenderCity}`}
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </Link>
              )}
              {/* SEO: Cross-link to City×Category long-tail page */}
              {citySlug && tenderCity && (
                <Link
                  href={`/ausschreibungen/stadt/${citySlug}/${categorySlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`${categoryLabel} in ${tenderCity}`}
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </Link>
              )}
              {/* SEO: Cross-link to agency/ Auftraggeber page */}
              {agencySlug && client && (
                <Link
                  href={`/auftraggeber/${agencySlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`Alle Ausschreibungen von ${client.slice(0, 40)}`}
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </Link>
              )}
              <Link href="/ausschreibungen" style={{ textDecoration: "none" }}>
                <Chip
                  clickable
                  label="Alle Kategorien"
                  variant="outlined"
                  sx={{ fontWeight: 500 }}
                />
              </Link>
            </Stack>
          </Box>

          {/* Scored Companies */}
          {scoredCompanies.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Passende Auftraggeber
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
                      sx={{ fontWeight: 500 }}
                    />
                  </Link>
                ))}
              </Stack>
            </Box>
          )}
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
