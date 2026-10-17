import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, or, gt, isNull, desc, sql, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Box,
  Container,
  Typography,
  Stack,
  Chip,
  Paper,
  Breadcrumbs,
} from "@mui/material";
import {
  Building2,
  MapPin,
  Calendar,
  ArrowRight,
  Home as HomeIcon,
} from "lucide-react";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { PROCEDURE_TYPES, ALL_PROCEDURE_TYPE_SLUGS, getProcedureDatabaseValues } from "@/lib/procedure-types";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { getListingRobots, getPageNumber, getPaginationHref, type SeoSearchParams } from "@/lib/seo-indexability";
import { rethrowNavigationError } from "@/lib/public-route-resilience";
import { pickValidatedPublicCandidate } from "@/lib/public-content-quality";
import { readPublicTenderMeta } from "@/lib/tender-meta";

const PAGE_SIZE = 20;

export const revalidate = 3600;
export const runtime = "nodejs";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

// SEO: Procedure type pages — pre-render all Vergabeverfahren types
export async function generateStaticParams() {
  return ALL_PROCEDURE_TYPE_SLUGS.map((type) => ({ type }));
}

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { type } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const procType = PROCEDURE_TYPES[type];
  if (!procType) return { title: "Vergabeverfahren nicht gefunden", robots: { index: false, follow: true } };

  const pageSuffix = currentPage > 1 ? ` – Seite ${currentPage}` : "";
  const title = `${procType.label} – Aktuelle Ausschreibungen${pageSuffix}`;
  const description = procType.description;
  const canonicalPath = `/ausschreibungen/verfahren/${type}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
    robots: getListingRobots(await searchParams, 1, true),
    openGraph: { title, description, type: "website", locale: "de_DE" },
  };
}

export default async function ProcedureTypePage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const procType = PROCEDURE_TYPES[type];
  if (!procType) notFound();

  const now = new Date();
  let procTenders: Array<{
    id: number;
    title: string;
    source: string;
    deadline: string | null;
    location: string | null;
    client: string | null;
    slug: string;
  }> = [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(
        and(
          inArray(tenders.procedureType, getProcedureDatabaseValues(type)),
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      );
    totalCount = countRow[0]?.count ?? 0;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (currentPage > totalPages) notFound();

    const offset = (currentPage - 1) * PAGE_SIZE;

    const rows = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        source: tenders.source,
        deadlineAt: tenders.deadlineAt,
        metadataJson: tenders.metadataJson,
        slug: tenders.slug,
      })
      .from(tenders)
      .where(
        and(
          inArray(tenders.procedureType, getProcedureDatabaseValues(type)),
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      )
      .orderBy(desc(tenders.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    procTenders = rows.map((row) => {
      const meta = readPublicTenderMeta(row.metadataJson, {
        title: row.title,
        source: row.source,
      });
      const location = meta.location ? meta.location.split(",")[0].trim().slice(0, 60) : null;
      return {
        id: row.id,
        title: pickValidatedPublicCandidate(row.title) || `Ausschreibung #${row.id}`,
        source: row.source,
        deadline: row.deadlineAt
          ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
          : null,
        location,
        client: meta.client ? meta.client.slice(0, 80) : null,
        slug: getCanonicalTenderSlug(row.slug, row.title, row.metadataJson),
      };
    });
  } catch (error) {
    rethrowNavigationError(error);
    // DB unavailable
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${procType.label} Ausschreibungen`,
    numberOfItems: procTenders.length,
    itemListElement: procTenders.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug}`,
      name: t.title,
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: procType.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      { "@type": "ListItem", position: 3, name: procType.label, item: `${siteUrl}/ausschreibungen/verfahren/${type}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} />
              Start
            </Link>
            <Link href="/ausschreibungen" style={{ color: "#667288", textDecoration: "none" }}>
              Ausschreibungen
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">{procType.label}</Typography>
          </Breadcrumbs>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              {procType.label}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle Ausschreibungen im {procType.keyword}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "70ch", lineHeight: 1.7 }}>
              {procType.intro}
            </Typography>
          </Box>

          {procTenders.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {procTenders.map((tender) => (
                <Link key={tender.id} href={`/ausschreibung/${tender.id}/${tender.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: 1, borderColor: "divider", borderLeft: 4, borderLeftColor: "primary.main", transition: "border-color 0.15s", "&:hover": { borderColor: "primary.main" } }}>
                    <Typography variant="subtitle1" component="h3" fontWeight={600} sx={{ mb: 1, fontSize: { xs: "0.95rem", md: "1.05rem" }, "&:hover": { color: "primary.main" } }}>
                      {tender.title}
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                      {tender.client && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Building2 size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary">{tender.client}</Typography>
                        </Stack>
                      )}
                      {tender.location && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <MapPin size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary">{tender.location}</Typography>
                        </Stack>
                      )}
                      {tender.deadline && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Calendar size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary" component="span">Frist: <time>{tender.deadline}</time></Typography>
                        </Stack>
                      )}
                      <Chip label={tender.source} size="small" sx={{ opacity: 0.7, height: 20 }} />
                    </Stack>
                  </Paper>
                </Link>
              ))}
            </Stack>
          ) : (
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 5, border: 1, borderColor: "divider", textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                Aktuell gibt es keine offenen Ausschreibungen im {procType.keyword}.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Abonnieren Sie unseren{" "}
                <Link href="/feeds/tender.xml" style={{ color: "inherit", fontWeight: 600 }}>RSS-Feed</Link>
                , um benachrichtigt zu werden.
              </Typography>
            </Paper>
          )}

          {totalPages > 1 && (
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 5 }} component="nav" aria-label="Seitennavigation">
              {currentPage > 1 && (
                <Link href={getPaginationHref(`/ausschreibungen/verfahren/${type}`, currentPage - 1)} style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}>
                  ← Zurück
                </Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev !== undefined && p - prev > 1;
                  return (
                    <span key={p}>
                      {showEllipsis && <span style={{ padding: "0 4px", color: "#999" }}>…</span>}
                      {p === currentPage ? (
                        <span style={{ fontWeight: 700, color: "#e9644d", padding: "8px 12px" }}>{p}</span>
                      ) : (
                        <Link href={getPaginationHref(`/ausschreibungen/verfahren/${type}`, p)} style={{ textDecoration: "none", color: "#667288", fontWeight: 500, padding: "8px 12px" }}>{p}</Link>
                      )}
                    </span>
                  );
                })}
              {currentPage < totalPages && (
                <Link href={getPaginationHref(`/ausschreibungen/verfahren/${type}`, currentPage + 1)} style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}>
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          <Box sx={{ mb: 5, maxWidth: "75ch" }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              So funktioniert das {procType.keyword}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {procType.details}
            </Typography>
          </Box>

          {procType.faq.length > 0 && (
            <Box sx={{ mb: 5, maxWidth: "75ch" }}>
              <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 3 }}>
                Häufige Fragen zum {procType.keyword}
              </Typography>
              {procType.faq.map((item, i) => (
                <Box key={i} component="details" sx={{ mb: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <Box component="summary" sx={{ fontWeight: 600, cursor: "pointer", fontSize: "1rem", mb: 1 }}>
                    {item.question}
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.7, color: "text.secondary" }}>
                    {item.answer}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weitere Vergabeverfahren
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {ALL_PROCEDURE_TYPE_SLUGS.filter((s) => s !== type).map((s) => (
                <Link key={s} href={`/ausschreibungen/verfahren/${s}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={PROCEDURE_TYPES[s].label} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende {procType.label}-Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scannen Sie Ihre Website und finden Sie automatisch Ausschreibungen im passenden Vergabeverfahren.
            </Typography>
            <Box component="a" href="/#app" sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: "primary.main", color: "#fff", px: 3, py: 1.25, borderRadius: 2, fontWeight: 700, textDecoration: "none", "&:hover": { opacity: 0.88 } }}>
              Jetzt Website analysieren
              <ArrowRight size={16} />
            </Box>
          </Box>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
