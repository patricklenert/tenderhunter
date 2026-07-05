import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Divider } from "@mui/material";
import {
  Search,
  Brain,
  Target,
  ArrowRight,
  FileText,
  Bell,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { SiteFooter } from "@/components/seo/SiteFooter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const metadata: Metadata = {
  title: "Funktionen – KI-Ausschreibungssoftware für deutsche Unternehmen",
  description:
    "Automatische Suche in deutschen Vergabeportalen, KI-Analyse von Anforderungen, intelligentes Matching mit Fit-Score. So funktioniert Tenderhunter.",
  alternates: { canonical: "/funktionen", languages: { "de-DE": "/funktionen" } },
  openGraph: {
    title: "Funktionen – Tenderhunter KI-Ausschreibungssoftware",
    description:
      "Automatische Ausschreibungssuche, KI-Analyse, Unternehmens-Scanner und intelligentes Matching.",
    type: "website",
    locale: "de_DE",
  },
};

const features = [
  {
    icon: Search,
    title: "Automatische Ausschreibungssuche",
    description:
      "Tenderhunter durchsucht täglich die wichtigsten deutschen Vergabeportale: DTVP, TED, evergabe, Bauportal Deutschland, Bundesimmobilien und Niedersachsen. Neue Ausschreibungen werden automatisch erfasst, kategorisiert und auf Deutschland gefiltert.",
    points: [
      "6+ Vergabeportale werden automatisch überwacht",
      "Filterung nach deutschen Ausschreibungen (Sprach- und Ländertest)",
      "Automatische Kategorisierung in 13 Leistungsbereiche",
    ],
  },
  {
    icon: Brain,
    title: "KI-Analyse von Ausschreibungsanforderungen",
    description:
      "Jede Ausschreibung wird per KI strukturiert extrahiert: Auftraggeber, Leistungsbeschreibung, Eignungskriterien, Fristen, Zuschlagskriterien und Vertragslaufzeit. So sehen Sie auf einen Blick, ob sich eine Bewerbung lohnt.",
    points: [
      "Strukturierte Aufbereitung aus PDFs und Webseiten",
      "Extraktion von Eignungskriterien und Referenzanforderungen",
      "Zuschlagskriterien und Gewichtung werden automatisch erkannt",
    ],
  },
  {
    icon: Target,
    title: "Intelligentes Matching mit Fit-Score",
    description:
      "Scannen Sie Ihre Unternehmenswebsite – Tenderhunter analysiert Ihre Leistungen und vergleicht sie mit allen offenen Ausschreibungen. Der Fit-Score zeigt Ihnen sofort, welche Projekte am besten zu Ihnen passen.",
    points: [
      "Automatisches Profiling Ihrer Unternehmenswebsite",
      "Fit-Score basierend auf Leistungsspektrum, Region und Unternehmensgröße",
      "Sortierung nach Relevanz statt nur nach Datum",
    ],
  },
];

const steps = [
  {
    n: 1,
    title: "Unternehmenswebsite scannen",
    description:
      "Geben Sie Ihre Website-URL ein. Tenderhunter analysiert automatisch Ihre Leistungen, Region und Spezialisierung.",
  },
  {
    n: 2,
    title: "Passende Ausschreibungen erhalten",
    description:
      "Die KI vergleicht Ihr Profil mit allen offenen Ausschreibungen und erstellt einen Fit-Score für jede einzelne.",
  },
  {
    n: 3,
    title: "Gezielt bewerben",
    description:
      "Sehen Sie Details, Anforderungen und Fristen. Bewerben Sie sich nur auf Ausschreibungen mit hohem Fit-Score.",
  },
];

const faqs = [
  {
    q: "Wie funktioniert das Matching zwischen Unternehmen und Ausschreibungen?",
    a: "Tenderhunter scannt Ihre Unternehmenswebsite und erstellt ein strukturiertes Profil Ihrer Leistungen. Dieses Profil wird mit den Anforderungen jeder Ausschreibung verglichen – basierend auf Leistungsspektrum (40%), Region (15%), Auftragsgröße (10%) und Domain-Übereinstimmung (35%). Der resultierende Fit-Score hilft Ihnen, Ausschreibungen zu priorisieren.",
  },
  {
    q: "Welche Vergabeportale werden durchsucht?",
    a: "Aktuell durchsucht Tenderhunter automatisch DTVP (Deutsches Tenderportal), TED (Tenders Electronic Daily), evergabe.de, Bauportal Deutschland, Bundesimmobilien und das Vergabeportal Niedersachsen. Neue Quellen werden regelmäßig hinzugefügt.",
  },
  {
    q: "Ist Tenderhunter kostenlos?",
    a: "Ja, die grundlegende Nutzung von Tenderhunter ist kostenlos. Sie können Ihre Unternehmenswebsite analysieren lassen und passende Ausschreibungen einsehen. Erweiterte Funktionen wie automatische Alerts und API-Zugriff können kostenpflichtig sein.",
  },
  {
    q: "Wie aktuell sind die Ausschreibungen?",
    a: "Die Vergabeportale werden mehrmals täglich gescannt. Neue Ausschreibungen erscheinen in der Regel innerhalb weniger Stunden im System. Jede Ausschreibung zeigt die Originalquelle und die Einreichungsfrist.",
  },
  {
    q: "Kann ich Tenderhunter per API nutzen?",
    a: "Ja, Tenderhunter bietet eine REST-API unter /api/v1/analyze an. Sie können die Analyse programmatisch anstoßen und den Status asynchron abfragen. Die API-Authentifizierung erfolgt über einen API-Key.",
  },
];

