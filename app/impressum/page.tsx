import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Breadcrumbs } from "@mui/material";
import { Home as HomeIcon } from "lucide-react";
import { SiteFooter } from "@/components/seo/SiteFooter";

// SEO: Impressum is legally required in Germany (TMG §5) but not SEO-relevant — noindex to conserve crawl budget
export const metadata: Metadata = {
  title: "Impressum",
  robots: { index: false, follow: true },
};

export default function ImpressumPage() {
  return (
    <>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} /> Start
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">Impressum</Typography>
          </Breadcrumbs>

          <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 3 }}>
            Impressum
          </Typography>

          <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8, color: "text.secondary" }}>
            Angaben gemäß §5 TMG
          </Typography>

          <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
            Tenderhunter
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8, color: "text.secondary" }}>
            [Vollständige Adresse des Betreibers]<br />
            [PLZ Ort]
          </Typography>

          <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
            Kontakt
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8, color: "text.secondary" }}>
            E-Mail: [E-Mail-Adresse]<br />
            Telefon: [Telefonnummer]
          </Typography>

          <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
            Verantwortlich für den Inhalt nach §55 Abs.2 RStV
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8, color: "text.secondary" }}>
            [Name des Verantwortlichen]<br />
            [Adresse]
          </Typography>

          <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
            Haftungsausschluss
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8, color: "text.secondary" }}>
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
          </Typography>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
