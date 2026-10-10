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
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { searchTenders } from "@/lib/meilisearch";
import { CITY_SLUG_MAP, generateCityFaq } from "@/lib/cities";
import { BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { getListingRobots, getPageNumber, getPaginationHref, type SeoSearchParams } from "@/lib/seo-indexability";

// SEO: City landing pages for long-tail keywords like "Ausschreibungen München"
export const revalidate = 3600;
export const runtime = "nodejs";

const PAGE_SIZE = 20;

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const city = CITY_SLUG_MAP[slug];
  if (!city) return { title: "Stadt nicht gefunden", robots: { index: false, follow: true } };

  try {
    const { estimatedTotalHits } = await searchTenders({ city: city.label, query: "", limit: 1 });
    const count = estimatedTotalHits;
    const pageSuffix = currentPage > 1 ? ` – Seite ${currentPage}` : "";
    const title = `Ausschreibungen ${city.label} – Aktuelle öffentliche Vergaben${pageSuffix}`;
    const description = `${count} aktuelle öffentliche Ausschreibungen in ${city.label}. Vergabeverfahren für Bauarbeiten, IT, Facility Management und mehr. Täglich aktualisiert.`;
    // SEO: Paginated pages (2+) canonicalize to page 1 to consolidate ranking signals
    const canonicalPath = `/ausschreibungen/stadt/${slug}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: getListingRobots(await searchParams, count),
      openGraph: { title, description, type: "website", locale: "de_DE" },
    };
  } catch {
    const canonicalPath = `/ausschreibungen/stadt/${slug}`;
    return {
      title: `Ausschreibungen ${city.label}`,
      description: `Öffentliche Ausschreibungen in ${city.label}.`,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: { index: false, follow: true },
    };
  }
}

export default async function CityPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const city = CITY_SLUG_MAP[slug];
  if (!city) notFound();

  let tenders: Array<{
    id: number;
    title: string;
    category: string;
    client: string;
    location: string;
    deadline: string | null;
    slug: string;
  }> = [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    const result = await searchTenders({ city: city.label, query: "", limit: PAGE_SIZE, page: currentPage });
    totalCount = result.estimatedTotalHits;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (currentPage > totalPages && totalCount > 0) notFound();

    tenders = result.hits.map((hit) => ({
      id: hit.id,
      title: hit.title || `Ausschreibung #${hit.id}`,
      category: hit.category || "Diverse",
      client: hit.client || "",
      location: hit.location || "",
      deadline: hit.deadlineAt
        ? new Date(hit.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      slug: getCanonicalTenderSlug(hit.slug ?? null, hit.title, { client: hit.client, location: hit.location }),
    }));
  } catch {
    // Meilisearch unavailable — page renders empty with noindex
  }

  const availableCategorySlugs = new Set(
    tenders
      .map((tender) => CATEGORY_SLUGS[tender.category])
      .filter((slug): slug is string => Boolean(slug)),
  );

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Ausschreibungen ${city.label}`,
    numberOfItems: totalCount,
    itemListElement: tenders.slice(0, 20).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug}`,
      name: t.title,
    })),
  };

  const bundeslandSlug = BUNDESLAND_SLUGS[city.bundesland];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      ...(bundeslandSlug
        ? [{ "@type": "ListItem", position: 3, name: city.bundesland, item: `${siteUrl}/ausschreibungen/region/${bundeslandSlug}` }]
        : []),
      { "@type": "ListItem", position: bundeslandSlug ? 4 : 3, name: city.label, item: `${siteUrl}/ausschreibungen/stadt/${slug}` },
    ],
  };

  // SEO: FAQPage JSON-LD for city landing pages — targets "Ausschreibungen {Stadt}" long-tail queries with FAQ rich snippets
  const cityFaq = generateCityFaq(city);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cityFaq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          {/* Breadcrumbs */}
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} />
              Start
            </Link>
            <Link href="/ausschreibungen" style={{ color: "#667288", textDecoration: "none" }}>
              Ausschreibungen
            </Link>
            {bundeslandSlug && (
              <Link href={`/ausschreibungen/region/${bundeslandSlug}`} style={{ color: "#667288", textDecoration: "none" }}>
                {city.bundesland}
              </Link>
            )}
            <Typography color="text.primary" fontSize="0.85rem">{city.label}</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}
            >
              Ausschreibungen in {city.label}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle öffentliche Ausschreibungen in {city.label}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "70ch", lineHeight: 1.7 }}>
              {city.intro}
            </Typography>
          </Box>

          {/* Tender List */}
          {tenders.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {tenders.map((tender) => (
                <Link
                  key={tender.id}
                  href={`/ausschreibung/${tender.id}/${tender.slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      border: 1,
                      borderColor: "divider",
                      borderLeft: 4,
                      borderLeftColor: "primary.main",
                      transition: "border-color 0.15s",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      component="h3"
                      fontWeight={600}
                      sx={{ mb: 1, fontSize: { xs: "0.95rem", md: "1.05rem" }, "&:hover": { color: "primary.main" } }}
                    >
                      {tender.title}
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                      <Chip label={tender.category} size="small" color="primary" variant="outlined" sx={{ height: 20 }} />
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
                          <Typography variant="caption" color="text.secondary">Frist: {tender.deadline}</Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                </Link>
              ))}
            </Stack>
          ) : (
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 5, border: 1, borderColor: "divider", textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                Aktuell gibt es keine offenen Ausschreibungen in {city.label}.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Abonnieren Sie unseren{" "}
                <Link href="/feeds/tender.xml" style={{ color: "inherit", fontWeight: 600 }}>RSS-Feed</Link>
                , um benachrichtigt zu werden.
              </Typography>
            </Paper>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              alignItems="center"
              sx={{ mb: 5 }}
              component="nav"
              aria-label="Seitennavigation"
            >
              {currentPage > 1 && (
                <Link
                  href={getPaginationHref(`/ausschreibungen/stadt/${slug}`, currentPage - 1)}
                  style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}
                >
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
                        <Link
                          href={getPaginationHref(`/ausschreibungen/stadt/${slug}`, p)}
                          style={{ textDecoration: "none", color: "#667288", fontWeight: 500, padding: "8px 12px" }}
                        >
                          {p}
                        </Link>
                      )}
                    </span>
                  );
                })}
              {currentPage < totalPages && (
                <Link
                  href={getPaginationHref(`/ausschreibungen/stadt/${slug}`, currentPage + 1)}
                  style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}
                >
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          {/* City×Category cross-links: only categories represented by current results */}
          {availableCategorySlugs.size > 0 && (
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Kategorien in {city.label}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(CATEGORY_SLUGS)
                .filter(([, catSlug]) => availableCategorySlugs.has(catSlug))
                .map(([key, catSlug]) => (
                <Link
                  key={catSlug}
                  href={`/ausschreibungen/stadt/${slug}/${catSlug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={CATEGORY_LABELS[key] ?? key}
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </Link>
                ))}
            </Stack>
          </Box>
          )}

          {/* SEO: Link to parent Bundesland page for city→region internal link equity */}
          {bundeslandSlug && (
            <Box sx={{ mb: 5 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Ausschreibungen in {city.bundesland}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Link href={`/ausschreibungen/region/${bundeslandSlug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={`Alle Ausschreibungen in ${city.bundesland}`} variant="outlined" color="primary" sx={{ fontWeight: 500 }} />
                </Link>
              </Stack>
            </Box>
          )}

          {/* SEO: Visible FAQ section — mirrors FAQPage JSON-LD for user accessibility and snippet eligibility */}
          <Box sx={{ mb: 5, maxWidth: "75ch" }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 3 }}>
              Häufige Fragen zu Ausschreibungen in {city.label}
            </Typography>
            {cityFaq.map((item, i) => (
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

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende Ausschreibungen in {city.label} für Ihr Unternehmen?
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
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
