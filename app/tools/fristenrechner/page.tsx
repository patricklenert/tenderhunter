import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper } from "@mui/material";
import { Clock } from "lucide-react";
import { SiteBreadcrumbs } from "@/components/seo/SiteBreadcrumbs";
import Fristenrechner from "@/components/tools/Fristenrechner";
import { SiteFooter } from "@/components/seo/SiteFooter";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Vergabe-Fristenrechner – Angebotsfrist nach VgV & UVgO berechnen",
  description:
    "Kostenloser Fristenrechner für öffentliche Vergaben: Ermitteln Sie EU-Mindestfristen nach VgV. Für UVgO-Vergaben zeigt das Tool, warum die Frist im Einzelfall angemessen festgelegt werden muss.",
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
          text: "Die Mindestfrist im offenen Verfahren beträgt 35 Kalendertage ab Absendung der Bekanntmachung (§ 15 Abs. 2 VgV). Die konkrete Bekanntmachung kann eine längere Frist vorsehen.",
        },
      },
      {
        "@type": "Question",
        name: "Wie lange ist die Frist bei Unterschwellenvergaben (UVgO)?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Nach § 13 Abs. 1 UVgO gibt es keine einheitliche gesetzliche Zahl von Kalendertagen. Die Angebotsfrist muss angemessen sein und steht in den Vergabeunterlagen.",
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
          <SiteBreadcrumbs items={[
            { label: "Start", href: "/" },
            { label: "Tools", href: "/tools" },
            { label: "Fristenrechner" },
          ]} />

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
               Abgabetermin nach den einschlägigen VgV-Regeln. Bei UVgO-Vergaben muss die Frist im Einzelfall angemessen
               festgelegt werden. Der Rechner berücksichtigt Kalendertage und Wochenenden.
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
               Verkürzungen oder besondere Fristregeln hängen vom Verfahren und den gesetzlichen Voraussetzungen ab. Die
               konkrete Frist in der Bekanntmachung oder den Vergabeunterlagen ist maßgeblich.
            </Typography>
            <Typography variant="body1" component="p" sx={{ lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
              <strong>Fällt der letzte Tag auf ein Wochenende oder einen Feiertag</strong>, verlängert sich die Frist
               auf den nächsten Werktag. Die hier berechneten Fristen sind <strong>Kalendertage</strong>
              und enthalten Wochenenden.
            </Typography>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
