import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Box, Container, Typography, Stack, Paper, Breadcrumbs, Chip } from "@mui/material";
import { Home as HomeIcon, ArrowRight, FileText, Lightbulb } from "lucide-react";
import { TEMPLATE_MAP, ALL_TEMPLATE_SLUGS, TEMPLATES } from "@/lib/templates";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { SiteFooter } from "@/components/seo/SiteFooter";
import InteractiveChecklist from "@/components/seo/InteractiveChecklist";
import CopyButton from "@/components/seo/CopyButton";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;
export const runtime = "nodejs";

export async function generateStaticParams() {
  return ALL_TEMPLATE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = TEMPLATE_MAP[slug];
  if (!entry) return { title: "Vorlage nicht gefunden", robots: { index: false, follow: true } };

  const canonicalPath = `/vorlagen/${entry.slug}`;

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

export default async function TemplateEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = TEMPLATE_MAP[slug];
  if (!entry) notFound();

  const relatedEntries = (entry.relatedTemplates ?? [])
    .map((s) => TEMPLATE_MAP[s])
    .filter(Boolean);

  // SEO: "See also" entries from same category
  const sameCategoryEntries = TEMPLATES
    .filter((e) => e.category === entry.category && e.slug !== entry.slug)
    .slice(0, 6);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Vorlagen", item: `${siteUrl}/vorlagen` },
      { "@type": "ListItem", position: 3, name: entry.title, item: `${siteUrl}/vorlagen/${entry.slug}` },
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

  // SEO: HowTo JSON-LD — templates describe how to use a document, which maps to HowTo
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: entry.title,
    description: entry.metaDescription,
    step: entry.whenToUse.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: `Schritt ${i + 1}`,
      text: step,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} /> Start
            </Link>
            <Link href="/vorlagen" style={{ color: "#667288", textDecoration: "none" }}>
              Vorlagen
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">{entry.title}</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <FileText size={18} color="#e9644d" />
              <Link href="/vorlagen" style={{ textDecoration: "none" }}>
                <Chip clickable label={entry.category} size="small" color="primary" variant="outlined" />
              </Link>
            </Stack>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              {entry.title}
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

          {/* Wann verwenden */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Lightbulb size={20} color="#e9644d" />
                <Typography variant="h6" component="h2" fontWeight={700}>
                  Wann Sie diese Vorlage verwenden
                </Typography>
              </Stack>
              <CopyButton text={entry.whenToUse.map((t) => `• ${t}`).join("\n")} label="Liste kopieren" />
            </Stack>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {entry.whenToUse.map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: "text.secondary" }}>
                  {item}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Was enthalten ist — Interactive Checklist */}
          <Box sx={{ mb: 4 }}>
            <InteractiveChecklist title="Was in dieser Vorlage enthalten ist" items={entry.contents} />
          </Box>

          {/* Tipps */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6" component="h2" fontWeight={700}>
                Tipps für die Anwendung
              </Typography>
              <CopyButton text={entry.tips.map((t, i) => `${i + 1}. ${t}`).join("\n")} label="Tipps kopieren" />
            </Stack>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {entry.tips.map((tip, i) => (
                <Box component="li" key={i} sx={{ mb: 1.5, lineHeight: 1.7, color: "text.secondary" }}>
                  {tip}
                </Box>
              ))}
            </Box>
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

          {/* Related Templates */}
          {relatedEntries.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Verwandte Vorlagen
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {relatedEntries.map((re) => (
                  <Link key={re.slug} href={`/vorlagen/${re.slug}`} style={{ textDecoration: "none" }}>
                    <Chip clickable label={re.title} variant="outlined" sx={{ fontWeight: 500 }} />
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {/* Same Category Cross-links */}
          {sameCategoryEntries.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                Weitere Vorlagen aus &quot;{entry.category}&quot;
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {sameCategoryEntries.map((re) => (
                  <Link key={re.slug} href={`/vorlagen/${re.slug}`} style={{ textDecoration: "none" }}>
                    <Chip clickable label={re.title} variant="outlined" sx={{ fontWeight: 500 }} />
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

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tenderhunter findet automatisch passende Vergaben für Ihre Leistungen — mit {entry.title} und allen anderen Dokumenten.
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
