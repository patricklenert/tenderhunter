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

  const faqItems = [
    {
      question: "Was ist der aktuelle Schwellenwert für Bauleistungen?",
      answer: "Der EU-Schwellenwert für Bauaufträge beträgt 5.404.000 € für 2026/2027. Maßgeblich sind Auftraggeber und Leistungsart; bei Bauaufträgen klassischer Auftraggeber im Richtlinien-Anwendungsbereich sind oberhalb des Schwellenwerts GWB, VOB/A Abschnitt 2 und die nach § 2 VgV anwendbaren Vorschriften zu prüfen.",
    },
    {
      question: "Was ist der Schwellenwert für Liefer- und Dienstleistungen?",
      answer: "Für Liefer- und Dienstleistungen im Anwendungsbereich der Richtlinie 2014/24/EU gelten 2026/2027 grundsätzlich 140.000 € für bestimmte oberste und obere Bundesbehörden sowie vergleichbare Bundeseinrichtungen und 216.000 € für andere öffentliche Auftraggeber. Sonderfälle, insbesondere soziale und andere besondere Dienstleistungen, haben eigene Schwellenwerte.",
    },
    {
      question: "Was bedeutet Unterschwellenvergabe?",
      answer: "Bei Aufträgen unterhalb der EU-Schwellenwerte gelten die Regeln des zuständigen Auftraggebers, etwa die UVgO auf Bundesebene oder Landesvergaberecht. Eine EU-Bekanntmachungspflicht folgt daraus nicht automatisch; nationale Vorgaben bleiben zu beachten.",
    },
    {
      question: "Wann gilt die SektVO?",
      answer: "Die SektVO gilt für Auftraggeber in den Sektoren Trinkwasser, Energie, Verkehr und Postdienste (§ 100 GWB). Für 2026/2027 beträgt der Schwellenwert für Sektorenbau 5.404.000 € und für Liefer-/Dienstleistungen außerhalb der besonderen Dienstleistungen nach Anhang XVII 432.000 €. Für diese besonderen Dienstleistungen gilt 1.000.000 €.",
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
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
              <li><strong>Bauaufträge klassischer Auftraggeber:</strong> 5.404.000 €</li>
              <li><strong>Liefer-/Dienstleistungen bestimmter oberster und oberer Bundesbehörden sowie vergleichbarer Bundeseinrichtungen im Anwendungsbereich der Richtlinie 2014/24/EU:</strong> 140.000 €</li>
              <li><strong>Liefer-/Dienstleistungen anderer öffentlicher Auftraggeber im Anwendungsbereich der Richtlinie 2014/24/EU (grundsätzlich, soweit keine Sonderregel gilt):</strong> 216.000 €</li>
              <li><strong>Sektoren-Liefer-/Dienstleistungen (außer besonderen Dienstleistungen nach Anhang XVII):</strong> 432.000 €</li>
              <li><strong>Soziale und andere besondere Dienstleistungen klassischer Auftraggeber nach Anhang XIV:</strong> 750.000 €</li>
              <li><strong>Bauaufträge von Sektorenauftraggebern:</strong> 5.404.000 €</li>
              <li><strong>Soziale und andere besondere Dienstleistungen von Sektorenauftraggebern nach Anhang XVII:</strong> 1.000.000 €</li>
              <li><strong>Konzessionen:</strong> 5.404.000 €</li>
              <li><strong>Verteidigungs- und Sicherheitsbereich (Liefer-/Dienstleistungen):</strong> 432.000 €</li>
              <li><strong>Verteidigungs- und Sicherheitsbereich (Bauaufträge):</strong> 5.404.000 €</li>
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ mt: 3, p: { xs: 3, md: 4 }, border: 1, borderColor: "divider" }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Häufige Fragen zu Schwellenwerten
            </Typography>
            <Stack spacing={2.5}>
              {faqItems.map(({ question, answer }) => (
                <Box key={question}>
                  <Typography variant="subtitle1" component="h3" fontWeight={700}>
                    {question}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.7 }}>
                    {answer}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
