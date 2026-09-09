import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Breadcrumbs, Paper } from "@mui/material";
import { Home as HomeIcon, Clock } from "lucide-react";
import Fristenrechner from "@/components/tools/Fristenrechner";
import { SiteFooter } from "@/components/seo/SiteFooter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Vergabe-Fristenrechner – Angebotsfrist nach VgV & UVgO berechnen",
  description:
    "Kostenloser Fristenrechner für öffentliche Vergaben: Wählen Sie das Verfahren und das Datum der Bekanntmachung – sofort sehen Sie den frühesten Abgabetermin nach § 17 VgV bzw. § 12 UVgO.",
  alternates: { canonical: "/tools/fristenrechner", languages: { "de-DE": "/tools/fristenrechner" } },
  openGraph: {
    title: "Vergabe-Fristenrechner – Angebotsfrist nach VgV & UVgO",
    description: "Berechnen Sie die gesetzliche Mindestfrist für Ihre Angebotsabgabe.",
    type: "website",
    locale: "de_DE",
  },
};

export default function FristenrechnerPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${siteUrl}/tools` },
      { "@type": "ListItem", position: 3, name: "Fristenrechner", item: `${siteUrl}/tools/fristenrechner` },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Wie lange ist die Angebotsfrist beim offenen Verfahren nach VgV?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Die Mindestfrist beträgt 52 Kalendertage ab Versand der Bekanntmachung (§ 17 Abs. 1 VgV). Bei elektronischer Einreichung kann sie auf 35 Kalendertage verkürzt werden.",
        },
      },
      {
        "@type": "Question",
        name: "Wie lange ist die Frist bei Unterschwellenvergaben (UVgO)?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Nach § 12 Abs. 2 UVgO beträgt die Frist mindestens 17 Kalendertage, bei besonders komplexen Leistungen 26 Kalendertage. Bei Aufträgen bis 25.000 € genügen 10 Kalendertage.",
        },
      },
      {
        "@type": "Question",
        name: "Ab wann läuft die Angebotsfrist?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Die Frist beginnt mit dem Versand der Bekanntmachung (bei EU-Bekanntmachungen: dem Tag der Absendung an das Amtsblatt der EU). Maßgeblich ist immer die in der Bekanntmachung angegebene Frist.",
        },
      },
    ],
  };

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Vergabe-Fristenrechner",
    url: `${siteUrl}/tools/fristenrechner`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    description:
      "Berechnen Sie die gesetzliche Mindestfrist für die Angebotsabgabe nach VgV, UVgO oder SektVO.",
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
            <Typography color="text.primary" fontSize="0.85rem">Fristenrechner</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Clock size={18} color="#e9644d" />
              <Link href="/tools" style={{ textDecoration: "none" }}>
                <Typography fontSize="0.85rem" fontWeight={600} color="primary">
                  Kostenlose Vergabe-Tools
                </Typography>
              </Link>
            </Stack>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              Vergabe-Fristenrechner
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8, fontSize: "1.1rem" }}>
              Wählen Sie das Vergabeverfahren und das Datum der Bekanntmachung – sofort sehen Sie den frühesten
              Abgabetermin nach § 17 VgV bzw. § 12 UVgO. Including aktueller Kalender mit Wochenenden.
            </Typography>
          </Box>

          <Fristenrechner />

          {/* Erläuterung */}
          <Paper elevation={0} sx={{ mt: 5, p: { xs: 3, md: 4 }, border: 1, borderColor: "divider" }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Wichtige Hinweise zu Vergabefristen
            </Typography>
            <Typography variant="body1" component="p" sx={{ mb: 2, lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
              Die gesetzlichen Mindestfristen sichern Bietern ausreichend Zeit für die Angebotserstellung. Sie sind
              <strong> Untergrenzen</strong> – der Auftraggeber kann sie verlängern, aber nicht unterschreiten.
              Verkürzungen sind nur unter engen Voraussetzungen möglich (z. B. elektronische Einreichung beim offenen
              Verfahren: 52 → 35 Tage).
            </Typography>
            <Typography variant="body1" component="p" sx={{ lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
              <strong>Fällt der letzte Tag auf ein Wochenende oder einen Feiertag</strong>, verlängert sich die Frist
              auf den nächsten Werktag (§ 193 BGB analog). Die hier berechneten Fristen sind <strong>Kalendertage</strong>
              und enthalten Wochenenden.
            </Typography>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
