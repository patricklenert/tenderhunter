import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper, Breadcrumbs, Chip } from "@mui/material";
import { Home as HomeIcon, BookOpen, ArrowRight } from "lucide-react";
import { GLOSSARY, getGlossaryByCategory, GLOSSARY_CATEGORIES } from "@/lib/glossary";
import { SiteFooter } from "@/components/seo/SiteFooter";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Vergabelexikon – Begriffe rund um öffentliche Ausschreibungen",
  description:
    "Das Vergabelexikon von Tenderhunter erklärt alle wichtigen Begriffe aus Vergaberecht, Vergabeverfahren und öffentlicher Auftragsvergabe. Von GWB über VgV bis zur UVgO.",
  alternates: { canonical: "/lexikon", languages: { "de-DE": "/lexikon" } },
  openGraph: {
    title: "Vergabelexikon – Begriffe rund um öffentliche Ausschreibungen",
    description: "Alle wichtigen Begriffe aus Vergaberecht und Vergabeverfahren verständlich erklärt.",
    type: "website",
    locale: "de_DE",
  },
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Rechtsgrundlagen: "Gesetze und Verordnungen, die die öffentliche Vergabe regeln",
  Verfahren: "Die verschiedenen Vergabeverfahrensarten von offen bis Verhandlung",
  Vergabeprozess: "Ablauf und Bestandteile des Vergabeverfahrens",
  "Eignung & Zuschlag": "Kriterien und Prüfungen im Vergabeverfahren",
  Schwellenwerte: "Wann gilt welches Vergaberecht?",
  Nachprüfung: "Rechtsbehelfe bei Vergaberechtsverstößen",
  "Technik & Standards": "Elektronische Standards und Portale",
  Akteure: "Wer ist am Vergabeverfahren beteiligt?",
  Sonderbereiche: "Besondere Vergabeformen und Querschnittsthemen",
};

const VOB_CLUSTER = [
  { slug: "vob-a", label: "VOB/A: Vergabeverfahren" },
  { slug: "vob-a-eu", label: "VOB/A EU: Abschnitt 2" },
  { slug: "vob-b", label: "VOB/B: Vertragsbedingungen" },
  { slug: "vob-c", label: "VOB/C: technische ATV" },
  { slug: "losvergabe", label: "Losvergabe: Teil- und Fachlose" },
  { slug: "schwellenwerte", label: "Schwellenwerte" },
  { slug: "auftragswert", label: "Auftragswert" },
  { slug: "leistungsbeschreibung", label: "Leistungsbeschreibung" },
  { slug: "leistungsverzeichnis", label: "Leistungsverzeichnis" },
  { slug: "vgv-vergabeverordnung", label: "VgV" },
  { slug: "gwb-vergaberecht", label: "GWB" },
];

const PROCESS_CLUSTER = [
  { slug: "e-vergabe", label: "E-Vergabe" },
  { slug: "vergabeunterlagen", label: "Vergabeunterlagen" },
  { slug: "teilnahmewettbewerb", label: "Teilnahmewettbewerb" },
  { slug: "bieterfragen", label: "Bieterfragen" },
  { slug: "nachforderung-unterlagen", label: "Nachforderung von Unterlagen" },
  { slug: "angebot", label: "Angebot" },
];

export default function LexikonHubPage() {
  const byCategory = getGlossaryByCategory();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Lexikon", item: `${siteUrl}/lexikon` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} /> Start
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">Lexikon</Typography>
          </Breadcrumbs>

          <Box sx={{ mb: 5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <BookOpen size={28} color="#e9644d" />
              <Typography variant="h4" component="h1" fontWeight={800} sx={{ fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
                Vergabelexikon
              </Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8 }}>
              Alle wichtigen Begriffe aus dem Vergaberecht, von Gesetzen wie GWB und VgV über Vergabeverfahren bis hin zu praktischen Konzepten wie Bindefrist und Zuschlag. Verständlich erklärt für Bieter, Auftraggeber und alle, die sich für öffentliche Ausschreibungen interessieren.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {GLOSSARY.length} Begriffe · nach Themenbereichen geordnet
            </Typography>
          </Box>

          <Paper elevation={0} sx={{ mb: 5, p: { xs: 2.5, md: 3 }, border: 1, borderColor: "divider", bgcolor: "grey.50" }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 0.75 }}>
              VOB im Vergaberecht: die wichtigsten Zusammenhänge
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: "75ch", lineHeight: 1.7 }}>
              VOB/A betrifft das Vergabeverfahren, VOB/B die Vertragsbedingungen und VOB/C die technischen Vertragsbedingungen. Die folgenden Begriffe helfen bei der Einordnung von Bauaufträgen und ihrem Auftragswert.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {VOB_CLUSTER.map((item) => (
                <Link key={item.slug} href={`/lexikon/${item.slug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={item.label} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ mb: 5, p: { xs: 2.5, md: 3 }, border: 1, borderColor: "divider" }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 0.75 }}>
              Vergabeprozess und E-Vergabe
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: "75ch", lineHeight: 1.7 }}>
              Von den Vergabeunterlagen über den Teilnahmewettbewerb bis zur elektronischen Angebotsabgabe: Diese Begriffe ordnen die wichtigsten Schritte für Auftraggeber und Bieter ein.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {PROCESS_CLUSTER.map((item) => (
                <Link key={item.slug} href={`/lexikon/${item.slug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={item.label} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Paper>

          {GLOSSARY_CATEGORIES.map((category) => {
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
                    <Link key={entry.slug} href={`/lexikon/${entry.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
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
                          {entry.term}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          {entry.shortDefinition}
                        </Typography>
                      </Paper>
                    </Link>
                  ))}
                </Stack>
              </Box>
            );
          })}

          {/* SEO: Cross-link to related categories */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weiterführende Informationen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Link href="/wissen" style={{ textDecoration: "none" }}>
                <Chip clickable label="Wissen & Ratgeber" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
              <Link href="/ausschreibungen/verfahren/offen" style={{ textDecoration: "none" }}>
                <Chip clickable label="Offenes Verfahren" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
              <Link href="/ausschreibungen" style={{ textDecoration: "none" }}>
                <Chip clickable label="Aktuelle Ausschreibungen" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              passende Ausschreibungen für Ihr Unternehmen?
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
