import Link from "next/link";
import { Box, Container, Typography, Stack, Chip } from "@mui/material";
import { MapPin, Calendar } from "lucide-react";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, or, isNull, gt, asc } from "drizzle-orm";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { CITIES } from "@/lib/cities";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { readPublicTenderMeta } from "@/lib/tender-meta";

// SEO: Server-rendered content for homepage so crawlers see h1, body text, and internal links.
// The existing InteractiveApp is a client component — invisible to Googlebot in initial HTML.
// Keep this as a sibling after the complete interactive shell. It must not be passed through
// the client component, otherwise hydration can replace the SSR-only content on tab changes.

const TOP_BUNDESLAENDER = [
  "Nordrhein-Westfalen",
  "Bayern",
  "Baden-Württemberg",
  "Hessen",
  "Niedersachsen",
  "Sachsen",
  "Berlin",
  "Hamburg",
];

const TOP_CITIES = CITIES.slice(0, 10);

export async function HomeSeoContent() {
  const now = new Date();
  let rows: Array<{
    id: number;
    title: string | null;
    category: string | null;
    source: string;
    url: string | null;
    deadlineAt: Date | null;
    metadataJson: unknown;
    slug: string | null;
  }> = [];

  try {
    rows = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        category: tenders.category,
        source: tenders.source,
        url: tenders.url,
        deadlineAt: tenders.deadlineAt,
        metadataJson: tenders.metadataJson,
        slug: tenders.slug,
      })
      .from(tenders)
      .where(
        and(
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      )
      .orderBy(asc(tenders.deadlineAt))
      .limit(12);
  } catch {
    // Keep the substantive editorial content available without the live catalog.
  }

  const latestTenders = rows.map((row) => {
    const meta = readPublicTenderMeta(row.metadataJson, {
      title: row.title,
      source: row.source,
      sourceUrl: row.url,
    });
    const location = meta.location ? meta.location.split(",")[0].trim().slice(0, 60) : null;
    return {
      id: row.id,
      title: row.title ?? `Ausschreibung #${row.id}`,
      categoryLabel: CATEGORY_LABELS[row.category ?? "Sonstiges"] ?? row.category ?? "Diverse",
      categorySlug: CATEGORY_SLUGS[row.category ?? "Sonstiges"] ?? "diverse",
      deadline: row.deadlineAt
        ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      location,
       slug: getCanonicalTenderSlug(row.slug, row.title, row.metadataJson),
    };
  });

  return (
    <Box
      component="section"
      data-layout-slot="homepage-seo"
      sx={{ py: { xs: 4, md: 6 }, bgcolor: "background.default" }}
    >
      <Container maxWidth="lg">
        {/* SEO: H1 for crawlers — the interactive app has no SSR heading */}
        <Typography
          variant="h3"
          component="h1"
          fontWeight={800}
          sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.5rem" }, letterSpacing: "-0.02em" }}
        >
          Öffentliche Ausschreibungen in Deutschland finden
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5, maxWidth: "75ch", lineHeight: 1.7 }}>
          Tenderhunter durchsucht automatisch die wichtigsten deutschen Vergabeportale — DTVP, TED, evergabe und Bauportal Deutschland — und zeigt Ihnen täglich aktuelle öffentliche Ausschreibungen. Die KI analysiert Vergabeunterlagen, extrahiert Anforderungen und bewertet die Passung zu Ihrem Unternehmen mit einem Fit-Score.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5, maxWidth: "75ch", lineHeight: 1.7 }}>
          Ob Bauarbeiten, IT-Dienstleistungen, Facility Management, Gebäudereinigung oder Lieferaufträge — finden Sie als KMU passende öffentliche Aufträge in Ihrer Region. Kostenlos starten, Website scannen und sofort relevante Vergaben entdecken.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: "75ch", lineHeight: 1.7 }}>
          Über 13 Leistungsbereiche, alle 16 Bundesländer und {CITIES.length} Städte — Tenderhunter ist die KI-Ausschreibungssoftware für deutsche Unternehmen, die öffentliche Aufträge effizient finden und erfolgreich vergeben wollen.
        </Typography>

        {/* Categories */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
            Ausschreibungen nach Kategorie
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(CATEGORY_SLUGS).map(([key, slug]) => (
              <Link key={slug} href={`/ausschreibungen/${slug}`} style={{ textDecoration: "none" }}>
                <Chip clickable label={CATEGORY_LABELS[key] ?? key} variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
            ))}
          </Stack>
        </Box>

        {/* Top Bundesländer */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
            Ausschreibungen nach Region
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {TOP_BUNDESLAENDER.map((bl) => (
              <Link key={bl} href={`/ausschreibungen/region/${BUNDESLAND_SLUGS[bl]}`} style={{ textDecoration: "none" }}>
                <Chip clickable label={bl} variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
            ))}
          </Stack>
        </Box>

        {/* Top Cities */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
            Ausschreibungen nach Stadt
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {TOP_CITIES.map((city) => (
              <Link key={city.slug} href={`/ausschreibungen/stadt/${city.slug}`} style={{ textDecoration: "none" }}>
                <Chip clickable label={city.label} variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
            ))}
          </Stack>
        </Box>

        {/* Latest tenders */}
        {latestTenders.length > 0 && (
          <Box>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Aktuelle Ausschreibungen
            </Typography>
            <Stack spacing={1.5}>
              {latestTenders.map((t) => (
                <Link
                  key={t.id}
                  href={`/ausschreibung/${t.id}/${t.slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Box
                    sx={{
                      p: { xs: 1.5, md: 2 },
                      border: 1,
                      borderColor: "divider",
                      borderLeft: 3,
                      borderLeftColor: "primary.main",
                      borderRadius: 1,
                      transition: "border-color 0.15s",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                      {t.title}
                    </Typography>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                      <Chip label={t.categoryLabel} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                      {t.location && (
                        <Stack direction="row" spacing={0.3} alignItems="center">
                          <MapPin size={12} color="#667288" />
                          <Typography variant="caption" color="text.secondary">{t.location}</Typography>
                        </Stack>
                      )}
                      {t.deadline && (
                        <Stack direction="row" spacing={0.3} alignItems="center">
                          <Calendar size={12} color="#667288" />
                          <Typography variant="caption" color="text.secondary">Frist: {t.deadline}</Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                </Link>
              ))}
            </Stack>
          </Box>
        )}
      </Container>
    </Box>
  );
}
