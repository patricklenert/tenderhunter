import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Breadcrumbs, Paper } from "@mui/material";
import { Home as HomeIcon, Gavel } from "lucide-react";
import RuegefristRechner from "@/components/tools/RuegefristRechner";
import { SiteFooter } from "@/components/seo/SiteFooter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Rügefrist-Rechner – § 160 GWB Fristen exakt berechnen",
  description:
    "Kostenloser Rügefrist-Rechner nach § 160 GWB: Berechnen Sie die 14-Tage-Rügefrist und die 15-Tage-Nachprüfungsantragsfrist inkl. Wochenend-Verlängerung nach § 193 BGB.",
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
          text: "Nach § 160 Abs. 3 Satz 1 GWB beträgt die Rügefrist 14 Kalendertage ab Kenntnis des Vergabeverstoßes. Fällt der letzte Tag auf ein Wochenende oder Feiertag, verlängert sich die Frist auf den nächsten Werktag (§ 193 BGB).",
        },
      },
      {
        "@type": "Question",
        name: "Wie lange habe ich für den Nachprüfungsantrag beim Vergabesenat?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Nach § 160 Abs. 3 Satz 4 GWB haben Sie 15 Kalendertage ab Eingang der Mitteilung des Auftraggebers, der Rüge nicht abzuhelfen. Alternativ endet die Frist spätestens 15 Kalendertage nach Ablauf der Stillhaltefrist (Zuschlagserteilung).",
        },
      },
      {
        "@type": "Question",
        name: "Was passiert, wenn ich die Rügefrist verstreichen lasse?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Verstreichene Rügefristen führen zur Unzulässigkeit des Nachprüfungsantrags (§ 160 Abs. 3 Satz 1 GWB). Der Vergabeverstoß kann dann nicht mehr gerichtlich geltend gemacht werden – es sei denn, eine Ausnahme nach § 160 Abs. 3 Satz 1 lit. a-e GWB greift.",
        },
      },
      {
        "@type": "Question",
        name: "Muss ich immer erst rügen, bevor ich Nachprüfung beantrage?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ja, grundsätzlich herrscht Rügeobliegenheit. Ausnahmen bestehen nur, wenn der Auftraggeber nicht über die Zuschlagserteilung informiert hat, die Frist für die Information unzumutbar verkürzt wurde, oder weitere Ausnahmen nach § 160 Abs. 3 Satz 1 lit. a-e GWB vorliegen.",
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
      "Berechnen Sie die Rügefrist (14 Tage) und Nachprüfungsantragsfrist (15 Tage) nach § 160 GWB inkl. Wochenend-Verlängerung.",
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
            <Typography color="text.primary" fontSize="0.85rem">Rügefrist-Rechner</Typography>
          </Breadcrumbs>

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
              Vergabeverstöße haben strenge Fristen: 14 Kalendertage für die Rüge, 15 Kalendertage für den
              Nachprüfungsantrag beim Vergabesenat. Berechnen Sie beide Fristen inkl. Wochenend-Verlängerung nach
              § 193 BGB.
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
              muss diesen zunächst beim Auftraggeber rügen. Erst wenn der Auftraggeber die Rüge ablehnt, kann der
              Vergabenachprüfungsantrag bei der zuständigen Vergabekammer gestellt werden.
            </Typography>
            <Typography variant="body1" component="p" sx={{ mb: 2, lineHeight: 1.8, color: "text.secondary", maxWidth: "75ch" }}>
              Die Fristen sind <strong>absolut</strong>: Eine Verlängerung gibt es nicht. Versäumnisse führen zur
              Unzulässigkeit des Nachprüfungsantrags – der Vergabeverstoß kann dann nicht mehr gerichtlich verfolgt
              werden. Ausnahmen sind in § 160 Abs. 3 Satz 1 lit. a-e GWB geregelt (z. B. fehlende Information über
              die Zuschlagserteilung).
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary" }}>
              <li><strong>§ 160 Abs. 3 Satz 1 GWB:</strong> Rügefrist 14 Kalendertage</li>
              <li><strong>§ 160 Abs. 3 Satz 4 GWB:</strong> Nachprüfungsantragsfrist 15 Kalendertage</li>
              <li><strong>§ 193 BGB:</strong> Wochenende/Feiertag → nächster Werktag</li>
            </Box>
          </Paper>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
