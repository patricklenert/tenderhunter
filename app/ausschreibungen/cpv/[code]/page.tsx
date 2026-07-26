import { db } from "@/lib/db";
import { tenders, structuredData } from "@/lib/schema";
import { eq, and, inArray, or, gt, isNull, desc, sql } from "drizzle-orm";
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
  Building2,
  MapPin,
  Calendar,
  ArrowRight,
  Home as HomeIcon,
} from "lucide-react";
import { generateTenderSlug } from "@/lib/tender-slug";
import { CPV_CODES, ALL_CPV_CODES } from "@/lib/cpv-codes";
import { SiteFooter } from "@/components/seo/SiteFooter";

const PAGE_SIZE = 20;

export const revalidate = 3600;
export const runtime = "nodejs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

// SEO: CPV landing pages — pre-render top CPV codes from the EU procurement vocabulary
export async function generateStaticParams() {
  return ALL_CPV_CODES.map((code) => ({ code }));
}

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const cpvEntry = CPV_CODES[code];
  if (!cpvEntry) return { title: "CPV-Code nicht gefunden", robots: { index: false, follow: true } };

  const pageSuffix = currentPage > 1 ? ` – Seite ${currentPage}` : "";
  const title = `CPV ${code} ${cpvEntry.label} – Ausschreibungen${pageSuffix}`;
  const description = cpvEntry.description;
  const canonicalPath = `/ausschreibungen/cpv/${code}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
    openGraph: { title, description, type: "website", locale: "de_DE" },
  };
}

export default async function CpvPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const cpvEntry = CPV_CODES[code];
  if (!cpvEntry) notFound();

  const now = new Date();
  let cpvTenders: Array<{
    id: number;
    title: string;
    source: string;
    deadline: string | null;
    location: string | null;
    client: string | null;
    slug: string;
  }> = [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    // SEO: Query structured_data for tenders whose CPV codes include this code or its subdivisions
    // Match both exact code and codes starting with the first 2 digits (division level)
    const divisionPrefix = code.slice(0, 2);

    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .innerJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${structuredData.jsonBlob}->'procurement'->'cpv_codes')::jsonb ?| array[${code}, ${divisionPrefix + "000000"}]`,
        ),
      );
    totalCount = countRow[0]?.count ?? 0;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (currentPage > totalPages && totalCount > 0) notFound();

    const offset = (currentPage - 1) * PAGE_SIZE;

    const rows = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        source: tenders.source,
        deadlineAt: tenders.deadlineAt,
        metadataJson: tenders.metadataJson,
        slug: tenders.slug,
      })
      .from(tenders)
      .innerJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${structuredData.jsonBlob}->'procurement'->'cpv_codes')::jsonb ?| array[${code}, ${divisionPrefix + "000000"}]`,
        ),
      )
      .orderBy(desc(tenders.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    cpvTenders = rows.map((row) => {
      const meta =
        typeof row.metadataJson === "object" && row.metadataJson !== null
          ? (row.metadataJson as Record<string, unknown>)
          : {};
      const rawLocation = typeof meta.location === "string" ? meta.location : "";
      return {
        id: row.id,
        title: row.title ?? `Ausschreibung #${row.id}`,
        source: row.source,
        deadline: row.deadlineAt
          ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
          : null,
        location: typeof meta.location === "string" ? meta.location.split(",")[0].trim().slice(0, 60) : null,
        client: typeof meta.client === "string" ? meta.client.slice(0, 80) : null,
        slug: row.slug ?? generateTenderSlug(row.title ?? "", rawLocation),
      };
    });
  } catch {
    // DB unavailable
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `CPV ${code} ${cpvEntry.label} Ausschreibungen`,
    numberOfItems: cpvTenders.length,
    itemListElement: cpvTenders.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug}`,
      name: t.title,
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cpvEntry.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      { "@type": "ListItem", position: 3, name: `CPV ${code}`, item: `${siteUrl}/ausschreibungen/cpv/${code}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} />
              Start
            </Link>
            <Link href="/ausschreibungen" style={{ color: "#667288", textDecoration: "none" }}>
              Ausschreibungen
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">CPV {code}</Typography>
          </Breadcrumbs>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 1, fontSize: { xs: "1.5rem", md: "2.25rem" }, letterSpacing: "-0.01em" }}>
              CPV {code} – {cpvEntry.label}{currentPage > 1 ? `, Seite ${currentPage}` : ""}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {totalCount} aktuelle Ausschreibungen mit CPV-Code {code}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "70ch", lineHeight: 1.7 }}>
              {cpvEntry.intro}
            </Typography>
          </Box>

          {cpvTenders.length > 0 ? (
            <Stack spacing={2} sx={{ mb: 5 }}>
              {cpvTenders.map((tender) => (
                <Link key={tender.id} href={`/ausschreibung/${tender.id}/${tender.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
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
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                Aktuell gibt es keine offenen Ausschreibungen mit CPV-Code {code}.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Abonnieren Sie unseren{" "}
                <Link href="/feeds/tender.xml" style={{ color: "inherit", fontWeight: 600 }}>RSS-Feed</Link>
                , um benachrichtigt zu werden.
              </Typography>
            </Paper>
          )}

          {totalPages > 1 && (
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 5 }} component="nav" aria-label="Seitennavigation">
              {currentPage > 1 && (
                <Link href={`/ausschreibungen/cpv/${code}?page=${currentPage - 1}`} style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}>
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
                        <Link href={`/ausschreibungen/cpv/${code}?page=${p}`} style={{ textDecoration: "none", color: "#667288", fontWeight: 500, padding: "8px 12px" }}>{p}</Link>
                      )}
                    </span>
                  );
                })}
              {currentPage < totalPages && (
                <Link href={`/ausschreibungen/cpv/${code}?page=${currentPage + 1}`} style={{ textDecoration: "none", color: "#e9644d", fontWeight: 600, padding: "8px 12px" }}>
                  Weiter →
                </Link>
              )}
            </Stack>
          )}

          <Box sx={{ mb: 5, maxWidth: "75ch" }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Über CPV {code} – {cpvEntry.label}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {cpvEntry.description}
            </Typography>
          </Box>

          {cpvEntry.faq.length > 0 && (
            <Box sx={{ mb: 5, maxWidth: "75ch" }}>
              <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 3 }}>
                Häufige Fragen zu CPV {code}
              </Typography>
              {cpvEntry.faq.map((item, i) => (
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
          )}

          <Box sx={{ mb: 5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 2 }}>
              Weitere CPV-Codes
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {ALL_CPV_CODES.filter((c) => c !== code).map((c) => (
                <Link key={c} href={`/ausschreibungen/cpv/${c}`} style={{ textDecoration: "none" }}>
                  <Chip clickable label={`CPV ${c} ${CPV_CODES[c].label}`} variant="outlined" sx={{ fontWeight: 500 }} />
                </Link>
              ))}
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ mb: 1 }}>
              Passende CPV-{cpvEntry.label}-Ausschreibungen für Ihr Unternehmen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scannen Sie Ihre Website und finden Sie automatisch Ausschreibungen mit passenden CPV-Codes.
            </Typography>
            <Box component="a" href="/#app" sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: "primary.main", color: "#fff", px: 3, py: 1.25, borderRadius: 2, fontWeight: 700, textDecoration: "none", "&:hover": { opacity: 0.88 } }}>
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
