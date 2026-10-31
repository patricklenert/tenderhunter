import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Box, Container, Typography, Stack, Chip } from "@mui/material";
import { ArrowRight, CheckCircle2, BookOpen } from "lucide-react";
import { SiteBreadcrumbs } from "@/components/seo/SiteBreadcrumbs";
import { GLOSSARY_MAP, ALL_GLOSSARY_SLUGS, GLOSSARY } from "@/lib/glossary";
import { ARTICLES } from "@/lib/articles";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { SiteFooter } from "@/components/seo/SiteFooter";
import { decodeRouteParam } from "@/lib/route-params";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;
export const dynamicParams = false;
export const runtime = "nodejs";

export async function generateStaticParams() {
  return ALL_GLOSSARY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const entry = GLOSSARY_MAP[slug];
  if (!entry) return { title: "Begriff nicht gefunden", robots: { index: false, follow: true } };

  const title = `${entry.term} – Definition im Vergabelexikon`;
  const description = entry.shortDefinition.slice(0, 155);
  const canonicalPath = `/lexikon/${entry.slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
    openGraph: {
      title,
      description,
      type: "article",
      locale: "de_DE",
    },
  };
}

export default async function GlossaryEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const entry = GLOSSARY_MAP[slug];
  if (!entry) notFound();

  const relatedEntries = (entry.relatedTerms ?? [])
    .map((s) => GLOSSARY_MAP[s])
    .filter(Boolean);

  // SEO: "See also" entries from same category
  const sameCategoryEntries = GLOSSARY
    .filter((e) => e.category === entry.category && e.slug !== entry.slug)
    .slice(0, 6);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Lexikon", item: `${siteUrl}/lexikon` },
      { "@type": "ListItem", position: 3, name: entry.term, item: `${siteUrl}/lexikon/${entry.slug}` },
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

  const definedTermJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: entry.term,
    description: entry.shortDefinition,
    termCode: entry.slug,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Tenderhunter Vergabelexikon",
      url: `${siteUrl}/lexikon`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          <SiteBreadcrumbs items={[
            { label: "Start", href: "/" },
            { label: "Lexikon", href: "/lexikon" },
            { label: entry.term },
          ]} />

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <BookOpen size={18} color="#e9644d" />
              <Link href="/lexikon" style={{ textDecoration: "none" }}>
                <Chip clickable label={entry.category} size="small" color="primary" variant="outlined" />
              </Link>
            </Stack>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              {entry.term}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.8, fontSize: "1.1rem" }}>
              {entry.shortDefinition}
            </Typography>
            {entry.lastReviewed && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Zuletzt fachlich geprüft: {new Intl.DateTimeFormat("de-DE").format(new Date(entry.lastReviewed))}
              </Typography>
            )}
          </Box>

          {/* Definition */}
          <Box sx={{ mb: 4 }}>
            {entry.definition.map((para, i) => (
              <Typography key={i} variant="body1" component="p" sx={{ mb: 2, maxWidth: "75ch", lineHeight: 1.8, color: "text.secondary" }}>
                {para}
              </Typography>
            ))}
          </Box>

          {/* Key Points */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Wichtigste Punkte
            </Typography>
            <Stack spacing={1.5}>
              {entry.keyPoints.map((point, i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                  <CheckCircle2 size={18} color="#e9644d" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Typography variant="body1" sx={{ lineHeight: 1.7, color: "text.secondary" }}>
                    {point}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          {/* FAQ */}
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

          {/* Related Terms */}
          {relatedEntries.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Verwandte Begriffe
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {relatedEntries.map((re) => (
                  <Link key={re.slug} href={`/lexikon/${re.slug}`} style={{ textDecoration: "none" }}>
                    <Chip clickable label={re.term} variant="outlined" sx={{ fontWeight: 500 }} />
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {/* Same Category Cross-links */}
          {sameCategoryEntries.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Weitere Begriffe aus &quot;{entry.category}&quot;
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {sameCategoryEntries.map((re) => (
                  <Link key={re.slug} href={`/lexikon/${re.slug}`} style={{ textDecoration: "none" }}>
                    <Chip clickable label={re.term} variant="outlined" sx={{ fontWeight: 500 }} />
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {/* Related Tender Categories */}
          {entry.relatedCategories && entry.relatedCategories.length > 0 && (
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

          {entry.relatedArticles && entry.relatedArticles.some((slug) => ARTICLES[slug]) && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Weiterführende Artikel
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {entry.relatedArticles.filter((slug) => ARTICLES[slug]).map((articleSlug) => (
                  <Link key={articleSlug} href={`/wissen/${articleSlug}`} style={{ textDecoration: "none" }}>
                    <Chip clickable label={ARTICLES[articleSlug]?.title ?? articleSlug} variant="outlined" sx={{ fontWeight: 500 }} />
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {entry.sources && entry.sources.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
                Quellen und Rechtsgrundlagen
              </Typography>
              <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, m: 0 }}>
                {entry.sources.map((source) => (
                  <Box component="li" key={source.url}>
                    <Link href={source.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                      {source.title}
                    </Link>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tenderhunter findet automatisch passende Vergaben für Ihre Leistungen — aus {entry.term} und allen anderen Quellen.
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
