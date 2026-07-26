// SEO: Shared component for Portal×Category cross-landing pages.
// Renders tenders filtered by portal source + category, with FAQPage, ItemList and BreadcrumbList JSON-LD.
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
  ArrowRight,
} from "lucide-react";
import { generateTenderSlug } from "@/lib/tender-slug";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";

interface PortalCatTender {
  id: number;
  title: string;
  deadline: string | null;
  location: string | null;
  client: string | null;
  source: string;
  slug?: string | null;
}

interface PortalCategoryContentProps {
  portal: { slug: string; label: string };
  categoryKey: string;
  tenders: PortalCatTender[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  siteUrl: string;
}

// SEO: FAQPage JSON-LD for portal×category pages — auto-generated FAQ targets "DTVP Bauarbeiten" long-tail
function generateFaq(portalLabel: string, categoryLabel: string) {
  return [
    {
      question: `Wie finde ich ${categoryLabel}-Ausschreibungen auf ${portalLabel}?`,
      answer: `Tenderhunter durchsucht ${portalLabel} automatisch nach ${categoryLabel}-Ausschreibungen und zeigt Ihnen nur aktuelle, relevante Ergebnisse mit Fristen und Auftraggebern.`,
    },
    {
      question: `Welche ${categoryLabel}-Aufträge gibt es auf ${portalLabel}?`,
      answer: `${portalLabel} veröffentlicht regelmäßig ${categoryLabel}-Vergaben von öffentlichen Auftraggebern in Deutschland. Die Aufträge umfassen verschiedene Leistungsbereiche und Auftragsvolumina.`,
    },
    {
      question: `Wie aktuell sind die ${categoryLabel}-Ausschreibungen von ${portalLabel}?`,
      answer: `Die Daten werden täglich aktualisiert. Tenderhunter aggregiert ${portalLabel}-Ausschreibungen und aktualisiert die Ergebnisse automatisch.`,
    },
  ];
}

export function PortalCategoryContent({
  portal,
  categoryKey,
  tenders,
  totalCount,
  currentPage,
  totalPages,
  siteUrl,
}: PortalCategoryContentProps) {
  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  const catSlug = CATEGORY_SLUGS[categoryKey] ?? categoryKey.toLowerCase();
  const canonicalPath = `/ausschreibungen/${portal.slug}/${catSlug}`;
  const faq = generateFaq(portal.label, label);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      { "@type": "ListItem", position: 3, name: portal.label, item: `${siteUrl}/ausschreibungen/${portal.slug}` },
      { "@type": "ListItem", position: 4, name: label, item: `${siteUrl}${canonicalPath}` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${portal.label} ${label} Ausschreibungen`,
    numberOfItems: tenders.length,
    itemListElement: tenders.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug ?? generateTenderSlug(t.title, t.location ?? "")}`,
      name: t.title,
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} /> Start
            </Link>
            <Link href="/ausschreibungen" style={{ color: "#667288", textDecoration: "none" }}>Ausschreibungen</Link>
            <Link href={`/ausschreibungen/${portal.slug}`} style={{ color: "#667288", textDecoration: "none" }}>{portal.label}</Link>
            <Typography color="text.primary" fontSize="0.85rem">{label}</Typography>
          </Breadcrumbs>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              {portal.label} – {label}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle {label}-Ausschreibungen aus {portal.label}
            </Typography>
          </Box>

          {tenders.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {tenders.map((tender) => (
                <Link key={tender.id} href={`/ausschreibung/${tender.id}/${tender.slug ?? generateTenderSlug(tender.title, tender.location ?? "")}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: 1, borderColor: "divider", borderLeft: 4, borderLeftColor: "primary.main", transition: "border-color 0.15s", "&:hover": { borderColor: "primary.main" } }}>
                    <Typography variant="subtitle1" component="h3" fontWeight={600} sx={{ mb: 1, fontSize: { xs: "0.95rem", md: "1.05rem" }, "&:hover": { color: "primary.main" } }}>
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
                          <Typography variant="caption" color="text.secondary" component="span">Frist: <time>{tender.deadline}</time></Typography>
                        </Stack>
                      )}
                      <Chip label={tender.source} size="small" sx={{ opacity: 0.7, height: 20 }} />
                    </Stack>
                  </Paper>
                </Link>
              ))}
            </Stack>
          ) : (
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 5, border: 1, borderColor: "divider", textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                Aktuell gibt es keine offenen {label}-Ausschreibungen auf {portal.label}.
              </Typography>
            </Paper>
          )}

          {totalPages > 1 && (
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 5 }} component="nav" aria-label="Seitennavigation">
              {currentPage > 1 && (
                <Link href={`${canonicalPath}?page=${currentPage - 1}`} style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}>
                  ← Zurück
                </Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev !== undefined && p - prev > 1;
                  return (
                    <span key={p}>
                      {showEllipsis && <span style={{ padding: "0 4px", color: "#999" }}>…</span>}
                      {p === currentPage ? (
                        <span style={{ fontWeight: 700, color: "#e9644d", padding: "8px 12px" }}>{p}</span>
                      ) : (
                        <Link href={`${canonicalPath}?page=${p}`} style={{ textDecoration: "none", color: "#667288", fontWeight: 500, padding: "8px 12px" }}>{p}</Link>
                      )}
                    </span>
                  );
                })}
              {currentPage < totalPages && (
                <Link href={`${canonicalPath}?page=${currentPage + 1}`} style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}>
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          {/* FAQ */}
          <Box sx={{ mb: 5, maxWidth: "75ch" }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 3 }}>
              Häufige Fragen zu {label} auf {portal.label}
            </Typography>
            {faq.map((item, i) => (
              <Box key={i} component="details" sx={{ mb: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Box component="summary" sx={{ fontWeight: 600, cursor: "pointer", fontSize: "1rem", mb: 1 }}>
                  {item.question}
                </Box>
                <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.7, color: "text.secondary" }}>
                  {item.answer}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Other categories for this portal */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              {portal.label} nach Kategorie
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(CATEGORY_SLUGS).filter(([, s]) => s !== catSlug).map(([key, s]) => (
                <Link key={s} href={`/ausschreibungen/${portal.slug}/${s}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={CATEGORY_LABELS[key] ?? key} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende {label}-Ausschreibungen von {portal.label}?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tenderhunter findet automatisch passende {portal.label}-{label}-Vergaben für Ihr Unternehmen.
            </Typography>
            <Box component="a" href="/#app" sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: "primary.main", color: "#fff", px: 3, py: 1.25, borderRadius: 2, fontWeight: 700, textDecoration: "none", "&:hover": { opacity: 0.88 } }}>
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
