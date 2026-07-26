import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper, Breadcrumbs, Chip } from "@mui/material";
import { Home as HomeIcon, FileText, ArrowRight } from "lucide-react";
import { TEMPLATES, getTemplatesByCategory, TEMPLATE_CATEGORIES } from "@/lib/templates";
import { SiteFooter } from "@/components/seo/SiteFooter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Vorlagen für Ausschreibungen – Kostenlose Muster und Checklisten",
  description:
    "Kostenlose Vorlagen für öffentliche Ausschreibungen: Deckblatt VgV, Eigenerklärung EEE, Leistungsverzeichnis, Bieterfragen und mehr. Praxiserprobte Muster für Bieter und Auftraggeber.",
  alternates: { canonical: "/vorlagen", languages: { "de-DE": "/vorlagen" } },
  openGraph: {
    title: "Vorlagen für Ausschreibungen – Kostenlose Muster und Checklisten",
    description: "Praxiserprobte Vorlagen für öffentliche Vergabeverfahren — vom Deckblatt bis zum Leistungsverzeichnis.",
    type: "website",
    locale: "de_DE",
  },
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Angebotsunterlagen: "Dokumente für die strukturierte Angebotsabgabe",
  Eignungsnachweise: "Nachweise und Erklärungen zur fachlichen Eignung",
  Vertragsbedingungen: "Vertragliche Grundlagen und Besondere Vertragsbedingungen",
  Leistungsbeschreibung: "Strukturierte Leistungsvorgaben für Ausschreibungen",
  Korrespondenz: "Muster für Bieterfragen, Rügen und Begleitschreiben",
  Baubetrieb: "Spezifische Dokumente und Standards im Baubereich",
};

export default function VorlagenHubPage() {
  const byCategory = getTemplatesByCategory();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Vorlagen", item: `${siteUrl}/vorlagen` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Tenderhunter Vorlagen für Ausschreibungen",
    numberOfItems: TEMPLATES.length,
    itemListElement: TEMPLATES.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/vorlagen/${t.slug}`,
      name: t.title,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} /> Start
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">Vorlagen</Typography>
          </Breadcrumbs>

          <Box sx={{ mb: 5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <FileText size={28} color="#e9644d" />
              <Typography variant="h4" component="h1" fontWeight={800} sx={{ fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
                Vorlagen für Ausschreibungen
              </Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8 }}>
              Kostenlose Vorlagen und Muster für öffentliche Vergabeverfahren. Vom Deckblatt nach VgV über die Einheitliche Europäische Eigenerklärung (EEE) bis hin zum Leistungsverzeichnis — alle Dokumente praxiserprobt und rechtssicher aufbereitet. Für Bieter, die professionell an Ausschreibungen teilnehmen, und Auftraggeber, die Vergaben vorbereiten.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {TEMPLATES.length} Vorlagen · nach Kategorie sortiert
            </Typography>
          </Box>

          {TEMPLATE_CATEGORIES.map((category) => {
            const entries = byCategory[category];
            if (!entries || entries.length === 0) return null;
            return (
              <Box key={category} sx={{ mb: 5 }}>
                <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 0.5 }}>
                  {category}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {CATEGORY_DESCRIPTIONS[category]}
                </Typography>
                <Stack spacing={1.5}>
                  {entries.map((entry) => (
                    <Link key={entry.slug} href={`/vorlagen/${entry.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
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
                        <Typography variant="subtitle1" component="h3" fontWeight={700} sx={{ mb: 0.5, "&:hover": { color: "primary.main" } }}>
                          {entry.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          {entry.metaDescription.slice(0, 140)}
                        </Typography>
                      </Paper>
                    </Link>
                  ))}
                </Stack>
              </Box>
            );
          })}

          {/* SEO: Cross-links */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weiterführende Informationen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Link href="/lexikon" style={{ textDecoration: "none" }}>
                <Chip clickable label="Vergabelexikon" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
              <Link href="/wissen" style={{ textDecoration: "none" }}>
                <Chip clickable label="Wissen & Ratgeber" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
              <Link href="/ausschreibungen" style={{ textDecoration: "none" }}>
                <Chip clickable label="Aktuelle Ausschreibungen" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tenderhunter findet automatisch passende öffentliche Aufträge für Ihre Leistungen.
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
              Jetzt kostenlos testen
              <ArrowRight size={16} />
            </Box>
          </Box>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
