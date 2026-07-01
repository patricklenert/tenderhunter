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
import { BUNDESLAND_SLUGS, SLUG_TO_BUNDESLAND, ALL_BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { searchTenders } from "@/lib/meilisearch";

// SEO: Bundesland landing pages for regional long-tail keywords like "Ausschreibungen Bayern"
export const revalidate = 3600;
export const runtime = "nodejs";

const PAGE_SIZE = 20;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

// Editorial intros for each Bundesland — SEO keyword-rich content
const REGION_INTRO: Record<string, string> = {
  "Baden-Württemberg": "Baden-Württemberg zählt zu den wirtschaftsstärksten Bundesländern mit hoher Vergabeaktivität. Kommunen, Landesbetriebe und Universitäten in Stuttgart, Karlsruhe, Mannheim und Freiburg schreiben regelmäßig Bauarbeiten, IT-Dienstleistungen und Facility Management aus.",
  Bayern: "Bayern ist das flächenmäßig größte Bundesland mit vielfältigen öffentlichen Aufträgen – von der Landeshauptstadt München über Nürnberg und Augsburg bis zu ländlichen Gemeinden. Besonders aktiv sind kommunale Bauvergaben, IT-Digitalisierung und energietechnische Sanierungen.",
  Berlin: "Berlin als Bundeshauptstadt und Stadtstaat ist einer der größten öffentlichen Auftraggeber in Deutschland. Die Senatsverwaltungen, Bezirke und Landesbetriebe vergeben Aufträge in allen Leistungsbereichen – von Großbauprojekten über IT-Services bis hin zu Gebäudereinigung.",
  Brandenburg: "Brandenburg profitiert von der Nähe zu Berlin und der wachsenden Inffrastruktur. Kommunale Vergaben umfassen vor allem Tiefbau, Straßenbau, Grünflächenpflege und energieeffiziente Sanierung öffentlicher Gebäude.",
  Bremen: "Bremen und Bremerhaven als Stadtstaaten vergeben öffentliche Aufträge insbesondere im Hafenbereich, in der Logistik und in der maritimen Wirtschaft. Auch klassische kommunale Vergaben wie Reinigung und Winterdienst sind regelmäßig ausgeschrieben.",
  Hamburg: "Hamburg als größter deutscher Hafenstadtstaat ist ein bedeutender Vergabemarkt. Die Stadt, ihre Bezirke und städtischen Unternehmen schreiben regelmäßig Bauarbeiten, IT-Services, Facility Management und maritime Dienstleistungen aus.",
  Hessen: "Hessen mit der Finanzmetropole Frankfurt am Main und der Landeshauptstadt Wiesbaden ist ein hochaktiver Vergabemarkt. Besonders viele Ausschreibungen gibt es im IT-Bereich, bei Bauleistungen und in der energetischen Gebäudesanierung.",
  "Mecklenburg-Vorpommern": "Mecklenburg-Vorpommern vergeben öffentliche Aufträge vor allem in den Bereichen Tourismus-Infrastruktur, Küstenschutz, ländliche Entwicklung und kommunale Grundversorgung. Rostock, Schwerin und Greifswald sind die wichtigsten Vergabestandorte.",
  Niedersachsen: "Niedersachsen als zweitgrößtes Bundesland hat eine vielfältige Vergabelandschaft. Hannover, Braunschweig und Oldenburg schreiben regelmäßig aus – von Bauleistungen über IT-Dienstleistungen bis zu Lieferaufträgen für öffentliche Einrichtungen.",
  "Nordrhein-Westfalen": "Nordrhein-Westfalen ist das bevölkerungsreichste Bundesland und damit der größte Vergabemarkt in Deutschland. Köln, Düsseldorf, Dortmund und Essen vergeben gemeinsam mit zahlreichen Kommunen Aufträge in allen Leistungsbereichen.",
  "Rheinland-Pfalz": "Rheinland-Pfalz vergeben öffentliche Aufträge überwiegend in den Bereichen Weinbau-Infrastruktur, Tourismus, Kommunalbau und IT-Modernisierung. Mainz, Koblenz und Ludwigshafen sind die wichtigsten Vergabezentren.",
  Saarland: "Das Saarland als kleinstes Flächenbundesland hat eine überschaubare, aber aktive Vergabelandschaft. Saarbrücken und die Landesverwaltung vergeben regelmäßig Aufträge für Bauarbeiten, IT und kommunale Dienstleistungen.",
  Sachsen: "Sachsen profitiert vom wirtschaftlichen Aufschwung in Dresden, Leipzig und Chemnitz. Öffentliche Vergaben umfassen insbesondere Infrastrukturprojekte, Digitalisierung der Verwaltung und energieeffiziente Sanierung.",
  "Sachsen-Anhalt": "Sachsen-Anhalt vergeben öffentliche Aufträge vor allem in den Bereichen Infrastruktur, Landwirtschaft und kommunale Daseinsvorsorge. Magdeburg und Halle sind die wichtigsten Vergabestandorte.",
  "Schleswig-Holstein": "Schleswig-Holstein vergeben öffentliche Aufträge insbesondere im Küsten- und Meeresschutz, in der Landwirtschaft und in der Tourismusinfrastruktur. Kiel, Lübeck und Flensburg sind die zentralen Vergabestädte.",
  Thüringen: "Thüringen vergeben öffentliche Aufträge vor allem in den Bereichen Infrastruktur, Tourismus und kommunale Modernisierung. Erfurt, Jena und Weimar sind die wichtigsten Vergabestandorte mit wachsender Digitalisierungsaktivität.",
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateStaticParams() {
  return ALL_BUNDESLAND_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const bundesland = SLUG_TO_BUNDESLAND[slug];
  if (!bundesland) return { title: "Region nicht gefunden", robots: { index: false, follow: true } };

  try {
    const { estimatedTotalHits } = await searchTenders({ bundesland, query: "", limit: 1 });
    const count = estimatedTotalHits;
    const pageSuffix = currentPage > 1 ? ` – Seite ${currentPage}` : "";
    const title = `Ausschreibungen ${bundesland} – Aktuelle öffentliche Vergaben${pageSuffix}`;
    const description = `${count} aktuelle öffentliche Ausschreibungen in ${bundesland}. Vergabeverfahren für Bauarbeiten, IT, Facility Management und mehr. Täglich aktualisiert.`;
    // SEO: Self-referencing canonical includes ?page=N for page > 1
    const canonicalPath = currentPage > 1
      ? `/ausschreibungen/region/${slug}?page=${currentPage}`
      : `/ausschreibungen/region/${slug}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: count === 0 ? { index: false, follow: true } : undefined,
      openGraph: { title, description, type: "website", locale: "de_DE" },
    };
  } catch {
    const canonicalPath = currentPage > 1
      ? `/ausschreibungen/region/${slug}?page=${currentPage}`
      : `/ausschreibungen/region/${slug}`;
    return {
      title: `Ausschreibungen ${bundesland}`,
      description: `Öffentliche Ausschreibungen in ${bundesland}.`,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: { index: false, follow: true },
    };
  }
}

export default async function RegionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const bundesland = SLUG_TO_BUNDESLAND[slug];
  if (!bundesland) notFound();

  let tenders: Array<{
    id: number;
    title: string;
    category: string;
    client: string;
    location: string;
    deadline: string | null;
  }> = [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    // SEO: Paginated fetch (PAGE_SIZE per page) — enables long-tail indexation beyond 50
    const result = await searchTenders({ bundesland, query: "", limit: PAGE_SIZE, page: currentPage });
    totalCount = result.estimatedTotalHits;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // Return 404 for page numbers beyond total pages
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
    }));
  } catch {
    // Meilisearch unavailable — page renders empty with noindex
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Ausschreibungen ${bundesland}`,
    numberOfItems: totalCount,
    itemListElement: tenders.slice(0, 20).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}`,
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
    ],
  };

  const regionIntro = REGION_INTRO[bundesland];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

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
            <Typography color="text.primary" fontSize="0.85rem">{bundesland}</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}
            >
              Ausschreibungen in {bundesland}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle öffentliche Ausschreibungen in {bundesland}
            </Typography>
            {regionIntro && (
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "70ch", lineHeight: 1.7 }}>
                {regionIntro}
              </Typography>
            )}
          </Box>

          {/* Tender List */}
          {tenders.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {tenders.map((tender) => (
                <Link
                  key={tender.id}
                  href={`/ausschreibung/${tender.id}`}
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
                Aktuell gibt es keine offenen Ausschreibungen in {bundesland}.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Abonnieren Sie unseren{" "}
                <Link href="/feeds/tender.xml" style={{ color: "inherit", fontWeight: 600 }}>RSS-Feed</Link>
                , um benachrichtigt zu werden.
              </Typography>
            </Paper>
          )}

          {/* SEO: Crawlable pagination — anchors so Google discovers page 2+ */}
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
                  href={`/ausschreibungen/region/${slug}?page=${currentPage - 1}`}
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
                          href={`/ausschreibungen/region/${slug}?page=${p}`}
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
                  href={`/ausschreibungen/region/${slug}?page=${currentPage + 1}`}
                  style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}
                >
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          {/* Other Regions */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weitere Regionen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {ALL_BUNDESLAND_SLUGS.filter((s) => s !== slug).map((s) => (
                <Link key={s} href={`/ausschreibungen/region/${s}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={SLUG_TO_BUNDESLAND[s]} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* SEO: Cross-links to Region×Category pages for long-tail internal linking */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Kategorien in {bundesland}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(CATEGORY_SLUGS).map(([key, catSlug]) => (
                <Link
                  key={catSlug}
                  href={`/ausschreibungen/region/${slug}/${catSlug}`}
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

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende Ausschreibungen in {bundesland} für Ihr Unternehmen?
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
    </>
  );
}
