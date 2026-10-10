import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper, Breadcrumbs, Chip, Divider } from "@mui/material";
import { Home as HomeIcon, ArrowRight, Factory, FileText, Scale, AlertTriangle, Wrench } from "lucide-react";
import { BRANCHE_MAP, ALL_BRANCHE_SLUGS, BRANCHEN } from "@/lib/branchen";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { decodeRouteParam } from "@/lib/route-params";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;
export const dynamicParams = false;
export const runtime = "nodejs";

export async function generateStaticParams() {
  return ALL_BRANCHE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const entry = BRANCHE_MAP[slug];
  if (!entry) return { title: "Branche nicht gefunden", robots: { index: false, follow: true } };

  const canonicalPath = `/branchen/${entry.slug}`;

  return {
    title: entry.metaTitle,
    description: entry.metaDescription,
    alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
    openGraph: {
      title: entry.metaTitle,
      description: entry.metaDescription,
      type: "article",
      locale: "de_DE",
    },
  };
}

export default async function BrancheEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const entry = BRANCHE_MAP[slug];
  if (!entry) notFound();

  const relatedEntries = BRANCHEN.filter((b) => b.slug !== entry.slug).slice(0, 4);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Branchen", item: `${siteUrl}/branchen` },
      { "@type": "ListItem", position: 3, name: entry.name, item: `${siteUrl}/branchen/${entry.slug}` },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entry.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} /> Start
            </Link>
            <Link href="/branchen" style={{ color: "#667288", textDecoration: "none" }}>
              Branchen
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">{entry.name}</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Factory size={18} color="#e9644d" />
              <Link href="/branchen" style={{ textDecoration: "none" }}>
                <Typography fontSize="0.85rem" fontWeight={600} color="primary">
                  Branchen-Übersicht
                </Typography>
              </Link>
            </Stack>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              {entry.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8, fontSize: "1.1rem" }}>
              {entry.metaDescription}
            </Typography>
          </Box>

          {/* Intro */}
          <Box sx={{ mb: 4 }}>
            {entry.intro.map((para, i) => (
              <Typography key={i} variant="body1" component="p" sx={{ mb: 2, maxWidth: "75ch", lineHeight: 1.8, color: "text.secondary" }}>
                {para}
              </Typography>
            ))}
          </Box>

          {/* Quick Facts */}
          <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, border: 1, borderColor: "divider", mb: 4 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Schnell-Übersicht
            </Typography>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Scale size={18} color="#e9644d" style={{ flexShrink: 0, marginTop: 3 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Schwellenwert
                  </Typography>
                  <Typography variant="body2">{entry.schwellenwert}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <FileText size={18} color="#e9644d" style={{ flexShrink: 0, marginTop: 3 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Typische Verfahren
                  </Typography>
                  <Typography variant="body2">{entry.typischeVerfahren.join(", ")}</Typography>
                </Box>
              </Stack>
              {entry.saison && (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Wrench size={18} color="#e9644d" style={{ flexShrink: 0, marginTop: 3 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Saison
                    </Typography>
                    <Typography variant="body2">{entry.saison}</Typography>
                  </Box>
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* CPV-Codes */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Relevante CPV-Codes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: "75ch" }}>
              Diese Common Procurement Vocabulary (CPV) Codes werden in dieser Branche typischerweise verwendet.
              Tenderhunter filtert automatisch nach diesen Codes.
            </Typography>
            <Stack spacing={1}>
              {entry.cpvCodes.map((cpv) => (
                <Paper key={cpv.code} elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 2 }}>
                  <Chip label={cpv.code} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontFamily: "monospace" }} />
                  <Typography variant="body2" color="text.secondary">{cpv.label}</Typography>
                </Paper>
              ))}
            </Stack>
          </Box>

          {/* Eignungskriterien */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Eignungskriterien
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: "75ch" }}>
              Was Auftraggeber in dieser Branche typischerweise als Eignung verlangen.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {entry.eignungskriterien.map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: "text.secondary" }}>
                  {item}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Besonderheiten */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <AlertTriangle size={20} color="#e9644d" />
              <Typography variant="h6" component="h2" fontWeight={700}>
                Branchen-Besonderheiten
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: "75ch" }}>
              Wichtige Branchen-spezifische Aspekte, die bei der Angebotserstellung berücksichtigt werden müssen.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {entry.besonderheiten.map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: "text.secondary" }}>
                  {item}
                </Box>
              ))}
            </Box>
          </Box>

          {/* FAQ */}
          {entry.faq.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Häufige Fragen
              </Typography>
              <Stack spacing={2}>
                {entry.faq.map((item, idx) => (
                  <Box key={idx} component="details" sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
                    <Box component="summary" sx={{ fontWeight: 600, cursor: "pointer", fontSize: "1rem", mb: 1 }}>
                      {item.question}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mt: 1 }}>
                      {item.answer}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Related Categories */}
          {entry.relatedCategories.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Aktuelle Ausschreibungen
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {entry.relatedCategories.map((catKey) => {
                  const catSlug = CATEGORY_SLUGS[catKey];
                  const catLabel = CATEGORY_LABELS[catKey];
                  if (!catSlug) return null;
                  return (
                    <Link key={catKey} href={`/ausschreibungen/${catSlug}`} style={{ textDecoration: "none" }}>
                      <Chip clickable label={`${catLabel} Ausschreibungen`} color="primary" variant="outlined" sx={{ fontWeight: 500 }} />
                    </Link>
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* Related Branchen */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Andere Branchen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {relatedEntries.map((re) => (
                <Link key={re.slug} href={`/branchen/${re.slug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={re.name} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              {entry.name}-Ausschreibungen in Ihrer Region?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tenderhunter findet automatisch passende Vergaben für {entry.name} — mit Branchen-Filter und CPV-Codes.
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
                px: 3,
                py: 1.25,
                borderRadius: 2,
                fontWeight: 700,
                textDecoration: "none",
                "&:hover": { opacity: 0.88 },
              }}
            >
              Jetzt kostenlos testen
              <ArrowRight size={16} />
            </Box>
          </Box>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
