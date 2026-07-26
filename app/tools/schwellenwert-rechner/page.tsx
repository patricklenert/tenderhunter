import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Breadcrumbs, Paper } from "@mui/material";
import { Home as HomeIcon, Calculator } from "lucide-react";
import SchwellenwertRechner from "@/components/tools/SchwellenwertRechner";
import { SiteFooter } from "@/components/seo/SiteFooter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Schwellenwert-Rechner – VgV, UVgO oder SektVO? (2024/2025)",
  description:
    "Kostenloser Schwellenwert-Rechner für öffentliche Vergaben. Geben Sie den Auftragswert ein und sofort sehen Sie: Welches Vergaberecht gilt (VgV, UVgO, SektVO) und ob EU-Bekanntmachungspflicht besteht.",
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
          text: "Der EU-Schwellenwert für Bauaufträge liegt bei 5.538.000 € (Stand 2024–2025). Ab diesem Betrag gilt das VgV (Oberschwelle) mit verpflichtender EU-Bekanntmachung, darunter vergibt nach UVgO oder Landesvergaberecht (Unterschwelle).",
        },
      },
      {
        "@type": "Question",
        name: "Was ist der Schwellenwert für Liefer- und Dienstleistungen?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Für Liefer- und Dienstleistungen liegt der Schwellenwert bei 221.000 € (über zentrale Beschaffungsstellen) bzw. 143.000 € (sonstige Auftraggeber). Ab diesen Beträgen gilt das VgV mit EU-Bekanntmachungspflicht.",
        },
      },
      {
        "@type": "Question",
        name: "Was bedeutet Unterschwellenvergabe?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Bei Aufträgen unterhalb der EU-Schwellenwerte gilt die UVgO (Unterschwellenvergabeverordnung, für den Bund) oder das jeweilige Landesvergaberecht. Hier besteht keine EU-Bekanntmachungspflicht, die Vergabestelle hat freie Verfahrenswahl.",
        },
      },
      {
        "@type": "Question",
        name: "Wann gilt die SektVO?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Die Sektorenvergabeverordnung (SektVO) gilt für Auftraggeber in den Sektoren Trinkwasser, Energie, Verkehr und Postdienste (§ 100 GWB). Der Schwellenwert liegt hier bei 5.538.000 € (Bau) bzw. 443.000 € (Liefer-/Dienstleistungen).",
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
      "Berechnen Sie sofort, welches Vergaberecht für Ihren Auftrag gilt: VgV, UVgO oder SektVO. Geben Sie einfach den Auftragswert ein.",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} /> Start
            </Link>
            <Link href="/tools" style={{ color: "#667288", textDecoration: "none" }}>
              Tools
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">Schwellenwert-Rechner</Typography>
          </Breadcrumbs>

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
              Geben Sie den Auftragswert ein und sofort sehen Sie, welches Vergaberecht gilt: VgV (Oberschwelle), UVgO
              (Unterschwelle) oder SektVO (Sektorenauftraggeber). Mit aktuellen EU-Schwellenwerten 2024–2025.
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
              Auftragswert <strong>über</strong> dem Schwellenwert (Oberschwelle), greift das Vergabevergabegesetz
              (VgV) mit verpflichtender EU-weiter Bekanntmachung im TED. Liegt er <strong>darunter</strong>
              (Unterschwelle), gilt die UVgO oder das jeweilige Landesvergaberecht mit freier Verfahrenswahl.
            </Typography>
            <Typography variant="body1" component="p" sx={{ mb: 2, lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
              Die EU-Schwellenwerte werden alle zwei Jahre von der Europäischen Kommission angepasst. Die aktuell
              geltenden Werte (Stand: 2024–2025) beruhen auf der <strong>Verordnung (EU) 2022/2577</strong>.
            </Typography>

            <Typography variant="h6" component="h3" fontWeight={700} sx={{ mt: 3, mb: 1.5, fontSize: "1.1rem" }}>
              Die wichtigsten Schwellenwerte im Überblick
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary" }}>
              <li><strong>Bauaufträge:</strong> 5.538.000 €</li>
              <li><strong>Liefer-/Dienstleistungen (zentral):</strong> 221.000 €</li>
              <li><strong>Liefer-/Dienstleistungen (sonstige):</strong> 143.000 €</li>
              <li><strong>Sektoren (Liefer/Dienst):</strong> 443.000 €</li>
              <li><strong>Soziale und besondere Dienste:</strong> 443.000 €</li>
            </Box>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
