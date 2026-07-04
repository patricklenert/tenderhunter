import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
import {
  MapPin,
  Calendar,
  ArrowRight,
  Home as HomeIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { and, inArray, or, isNull, gt, sql, desc } from "drizzle-orm";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { normalizeAgencySlug } from "@/lib/agencies";
import { SiteFooter } from "@/components/seo/SiteFooter";

// SEO: Agency/Auftraggeber landing pages for long-tail keywords like "Ausschreibungen Stadt München"
export const revalidate = 3600;
export const runtime = "nodejs";

const PAGE_SIZE = 20;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  try {
    const now = new Date();
    // Find tenders whose normalized client matches the slug
    const rows = await db
      .select({
        client: sql<string>`(${tenders.metadataJson}::jsonb->>'client')`.as("client"),
      })
      .from(tenders)
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${tenders.metadataJson}::jsonb->>'client') IS NOT NULL`,
        ),
      )
      .groupBy(sql`(${tenders.metadataJson}::jsonb->>'client')`)
      .limit(500);

    const matchingClient = rows.find((r) => r.client && normalizeAgencySlug(r.client) === slug)?.client;
    if (!matchingClient) return { title: "Auftraggeber nicht gefunden", robots: { index: false, follow: true } };

    // Count tenders for this client
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenders)
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${tenders.metadataJson}::jsonb->>'client') = ${matchingClient}`,
        ),
      );
    const count = countResult[0]?.count ?? 0;

    const pageSuffix = currentPage > 1 ? ` – Seite ${currentPage}` : "";
    const title = `Ausschreibungen ${matchingClient} – Aktuelle Vergaben${pageSuffix}`;
    const description = `${count} aktuelle öffentliche Ausschreibungen von ${matchingClient}. Vergabeverfahren mit Fristen, Anforderungen und Details. Täglich aktualisiert.`;
    // SEO: Paginated pages (2+) canonicalize to page 1 to consolidate ranking signals
    const canonicalPath = `/auftraggeber/${slug}`;

    return {
      title,
      description,
      keywords: [`${matchingClient} Ausschreibungen`, `${matchingClient} Vergabe`, `öffentliche Aufträge ${matchingClient}`],
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: count === 0 ? { index: false, follow: true } : undefined,
      openGraph: { title, description, type: "website", locale: "de_DE" },
    };
  } catch {
    return {
      title: "Auftraggeber",
      description: "Öffentliche Ausschreibungen dieses Auftraggebers.",
      robots: { index: false, follow: true },
    };
  }
}

