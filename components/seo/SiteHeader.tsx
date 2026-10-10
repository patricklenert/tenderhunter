// SEO: Server-seitige Header-Navigation für alle öffentlichen Seiten.
// Verbessert Crawl-Pfad und Link-Equity-Verteilung — Google crawlt von oben nach unten,
// daher erhalten Header-Links mehr Gewicht als Footer-Links.
// Server component — kein "use client", kein JavaScript-Bundle.
import Link from "next/link";
import { Box, Container, Typography } from "@mui/material";

// Top-5 Kategorien nach SEO-Priorität (hohes Suchvolumen + starke Landingpages)
const TOP_NAV_CATEGORIES = [
  { label: "Bauarbeiten", href: "/ausschreibungen/bauarbeiten" },
  { label: "IT-Dienstleistungen", href: "/ausschreibungen/it-dienstleistungen" },
  { label: "Facility Management", href: "/ausschreibungen/facility-management" },
  { label: "Gebäudereinigung", href: "/ausschreibungen/gebaeudereinigung" },
  { label: "Lieferung", href: "/ausschreibungen/lieferung" },
];

export function SiteHeader() {
  return (
    <Box
      component="header"
      aria-hidden="true"
      sx={{
        position: "absolute",
        left: "-9999px",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <Container maxWidth="lg">
        {/* Hauptzeile: Logo + primäre Navigation */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Link href="/" tabIndex={-1} style={{ textDecoration: "none", color: "inherit" }}>
            <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
              Tenderhunter
            </Typography>
          </Link>

          {/* Primäre Navigation — crawlable <Link> anchors */}
          <Box
            component="nav"
            aria-label="Hauptnavigation"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 1.5, md: 2.5 },
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/ausschreibungen"
              tabIndex={-1}
              style={{
                textDecoration: "none",
                color: "#374151",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              Ausschreibungen
            </Link>
            {TOP_NAV_CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                tabIndex={-1}
                style={{
                  textDecoration: "none",
                  color: "#667288",
                  fontSize: "0.825rem",
                }}
              >
                {cat.label}
              </Link>
            ))}
            <Link
              href="/wissen"
              tabIndex={-1}
              style={{
                textDecoration: "none",
                color: "#667288",
                fontSize: "0.825rem",
              }}
            >
              Wissen
            </Link>
            <Link
              href="/funktionen"
              tabIndex={-1}
              style={{
                textDecoration: "none",
                color: "#667288",
                fontSize: "0.825rem",
              }}
            >
              Funktionen
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
