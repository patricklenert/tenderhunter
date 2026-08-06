import { db } from "@/lib/db";
import { companyProfiles, scores, tenders, structuredData } from "@/lib/schema";
import { eq, and, or, desc, gt } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Stack, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { sanitizeTenderUrl } from "@/lib/date-utils";
import { generateTenderSlug } from "@/lib/tender-slug";
import { CompanyProfileHeader } from "@/components/profile/CompanyProfileHeader";
import { TenderSectionHeader } from "@/components/profile/TenderSectionHeader";
import { TenderCard } from "@/components/profile/TenderCard";
import { PageFooter } from "@/components/profile/PageFooter";
import { findPublicProfileMatches } from "@/lib/discovery";
import { decodeHtmlEntities } from "@/lib/text-normalization";

export const revalidate = 300;
export const runtime = "nodejs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const rows = await db
    .select({ id: companyProfiles.id, name: companyProfiles.name, description: companyProfiles.description })
    .from(companyProfiles)
    .where(eq(companyProfiles.slug, slug))
    .limit(1);

  if (rows.length === 0) return { title: "Firma nicht gefunden", robots: { index: false, follow: true } };

  const title = `${rows[0].name} – Passende Ausschreibungen`;
  const description = rows[0].description ?? `Aktuelle passende Ausschreibungen für ${rows[0].name}`;

  return {
    title,
    description,
    alternates: { canonical: `/p/${slug}`, languages: { "de-DE": `/p/${slug}` } },
    openGraph: {
      title,
      description,
      type: "profile",
      locale: "de_DE",
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = await params;

  const companies = await db
    .select({
      id: companyProfiles.id,
      name: companyProfiles.name,
      description: companyProfiles.description,
      industry: companyProfiles.industry,
      logoUrl: companyProfiles.logoUrl,
      capabilitiesJson: companyProfiles.capabilitiesJson,
      certificationsJson: companyProfiles.certificationsJson,
      regionsJson: companyProfiles.regionsJson,
      teamSize: companyProfiles.teamSize,
      address: companyProfiles.address,
    })
    .from(companyProfiles)
    .where(eq(companyProfiles.slug, slug))
    .limit(1);

  if (companies.length === 0) notFound();

  const company = companies[0];
  const capabilities = Array.isArray(company.capabilitiesJson) ? company.capabilitiesJson as string[] : [];
  const certifications = Array.isArray(company.certificationsJson) ? company.certificationsJson as string[] : [];
  const regions = Array.isArray(company.regionsJson) ? company.regionsJson as string[] : [];

  const matchedRows = await db
    .select({
      tenderId: scores.tenderId,
      fit: scores.fit,
      winProbability: scores.winProbability,
      killSwitch: scores.killSwitch,
      title: tenders.title,
      url: tenders.url,
      rawText: tenders.rawText,
      jsonBlob: structuredData.jsonBlob,
      slug: tenders.slug,
      readinessStatus: tenders.readinessStatus,
    })
    .from(scores)
    .leftJoin(tenders, eq(scores.tenderId, tenders.id))
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      eq(scores.companyId, company.id),
      gt(scores.fit, 10),
      eq(scores.killSwitch, false),
      or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
    ))
    .orderBy(desc(scores.winProbability), desc(scores.fit))
    .limit(10);

  const persistedTenderIds = new Set(matchedRows.map((row) => row.tenderId));
  const publicFallbackRows = matchedRows.length < 10
    ? await findPublicProfileMatches({
      capabilities_json: JSON.stringify(capabilities),
      certifications_json: JSON.stringify(certifications),
      regions_json: JSON.stringify(regions),
      team_size: company.teamSize,
      industry: company.industry,
    }, persistedTenderIds, 10 - matchedRows.length)
    : [];
  const displayRows = [...matchedRows, ...publicFallbackRows];

  const tendersList = displayRows.map((row) => {
    const blob = (row.jsonBlob ?? {}) as Record<string, unknown>;
    const hardFacts = (blob.hard_facts ?? {}) as Record<string, unknown>;
    const procurement = (blob.procurement ?? {}) as Record<string, unknown>;
    const contractValue = (procurement.contract_value ?? {}) as Record<string, unknown>;

    const description = typeof blob.description === "string"
      ? blob.description
      : typeof blob.summary === "string"
        ? blob.summary.slice(0, 300)
        : (row.rawText ?? "").slice(0, 300);

    const rawUrl = row.url ?? null;
    const sourceUrl = typeof blob.sourceUrl === "string" ? blob.sourceUrl : null;
    const tenderUrl = sanitizeTenderUrl(rawUrl, sourceUrl);

    const rawTitle = (typeof blob.title === "string" && blob.title.length > 5 ? blob.title : row.title)
      ?? `Ausschreibung #${row.tenderId}`;

    return {
      id: row.tenderId,
      title: decodeHtmlEntities(rawTitle),
      description,
      location: typeof hardFacts.location === "string" ? hardFacts.location : null,
      volume: typeof hardFacts.budget === "string"
        ? hardFacts.budget
        : typeof contractValue.max === "number"
          ? `${contractValue.max.toLocaleString("de-DE")} EUR`
          : null,
      deadline: typeof hardFacts.deadline === "string" ? hardFacts.deadline : null,
      fit: Math.round(row.fit ?? 0),
      winProbability: Math.round(row.winProbability ?? 0),
      killSwitch: row.killSwitch,
      url: tenderUrl,
      slug: row.slug ?? generateTenderSlug(row.title ?? "", typeof hardFacts.location === "string" ? hardFacts.location : ""),
    };
  });

  const bestFit = tendersList.length > 0 ? Math.max(...tendersList.map((t) => t.fit)) : null;

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    url: `${siteUrl}/p/${slug}`,
    ...(company.logoUrl && { logo: company.logoUrl }),
    ...(company.description && { description: company.description.slice(0, 300) }),
    ...(company.address && { address: { "@type": "PostalAddress", streetAddress: company.address } }),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ausschreibungen", item: `${siteUrl}/ausschreibungen` },
      { "@type": "ListItem", position: 3, name: company.name, item: `${siteUrl}/p/${slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
        <Container maxWidth={false} sx={{ maxWidth: "1120px", mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, md: 4 } }}>
          {/* Breadcrumbs */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mb: 2.5,
              fontSize: "0.8125rem",
            }}
          >
            <Link
              href="/"
              style={{
                color: "#475569",
                textDecoration: "none",
              }}
            >
              Start
            </Link>
            <ChevronRight size={14} color="#94a3b8" />
            <Link
              href="/ausschreibungen"
              style={{
                color: "#475569",
                textDecoration: "none",
              }}
            >
              Ausschreibungen
            </Link>
            <ChevronRight size={14} color="#94a3b8" />
            <Typography
              component="span"
              sx={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              {company.name}
            </Typography>
          </Box>

          {/* Profile Header */}
          <CompanyProfileHeader
            name={company.name}
            industry={company.industry}
            description={company.description}
            logoUrl={company.logoUrl}
            capabilities={capabilities}
            certifications={certifications}
            regions={regions}
            teamSize={company.teamSize}
            address={company.address}
            tenderCount={tendersList.length}
            bestFit={bestFit}
          />

          {/* Tender Section */}
          <TenderSectionHeader count={tendersList.length} />

          {tendersList.length === 0 ? (
            <Box
              sx={{
                p: { xs: 3, md: 4 },
                textAlign: "center",
                bgcolor: "white",
                borderRadius: "10px",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="h6" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
                Aktuell keine passenden Ausschreibungen
              </Typography>
              <Typography sx={{ color: "text.secondary", fontSize: "0.875rem", maxWidth: 620, mx: "auto", lineHeight: 1.7 }}>
                Für dieses Firmenprofil wurden derzeit keine passenden aktiven Vergaben gefunden. Neue Ausschreibungen
                werden laufend ergänzt. Nutzen Sie bis dahin unsere aktuellen Vergaben, Tools und Vorlagen.
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                <Link href="/ausschreibungen" style={{ color: "#e9644d", fontWeight: 600, textDecoration: "none" }}>
                  Alle Ausschreibungen
                </Link>
                <Link href="/tools" style={{ color: "#e9644d", fontWeight: 600, textDecoration: "none" }}>
                  Vergabe-Tools
                </Link>
                <Link href="/vorlagen" style={{ color: "#e9644d", fontWeight: 600, textDecoration: "none" }}>
                  Vorlagen &amp; Muster
                </Link>
              </Stack>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {tendersList.map((tender) => (
                <TenderCard
                  key={tender.id}
                  id={tender.id}
                  title={tender.title}
                  description={tender.description}
                  location={tender.location}
                  volume={tender.volume}
                  deadline={tender.deadline}
                  fit={tender.fit}
                  slug={tender.slug}
                />
              ))}
            </Stack>
          )}

          <PageFooter />
        </Container>
      </Box>
    </>
  );
}
