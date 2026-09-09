import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper, Breadcrumbs, Chip } from "@mui/material";
import { Home as HomeIcon, Calculator, Clock, Gavel, ArrowRight, Wrench } from "lucide-react";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { GLOSSARY } from "@/lib/glossary";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Kostenlose Vergabe-Tools – Schwellenwert, Fristen & Rüge berechnen",
  description:
    "Praktische Online-Tools für Bieter und Auftraggeber: Schwellenwert-Rechner (VgV/UVgO/SektVO), Vergabe-Fristenrechner und Rügefrist-Rechner nach § 160 GWB. Kostenlos, sofort einsetzbar.",
  alternates: { canonical: "/tools", languages: { "de-DE": "/tools" } },
  openGraph: {
    title: "Kostenlose Vergabe-Tools – Schwellenwert, Fristen & Rüge",
    description: "Praktische Rechner für öffentliche Vergaben: Schwellenwerte, Fristen, Rügefristen.",
    type: "website",
    locale: "de_DE",
  },
};

interface ToolMeta {
  slug: string;
  title: string;
  kurz: string;
  beschreibung: string;
  icon: typeof Calculator;
  labels: string[];
}

const TOOLS: ToolMeta[] = [
  {
    slug: "schwellenwert-rechner",
    title: "Schwellenwert-Rechner",
    kurz: "VgV, UVgO oder SektVO?",
    beschreibung:
      "Geben Sie den Auftragswert ein und sofort sehen Sie, welches Vergaberecht gilt und ob EU-Bekanntmachungspflicht besteht.",
    icon: Calculator,
    labels: ["§ 3 VgV", "EU-Schwellenwerte", "Bekanntmachung"],
  },
  {
    slug: "fristenrechner",
    title: "Vergabe-Fristenrechner",
    kurz: "Wann ist Angebotsabgabe?",
    beschreibung:
      "Berechnen Sie die gesetzliche Mindestfrist für die Angebotsabgabe nach § 17 VgV oder § 12 UVgO – ab Bekanntmachungsdatum.",
    icon: Clock,
    labels: ["§ 17 VgV", "§ 12 UVgO", "Kalendertage"],
  },
  {
    slug: "ruegefrist-rechner",
    title: "Rügefrist-Rechner",
    kurz: "14 Tage Rüge, 15 Tage Nachprüfung",
    beschreibung:
      "Vergabeverstoß erkannt? Berechnen Sie die Rügefrist (14 Tage) und Nachprüfungsantragsfrist (15 Tage) nach § 160 GWB inkl. Wochenend-Verlängerung.",
    icon: Gavel,
    labels: ["§ 160 GWB", "§ 193 BGB", "Vergabesenat"],
  },
];

export default function ToolsHubPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${siteUrl}/tools` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Vergabe-Tools",
    itemListElement: TOOLS.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.title,
      url: `${siteUrl}/tools/${t.slug}`,
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
            <Typography color="text.primary" fontSize="0.85rem">Tools</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Wrench size={18} color="#e9644d" />
              <Typography fontSize="0.85rem" fontWeight={600} color="primary">
                Kostenlos · Sofort einsetzbar · Praxiserprobt
              </Typography>
            </Stack>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              Vergabe-Tools für Bieter &amp; Auftraggeber
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8, fontSize: "1.1rem" }}>
              Praxisrechner für die tägliche Arbeit im Vergabewesen: Schwellenwerte bestimmen, Fristen berechnen,
              Rügefristen überwachen. Alle Tools basieren auf aktuellem Vergaberecht (GWB, VgV, UVgO, SektVO).
            </Typography>
          </Box>

          {/* Tool Cards */}
          <Stack spacing={2}>
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.slug} href={`/tools/${tool.slug}`} style={{ textDecoration: "none" }}>
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
                      <Box
                        sx={{
                          flexShrink: 0,
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          bgcolor: "primary.50",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon size={24} color="#e9644d" />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap", gap: 1 }}>
                          <Typography variant="h6" component="h2" fontWeight={700}>
                            {tool.title}
                          </Typography>
                          <Chip label={tool.kurz} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 1.5 }}>
                          {tool.beschreibung}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {tool.labels.map((label) => (
                            <Chip
                              key={label}
                              label={label}
                              size="small"
                              sx={{ fontSize: "0.7rem", bgcolor: "grey.100", color: "text.secondary" }}
                            />
                          ))}
                        </Stack>
                      </Box>
                      <ArrowRight size={20} color="#999" style={{ flexShrink: 0, marginTop: 4 }} />
                    </Stack>
                  </Paper>
                </Link>
              );
            })}
          </Stack>

          {/* Cross-Links */}
          <Paper elevation={0} sx={{ mt: 5, p: { xs: 3, md: 4 }, border: 1, borderColor: "divider", bgcolor: "grey.50" }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weiterführende Ressourcen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Link href="/lexikon" style={{ textDecoration: "none" }}>
                <Chip clickable label={`Vergabelexikon (${GLOSSARY.length} Begriffe)`} variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
              <Link href="/vorlagen" style={{ textDecoration: "none" }}>
                <Chip clickable label="Vorlagen &amp; Muster (17 Dokumente)" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
              <Link href="/ausschreibungen" style={{ textDecoration: "none" }}>
                <Chip clickable label="Aktuelle Ausschreibungen" variant="outlined" sx={{ fontWeight: 500 }} />
              </Link>
            </Stack>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
