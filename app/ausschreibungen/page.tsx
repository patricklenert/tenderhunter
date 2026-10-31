import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Chip } from "@mui/material";
import { MapPin, Calendar } from "lucide-react";
import { SiteBreadcrumbs } from "@/components/seo/SiteBreadcrumbs";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { CATEGORY_CONTENT } from "@/lib/category-content";
import { getLatestTenders } from "@/components/seo/HomeTenderList";
import { PORTALS, ALL_PORTAL_SLUGS } from "@/lib/portal-content";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { getListingRobots, type SeoSearchParams } from "@/lib/seo-indexability";
import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const dynamic = "force-dynamic";

const baseMetadata: Metadata = {
  title: "Ausschreibungen Deutschland – aktuelle Vergaben und Aufträge",
  description:
    "Alle öffentlichen Ausschreibungen in Deutschland nach Kategorie: Bauarbeiten, Tiefbau, IT, Facility Management, Reinigung und mehr. Täglich aktuelle Vergaben und Aufträge der öffentlichen Hand.",
  alternates: { canonical: "/ausschreibungen", languages: { "de-DE": "/ausschreibungen" } },
  openGraph: {
    title: "Ausschreibungen Deutschland – aktuelle Vergaben und Aufträge",
    description:
      "Alle öffentlichen Ausschreibungen in Deutschland nach Kategorie. Täglich aktuelle Vergaben und Aufträge der öffentlichen Hand.",
    type: "website",
    locale: "de_DE",
  },
};

interface PageProps {
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    ...baseMetadata,
    robots: getListingRobots(await searchParams, 1, true),
  };
}

// SEO: FAQ data for the Ausschreibungen hub page — enables FAQPage rich snippets in Google SERP
const HUB_FAQS = [
  {
    q: "Was sind öffentliche Ausschreibungen?",
    a: "Öffentliche Ausschreibungen sind geregelte Vergabeverfahren, bei denen Bund, Länder, Kommunen und öffentliche Unternehmen Aufträge an private Unternehmen vergeben. Ziel ist ein fairer Wettbewerb und das wirtschaftlichste Angebot.",
  },
  {
    q: "Wo finde ich Ausschreibungen in Deutschland?",
    a: "Die wichtigsten Vergabeportale sind DTVP (Deutsches Technologievermittlungsportal), TED (Tenders Electronic Daily für EU-Vergaben), evergabe (elektronische Vergabe) und Bauportal Deutschland. Tenderhunter durchsucht alle diese Quellen automatisch.",
  },
  {
    q: "Welche Arten von Ausschreibungen gibt es?",
    a: "Ausschreibungen gibt es in 13 Leistungsbereichen: Bauarbeiten, Tiefbau, Technische Gebäudeausrüstung, Gebäudereinigung, Winterdienst, Immobilienverwaltung, Facility Management, Grünflächenpflege, Garten- und Landschaftsbau, Planungsleistungen, IT-Dienstleistungen, Lieferung und diverse Leistungen.",
  },
  {
    q: "Wie oft werden neue Ausschreibungen veröffentlicht?",
    a: "Neue Ausschreibungen werden täglich veröffentlicht. Tenderhunter aktualisiert die Datenbank kontinuierlich — Sie können sich auch per RSS-Feed oder E-Mail-Benachrichtigung über neue Vergaben informieren lassen.",
  },
  {
    q: "Sind die Ausschreibungen bei Tenderhunter kostenlos?",
    a: "Ja, Tenderhunter bietet eine kostenlose Testung an. Sie können die Plattform unverbindlich ausprobieren und passende Ausschreibungen für Ihr Unternehmen finden.",
  },
  {
    q: "Für welche Regionen gibt es Ausschreibungen?",
    a: "Tenderhunter deckt alle 16 Bundesländer und über 45 Städte in Deutschland ab. Sie können nach Bundesland, Stadt oder Kategorie filtern — von München über Berlin bis Hamburg.",
  },
];

const hubFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HUB_FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default async function AusschreibungenPage() {
  const latestTenders = await getLatestTenders();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Ausschreibungen",
        item: `${siteUrl}/ausschreibungen`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hubFaqJsonLd) }}
      />

      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          py: { xs: 3, md: 5 },
        }}
      >
        <Container maxWidth="lg">
          {/* SEO: Visible breadcrumbs (JSON-LD already present) */}
          <SiteBreadcrumbs items={[
            { label: "Start", href: "/" },
            { label: "Ausschreibungen" },
          ]} />

          <Typography
            variant="h4"
            component="h1"
            fontWeight={800}
            sx={{
              mb: 2,
              fontSize: { xs: "1.5rem", md: "2.25rem" },
              letterSpacing: "-0.01em",
            }}
          >
            Ausschreibungen in Deutschland
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: "75ch", lineHeight: 1.8, mb: 4 }}
          >
            Finden Sie aktuelle öffentliche Ausschreibungen, Vergabeverfahren
            und Aufträge der öffentlichen Hand in Deutschland. Tenderhunter
            durchsucht automatisch die wichtigsten Vergabeportale – DTVP, TED,
            evergabe, Bauportal Deutschland und weitere. Alle Auftragsbekanntmachungen
            sind nach Leistungsbereichen kategorisiert und täglich aktualisiert.
          </Typography>

          <Stack spacing={2}>
            {Object.entries(CATEGORY_SLUGS).map(([key, slug]) => {
              const label = CATEGORY_LABELS[key] ?? key;
              const content = CATEGORY_CONTENT[key];
              return (
                <Link
                  key={key}
                  href={`/ausschreibungen/${slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Box
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      border: 1,
                      borderColor: "divider",
                      borderLeft: 4,
                      borderLeftColor: "primary.main",
                      borderRadius: 1,
                      transition: "border-color 0.15s",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      component="p"
                      fontWeight={700}
                      sx={{
                        mb: 0.5,
                        fontSize: { xs: "1rem", md: "1.15rem" },
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {label}
                    </Typography>
                    {content && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          lineHeight: 1.7,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {content.intro}
                      </Typography>
                    )}
                  </Box>
                </Link>
              );
            })}
          </Stack>

          {/* Latest Tenders */}
          {latestTenders.length > 0 && (
            <Box sx={{ mt: 5, mb: 5 }}>
              <Typography
                variant="h5"
                component="h2"
                fontWeight={700}
                sx={{ mb: 3 }}
              >
                Aktuelle Ausschreibungen
              </Typography>
              <Stack spacing={1.5}>
                {latestTenders.map((t) => (
                  <Link
                    key={t.id}
                    href={`/ausschreibung/${t.id}/${t.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Box
                      sx={{
                        p: { xs: 1.5, md: 2 },
                        border: 1,
                        borderColor: "divider",
                        borderLeft: 4,
                        borderLeftColor: "primary.main",
                        borderRadius: 1,
                        transition: "border-color 0.15s",
                        "&:hover": { borderColor: "primary.main" },
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        component="h3"
                        fontWeight={600}
                        sx={{ mb: 0.5, fontSize: { xs: "0.9rem", md: "1rem" }, "&:hover": { color: "primary.main" } }}
                      >
                        {t.title}
                      </Typography>
                      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                        <Link href={`/ausschreibungen/${t.categorySlug}`} style={{ textDecoration: "none" }}>
                          <Typography variant="caption" color="primary" fontWeight={600}>
                            {t.categoryLabel}
                          </Typography>
                        </Link>
                        {t.location && (
                          <Stack direction="row" spacing={0.3} alignItems="center">
                            <MapPin size={12} color="#667288" />
                            <Typography variant="caption" color="text.secondary">{t.location}</Typography>
                          </Stack>
                        )}
                        {t.deadline && (
                          <Stack direction="row" spacing={0.3} alignItems="center">
                            <Calendar size={12} color="#667288" />
                            <Typography variant="caption" color="text.secondary">Frist: {t.deadline}</Typography>
                          </Stack>
                        )}
                      </Stack>
                    </Box>
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {/* SEO: Portal source links for internal link equity to portal landing pages */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Ausschreibungen nach Quelle
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {ALL_PORTAL_SLUGS.map((slug) => (
                <Link key={slug} href={`/ausschreibungen/${slug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={PORTALS[slug].label} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* SEO: FAQ section — visible content mirrors FAQPage JSON-LD for rich snippets */}
          <Box sx={{ mt: 5, mb: 5 }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Häufige Fragen zu öffentlichen Ausschreibungen
            </Typography>
            <Stack spacing={1}>
              {HUB_FAQS.map((faq) => (
                <Box key={faq.q} component="details" sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: { xs: 1.5, md: 2 } }}>
                  <Box component="summary" sx={{ cursor: "pointer", fontWeight: 600, fontSize: "0.95rem", listStyle: "none", "&::-webkit-details-marker": { display: "none" } }}>
                    {faq.q}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                    {faq.a}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box sx={{ mt: 5, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Aktuelle Ausschreibungen auch per{" "}
              <Link
                href="/feeds/tender.xml"
                style={{
                  color: "inherit",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                RSS-Feed
              </Link>{" "}
              abonnieren.
            </Typography>
          </Box>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
