import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Chip } from "@mui/material";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 24px",
  borderRadius: 12,
  fontWeight: 700,
  textDecoration: "none",
  fontSize: "0.875rem",
  lineHeight: 1.5,
};

export default function NotFound() {
  const topCategories = [
    "Bauarbeiten",
    "Tiefbau",
    "Facility Management",
    "Gebaeudereinigung",
    "IT-Dienstleistungen",
  ];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Typography
            variant="h1"
            fontWeight={800}
            sx={{
              fontSize: { xs: "2.5rem", md: "4rem" },
              letterSpacing: "-0.03em",
              mb: 2,
              color: "text.primary",
            }}
          >
            404
          </Typography>
          <Typography
            variant="h4"
            component="h2"
            fontWeight={700}
            sx={{
              fontSize: { xs: "1.25rem", md: "1.75rem" },
              mb: 2,
            }}
          >
            Seite nicht gefunden
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: "55ch", mx: "auto", lineHeight: 1.7 }}
          >
            Die gesuchte Ausschreibungsseite existiert nicht oder wurde entfernt.
            Besuchen Sie unsere aktuellen öffentlichen Ausschreibungen und
            Vergabeverfahren in Deutschland.
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 5 }}
        >
          <Link
            href="/"
            style={{
              ...btnBase,
              backgroundColor: "var(--mui-palette-primary-main)",
              color: "#fff",
            }}
          >
            Zur Startseite
          </Link>
          <Link
            href="/ausschreibungen"
            style={{
              ...btnBase,
              border: "1px solid var(--mui-palette-primary-main)",
              color: "var(--mui-palette-primary-main)",
            }}
          >
            Alle Ausschreibungen
          </Link>
          <Link
            href="/funktionen"
            style={{
              ...btnBase,
              border: "1px solid var(--mui-palette-divider)",
              color: "var(--mui-palette-text-primary)",
            }}
          >
            Funktionen
          </Link>
          <Link
            href="/wissen"
            style={{
              ...btnBase,
              border: "1px solid var(--mui-palette-divider)",
              color: "var(--mui-palette-text-primary)",
            }}
          >
            Wissen
          </Link>
        </Stack>

        <Box>
          <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
            Beliebte Ausschreibungskategorien
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {topCategories.map((cat) => {
              const slug = CATEGORY_SLUGS[cat];
              if (!slug) return null;
              const label = CATEGORY_LABELS[cat] ?? cat;
              return (
                <Link
                  key={cat}
                  href={`/ausschreibungen/${slug}`}
                  style={{ textDecoration: "none" }}
                >
                  <Chip
                    clickable
                    label={label}
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </Link>
              );
            })}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
