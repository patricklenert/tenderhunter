import type { Metadata } from "next";
import { Box, Container, Typography } from "@mui/material";
import { InteractiveApp } from "@/components/seo/InteractiveApp";
import { HomeTenderList } from "@/components/seo/HomeTenderList";
import { SeoFooter } from "@/components/seo/SeoFooter";

export const metadata: Metadata = {
  title: { absolute: "Tenderhunter – KI-Ausschreibungssoftware für deutsche Unternehmen" },
  description:
    "Finden Sie automatisch passende öffentliche Ausschreibungen in Deutschland. KI analysiert Anforderungen, Ihre Unternehmenswebsite wird gescannt, täglich passende Projekte.",
  alternates: {
    canonical: "/",
    languages: { "de-DE": "/" },
    types: {
      "application/rss+xml": `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com"}/feeds/tender.xml`,
    },
  },
  openGraph: {
    title: "Tenderhunter – KI-Ausschreibungssoftware",
    description:
      "Deutsche Ausschreibungsportale automatisch durchsuchen. KI-gestütztes Matching für Ihr Unternehmen.",
    type: "website",
    locale: "de_DE",
  },
};

export default function HomePage() {
  return (
    <>
      <Box
        component="section"
        sx={{
          pt: { xs: 4, md: 6 },
          pb: { xs: 2, md: 3 },
          textAlign: "center",
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h2"
            component="h1"
            fontWeight={800}
            sx={{
              fontSize: { xs: "1.75rem", md: "2.5rem" },
              letterSpacing: "-0.02em",
              mb: 1.5,
            }}
          >
            Ausschreibungen finden &amp; automatisch passende Projekte erhalten
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: "65ch", mx: "auto", lineHeight: 1.7 }}
          >
            Tenderhunter durchsucht automatisch deutsche Vergabeportale wie DTVP, TED
            und evergabe. Ihre Unternehmenswebsite wird gescannt, passende öffentliche
            Ausschreibungen werden täglich per KI-Matching mit Fit-Score geliefert.
          </Typography>
        </Container>
      </Box>
      <HomeTenderList />
      <InteractiveApp />
      <SeoFooter />
    </>
  );
}
