import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper, Chip } from "@mui/material";
import { BookOpen, ArrowRight } from "lucide-react";
import { SiteBreadcrumbs } from "@/components/seo/SiteBreadcrumbs";
import { ARTICLES, ALL_ARTICLE_SLUGS } from "@/lib/articles";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { SiteFooter } from "@/components/seo/SiteFooter";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Wissen – Vergaberecht, Ausschreibungen und Bieter-Tipps",
  description:
    "Alles rund um öffentliche Ausschreibungen in Deutschland: Vergabeverfahren, VOB/A, Bieter-Tipps und Praxiswissen für Unternehmen.",
  alternates: { canonical: "/wissen", languages: { "de-DE": "/wissen" } },
  openGraph: {
    title: "Wissen – Vergaberecht, Ausschreibungen und Bieter-Tipps",
    description: "Praxiswissen für Unternehmen zu öffentlichen Ausschreibungen in Deutschland.",
    type: "website",
    locale: "de_DE",
  },
};

export default function WissenPage() {
  const articles = ALL_ARTICLE_SLUGS.map((slug) => ARTICLES[slug]);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Wissen", item: `${siteUrl}/wissen` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          <SiteBreadcrumbs items={[
            { label: "Start", href: "/" },
            { label: "Wissen" },
          ]} />

          <Box sx={{ mb: 5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <BookOpen size={28} color="#e9644d" />
              <Typography
                variant="h4"
                component="h1"
                fontWeight={800}
                sx={{ fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}
              >
                Wissen rund um Ausschreibungen
              </Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8 }}>
              Praxiswissen für Unternehmen zu öffentlichen Ausschreibungen, Vergaberecht und Bieter-Strategien.
              Ob Vergabeverfahren, VOB/A oder Tipps für KMU – hier finden Sie kompakte Informationen für den Einstieg.
            </Typography>
          </Box>

          <Stack spacing={3}>
            {articles.map((article) => (
              <Link key={article.slug} href={`/wissen/${article.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    border: 1,
                    borderColor: "divider",
                    borderLeft: 4,
                    borderLeftColor: "primary.main",
                    transition: "border-color 0.15s",
                    "&:hover": { borderColor: "primary.main" },
                  }}
                >
                  <Typography
                    variant="h5"
                    component="h2"
                    fontWeight={700}
                    sx={{ mb: 1, fontSize: { xs: "1.15rem", md: "1.35rem" }, "&:hover": { color: "primary.main" } }}
                  >
                    {article.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                    {article.description}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {article.relatedCategories.map((cat) => (
                      <Chip key={cat} label={CATEGORY_LABELS[cat] ?? cat} size="small" variant="outlined" sx={{ height: 24, fontSize: "0.75rem" }} />
                    ))}
                  </Stack>
                </Paper>
              </Link>
            ))}
          </Stack>

          {/* Link to categories */}
          <Box sx={{ mt: 6 }}>
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
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
