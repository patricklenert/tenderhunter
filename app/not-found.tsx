import type { Metadata } from "next";
import Link from "next/link";
import { Box, Button, Container, Typography, Stack, Chip } from "@mui/material";
import { BrandLockup } from "@/components/BrandLockup";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: null },
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
    <Box
      component="main"
      aria-labelledby="not-found-title"
      sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 6, md: 10 } }}
    >
      <Container maxWidth="md">
        <Box sx={{ mb: 4 }}>
          <Link
            href="/"
            aria-label="Tenderhunter, zur Startseite"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              textDecoration: "none",
            }}
          >
            <BrandLockup size={36} labelSize={20} gap={12} />
          </Link>
        </Box>

        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Typography
            variant="h1"
            fontWeight={800}
            sx={{
              fontSize: { xs: "2.5rem", md: "4rem" },
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
              mb: 2,
              color: "text.primary",
            }}
          >
            404
          </Typography>
          <Typography
            variant="h4"
            component="h2"
            id="not-found-title"
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
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="center"
          alignItems={{ xs: "stretch", sm: "center" }}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 5 }}
        >
          <Link href="/" passHref legacyBehavior>
            <Button component="a" variant="contained" disableElevation>
              Zur Startseite
            </Button>
          </Link>
          <Link href="/ausschreibungen" passHref legacyBehavior>
            <Button component="a" variant="outlined" color="primary">
              Alle Ausschreibungen
            </Button>
          </Link>
          <Link href="/funktionen" passHref legacyBehavior>
            <Button component="a" variant="outlined" color="secondary">
              Funktionen
            </Button>
          </Link>
          <Link href="/wissen" passHref legacyBehavior>
            <Button component="a" variant="outlined" color="secondary">
              Wissen
            </Button>
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
                <Link key={cat} href={`/ausschreibungen/${slug}`} passHref legacyBehavior>
                  <Chip
                    component="a"
                    clickable
                    label={label}
                    variant="outlined"
                    sx={{ fontWeight: 500, minHeight: 44 }}
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
