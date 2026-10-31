import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper } from "@mui/material";
import { Gavel } from "lucide-react";
import { SiteBreadcrumbs } from "@/components/seo/SiteBreadcrumbs";
import RuegefristRechner from "@/components/tools/RuegefristRechner";
import { SiteFooter } from "@/components/seo/SiteFooter";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Rügefrist-Rechner – § 160 GWB Fristen exakt berechnen",
  description:
    "Kostenloser Rügefrist-Rechner nach § 160 GWB: Berechnen Sie die 10-Tage-Frist für erkannte Verstöße und die 15-Tage-Frist nach Nichtabhilfe.",
  alternates: { canonical: "/tools/ruegefrist-rechner", languages: { "de-DE": "/tools/ruegefrist-rechner" } },
  openGraph: {
    title: "Rügefrist-Rechner – § 160 GWB Fristen exakt berechnen",
    description: "Berechnen Sie die Rüge- und Nachprüfungsfristen nach § 160 GWB.",
    type: "website",
    locale: "de_DE",
  },
};

export default function RuegefristRechnerPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${siteUrl}/tools` },
      { "@type": "ListItem", position: 3, name: "Rügefrist-Rechner", item: `${siteUrl}/tools/ruegefrist-rechner` },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Wie lange habe ich Zeit, um einen Vergabeverstoß zu rügen?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Nach § 160 Abs. 3 Satz 1 Nummer 1 GWB muss ein erkannter Vergabeverstoß innerhalb von zehn Kalendertagen gegenüber dem Auftraggeber gerügt werden. Für erkennbare Fehler in Bekanntmachung oder Vergabeunterlagen gelten die dort genannten Fristenden.",
        },
      },
      {
        "@type": "Question",
        name: "Wie lange habe ich für den Nachprüfungsantrag bei der Vergabekammer?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Nach § 160 Abs. 3 Satz 1 Nummer 4 GWB ist der Antrag unzulässig, wenn mehr als 15 Kalendertage nach Eingang der Mitteilung vergangen sind, dass der Auftraggeber der Rüge nicht abhelfen will.",
        },
      },
      {
        "@type": "Question",
        name: "Was passiert, wenn ich die Rügefrist verstreichen lasse?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ein Antrag kann nach § 160 Abs. 3 GWB unzulässig sein, wenn der Verstoß nicht rechtzeitig gerügt wurde. Nummern 2 bis 5 enthalten weitere Frist- und Zulässigkeitsregeln; ein Antrag auf Feststellung der Unwirksamkeit nach § 135 Absatz 1 Nummer 2 ist ausgenommen.",
        },
      },
      {
        "@type": "Question",
        name: "Muss ich immer erst rügen, bevor ich Nachprüfung beantrage?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Eine vorherige Rüge ist nicht in jedem Fall gleich zu beurteilen. § 160 Abs. 3 GWB enthält je nach Art und Zeitpunkt des Verstoßes unterschiedliche Anforderungen und Ausnahmen.",
        },
      },
    ],
  };

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Rügefrist-Rechner nach § 160 GWB",
    url: `${siteUrl}/tools/ruegefrist-rechner`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    description:
       "Berechnen Sie die 10-Tage-Rügefrist für erkannte Verstöße und die 15-Tage-Frist nach Nichtabhilfe gemäß § 160 GWB.",
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
            { label: "Rügefrist-Rechner" },
          ]} />

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Gavel size={18} color="#e9644d" />
              <Link href="/tools" style={{ textDecoration: "none" }}>
                <Typography fontSize="0.85rem" fontWeight={600} color="primary">
                  Kostenlose Vergabe-Tools
                </Typography>
              </Link>
            </Stack>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              Rügefrist-Rechner
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8, fontSize: "1.1rem" }}>
               Vergabeverstöße haben strenge Fristen: regelmäßig 10 Kalendertage für einen erkannten Verstoß und 15
               Kalendertage nach der Mitteilung, dass der Auftraggeber der Rüge nicht abhilft. Der Antrag wird bei der
               zuständigen Vergabekammer gestellt.
            </Typography>
          </Box>

          <RuegefristRechner />

          {/* Erläuterung */}
          <Paper elevation={0} sx={{ mt: 5, p: { xs: 3, md: 4 }, border: 1, borderColor: "divider" }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Das Rügeprinzip im Vergaberecht (§ 160 GWB)
            </Typography>
            <Typography variant="body1" component="p" sx={{ mb: 2, lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
              Das deutsche Vergaberecht folgt dem <strong>Rügeprinzip</strong>: Wer einen Vergabeverstoß erkennt,
               muss diesen zunächst beim Auftraggeber rügen. Ein Nachprüfungsantrag bei der zuständigen Vergabekammer
               setzt die weiteren Voraussetzungen des § 160 GWB voraus.
            </Typography>
            <Typography variant="body1" component="p" sx={{ mb: 2, lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
               Die gesetzlichen Fristen sind strikt einzuhalten. Versäumnisse können zur Unzulässigkeit des
               Nachprüfungsantrags führen. Weitere Regeln und Ausnahmen stehen in § 160 Abs. 3 GWB, etwa für Verstöße
               aus der Bekanntmachung oder den Vergabeunterlagen.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary" }}>
              <li><strong>§ 160 Abs. 3 Satz 1 Nummer 1 GWB:</strong> zehn Kalendertage für erkannte Verstöße</li>
              <li><strong>§ 160 Abs. 3 Satz 1 Nummer 4 GWB:</strong> 15 Kalendertage nach Mitteilung der Nichtabhilfe</li>
              <li><strong>§ 160 Abs. 3 GWB:</strong> Bekanntmachungs- und Unterlagenfehler müssen spätestens bis zum jeweiligen Fristende gerügt werden</li>
            </Box>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
