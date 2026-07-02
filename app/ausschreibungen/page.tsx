import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Chip, Breadcrumbs } from "@mui/material";
import { Home as HomeIcon } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { CATEGORY_CONTENT } from "@/lib/category-content";
import { BUNDESLAND_SLUGS, SLUG_TO_BUNDESLAND } from "@/lib/bundesland";
import { CITY_SLUG_MAP, ALL_CITY_SLUGS, CITY_LABEL_MAP } from "@/lib/cities";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Ausschreibungen Deutschland – aktuelle Vergaben und Aufträge",
  description:
    "Alle öffentlichen Ausschreibungen in Deutschland nach Kategorie: Bauarbeiten, Tiefbau, IT, Facility Management, Reinigung und mehr. Täglich aktuelle Vergaben und Aufträge der öffentlichen Hand.",
  alternates: { canonical: "/ausschreibungen", languages: { "de-DE": "/ausschreibungen" } },
  openGraph: {
    title: "Ausschreibungen Deutschland – aktuelle Vergaben und Aufträge",
    description:
      "Alle öffentlichen Ausschreibungen in Deutschland nach Kategorie. Täglich aktuelle Vergaben und Aufträge der öffentlichen Hand.",
    type: "website",
    locale: "de_DE",
  },
};

export default function AusschreibungenPage() {
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
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          py: { xs: 3, md: 5 },
        }}
      >
        <Container maxWidth="lg">
          {/* SEO: Visible breadcrumbs (JSON-LD already present) */}
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} />
              Start
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">Ausschreibungen</Typography>
          </Breadcrumbs>

          <Typography
            variant="h4"
            component="h1"
            fontWeight={800}
            sx={{
              mb: 2,
              fontSize: { xs: "1.5rem", md: "2.25rem" },
              letterSpacing: "-0.01em",
            }}
          >
            Ausschreibungen in Deutschland
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: "75ch", lineHeight: 1.8, mb: 4 }}
          >
            Finden Sie aktuelle öffentliche Ausschreibungen, Vergabeverfahren
            und Aufträge der öffentlichen Hand in Deutschland. Tenderhunter
            durchsucht automatisch die wichtigsten Vergabeportale – DTVP, TED,
            evergabe, Bauportal Deutschland und weitere. Alle Auftragsbekanntmachungen
            sind nach Leistungsbereichen kategorisiert und täglich aktualisiert.
          </Typography>

          <Stack spacing={2}>
            {Object.entries(CATEGORY_SLUGS).map(([key, slug]) => {
              const label = CATEGORY_LABELS[key] ?? key;
              const content = CATEGORY_CONTENT[key];
              return (
                <Link
                  key={key}
                  href={`/ausschreibungen/${slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Box
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      border: 1,
                      borderColor: "divider",
                      borderLeft: 4,
                      borderLeftColor: "primary.main",
                      borderRadius: 1,
                      transition: "border-color 0.15s",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      component="p"
                      fontWeight={700}
                      sx={{
                        mb: 0.5,
                        fontSize: { xs: "1rem", md: "1.15rem" },
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {label}
                    </Typography>
                    {content && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          lineHeight: 1.7,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {content.intro}
                      </Typography>
                    )}
                  </Box>
                </Link>
              );
            })}
          </Stack>

          {/* SEO: Region links for internal link equity to region landing pages */}
          <Box sx={{ mt: 5, mb: 5 }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Ausschreibungen nach Region
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(BUNDESLAND_SLUGS).map(([bundesland, slug]) => (
                <Link key={slug} href={`/ausschreibungen/region/${slug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={bundesland} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* SEO: City links for internal link equity to city landing pages */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Ausschreibungen nach Stadt
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {ALL_CITY_SLUGS.slice(0, 25).map((slug) => (
                <Link key={slug} href={`/ausschreibungen/stadt/${slug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={CITY_LABEL_MAP[slug]} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          <Box sx={{ mt: 5, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Aktuelle Ausschreibungen auch per{" "}
              <Link
                href="/feeds/tender.xml"
                style={{
                  color: "inherit",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                RSS-Feed
              </Link>{" "}
              abonnieren.
            </Typography>
          </Box>
        </Container>
      </Box>
    </>
  );
}
