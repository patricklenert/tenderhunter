import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper } from "@mui/material";
import { Calculator } from "lucide-react";
import { SiteBreadcrumbs } from "@/components/seo/SiteBreadcrumbs";
import SchwellenwertRechner from "@/components/tools/SchwellenwertRechner";
import { SiteFooter } from "@/components/seo/SiteFooter";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Schwellenwert-Rechner – VgV, UVgO oder SektVO? (2026/2027)",
  description:
    "Kostenloser Schwellenwert-Rechner für öffentliche Vergaben. Ordnen Sie den Auftragswert dem passenden Vergaberegelwerk zu (VgV, VOB/A, UVgO oder SektVO) und prüfen Sie den EU-Anwendungsbereich.",
  alternates: { canonical: "/tools/schwellenwert-rechner", languages: { "de-DE": "/tools/schwellenwert-rechner" } },
  openGraph: {
    title: "Schwellenwert-Rechner – VgV, UVgO oder SektVO?",
    description: "Geben Sie den Auftragswert ein und sofort sehen Sie, welches Vergaberecht gilt.",
    type: "website",
    locale: "de_DE",
  },
};

export default function SchwellenwertRechnerPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${siteUrl}/tools` },
      { "@type": "ListItem", position: 3, name: "Schwellenwert-Rechner", item: `${siteUrl}/tools/schwellenwert-rechner` },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Was ist der aktuelle Schwellenwert für Bauleistungen?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Der EU-Schwellenwert für Bauaufträge beträgt 5.404.000 € für 2026/2027. Maßgeblich sind der Auftraggeber und die Leistungsart; oberhalb greifen GWB, VOB/A Abschnitt 2 und die nach § 2 VgV anwendbaren Vorschriften.",
        },
      },
      {
        "@type": "Question",
        name: "Was ist der Schwellenwert für Liefer- und Dienstleistungen?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Für Liefer- und Dienstleistungen gelten 2026/2027 je nach Auftraggeber 140.000 € oder 216.000 €. Diese Werte gelten nicht pauschal für jede öffentliche Beschaffung; oberhalb ist grundsätzlich das einschlägige EU-Vergaberecht zu prüfen.",
        },
      },
      {
        "@type": "Question",
        name: "Was bedeutet Unterschwellenvergabe?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Bei Aufträgen unterhalb der EU-Schwellenwerte gelten die Regeln des zuständigen Auftraggebers, etwa die UVgO auf Bundesebene oder Landesvergaberecht. Eine EU-Bekanntmachungspflicht folgt daraus nicht automatisch; nationale Vorgaben bleiben zu beachten.",
        },
      },
      {
        "@type": "Question",
        name: "Wann gilt die SektVO?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Die SektVO gilt für Auftraggeber in den Sektoren Trinkwasser, Energie, Verkehr und Postdienste (§ 100 GWB). Für 2026/2027 beträgt der Schwellenwert für Sektorenbau 5.404.000 € und für Liefer-/Dienstleistungen 432.000 €.",
        },
      },
    ],
  };

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Schwellenwert-Rechner für öffentliche Vergaben",
    url: `${siteUrl}/tools/schwellenwert-rechner`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    description:
     "Ordnen Sie einen Auftragswert dem passenden Vergaberegelwerk zu: VgV, VOB/A, UVgO oder SektVO.",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          <SiteBreadcrumbs items={[
            { label: "Start", href: "/" },
            { label: "Tools", href: "/tools" },
            { label: "Schwellenwert-Rechner" },
          ]} />

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Calculator size={18} color="#e9644d" />
              <Link href="/tools" style={{ textDecoration: "none" }}>
                <Typography fontSize="0.85rem" fontWeight={600} color="primary">
                  Kostenlose Vergabe-Tools
                </Typography>
              </Link>
            </Stack>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              Schwellenwert-Rechner
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8, fontSize: "1.1rem" }}>
               Geben Sie den Auftragswert ein und ordnen Sie ihn dem passenden Vergaberegelwerk zu: VgV, VOB/A, UVgO
               oder SektVO. Mit aktuellen EU-Schwellenwerten 2026–2027.
            </Typography>
          </Box>

          <SchwellenwertRechner />

          {/* Erläuterung */}
          <Paper elevation={0} sx={{ mt: 5, p: { xs: 3, md: 4 }, border: 1, borderColor: "divider" }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Wie funktionieren Schwellenwerte?
            </Typography>
            <Typography variant="body1" component="p" sx={{ mb: 2, lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
              Schwellenwerte bestimmen, welches Vergaberecht für einen öffentlichen Auftrag gilt. Liegt der
              Auftragswert <strong>über</strong> dem passenden Schwellenwert (Oberschwelle), ist das einschlägige
              EU-Vergaberecht mit den jeweiligen Bekanntmachungspflichten zu prüfen. Liegt er <strong>darunter</strong>,
              gelten die nationalen Regeln des zuständigen Auftraggebers.
            </Typography>
            <Typography variant="body1" component="p" sx={{ mb: 2, lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
              Die EU-Schwellenwerte werden alle zwei Jahre von der Europäischen Kommission angepasst. Die aktuell
              geltenden Werte (Stand: 2026–2027) beruhen auf den einschlägigen delegierten EU-Verordnungen.
            </Typography>

            <Typography variant="h6" component="h3" fontWeight={700} sx={{ mt: 3, mb: 1.5, fontSize: "1.1rem" }}>
              Die wichtigsten Schwellenwerte im Überblick
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary" }}>
              <li><strong>Bauaufträge:</strong> 5.404.000 €</li>
              <li><strong>Liefer-/Dienstleistungen (bestimmte zentrale Behörden):</strong> 140.000 €</li>
              <li><strong>Liefer-/Dienstleistungen (sonstige bestimmte Auftraggeber):</strong> 216.000 €</li>
              <li><strong>Sektoren (Liefer/Dienst):</strong> 432.000 €</li>
              <li><strong>Soziale und besondere Dienstleistungen:</strong> 750.000 €</li>
            </Box>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
