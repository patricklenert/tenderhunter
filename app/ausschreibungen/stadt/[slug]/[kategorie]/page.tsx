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
import { CATEGORY_LABELS, CATEGORY_SLUGS, SLUG_TO_CATEGORY, ALL_CATEGORY_SLUGS } from "@/lib/categories";
import { CATEGORY_CONTENT } from "@/lib/category-content";
import { searchTenders } from "@/lib/meilisearch";
import { CITY_SLUG_MAP, ALL_CITY_SLUGS, CITY_LABEL_MAP } from "@/lib/cities";
import { BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { generateTenderSlug } from "@/lib/tender-slug";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { getListingRobots, getPageNumber, type SeoSearchParams } from "@/lib/seo-indexability";

// SEO: Auto-generated FAQ for city×category pages — targets long-tail queries like "Ausschreibungen München IT"
function generateCityCategoryFaq(cityLabel: string, categoryLabel: string): Array<{ question: string; answer: string }> {
  return [
    {
      question: `Wo finde ich ${categoryLabel}-Ausschreibungen in ${cityLabel}?`,
      answer: `${categoryLabel}-Ausschreibungen in ${cityLabel} finden Sie auf DTVP, TED und evergabe. Tenderhunter aggregiert alle Quellen automatisch und zeigt Ihnen aktuelle Vergaben aus ${cityLabel} und Umgebung.`,
    },
    {
      question: `Welche Auftraggeber schreiben ${categoryLabel} in ${cityLabel} aus?`,
      answer: `Die wichtigsten Auftraggeber für ${categoryLabel} in ${cityLabel} sind die Stadtverwaltung, kommunale Betriebe und öffentliche Institutionen. Die Vergaben werden auf regionalen und nationalen Vergabeportalen veröffentlicht.`,
    },
    {
      question: `Wie oft werden ${categoryLabel}-Ausschreibungen in ${cityLabel} aktualisiert?`,
      answer: `Tenderhunter aktualisiert die ${categoryLabel}-Ausschreibungen für ${cityLabel} täglich. Neue Vergaben werden in Echtzeit aus DTVP, TED und evergabe aggregiert.`,
    },
  ];
}

// SEO: City×Category cross pages for long-tail keywords like "bauausschreibungen münchen"
export const revalidate = 3600;
export const runtime = "nodejs";

const PAGE_SIZE = 20;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

interface PageProps {
  params: Promise<{ slug: string; kategorie: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateStaticParams() {
  const params: Array<{ slug: string; kategorie: string }> = [];
  for (const slug of ALL_CITY_SLUGS) {
    for (const kategorie of ALL_CATEGORY_SLUGS) {
      params.push({ slug, kategorie });
    }
  }
  return params;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug, kategorie } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const city = CITY_SLUG_MAP[slug];
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!city || !categoryKey) return { title: "Seite nicht gefunden", robots: { index: false, follow: true } };

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;

  try {
    const { estimatedTotalHits } = await searchTenders({ city: city.label, category: categoryKey, query: "", limit: 1 });
    const count = estimatedTotalHits;
    const pageSuffix = currentPage > 1 ? ` – Seite ${currentPage}` : "";
    const title = `${label} Ausschreibungen ${city.label} – Aktuelle Vergaben${pageSuffix}`;
    const description = `${count} aktuelle ${label}-Ausschreibungen in ${city.label}. Öffentliche Vergabeverfahren mit Fristen, Auftraggebern und Anforderungen. Täglich aktualisiert.`;
    // SEO: Paginated pages (2+) canonicalize to page 1 to consolidate ranking signals
    const canonicalPath = `/ausschreibungen/stadt/${slug}/${kategorie}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: getListingRobots(await searchParams, count),
      openGraph: { title, description, type: "website", locale: "de_DE" },
    };
  } catch {
    const canonicalPath = `/ausschreibungen/stadt/${slug}/${kategorie}`;
    return {
      title: `${label} Ausschreibungen ${city.label}`,
      description: `Öffentliche ${label}-Ausschreibungen in ${city.label}.`,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: { index: false, follow: true },
    };
  }
}

export default async function CityCategoryPage({ params, searchParams }: PageProps) {
  const { slug, kategorie } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const city = CITY_SLUG_MAP[slug];
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!city || !categoryKey) notFound();

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
    const result = await searchTenders({ city: city.label, category: categoryKey, query: "", limit: PAGE_SIZE, page: currentPage });
    totalCount = result.estimatedTotalHits;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (currentPage > totalPages && totalCount > 0) notFound();

    tendersList = result.hits.map((hit) => ({
      id: hit.id,
      title: hit.title || `Ausschreibung #${hit.id}`,
      client: hit.client || "",
      location: hit.location || "",
      deadline: hit.deadlineAt
        ? new Date(hit.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      slug: hit.slug ?? generateTenderSlug(hit.title || "", hit.location || ""),
    }));
  } catch {
    // Meilisearch unavailable — page renders empty with noindex
  }

  const bundeslandSlug = BUNDESLAND_SLUGS[city.bundesland];

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${label} Ausschreibungen ${city.label}`,
    numberOfItems: totalCount,
    itemListElement: tendersList.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug}`,
      name: t.title,
    })),
  };

  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
  ];
  let breadPos = 3;
  if (bundeslandSlug) {
    breadcrumbItems.push({ "@type": "ListItem", position: breadPos++, name: city.bundesland, item: `${siteUrl}/ausschreibungen/region/${bundeslandSlug}` });
  }
  breadcrumbItems.push({ "@type": "ListItem", position: breadPos++, name: city.label, item: `${siteUrl}/ausschreibungen/stadt/${slug}` });
  breadcrumbItems.push({ "@type": "ListItem", position: breadPos, name: label, item: `${siteUrl}/ausschreibungen/stadt/${slug}/${kategorie}` });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  // SEO: FAQPage JSON-LD for city×category — enables FAQ rich snippets for long-tail queries
  const cityCategoryFaq = generateCityCategoryFaq(city.label, label);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cityCategoryFaq.map((item) => ({
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
            <Link href={`/ausschreibungen/stadt/${slug}`} style={{ color: "#667288", textDecoration: "none" }}>
              {city.label}
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">{label}</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}
            >
              {label} in {city.label}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle {label}-Ausschreibungen in {city.label}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "70ch", lineHeight: 1.7 }}>
              {`Aktuelle ${label}-Vergaben von öffentlichen Auftraggebern in ${city.label} — Kommunen, Landesbetriebe und Institutionen schreiben ${label.toLowerCase()} regelmäßig aus. `}
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
                Aktuell gibt es keine offenen {label}-Ausschreibungen in {city.label}.
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
                  href={`/ausschreibungen/stadt/${slug}/${kategorie}?page=${currentPage - 1}`}
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
                          href={`/ausschreibungen/stadt/${slug}/${kategorie}?page=${p}`}
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
                  href={`/ausschreibungen/stadt/${slug}/${kategorie}?page=${currentPage + 1}`}
                  style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}
                >
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          {/* Other Categories in this City */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weitere Kategorien in {city.label}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {ALL_CATEGORY_SLUGS.filter((s) => s !== kategorie).map((s) => (
                <Link key={s} href={`/ausschreibungen/stadt/${slug}/${s}`} style={{ textDecoration: "none" }}>
                  <Chip
                    clickable
                    label={CATEGORY_LABELS[Object.keys(CATEGORY_SLUGS).find((k) => CATEGORY_SLUGS[k] === s) ?? ""] ?? s}
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* Other Cities for this Category */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              {label} in anderen Städten
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {ALL_CITY_SLUGS.filter((s) => s !== slug).slice(0, 15).map((s) => (
                <Link key={s} href={`/ausschreibungen/stadt/${s}/${kategorie}`} style={{ textDecoration: "none" }}>
                  <Chip
                    clickable
                    label={CITY_LABEL_MAP[s]}
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* FAQ — SEO: unique content for city×category pages */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Häufige Fragen zu {label} in {city.label}
            </Typography>
            <Stack spacing={2}>
              {cityCategoryFaq.map((item, idx) => (
                <Box key={idx}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                    {item.question}
                  </Typography>
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
              Passende {label}-Ausschreibungen in {city.label} für Ihr Unternehmen?
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
