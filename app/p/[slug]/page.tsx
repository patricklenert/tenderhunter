import { db } from "@/lib/db";
import { companyProfiles, scores, tenders, structuredData } from "@/lib/schema";
import { eq, and, desc, gt, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Stack, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { CompanyProfileHeader } from "@/components/profile/CompanyProfileHeader";
import { TenderSectionHeader } from "@/components/profile/TenderSectionHeader";
import { TenderCard } from "@/components/profile/TenderCard";
import { PageFooter } from "@/components/profile/PageFooter";
import { findPublicProfileMatches, type PublicProfileMatch } from "@/lib/discovery";
import { decodeHtmlEntities } from "@/lib/text-normalization";
import { normalizePublicClient, pickValidatedPublicCandidate, pickValidatedPublicLocationForTender } from "@/lib/public-content-quality";
import { pickPublicTenderDescription } from "@/lib/tender-meta";
import { daysUntil, getDeadlineState, parseDeadlineDate } from "@/lib/date-utils";
import { getListingRobots, type SeoSearchParams } from "@/lib/seo-indexability";
import {
  buildProfileSummary,
  sortProfileTenders,
  truncateProfileText,
  PUBLIC_PROFILE_FALLBACK_CANDIDATE_LIMIT,
  type ProfileTender,
} from "@/lib/public-profile";

export const revalidate = 300;
export const runtime = "nodejs";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SeoSearchParams>;
}

