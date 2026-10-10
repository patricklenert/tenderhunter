// SEO: Shared component for Verfahren×Kategorie and CPV×Kategorie cross-landing pages.
// Targets long-tail keywords like "offenes Verfahren Bauarbeiten", "CPV 45000000 Gebaeudereinigung".
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
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { getPaginationHref } from "@/lib/seo-indexability";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";

interface TaxCatTender {
  id: number;
  title: string;
  deadline: string | null;
  location: string | null;
  client: string | null;
  source: string;
  slug?: string | null;
}

interface TaxonomyCategoryContentProps {
  taxonomyType: "verfahren" | "cpv";
  taxonSlug: string;
  taxonLabel: string;
  taxonParentPath: string; // e.g. "/ausschreibungen/verfahren" or "/ausschreibungen/cpv"
  categoryKey: string;
  tenders: TaxCatTender[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  siteUrl: string;
  // Only link category combinations with a current qualified result.
  availableCategorySlugs: string[];
}

export function TaxonomyCategoryContent({
  taxonomyType,
  taxonSlug,
  taxonLabel,
  taxonParentPath,
  categoryKey,
  tenders,
  totalCount,
  currentPage,
  totalPages,
  siteUrl,
  availableCategorySlugs,
}: TaxonomyCategoryContentProps) {
  const categoryLabel = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  const catSlug = CATEGORY_SLUGS[categoryKey] ?? categoryKey.toLowerCase();
  const basePath = `${taxonParentPath}/${taxonSlug}/${catSlug}`;
  const taxonTypeLabel = taxonomyType === "verfahren" ? "Vergabeverfahren" : "CPV-Code";

  const faq = [
    {
      question: `Wo finde ich ${categoryLabel}-Ausschreibungen im ${taxonTypeLabel} ${taxonLabel}?`,
      answer: `Tenderhunter filtert automatisch alle ${categoryLabel}-Ausschreibungen nach dem ${taxonTypeLabel} ${taxonLabel}. Hier finden Sie aktuelle Vergaben mit Fristen, Auftraggebern und Anforderungen — täglich aktualisiert.`,
    },
    {
      question: `Welche Auftraggeber vergeben ${categoryLabel} als ${taxonLabel}?`,
      answer: `Öffentliche Auftraggeber aus Bund, Ländern und Kommunen schreiben ${categoryLabel} regelmäßig als ${taxonLabel} aus. Die Vergaben werden auf DTVP, TED und evergabe veröffentlicht und von Tenderhunter automatisch aggregiert.`,
    },
    {
      question: `Wie aktuell sind die ${categoryLabel}-Ausschreibungen für ${taxonLabel}?`,
      answer: `Tenderhunter aktualisiert die Daten täglich. Neue Vergaben, die dem ${taxonTypeLabel} ${taxonLabel} und der Kategorie ${categoryLabel} entsprechen, erscheinen in der Regel innerhalb von 24 Stunden nach Veröffentlichung.`,
    },
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      { "@type": "ListItem", position: 3, name: taxonLabel, item: `${siteUrl}${taxonParentPath}/${taxonSlug}` },
      { "@type": "ListItem", position: 4, name: categoryLabel, item: `${siteUrl}${basePath}` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${categoryLabel} Ausschreibungen – ${taxonLabel}`,
    numberOfItems: totalCount,
    itemListElement: tenders.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${getCanonicalTenderSlug(t.slug ?? null, t.title, { client: t.client, location: t.location })}`,
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
            <Link href={`${taxonParentPath}/${taxonSlug}`} style={{ color: "#667288", textDecoration: "none" }}>{taxonLabel}</Link>
            <Typography color="text.primary" fontSize="0.85rem">{categoryLabel}</Typography>
          </Breadcrumbs>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              {categoryLabel} – {taxonLabel}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle {categoryLabel}-Ausschreibungen im {taxonTypeLabel} {taxonLabel}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "70ch", lineHeight: 1.7 }}>
              {`Hier finden Sie alle öffentlichen ${categoryLabel}-Vergaben, die im ${taxonTypeLabel} "${taxonLabel}" durchgeführt werden. Tenderhunter filtert automatisch alle verfügbaren Quellen (DTVP, TED, evergabe) und zeigt Ihnen nur relevante Ausschreibungen.`}
            </Typography>
          </Box>

          {tenders.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {tenders.map((tender) => (
                <Link key={tender.id} href={`/ausschreibung/${tender.id}/${getCanonicalTenderSlug(tender.slug ?? null, tender.title, { client: tender.client, location: tender.location })}`} style={{ textDecoration: "none", color: "inherit" }}>
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
                Aktuell gibt es keine offenen {categoryLabel}-Ausschreibungen im {taxonTypeLabel} {taxonLabel}.
              </Typography>
            </Paper>
          )}

          {totalPages > 1 && (
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 5 }} component="nav" aria-label="Seitennavigation">
              {currentPage > 1 && (
                <Link href={getPaginationHref(basePath, currentPage - 1)} style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}>
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
                        <Link href={getPaginationHref(basePath, p)} style={{ textDecoration: "none", color: "#667288", fontWeight: 500, padding: "8px 12px" }}>{p}</Link>
                      )}
                    </span>
                  );
                })}
              {currentPage < totalPages && (
                <Link href={getPaginationHref(basePath, currentPage + 1)} style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}>
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          {/* FAQ */}
          <Box sx={{ mb: 5, maxWidth: "75ch" }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 3 }}>
              Häufige Fragen zu {categoryLabel} als {taxonLabel}
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

          {/* Cross-links: only result-backed categories for this taxon */}
          {availableCategorySlugs.filter((s) => s !== catSlug).length > 0 && (
            <Box sx={{ mb: 5 }}>
              <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
                {taxonLabel} nach Kategorie
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {availableCategorySlugs.filter((s) => s !== catSlug).map((s) => {
                  const catKey = Object.keys(CATEGORY_SLUGS).find((k) => CATEGORY_SLUGS[k] === s);
                  return (
                    <Link key={s} href={`${taxonParentPath}/${taxonSlug}/${s}`} style={{ textDecoration: "none" }}>
                      <Chip clickable label={catKey ? CATEGORY_LABELS[catKey] : s} variant="outlined" sx={{ fontWeight: 500 }} />
                    </Link>
                  );
                })}
              </Stack>
            </Box>
          )}

          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende {categoryLabel}-Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tenderhunter findet automatisch passende Vergaben und bewertet sie für Ihr Unternehmen.
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
