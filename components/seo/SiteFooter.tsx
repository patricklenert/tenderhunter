// SEO: Site-wide footer with internal links for improved crawl depth and PageRank flow.
// Renders on all public pages. Server component — no "use client".
import Link from "next/link";
import { Box, Container, Typography, Stack } from "@mui/material";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/BrandLockup";
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

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="public-footer-link">{children}</Link>;
}

export function SiteFooter({ containerMaxWidth = "lg" }: { containerMaxWidth?: string }) {
  const isMuiBreakpoint = ["xs", "sm", "md", "lg", "xl", false].includes(containerMaxWidth as string);
  return (
    <Box
      component="footer"
      sx={{ bgcolor: "background.paper", borderTop: 1, borderColor: "divider", mt: 8, py: { xs: 4, md: 5 } }}
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
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <Link href="/" aria-label="Tenderhunter Startseite" className="public-footer-brand-link">
              <BrandLockup size={32} labelSize={18} gap={8} />
            </Link>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: "28ch" }}>
              Öffentliche Aufträge. Früh erkannt. Klar bewertet.
            </Typography>
          </Box>

          {/* Categories */}
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Ausschreibungen nach Kategorie
            </Typography>
            <Stack spacing={0.5}>
              {Object.entries(CATEGORY_SLUGS).map(([key, slug]) => (
                <FooterLink key={slug} href={`/ausschreibungen/${slug}`}>
                  {CATEGORY_LABELS[key] ?? key}
                </FooterLink>
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
                <FooterLink key={region} href={`/ausschreibungen/region/${BUNDESLAND_SLUGS[region]}`}>
                  {region}
                </FooterLink>
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
                <FooterLink key={slug} href={`/ausschreibungen/${slug}`}>
                  {PORTALS[slug]?.label ?? slug}
                </FooterLink>
              ))}
            </Stack>

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, mt: 2.5 }}>
              Informationen
            </Typography>
            <Stack spacing={0.5}>
              <FooterLink href="/wissen">
                Wissen & Ratgeber
              </FooterLink>
              <FooterLink href="/lexikon">
                Vergabelexikon
              </FooterLink>
              <FooterLink href="/funktionen">
                Funktionen
              </FooterLink>
              <FooterLink href="/feeds/tender.xml">
                RSS-Feed
              </FooterLink>
              <FooterLink href="/impressum">
                Impressum
              </FooterLink>
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