export default async function AuftraggeberPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const now = new Date();

  // Find the matching client name for this slug
  const clientRows = await db
    .select({
      client: sql<string>`(${tenders.metadataJson}::jsonb->>'client')`.as("client"),
    })
    .from(tenders)
    .where(
      and(
        inArray(tenders.qualityStatus, ["qualified", "candidate"]),
        or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        sql`(${tenders.metadataJson}::jsonb->>'client') IS NOT NULL`,
      ),
    )
    .groupBy(sql`(${tenders.metadataJson}::jsonb->>'client')`)
    .limit(500);

  const matchingClient = clientRows.find((r) => r.client && normalizeAgencySlug(r.client) === slug)?.client;
  if (!matchingClient) notFound();

  // Fetch tenders for this client with pagination
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [tenderRows, countResult, sourceUrlRow] = await Promise.all([
    db
      .select({
        id: tenders.id,
        title: tenders.title,
        category: tenders.category,
        deadlineAt: tenders.deadlineAt,
        metadataJson: tenders.metadataJson,
      })
      .from(tenders)
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${tenders.metadataJson}::jsonb->>'client') = ${matchingClient}`,
        ),
      )
      .orderBy(desc(tenders.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenders)
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${tenders.metadataJson}::jsonb->>'client') = ${matchingClient}`,
        ),
      ),
    // SEO: Fetch one source URL for Organization sameAs structured data
    db
      .select({ url: tenders.url })
      .from(tenders)
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          sql`(${tenders.metadataJson}::jsonb->>'client') = ${matchingClient}`,
        ),
      )
      .limit(1),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (currentPage > totalPages && totalCount > 0) notFound();

  const tenderList = tenderRows.map((t) => {
    const meta = (typeof t.metadataJson === "object" && t.metadataJson !== null
      ? t.metadataJson
      : {}) as Record<string, unknown>;
    return {
      id: t.id,
      title: t.title ?? `Ausschreibung #${t.id}`,
      category: t.category ?? "Diverse",
      location: typeof meta.location === "string" ? meta.location.split(",")[0].trim() : "",
      deadline: t.deadlineAt
        ? new Date(t.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
    };
  });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Ausschreibungen von ${matchingClient}`,
    numberOfItems: totalCount,
    itemListElement: tenderList.slice(0, 20).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}`,
      name: t.title,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      { "@type": "ListItem", position: 3, name: matchingClient, item: `${siteUrl}/auftraggeber/${slug}` },
    ],
  };

  // SEO: Enhanced Organization schema for agency rich results and sitelinks
  const sourceUrl = sourceUrlRow[0]?.url;
  const agencyJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: matchingClient,
    url: `${siteUrl}/auftraggeber/${slug}`,
    description: `Öffentliche Ausschreibungen und Vergabebekanntmachungen von ${matchingClient}. ${totalCount} aktuelle Aufträge auf Tenderhunter.`,
  };
  if (sourceUrl) {
    agencyJsonLd.sameAs = sourceUrl;
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(agencyJsonLd) }} />

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
            <Typography color="text.primary" fontSize="0.85rem">{matchingClient}</Typography>
          </Breadcrumbs>

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}
            >
              Ausschreibungen von {matchingClient}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle öffentliche Ausschreibungen und Vergabebekanntmachungen von {matchingClient}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "70ch", lineHeight: 1.7 }}>
              Alle aktuellen Ausschreibungen und Vergabebekanntmachungen von {matchingClient} — Übersicht mit Fristen, Anforderungen und Details. Täglich aktualisiert.
            </Typography>
          </Box>

          {/* Tender List */}
          {tenderList.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {tenderList.map((tender) => (
                <Link
                  key={tender.id}
                  href={`/ausschreibung/${tender.id}`}
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
                      <Chip label={tender.category} size="small" color="primary" variant="outlined" sx={{ height: 20 }} />
                      {tender.location && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <MapPin size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary">{tender.location}</Typography>
                        </Stack>
                      )}
                      {tender.deadline && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Calendar size={14} color="#667288" />
                          <Typography variant="caption" color="text.secondary">Frist: {tender.deadline}</Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                </Link>
              ))}
            </Stack>
          ) : (
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 5, border: 1, borderColor: "divider", textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                Aktuell gibt es keine offenen Ausschreibungen von {matchingClient}.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Abonnieren Sie unseren{" "}
                <Link href="/feeds/tender.xml" style={{ color: "inherit", fontWeight: 600 }}>RSS-Feed</Link>
                , um benachrichtigt zu werden.
              </Typography>
            </Paper>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              alignItems="center"
              sx={{ mb: 5 }}
              component="nav"
              aria-label="Seitennavigation"
            >
              {currentPage > 1 && (
                <Link
                  href={`/auftraggeber/${slug}?page=${currentPage - 1}`}
                  style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}
                >
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
                        <Link
                          href={`/auftraggeber/${slug}?page=${p}`}
                          style={{ textDecoration: "none", color: "#667288", fontWeight: 500, padding: "8px 12px" }}
                        >
                          {p}
                        </Link>
                      )}
                    </span>
                  );
                })}
              {currentPage < totalPages && (
                <Link
                  href={`/auftraggeber/${slug}?page=${currentPage + 1}`}
                  style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}
                >
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          {/* CTA */}
          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scannen Sie Ihre Website und finden Sie automatisch Ausschreibungen, die zu Ihren Leistungen passen.
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
              Jetzt Website analysieren
              <ArrowRight size={16} />
            </Box>
          </Box>
        </Container>
      </Box>
      <SiteFooter />
    </>
  );
}
