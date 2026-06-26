import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, inArray, or, gt, isNull, desc, sql } from "drizzle-orm";
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
import {
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  SLUG_TO_CATEGORY,
  ALL_CATEGORY_SLUGS,
} from "@/lib/categories";
import { CATEGORY_CONTENT } from "@/lib/category-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com";

interface PageProps {
  params: Promise<{ kategorie: string }>;
}

export async function generateStaticParams() {
  return ALL_CATEGORY_SLUGS.map((slug) => ({ kategorie: slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { kategorie } = await params;
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!categoryKey) return { title: "Kategorie nicht gefunden" };

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;

  try {
    const now = new Date();
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(
        and(
          eq(tenders.category, categoryKey),
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      );

    const count = countRow[0]?.count ?? 0;
    const title = `${label} – Aktuelle öffentliche Ausschreibungen`;
    const description = `${count} aktuelle ${label}-Ausschreibungen in Deutschland. Öffentliche Vergabeverfahren für ${label.toLowerCase()} mit Fristen, Auftraggebern und Anforderungen.`;

    return {
      title,
      description,
      alternates: { canonical: `/ausschreibungen/${kategorie}` },
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
    };
  }
}

export default async function CategoryPage({ params }: PageProps) {
  const { kategorie } = await params;
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
  }> = [];

  let otherCategories: Array<{ slug: string; label: string; count: number }> =
    [];

  try {
    const rows = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        source: tenders.source,
        deadlineAt: tenders.deadlineAt,
        metadataJson: tenders.metadataJson,
      })
      .from(tenders)
      .where(
        and(
          eq(tenders.category, categoryKey),
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      )
      .orderBy(desc(tenders.createdAt));

    categoryTenders = rows.map((row) => {
      const meta =
        typeof row.metadataJson === "object" && row.metadataJson !== null
          ? (row.metadataJson as Record<string, unknown>)
          : {};
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
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
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

  if (categoryTenders.length === 0) notFound();

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${label} Ausschreibungen`,
    numberOfItems: categoryTenders.length,
    itemListElement: categoryTenders.slice(0, 10).map((t, i) => ({
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
      {
        "@type": "ListItem",
        position: 2,
        name: "Ausschreibungen",
        item: `${siteUrl}/#aktuelle-ausschreibungen`,
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
              href="/#aktuelle-ausschreibungen"
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
              {label} – Ausschreibungen
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
          <Stack spacing={2} sx={{ mb: 5 }}>
            {categoryTenders.map((tender) => (
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
                        <Typography variant="caption" color="text.secondary">
                          Frist: {tender.deadline}
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

          {/* CTA */}
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              textAlign: "center",
              bgcolor: "primary.light",
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
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
    </>
  );
}
