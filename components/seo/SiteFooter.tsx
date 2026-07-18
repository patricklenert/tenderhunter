// SEO: Site-wide footer with internal links for improved crawl depth and PageRank flow.
// Renders on all public pages. Server component — no "use client".
import Link from "next/link";
import { Box, Container, Typography, Stack } from "@mui/material";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { ALL_PORTAL_SLUGS, PORTALS } from "@/lib/portal-content";

const TOP_REGIONS = [
  "Bayern",
  "Nordrhein-Westfalen",
  "Baden-Württemberg",
  "Hessen",
  "Niedersachsen",
  "Sachsen",
  "Berlin",
  "Hamburg",
];

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export function SiteFooter({ containerMaxWidth = "lg" }: { containerMaxWidth?: string }) {
  const isMuiBreakpoint = ["xs", "sm", "md", "lg", "xl", false].includes(containerMaxWidth as string);
  return (
    <Box
      component="footer"
      sx={{ bgcolor: "grey.50", borderTop: 1, borderColor: "divider", mt: 8, py: { xs: 4, md: 5 } }}
    >
      <Container
        maxWidth={isMuiBreakpoint ? (containerMaxWidth as "lg") : false}
        sx={isMuiBreakpoint ? {} : { maxWidth: containerMaxWidth, mx: "auto" }}
      >
      <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 3, md: 5 }}
          flexWrap="wrap"
          useFlexGap
        >
          {/* Categories */}
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Ausschreibungen nach Kategorie
            </Typography>
            <Stack spacing={0.5}>
              {Object.entries(CATEGORY_SLUGS).map(([key, slug]) => (
                <Link
                  key={slug}
                  href={`/ausschreibungen/${slug}`}
                  style={{ color: "#667288", textDecoration: "none", fontSize: "0.85rem" }}
                >
                  {CATEGORY_LABELS[key] ?? key}
                </Link>
              ))}
            </Stack>
          </Box>

          {/* Regions */}
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Ausschreibungen nach Region
            </Typography>
            <Stack spacing={0.5}>
              {TOP_REGIONS.map((region) => (
                <Link
                  key={region}
                  href={`/ausschreibungen/region/${BUNDESLAND_SLUGS[region]}`}
                  style={{ color: "#667288", textDecoration: "none", fontSize: "0.85rem" }}
                >
                  {region}
                </Link>
              ))}
            </Stack>
          </Box>

          {/* Portals + Info */}
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Vergabeportale
            </Typography>
            <Stack spacing={0.5}>
              {ALL_PORTAL_SLUGS.map((slug) => (
                <Link
                  key={slug}
                  href={`/ausschreibungen/${slug}`}
                  style={{ color: "#667288", textDecoration: "none", fontSize: "0.85rem" }}
                >
                  {PORTALS[slug]?.label ?? slug}
                </Link>
              ))}
            </Stack>

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, mt: 2.5 }}>
              Informationen
            </Typography>
            <Stack spacing={0.5}>
              <Link href="/wissen" style={{ color: "#667288", textDecoration: "none", fontSize: "0.85rem" }}>
                Wissen & Ratgeber
              </Link>
              <Link href="/funktionen" style={{ color: "#667288", textDecoration: "none", fontSize: "0.85rem" }}>
                Funktionen
              </Link>
              <Link href="/feeds/tender.xml" style={{ color: "#667288", textDecoration: "none", fontSize: "0.85rem" }}>
                RSS-Feed
              </Link>
              <Link href="/impressum" style={{ color: "#667288", textDecoration: "none", fontSize: "0.85rem" }}>
                Impressum
              </Link>
            </Stack>
          </Box>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 4, display: "block" }}>
          © {new Date().getFullYear()} Tenderhunter – KI-gestützte Ausschreibungssuche für Deutschland
        </Typography>
      </Container>
    </Box>
  );
}
