import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper, Breadcrumbs, Chip } from "@mui/material";
import { Home as HomeIcon, Factory, ArrowRight } from "lucide-react";
import { BRANCHEN } from "@/lib/branchen";
import { SiteFooter } from "@/components/seo/SiteFooter";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Branchen – Öffentliche Ausschreibungen nach Branche",
  description:
    "Öffentliche Ausschreibungen nach Branche: Tiefbau, Hochbau, IT, Reinigung, GaLaBau, Sicherheit, Catering, Energie. Mit CPV-Codes, Verfahren und Branchen-Besonderheiten.",
  alternates: { canonical: "/branchen", languages: { "de-DE": "/branchen" } },
  openGraph: {
    title: "Branchen – Öffentliche Ausschreibungen nach Branche",
    description: "Branchen-Profile für deutsche Vergaben: CPV-Codes, Eignungskriterien, Besonderheiten.",
    type: "website",
    locale: "de_DE",
  },
};

export default function BranchenHubPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Branchen", item: `${siteUrl}/branchen` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Branche-Profile",
    itemListElement: BRANCHEN.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      url: `${siteUrl}/branchen/${b.slug}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} /> Start
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">Branchen</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Factory size={18} color="#e9644d" />
              <Typography fontSize="0.85rem" fontWeight={600} color="primary">
                {BRANCHEN.length} Branchen · Mit CPV-Codes &amp; Branchen-Know-how
              </Typography>
            </Stack>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              Öffentliche Ausschreibungen nach Branche
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8, fontSize: "1.1rem" }}>
              Jede Branche hat eigene CPV-Codes, Eignungskriterien und Vergabe-Besonderheiten. Wählen Sie Ihre Branche
              und sehen Sie, welche Voraussetzungen für öffentliche Aufträge gelten — mit Referenzen zu passenden
              Ausschreibungen.
            </Typography>
          </Box>

          {/* Branche Cards */}
          <Stack spacing={2}>
            {BRANCHEN.map((branche) => (
              <Link key={branche.slug} href={`/branchen/${branche.slug}`} style={{ textDecoration: "none" }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 3, md: 4 },
                    border: 1,
                    borderColor: "divider",
                    transition: "all 0.2s",
                    "&:hover": {
                      borderColor: "primary.main",
                      boxShadow: "0 4px 12px rgba(233,100,77,0.08)",
                    },
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ flexWrap: { xs: "wrap", md: "nowrap" }, gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 0.5 }}>
                        {branche.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 1.5 }}>
                        {branche.metaDescription.split(".")[0]}.
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        <Chip label={branche.schwellenwert.split(" —")[0]} size="small" sx={{ fontSize: "0.7rem", bgcolor: "grey.100" }} />
                        <Chip label={`${branche.cpvCodes.length} CPV-Codes`} size="small" sx={{ fontSize: "0.7rem", bgcolor: "grey.100" }} />
                        <Chip label={`${branche.typischeVerfahren.length} Verfahren`} size="small" sx={{ fontSize: "0.7rem", bgcolor: "grey.100" }} />
                      </Stack>
                    </Box>
                    <ArrowRight size={20} color="#999" style={{ flexShrink: 0, marginTop: 4 }} />
                  </Stack>
                </Paper>
              </Link>
            ))}
          </Stack>

          {/* Cross-Links */}
          <Paper elevation={0} sx={{ mt: 5, p: { xs: 3, md: 4 }, border: 1, borderColor: "divider", bgcolor: "grey.50" }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weiterführende Ressourcen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Link href="/tools" style={{ textDecoration: "none" }}>
                <Chip clickable label="Vergabe-Tools" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
              <Link href="/lexikon" style={{ textDecoration: "none" }}>
                <Chip clickable label="Vergabelexikon" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
              <Link href="/vorlagen" style={{ textDecoration: "none" }}>
                <Chip clickable label="Vorlagen &amp; Muster" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
            </Stack>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
