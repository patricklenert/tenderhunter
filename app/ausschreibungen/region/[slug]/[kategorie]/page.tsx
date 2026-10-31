import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteBreadcrumbs } from "@/components/seo/SiteBreadcrumbs";
import {
  Box,
  Container,
  Typography,
  Stack,
  Paper,
} from "@mui/material";
import {
  Building2,
  MapPin,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { SLUG_TO_BUNDESLAND } from "@/lib/bundesland";
import { CATEGORY_LABELS, SLUG_TO_CATEGORY } from "@/lib/categories";
import { CATEGORY_CONTENT } from "@/lib/category-content";
import { BUNDESLAND_CONTENT } from "@/lib/bundesland-content";
import { ARTICLES } from "@/lib/articles";
import { searchTenders } from "@/lib/meilisearch";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { getListingRobots, getPageNumber, getPaginationHref, type SeoSearchParams } from "@/lib/seo-indexability";
import { rethrowNavigationError } from "@/lib/public-route-resilience";

// SEO: Region×Category cross pages for long-tail keywords like "gebäudereinigung ausschreibung nrw"
export const revalidate = 3600;
export const runtime = "nodejs";

const PAGE_SIZE = 20;
import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

// SEO: Auto-generated FAQ for region×category pages — targets long-tail queries like "IT Ausschreibungen NRW"
function generateRegionCategoryFaq(bundesland: string, categoryLabel: string): Array<{ question: string; answer: string }> {
  return [
    {
      question: `Wo finde ich ${categoryLabel}-Ausschreibungen in ${bundesland}?`,
      answer: `${categoryLabel}-Ausschreibungen in ${bundesland} finden Sie auf DTVP, TED und evergabe. Tenderhunter aggregiert alle Quellen automatisch und zeigt Ihnen aktuelle Vergaben aus ${bundesland} und Umgebung.`,
    },
    {
      question: `Welche Auftraggeber schreiben ${categoryLabel} in ${bundesland} aus?`,
      answer: `Die wichtigsten Auftraggeber für ${categoryLabel} in ${bundesland} sind Landesverwaltungen, Kommunen, öffentliche Unternehmen und Universitäten. Die Vergaben werden auf regionalen und nationalen Vergabeportalen veröffentlicht.`,
    },
    {
      question: `Wie oft werden ${categoryLabel}-Ausschreibungen in ${bundesland} aktualisiert?`,
      answer: `Tenderhunter aktualisiert die ${categoryLabel}-Ausschreibungen für ${bundesland} täglich. Neue Vergaben werden in Echtzeit aus DTVP, TED und evergabe aggregiert.`,
    },
  ];
}

interface PageProps {
  params: Promise<{ slug: string; kategorie: string }>;
  searchParams: Promise<SeoSearchParams>;
}

// SEO: Pre-render all 208 Bundesland×Category combinations
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug, kategorie } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const bundesland = SLUG_TO_BUNDESLAND[slug];
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!bundesland || !categoryKey) return { title: "Seite nicht gefunden", robots: { index: false, follow: true } };

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;

  try {
    const { estimatedTotalHits } = await searchTenders({ bundesland, category: categoryKey, query: "", limit: 1 });
    const count = estimatedTotalHits;
    const pageSuffix = currentPage > 1 ? ` – Seite ${currentPage}` : "";
    const title = `${label} Ausschreibungen ${bundesland} – Aktuelle Vergaben${pageSuffix}`;
    const description = `${count} aktuelle ${label}-Ausschreibungen in ${bundesland}. Öffentliche Vergabeverfahren mit Fristen, Auftraggebern und Anforderungen. Täglich aktualisiert.`;
    // SEO: Paginated pages (2+) canonicalize to page 1 to consolidate ranking signals
    const canonicalPath = `/ausschreibungen/region/${slug}/${kategorie}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: getListingRobots(await searchParams, count),
      openGraph: { title, description, type: "website", locale: "de_DE" },
    };
  } catch {
    const canonicalPath = `/ausschreibungen/region/${slug}/${kategorie}`;
    return {
      title: `${label} Ausschreibungen ${bundesland}`,
      description: `Öffentliche ${label}-Ausschreibungen in ${bundesland}.`,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: { index: false, follow: true },
    };
  }
}

export default async function RegionCategoryPage({ params, searchParams }: PageProps) {
  const { slug, kategorie } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const bundesland = SLUG_TO_BUNDESLAND[slug];
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!bundesland || !categoryKey) notFound();

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  const catContent = CATEGORY_CONTENT[categoryKey];

  let tendersList: Array<{
    id: number;
    title: string;
    client: string;
    location: string;
    deadline: string | null;
    slug: string;
  }> = [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    const result = await searchTenders({ bundesland, category: categoryKey, query: "", limit: PAGE_SIZE, page: currentPage });
    totalCount = result.estimatedTotalHits;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (currentPage > totalPages) notFound();

    tendersList = result.hits.map((hit) => ({
      id: hit.id,
      title: hit.title || `Ausschreibung #${hit.id}`,
      client: hit.client || "",
      location: hit.location || "",
      deadline: hit.deadlineAt
        ? new Date(hit.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      slug: getCanonicalTenderSlug(hit.slug ?? null, hit.title, { client: hit.client, location: hit.location }),
    }));
  } catch (error) {
    rethrowNavigationError(error);
    // Meilisearch unavailable — page renders empty with noindex
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${label} Ausschreibungen ${bundesland}`,
    numberOfItems: totalCount,
    itemListElement: tendersList.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug}`,
      name: t.title,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      { "@type": "ListItem", position: 3, name: bundesland, item: `${siteUrl}/ausschreibungen/region/${slug}` },
      { "@type": "ListItem", position: 4, name: label, item: `${siteUrl}/ausschreibungen/region/${slug}/${kategorie}` },
    ],
  };

  // SEO: FAQPage JSON-LD for region×category — enables FAQ rich snippets for long-tail queries
  const regionCategoryFaq = generateRegionCategoryFaq(bundesland, label);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: regionCategoryFaq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const blContent = BUNDESLAND_CONTENT[bundesland];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          <SiteBreadcrumbs items={[
            { label: "Start", href: "/" },
            { label: "Ausschreibungen", href: "/ausschreibungen" },
            { label: bundesland, href: `/ausschreibungen/region/${slug}` },
            { label },
          ]} />

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}
            >
              {label} in {bundesland}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle {label}-Ausschreibungen in {bundesland}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "70ch", lineHeight: 1.7 }}>
              {`Aktuelle ${label}-Vergaben von öffentlichen Auftraggebern in ${bundesland} — Kommunen, Landesbetriebe und Universitäten schreiben ${label.toLowerCase()} regelmäßig aus. `}
              {catContent ? catContent.intro : ""}
            </Typography>
          </Box>

          {/* Tender List */}
          {tendersList.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {tendersList.map((tender) => (
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
                Aktuell gibt es keine offenen {label}-Ausschreibungen in {bundesland}.
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
                  href={getPaginationHref(`/ausschreibungen/region/${slug}/${kategorie}`, currentPage - 1)}
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
                          href={getPaginationHref(`/ausschreibungen/region/${slug}/${kategorie}`, p)}
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
                  href={getPaginationHref(`/ausschreibungen/region/${slug}/${kategorie}`, currentPage + 1)}
                  style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}
                >
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          {/* SEO: Expanded content — Tips, Requirements from Bundesland for regional content depth */}
          {blContent && (
            <Box sx={{ mb: 5 }}>
              {/* Bieter-Tipps */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                  Tipps für Bieter in {bundesland}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {blContent.tips.map((tip, i) => (
                    <Box component="li" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: "text.secondary" }}>
                      {tip}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Eignungsanforderungen */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                  Typische Eignungsanforderungen in {bundesland}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {blContent.requirements.map((req, i) => (
                    <Box component="li" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: "text.secondary" }}>
                      {req}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          {/* SEO: Cross-links to related Wissen articles */}
          {(() => {
            const categoryKey = SLUG_TO_CATEGORY[kategorie];
            const relatedArticles = Object.values(ARTICLES).filter((a) =>
              a.relatedCategories.includes(categoryKey ?? ""),
            );
            if (relatedArticles.length === 0) return null;
            return (
              <Box sx={{ mb: 5 }}>
                <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                  Mehr erfahren
                </Typography>
                <Stack spacing={1}>
                  {relatedArticles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/wissen/${article.slug}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Typography variant="body2" color="primary" fontWeight={600}>
                        {article.title} →
                      </Typography>
                    </Link>
                  ))}
                </Stack>
              </Box>
            );
          })()}

          {/* SEO: FAQ section — visible content mirrors FAQPage JSON-LD for rich snippets */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Häufige Fragen zu {label} in {bundesland}
            </Typography>
            <Stack spacing={2}>
              {regionCategoryFaq.map((item, idx) => (
                <Box key={idx} component="details" sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <Box component="summary" sx={{ fontWeight: 600, cursor: "pointer", fontSize: "1rem", mb: 1 }}>
                    {item.question}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {item.answer}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende {label}-Ausschreibungen in {bundesland} für Ihr Unternehmen?
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
