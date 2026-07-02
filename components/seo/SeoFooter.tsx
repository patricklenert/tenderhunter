import Link from "next/link";
import { Box, Container, Typography, Stack, Divider } from "@mui/material";
import { ArrowRight } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { BUNDESLAND_SLUGS } from "@/lib/bundesland";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

const faqs = [
  {
    q: "Was ist Tenderhunter?",
    a: "Tenderhunter ist eine KI-gestützte Ausschreibungssoftware, die automatisch deutsche Vergabeportale durchsucht, Ausschreibungen strukturiert aufbereitet und mit Ihrem Unternehmensprofil abgleicht. So finden Sie schnell die für Sie relevanten öffentlichen Aufträge.",
  },
  {
    q: "Welche Arten von Ausschreibungen werden gefunden?",
    a: "Tenderhunter deckt 13 Leistungsbereiche ab – von Bauarbeiten, Tiefbau und technischer Gebäudeausrüstung über Gebäudereinigung, Winterdienst und Facility Management bis hin zu Planungsleistungen, IT-Dienstleistungen und Materiallieferungen.",
  },
  {
    q: "Wie funktioniert das Matching mit meinem Unternehmen?",
    a: "Sie geben Ihre Unternehmenswebsite ein. Tenderhunter analysiert Ihre Leistungen und vergleicht sie mit allen offenen Ausschreibungen. Ein Fit-Score zeigt Ihnen an, wie gut jede Ausschreibung zu Ihrem Profil passt.",
  },
];

export function SeoFooter() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Box
        component="section"
        sx={{
          bgcolor: "grey.50",
          borderTop: 1,
          borderColor: "divider",
          py: { xs: 5, md: 7 },
        }}
      >
        <Container maxWidth="lg">
          {/* H2 for SEO (H1 is in page hero) */}
          <Typography
            variant="h2"
            component="h2"
            fontWeight={800}
            sx={{
              fontSize: { xs: "1.5rem", md: "2rem" },
              letterSpacing: "-0.02em",
              mb: 2,
            }}
          >
            KI-Ausschreibungssoftware für deutsche Unternehmen
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: "70ch", lineHeight: 1.8, mb: 4 }}
          >
            Tenderhunter durchsucht automatisch die wichtigsten deutschen
            Vergabeportale – DTVP, TED, evergabe, Bauportal Deutschland und
            weitere. Finden Sie öffentliche Ausschreibungen, die zu Ihren
            Leistungen passen, mit KI-gestütztem Matching und Fit-Score. Statt
            täglich mehrere Portale manuell zu durchsuchen, scannen Sie einfach
            Ihre Unternehmenswebsite und erhalten automatisch die relevanten
            Aufträge der öffentlichen Hand.
          </Typography>

          {/* Category Links */}
          <Typography
            variant="h6"
            component="h2"
            fontWeight={700}
            sx={{ mb: 2 }}
          >
            Ausschreibungen nach Branche
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
            {Object.entries(CATEGORY_SLUGS).map(([cat, slug]) => {
              const label = CATEGORY_LABELS[cat] ?? cat;
              return (
                <Link
                  key={cat}
                  href={`/ausschreibungen/${slug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: "inline-block",
                      px: 2,
                      py: 0.75,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "text.primary",
                      cursor: "pointer",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    {label}
                  </Box>
                </Link>
              );
            })}
          </Stack>

          {/* Region Links — SEO internal linking for Bundesland landing pages */}
          <Typography
            variant="h6"
            component="h2"
            fontWeight={700}
            sx={{ mb: 2 }}
          >
            Ausschreibungen nach Region
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
            {Object.entries(BUNDESLAND_SLUGS).map(([bundesland, slug]) => (
              <Link
                key={bundesland}
                href={`/ausschreibungen/region/${slug}`}
                style={{ textDecoration: "none" }}
              >
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    px: 2,
                    py: 0.75,
                    borderRadius: 1.5,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "text.primary",
                    cursor: "pointer",
                    "&:hover": { borderColor: "primary.main" },
                  }}
                >
                  {bundesland}
                </Box>
              </Link>
            ))}
          </Stack>

          {/* Functions Link */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              mb: 4,
            }}
          >
            <Link
              href="/ausschreibungen"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "primary.main",
                fontWeight: 600,
              }}
            >
              Alle Kategorien ansehen
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/funktionen"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "primary.main",
                fontWeight: 600,
              }}
            >
              Alle Funktionen ansehen
              <ArrowRight size={16} />
            </Link>
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* FAQ */}
          <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
            Häufige Fragen
          </Typography>
          <Stack spacing={2.5} sx={{ maxWidth: "70ch" }}>
            {faqs.map((faq, idx) => (
              <Box key={idx}>
                <Typography variant="subtitle1" component="h3" fontWeight={600} sx={{ mb: 0.5 }}>
                  {faq.q}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {faq.a}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>
    </>
  );
}