const mapProfileMatch = (row: PublicProfileMatch): ProfileTender => {
  const blob = (row.jsonBlob ?? {}) as Record<string, unknown>;
  const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
  const hardFacts = (blob.hard_facts ?? {}) as Record<string, unknown>;
  const procurement = (blob.procurement ?? {}) as Record<string, unknown>;
  const contractValue = (procurement.contract_value ?? {}) as Record<string, unknown>;
  const structuredDeadline = typeof hardFacts.deadline === "string" ? hardFacts.deadline : null;
  const deadlineSource = row.deadlineAt ?? structuredDeadline;
  const parsedDeadline = parseDeadlineDate(deadlineSource);
  const description = pickPublicTenderDescription({
    structured: blob,
    metadata,
    rawText: row.rawText,
  });
  const rawTitle = pickValidatedPublicCandidate(blob.title, row.title) || `Ausschreibung #${row.tenderId}`;
  const client = normalizePublicClient(hardFacts.buyer) || normalizePublicClient(metadata.client);
  const location = pickValidatedPublicLocationForTender(
    rawTitle,
    client,
    hardFacts.location,
    metadata.location,
  ) || null;

  return {
    id: row.tenderId,
    title: decodeHtmlEntities(rawTitle),
    description: truncateProfileText(description),
    location,
    volume: typeof hardFacts.budget === "string"
      ? hardFacts.budget
      : typeof contractValue.max === "number"
        ? `${contractValue.max.toLocaleString("de-DE")} EUR`
        : null,
    deadlineAt: parsedDeadline?.toISOString() ?? null,
    deadlineDays: daysUntil(parsedDeadline),
    deadlineState: getDeadlineState(parsedDeadline),
    fit: Math.max(0, Math.min(100, Math.round(row.fit))),
    winProbability: Math.max(0, Math.min(100, Math.round(row.winProbability))),
    slug: getCanonicalTenderSlug(row.slug, rawTitle, { client, location }, blob),
  };
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
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
    robots: getListingRobots(resolvedSearchParams, 1, true),
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
      metadataJson: tenders.metadataJson,
      jsonBlob: structuredData.jsonBlob,
      deadlineAt: tenders.deadlineAt,
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
      eq(tenders.qualityStatus, "qualified"),
      sql`${tenders.rawText} IS NOT NULL AND BTRIM(${tenders.rawText}) <> ''`,
    ))
    .orderBy(desc(scores.winProbability), desc(scores.fit))
    .limit(50);

  const persistedTenders = matchedRows.map((row) => mapProfileMatch(row));
  const persistedTenderIds = new Set(persistedTenders.map((tender) => tender.id));
  const persistedCurrent = persistedTenders.filter((tender) => tender.deadlineState !== "expired");
  const publicFallbackRows = persistedCurrent.length < 10
    ? await findPublicProfileMatches({
      capabilities_json: JSON.stringify(capabilities),
      certifications_json: JSON.stringify(certifications),
      regions_json: JSON.stringify(regions),
      team_size: company.teamSize,
      industry: company.industry,
    }, persistedTenderIds, 10 - persistedCurrent.length + 3, {
      qualifiedOnly: true,
      candidateLimit: PUBLIC_PROFILE_FALLBACK_CANDIDATE_LIMIT,
    })
    : [];
  const fallbackTenders = publicFallbackRows.map((row) => mapProfileMatch(row));
  const currentTenders = sortProfileTenders([
    ...persistedCurrent,
    ...fallbackTenders.filter((tender) => tender.deadlineState !== "expired"),
  ]).slice(0, 10);
  const expiredTenders = sortProfileTenders([
    ...persistedTenders.filter((tender) => tender.deadlineState === "expired"),
    ...fallbackTenders.filter((tender) => tender.deadlineState === "expired"),
  ]).slice(0, 3);
  const tendersList = [...currentTenders, ...expiredTenders];
  const summary = buildProfileSummary(tendersList, capabilities, regions);
  const bestFit = currentTenders.length > 0 ? Math.max(...currentTenders.map((tender) => tender.fit)) : null;

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

      <Box sx={{ minHeight: "100vh", bgcolor: "#edf3f7" }}>
        <Container maxWidth={false} sx={{ maxWidth: "1240px", mx: "auto", px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
          {/* Breadcrumbs */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mb: 2,
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
            description={company.description?.trim() && company.description.trim() !== company.name.trim() ? company.description : null}
            logoUrl={company.logoUrl}
            capabilities={capabilities}
            certifications={certifications}
            regions={regions}
            teamSize={company.teamSize}
            address={company.address}
            tenderCount={tendersList.length}
            bestFit={bestFit}
            expiredCount={summary.expiredCount}
          />

          <Box
            component="section"
            aria-labelledby="profile-matches-heading"
            sx={{
              mt: { xs: 2.5, md: 3.5 },
              p: { xs: 1.5, sm: 2, md: 2.5 },
              bgcolor: "#e4edf3",
              border: "1px solid #d3e0e8",
              borderRadius: "18px",
            }}
          >
            <TenderSectionHeader count={summary.currentCount} summary={summary} />

            {tendersList.length === 0 ? (
              <Box
                sx={{
                  p: { xs: 3, md: 4 },
                  textAlign: "center",
                  bgcolor: "#fbfcfd",
                  borderRadius: "12px",
                  border: "1px solid #dce6ed",
                }}
              >
                <Typography variant="h6" component="h3" sx={{ mb: 1, fontWeight: 700 }}>
                  Aktuell keine passenden Ausschreibungen
                </Typography>
                <Typography sx={{ color: "#667288", fontSize: "0.875rem", maxWidth: 620, mx: "auto", lineHeight: 1.7 }}>
                  Für dieses Firmenprofil wurden derzeit keine passenden aktiven Vergaben gefunden. Neue Ausschreibungen
                  werden laufend ergänzt. Nutzen Sie bis dahin unsere aktuellen Vergaben, Tools und Vorlagen.
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                  <Link href="/ausschreibungen" style={{ color: "#c45342", fontWeight: 700, textDecoration: "none" }}>
                    Alle Ausschreibungen
                  </Link>
                  <Link href="/tools" style={{ color: "#c45342", fontWeight: 700, textDecoration: "none" }}>
                    Vergabe-Tools
                  </Link>
                  <Link href="/vorlagen" style={{ color: "#c45342", fontWeight: 700, textDecoration: "none" }}>
                    Vorlagen &amp; Muster
                  </Link>
                </Stack>
              </Box>
            ) : (
              <>
                {currentTenders.length === 0 && (
                  <Box sx={{ p: 2, mb: 1.5, bgcolor: "#f8fafc", border: "1px solid #dce6ed", borderRadius: "10px" }}>
                    <Typography sx={{ color: "#475569", fontSize: "0.875rem", fontWeight: 600 }}>
                      Keine aktiven Treffer mit offener Frist
                    </Typography>
                    <Typography sx={{ color: "#667288", fontSize: "0.8125rem", mt: 0.25 }}>
                      Die abgelaufenen Ausschreibungen stehen weiter unten zur Orientierung.
                    </Typography>
                  </Box>
                )}

                {currentTenders.length > 0 && (
                  <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, m: 0 }}>
                    {currentTenders.map((tender) => (
                      <Box component="li" key={tender.id}>
                        <TenderCard
                          id={tender.id}
                          title={tender.title}
                          description={tender.description}
                          location={tender.location}
                          volume={tender.volume}
                          deadlineAt={tender.deadlineAt}
                          deadlineDays={tender.deadlineDays}
                          deadlineState={tender.deadlineState}
                          fit={tender.fit}
                          slug={tender.slug}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}

                {expiredTenders.length > 0 && (
                  <Box component="section" aria-labelledby="expired-matches-heading" sx={{ mt: { xs: 3, md: 4 } }}>
                    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" gap={0.75} sx={{ mb: 1.25 }}>
                      <Box>
                        <Typography id="expired-matches-heading" component="h3" sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#475569" }}>
                          Abgelaufene Ausschreibungen
                        </Typography>
                        <Typography sx={{ color: "#7b8798", fontSize: "0.75rem", mt: 0.25 }}>
                          Zur Einordnung, nicht mehr im aktuellen Fokus.
                        </Typography>
                      </Box>
                      <Typography sx={{ color: "#7b8798", fontSize: "0.75rem", fontWeight: 600 }}>
                        {expiredTenders.length} Treffer
                      </Typography>
                    </Stack>
                    <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, m: 0 }}>
                      {expiredTenders.map((tender) => (
                        <Box component="li" key={tender.id}>
                          <TenderCard
                            id={tender.id}
                            title={tender.title}
                            description={tender.description}
                            location={tender.location}
                            volume={tender.volume}
                            deadlineAt={tender.deadlineAt}
                            deadlineDays={tender.deadlineDays}
                            deadlineState={tender.deadlineState}
                            fit={tender.fit}
                            slug={tender.slug}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Box>

          <PageFooter />
        </Container>
      </Box>
    </>
  );
}
