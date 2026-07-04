import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Typography, Stack, Chip, Breadcrumbs } from "@mui/material";
import { Home as HomeIcon, ArrowRight } from "lucide-react";
import { ARTICLES, ALL_ARTICLE_SLUGS } from "@/lib/articles";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ALL_ARTICLE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) return { title: "Artikel nicht gefunden", robots: { index: false, follow: true } };

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/wissen/${slug}`, languages: { "de-DE": `/wissen/${slug}` } },
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      locale: "de_DE",
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
    },
  };
}

// Simple markdown-ish renderer: ## headings, ### subheadings, ** bold, - list items, paragraphs
function renderContent(content: string) {
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(
        <Box component="ul" key={`list-${elements.length}`} sx={{ m: 0, pl: 2.5, mb: 2 }}>
          {listBuffer.map((item, i) => (
            <Box component="li" key={i} sx={{ mb: 0.75, lineHeight: 1.7, color: "text.secondary" }}>
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </Box>
          ))}
        </Box>,
      );
      listBuffer = [];
    }
  };

  const inlineFormat = (text: string) =>
    text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <Typography key={i} component="h3" variant="subtitle1" fontWeight={600} sx={{ mt: 3, mb: 1 }}>
          {trimmed.slice(4)}
        </Typography>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <Typography key={i} component="h2" variant="h5" fontWeight={700} sx={{ mt: 4, mb: 2 }}>
          {trimmed.slice(3)}
        </Typography>,
      );
    } else if (trimmed.startsWith("- ")) {
      listBuffer.push(trimmed.slice(2));
    } else if (trimmed.startsWith("| ")) {
      // Simple table row — render as preformatted text
      flushList();
      elements.push(
        <Typography key={i} variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: "0.85rem", lineHeight: 1.6 }}>
          {trimmed}
        </Typography>,
      );
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <Typography key={i} variant="body1" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />,
      );
    }
  }
  flushList();
  return elements;
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) notFound();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Wissen", item: `${siteUrl}/wissen` },
      { "@type": "ListItem", position: 3, name: article.title, item: `${siteUrl}/wissen/${slug}` },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    publisher: { "@id": `${siteUrl}#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/wissen/${slug}` },
  };

  // SEO: HowTo JSON-LD for step-by-step articles — enables HowTo rich snippet in Google SERP
  const howToJsonLd = article.howToSteps
    ? {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: article.title,
        description: article.description,
        step: article.howToSteps.map((step, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: step.name,
          text: step.text,
        })),
      }
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      {howToJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      )}

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} />
              Start
            </Link>
            <Link href="/wissen" style={{ color: "#667288", textDecoration: "none" }}>
              Wissen
            </Link>
            <Typography color="text.primary" fontSize="0.85rem" sx={{ maxWidth: "40ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {article.title}
            </Typography>
          </Breadcrumbs>

          <Box sx={{ maxWidth: "80ch" }}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{ mb: 2, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}
            >
              {article.title}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: "70ch", lineHeight: 1.7 }}>
              {article.description}
            </Typography>

            {renderContent(article.content)}
          </Box>

          {/* Related categories */}
          <Box sx={{ mt: 6, mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Passende Ausschreibungen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {article.relatedCategories.map((cat) => {
                const catSlug = CATEGORY_SLUGS[cat];
                if (!catSlug) return null;
                return (
                  <Link key={catSlug} href={`/ausschreibungen/${catSlug}`} style={{ textDecoration: "none" }}>
                    <Chip clickable label={CATEGORY_LABELS[cat] ?? cat} variant="outlined" sx={{ fontWeight: 500 }} />
                  </Link>
                );
              })}
            </Stack>
          </Box>

          {/* All categories */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Alle Kategorien
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(CATEGORY_SLUGS).map(([key, catSlug]) => (
                <Link key={catSlug} href={`/ausschreibungen/${catSlug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={CATEGORY_LABELS[key] ?? key} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende Ausschreibungen automatisch finden
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tenderhunter nutzt KI, um die passendsten öffentlichen Ausschreibungen für Ihr Unternehmen zu finden.
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
    </>
  );
}
