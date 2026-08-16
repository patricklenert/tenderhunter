import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, or, gt, isNull, desc, sql } from "drizzle-orm";
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
import { BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { CITIES } from "@/lib/cities";
import { ARTICLES } from "@/lib/articles";
import { generateTenderSlug } from "@/lib/tender-slug";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { getListingRobots, getPageNumber, type SeoSearchParams } from "@/lib/seo-indexability";

// SEO: Pagination for category pages — 20 tenders per page
const PAGE_SIZE = 20;

export const revalidate = 3600;
export const runtime = "nodejs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

interface PageProps {
  params: Promise<{ kategorie: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateStaticParams() {
  return ALL_CATEGORY_SLUGS.map((slug) => ({ kategorie: slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { kategorie } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!categoryKey) return { title: "Kategorie nicht gefunden", robots: { index: false, follow: true } };

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;

  try {
    const now = new Date();
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(
        and(
          eq(tenders.category, categoryKey),
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      );

    const count = countRow[0]?.count ?? 0;
    const pageSuffix = currentPage > 1 ? ` – Seite ${currentPage}` : "";
    const title = `${label} – Aktuelle öffentliche Ausschreibungen${pageSuffix}`;
    const description = `${count} aktuelle ${label}-Ausschreibungen in Deutschland. Öffentliche Vergabeverfahren mit Fristen, Auftraggebern und Anforderungen — kostenlos durchsuchen auf Tenderhunter.`;
    // SEO: Paginated pages (2+) canonicalize to page 1 to consolidate ranking signals
    const canonicalPath = `/ausschreibungen/${kategorie}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: getListingRobots(await searchParams, count, true),
      openGraph: {
        title,
        description,
        type: "website",
        locale: "de_DE",
      },
    };
  } catch {
    return {
      title: `${label} – Aktuelle öffentliche Ausschreibungen`,
      description: `Öffentliche ${label}-Ausschreibungen in Deutschland.`,
      alternates: { canonical: `/ausschreibungen/${kategorie}`, languages: { "de-DE": `/ausschreibungen/${kategorie}` } },
      robots: { index: false, follow: true },
    };
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { kategorie } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!categoryKey) notFound();

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  const catContent = CATEGORY_CONTENT[categoryKey];
  const now = new Date();

  let categoryTenders: Array<{
    id: number;
    title: string;
    source: string;
    deadline: string | null;
    location: string | null;
    client: string | null;
    slug: string;
  }> = [];

  let otherCategories: Array<{ slug: string; label: string; count: number }> =
    [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    // Get total count for pagination
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(
        and(
          eq(tenders.category, categoryKey),
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      );
    totalCount = countRow[0]?.count ?? 0;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // Return 404 for page numbers beyond total pages (avoids empty indexable pages)
    if (currentPage > totalPages && totalCount > 0) notFound();

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
          eq(tenders.category, categoryKey),
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      )
      .orderBy(desc(tenders.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    categoryTenders = rows.map((row) => {
      const meta =
        typeof row.metadataJson === "object" && row.metadataJson !== null
          ? (row.metadataJson as Record<string, unknown>)
          : {};
      const rawLocation = typeof meta.location === "string" ? meta.location : "";
      return {
        id: row.id,
        title: row.title ?? `Ausschreibung #${row.id}`,
        source: row.source,
        deadline: row.deadlineAt
          ? new Date(row.deadlineAt).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : null,
        location:
          typeof meta.location === "string"
            ? meta.location.split(",")[0].trim().slice(0, 60)
            : null,
        client:
          typeof meta.client === "string"
            ? meta.client.slice(0, 80)
            : null,
        slug: row.slug ?? generateTenderSlug(row.title ?? "", rawLocation),
      };
    });

    const allCatRows = await db
      .select({
        category: tenders.category,
        count: sql<number>`count(*)`,
      })
      .from(tenders)
      .where(
        and(
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`${tenders.category} IS NOT NULL`,
        ),
      )
      .groupBy(tenders.category);

    otherCategories = allCatRows
      .filter((r) => r.category && r.category !== categoryKey)
      .map((r) => ({
        slug: CATEGORY_SLUGS[r.category!] ?? r.category!.toLowerCase(),
        label: CATEGORY_LABELS[r.category!] ?? r.category!,
        count: Number(r.count),
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    // DB unavailable
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${label} Ausschreibungen`,
    numberOfItems: categoryTenders.length,
    itemListElement: categoryTenders.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug}`,
      name: t.title,
    })),
  };

  // SEO: FAQPage JSON-LD from category faq array — real question-answer pairs for Google rich snippets
  const faqJsonLd = catContent?.faq
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: catContent.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Ausschreibungen",
        item: `${siteUrl}/ausschreibungen`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: label,
        item: `${siteUrl}/ausschreibungen/${kategorie}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          {/* Breadcrumbs */}
          <Breadcrumbs
            sx={{ mb: 3, fontSize: "0.85rem" }}
            separator={<span style={{ color: "#999" }}>/</span>}
          >
            <Link
              href="/"
              style={{
                color: "#667288",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <HomeIcon size={14} />
              Start
            </Link>
            <Link
              href="/ausschreibungen"
              style={{ color: "#667288", textDecoration: "none" }}
            >
              Ausschreibungen
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">
              {label}
            </Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{
                mb: 1,
                fontSize: { xs: "1.5rem", md: "2.25rem" },
                letterSpacing: "-0.01em",
              }}
            >
              {label} – Ausschreibungen{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {categoryTenders.length} offene {label}-Ausschreibungen aus
              deutschen Vergabeportalen
            </Typography>
            {catContent && (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: "70ch", lineHeight: 1.7 }}
              >
                {catContent.intro}
              </Typography>
            )}
          </Box>

          {/* Tender List */}
          {categoryTenders.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {categoryTenders.map((tender) => (
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
                      sx={{
                        mb: 1,
                        fontSize: { xs: "0.95rem", md: "1.05rem" },
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {tender.title}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={2}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {tender.client && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Building2 size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary">
                            {tender.client}
                          </Typography>
                        </Stack>
                      )}
                      {tender.location && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <MapPin size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary">
                            {tender.location}
                          </Typography>
                        </Stack>
                      )}
                      {tender.deadline && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Calendar size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary" component="span">
                            Frist: <time>{tender.deadline}</time>
                          </Typography>
                        </Stack>
                      )}
                      <Chip
                        label={tender.source}
                        size="small"
                        sx={{ opacity: 0.7, height: 20 }}
                      />
                    </Stack>
                  </Paper>
                </Link>
              ))}
            </Stack>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                mb: 5,
                border: 1,
                borderColor: "divider",
                textAlign: "center",
              }}
            >
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                Aktuell gibt es keine offenen {label}-Ausschreibungen.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Abonnieren Sie unseren{" "}
                <Link href="/feeds/tender.xml" style={{ color: "inherit", fontWeight: 600 }}>
                  RSS-Feed
                </Link>
                , um benachrichtigt zu werden, wenn neue {label}-Vergaben veröffentlicht werden.
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
              aria-label="Seitenavigation"
            >
              {currentPage > 1 && (
                <Link
                  href={`/ausschreibungen/${kategorie}?page=${currentPage - 1}`}
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
                          href={`/ausschreibungen/${kategorie}?page=${p}`}
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
                  href={`/ausschreibungen/${kategorie}?page=${currentPage + 1}`}
                  style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}
                >
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          {/* Editorial Content */}
          {catContent && (
            <Box sx={{ mb: 5, maxWidth: "75ch" }}>
              <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Wissenswertes für {label}-Vergaben
              </Typography>
              <Typography component="h3" variant="subtitle1" fontWeight={600} sx={{ mt: 3, mb: 1 }}>
                Tipps für Bieter
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {catContent.tips.map((tip, i) => (
                  <Box component="li" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: "text.secondary" }}>
                    {tip}
                  </Box>
                ))}
              </Box>
              <Typography component="h3" variant="subtitle1" fontWeight={600} sx={{ mt: 3, mb: 1 }}>
                Typische Eignungsanforderungen
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {catContent.requirements.map((req, i) => (
                  <Box component="li" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: "text.secondary" }}>
                    {req}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* SEO: Visible FAQ section — mirrors the FAQPage JSON-LD for user accessibility */}
          {catContent?.faq && catContent.faq.length > 0 && (
            <Box sx={{ mb: 5, maxWidth: "75ch" }}>
              <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 3 }}>
                Häufige Fragen zu {label}-Ausschreibungen
              </Typography>
              {catContent.faq.map((item, i) => (
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

          {/* SEO: Cross-links to relevant Wissen articles */}
          {(() => {
            const relatedArticles = Object.values(ARTICLES).filter((a) =>
              a.relatedCategories.includes(categoryKey),
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

          {/* Other Categories */}
          {otherCategories.length > 0 && (
            <Box sx={{ mb: 5 }}>
              <Typography
                variant="h6"
                component="h2"
                fontWeight={700}
                sx={{ mb: 2 }}
              >
                Weitere Ausschreibungskategorien
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {otherCategories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/ausschreibungen/${cat.slug}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Chip
                      clickable
                      label={`${cat.label} (${cat.count})`}
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {/* SEO: Cross-links to Region×Category pages for long-tail internal linking */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              {label} nach Bundesland
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(BUNDESLAND_SLUGS).map(([bundesland, blSlug]) => (
                <Link
                  key={blSlug}
                  href={`/ausschreibungen/region/${blSlug}/${kategorie}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`${label} ${bundesland}`}
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* SEO: Cross-links to City×Category pages for long-tail "{Kategorie} {Stadt}" keywords */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              {label} nach Stadt
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {CITIES.slice(0, 15).map((city) => (
                <Link
                  key={city.slug}
                  href={`/ausschreibungen/stadt/${city.slug}/${kategorie}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={`${label} ${city.label}`}
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* CTA */}
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              textAlign: "center",
              bgcolor: "primary.light",
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende {label}-Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 2 }}
            >
              Scannen Sie Ihre Website und finden Sie automatisch Ausschreibungen,
              die zu Ihren Leistungen passen.
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