export default function FunktionenPage() {
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
      {
        "@type": "ListItem",
        position: 2,
        name: "Funktionen",
        item: `${siteUrl}/funktionen`,
      },
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

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        {/* Hero */}
        <Box sx={{ py: { xs: 6, md: 8 }, textAlign: "center" }}>
          <Container maxWidth="md">
            <Typography
              variant="h1"
              fontWeight={800}
              sx={{
                fontSize: { xs: "1.75rem", md: "2.75rem" },
                letterSpacing: "-0.02em",
                mb: 2,
                lineHeight: 1.15,
              }}
            >
              So funktioniert Tenderhunter
            </Typography>
            <Typography
              variant="h5"
              component="p"
              color="text.secondary"
              sx={{
                fontSize: { xs: "1rem", md: "1.2rem" },
                lineHeight: 1.6,
                maxWidth: "60ch",
                mx: "auto",
              }}
            >
              Drei Schritte zu den passenden Ausschreibungen: Website scannen,
              Matching erhalten, gezielt bewerben.
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
                px: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                textDecoration: "none",
                mt: 3,
                fontSize: "1.05rem",
                "&:hover": { opacity: 0.88 },
              }}
            >
              Jetzt kostenlos starten
              <ArrowRight size={18} />
            </Box>
          </Container>
        </Box>

        {/* Features */}
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
          <Stack spacing={6}>
            {features.map((feature, idx) => (
              <Box key={idx}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={4}
                  alignItems="flex-start"
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      bgcolor: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <feature.icon size={28} color="#fff" />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h4"
                      component="h2"
                      fontWeight={700}
                      sx={{ mb: 1.5, fontSize: { xs: "1.25rem", md: "1.5rem" } }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{ lineHeight: 1.7, mb: 2, maxWidth: "70ch" }}
                    >
                      {feature.description}
                    </Typography>
                    <Stack spacing={1}>
                      {feature.points.map((point, pi) => (
                        <Stack
                          key={pi}
                          direction="row"
                          spacing={1}
                          alignItems="flex-start"
                        >
                          <CheckCircle2
                            size={18}
                            color="primary.main"
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ lineHeight: 1.6 }}
                          >
                            {point}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
                {idx < features.length - 1 && <Divider sx={{ mt: 6 }} />}
              </Box>
            ))}
          </Stack>
        </Container>

        {/* How It Works */}
        <Box sx={{ bgcolor: "grey.50", py: { xs: 6, md: 8 } }}>
          <Container maxWidth="lg">
            <Typography
              variant="h2"
              component="h2"
              fontWeight={800}
              textAlign="center"
              sx={{ mb: 5, fontSize: { xs: "1.5rem", md: "2rem" } }}
            >
              In 3 Schritten zur passende Ausschreibung
            </Typography>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={4}
              justifyContent="center"
            >
              {steps.map((step) => (
                <Box
                  key={step.n}
                  sx={{
                    flex: 1,
                    maxWidth: 350,
                    textAlign: "center",
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mx: "auto",
                      mb: 2,
                      fontWeight: 800,
                      fontSize: "1.3rem",
                    }}
                  >
                    {step.n}
                  </Box>
                  <Typography
                    variant="h6"
                    component="h3"
                    fontWeight={700}
                    sx={{ mb: 1 }}
                  >
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {step.description}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Container>
        </Box>

        {/* FAQ */}
        <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>
          <Typography
            variant="h2"
            component="h2"
            fontWeight={800}
            sx={{ mb: 4, fontSize: { xs: "1.5rem", md: "2rem" } }}
          >
            Häufige Fragen
          </Typography>
          <Stack spacing={3}>
            {faqs.map((faq, idx) => (
              <Box key={idx}>
                <Typography
                  variant="h6"
                  component="h3"
                  fontWeight={600}
                  sx={{ mb: 1, fontSize: "1.05rem" }}
                >
                  {faq.q}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ lineHeight: 1.7 }}
                >
                  {faq.a}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Container>

        {/* CTA */}
        <Box
          sx={{
            py: { xs: 5, md: 7 },
            textAlign: "center",
            bgcolor: "primary.main",
          }}
        >
          <Container maxWidth="sm">
            <Typography
              variant="h4"
              component="h2"
              fontWeight={800}
              sx={{ color: "#fff", mb: 1.5, fontSize: { xs: "1.5rem", md: "2rem" } }}
            >
              Bereit, passende Ausschreibungen zu finden?
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.85)", mb: 3, fontSize: "1.05rem" }}>
              Scannen Sie Ihre Website und sehen Sie sofort offene Projekte.
            </Typography>
            <Box
              component="a"
              href="/#app"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "#fff",
                color: "primary.main",
                px: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                textDecoration: "none",
                fontSize: "1.05rem",
                "&:hover": { opacity: 0.9 },
              }}
            >
              Jetzt Website analysieren
              <ArrowRight size={18} />
            </Box>
          </Container>
        </Box>
      </Box>
      <SiteFooter />
    </>
  );
}
