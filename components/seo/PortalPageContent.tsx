import Link from "next/link";
import {
  Box,
  Container,
  Typography,
  Stack,
  Chip,
  Paper,
  Breadcrumbs,
} from "@mui/material";
import { SiteFooter } from "@/components/seo/SiteFooter";
import {
  Building2,
  MapPin,
  Calendar,
  Home as HomeIcon,
  ExternalLink,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { generateTenderSlug } from "@/lib/tender-slug";

interface PortalTender {
  id: number;
  title: string;
  category: string;
  deadline: string | null;
  location: string | null;
  client: string | null;
  source: string;
  slug?: string | null;
}

interface PortalPageContentProps {
  portal: {
    slug: string;
    label: string;
    h1: string;
    intro: string;
    portalInfo: string;
    // SEO: FAQ data for FAQPage JSON-LD
    faq: Array<{ question: string; answer: string }>;
  };
  tenders: PortalTender[];
  estimatedTotal: number;
  siteUrl: string;
}

// SEO: Shared component for portal landing pages (DTVP, TED, evergabe, Bauportal)
export function PortalPageContent({
  portal,
  tenders,
  estimatedTotal,
  siteUrl,
}: PortalPageContentProps) {
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
      {
        "@type": "ListItem",
        position: 3,
        name: portal.label,
        item: `${siteUrl}/ausschreibungen/${portal.slug}`,
      },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${portal.label} Ausschreibungen`,
    numberOfItems: tenders.length,
    itemListElement: tenders.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug ?? generateTenderSlug(t.title, t.location ?? "")}`,
      name: t.title,
    })),
  };

  // SEO: FAQPage JSON-LD for portal pages — targets "DTVP Ausschreibungen suchen" and similar queries
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: portal.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          {/* Breadcrumbs */}
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} />
              Start
            </Link>
            <Link href="/ausschreibungen" style={{ color: "#667288", textDecoration: "none" }}>
              Ausschreibungen
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">{portal.label}</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}
            >
              {portal.h1}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {estimatedTotal} aktuelle {portal.label}-Ausschreibungen aus deutschen Vergabeportalen
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.7 }}>
              {portal.intro}
            </Typography>
          </Box>

          {/* Tender List */}
          {tenders.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {tenders.map((tender) => (
                <Link
                  key={tender.id}
                  href={`/ausschreibung/${tender.id}/${tender.slug ?? generateTenderSlug(tender.title, tender.location ?? "")}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      border: 1,
                      borderColor: "divider",
                      borderLeft: 4,
                      borderLeftColor: "primary.main",
                      transition: "border-color 0.15s",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      component="h3"
                      fontWeight={600}
                      sx={{ mb: 1, fontSize: { xs: "0.95rem", md: "1.05rem" }, "&:hover": { color: "primary.main" } }}
                    >
                      {tender.title}
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                      {tender.client && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Building2 size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary">{tender.client}</Typography>
                        </Stack>
                      )}
                      {tender.location && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <MapPin size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary">{tender.location}</Typography>
                        </Stack>
                      )}
                      {tender.deadline && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Calendar size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary" component="span">
                            Frist: <time>{tender.deadline}</time>
                          </Typography>
                        </Stack>
                      )}
                      <Chip label={tender.source} size="small" sx={{ opacity: 0.7, height: 20 }} />
                    </Stack>
                  </Paper>
                </Link>
              ))}
            </Stack>
          ) : (
            <Paper
              elevation={0}
              sx={{ p: { xs: 3, md: 4 }, mb: 5, border: 1, borderColor: "divider", textAlign: "center" }}
            >
              <Typography variant="body1" color="text.secondary">
                Aktuell gibt es keine offenen {portal.label}-Ausschreibungen.
              </Typography>
            </Paper>
          )}

          {/* Portal Info */}
          <Box sx={{ mb: 5, maxWidth: "75ch" }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Über {portal.label}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {portal.portalInfo}
            </Typography>
          </Box>

          {/* Category Cross-links */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              {portal.label} nach Kategorie
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(CATEGORY_SLUGS).map(([key, catSlug]) => (
                <Link key={catSlug} href={`/ausschreibungen/${portal.slug}/${catSlug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={CATEGORY_LABELS[key] ?? key} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* Region Cross-links */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              {portal.label} nach Region
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(BUNDESLAND_SLUGS).map(([bundesland, blSlug]) => (
                <Link key={blSlug} href={`/ausschreibungen/${portal.slug}/region/${blSlug}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={bundesland} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          {/* Link to other portals */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weitere Vergabeportale
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {["dtvp", "ted", "evergabe", "bauportal-deutschland"]
                .filter((s) => s !== portal.slug)
                .map((s) => (
                  <Link key={s} href={`/ausschreibungen/${s}`} style={{ textDecoration: "none" }}>
                    <Chip
                      clickable
                      label={s === "bauportal-deutschland" ? "Bauportal Deutschland" : s.toUpperCase()}
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  </Link>
                ))}
            </Stack>
          </Box>

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Alle {portal.label}-Ausschreibungen im Blick?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tenderhunter findet automatisch passende {portal.label}-Vergaben für Ihr Unternehmen.
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
              <ExternalLink size={16} />
            </Box>
          </Box>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
