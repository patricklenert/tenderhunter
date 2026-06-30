import { db } from "@/lib/db";
import { companyProfiles, scores, tenders, structuredData } from "@/lib/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Box, Chip, Container, Divider, Paper, Stack, Typography, Breadcrumbs } from "@mui/material";
import { Building2, MapPin, ShieldCheck, Wrench, Home as HomeIcon } from "lucide-react";
import { formatDeadlineDE, deadlineLabel, deadlineColor, sanitizeTenderUrl } from "@/lib/date-utils";

export const revalidate = 3600;
export const runtime = "nodejs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function hasMatchingTenders(companyId: number): Promise<boolean> {
  const rows = await db
    .select({ tenderId: scores.tenderId })
    .from(scores)
    .leftJoin(tenders, eq(scores.tenderId, tenders.id))
    .where(
      and(
        eq(scores.companyId, companyId),
        or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
      ),
    )
    .limit(1);
  return rows.length > 0;
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
  const hasTenders = await hasMatchingTenders(rows[0].id);
  const noDescription = !rows[0].description || rows[0].description.trim().length === 0;
  const shouldNoindex = !hasTenders || noDescription;

  return {
    title,
    description,
    ...(shouldNoindex ? { robots: { index: false, follow: true } } : {}),
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
    })
    .from(scores)
    .leftJoin(tenders, eq(scores.tenderId, tenders.id))
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      eq(scores.companyId, company.id),
      or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
    ))
    .orderBy(desc(scores.winProbability), desc(scores.fit))
    .limit(10);

  const tendersList = matchedRows.map((row) => {
    const blob = (row.jsonBlob ?? {}) as Record<string, unknown>;
    const hardFacts = (blob.hard_facts ?? {}) as Record<string, unknown>;
    const procurement = (blob.procurement ?? {}) as Record<string, unknown>;
    const contractValue = (procurement.contract_value ?? {}) as Record<string, unknown>;

    const description = typeof blob.description === "string"
      ? blob.description
      : typeof blob.summary === "string"
        ? blob.summary.slice(0, 300)
        : (row.rawText ?? "").slice(0, 300);

    // Use public portal URL from structured_data if tenders.url is evergabe.de paywall
    const rawUrl = row.url ?? null;
    const sourceUrl = typeof blob.sourceUrl === "string" ? blob.sourceUrl : null;
    const tenderUrl = sanitizeTenderUrl(rawUrl, sourceUrl);

    return {
      id: row.tenderId,
      title: row.title ?? `Ausschreibung #${row.tenderId}`,
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
    };
  });

  const fitColor = (fit: number) => fit >= 75 ? "success" : fit >= 50 ? "warning" : "error";

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

      <Box sx={{ minHeight: "100vh", bgcolor: "grey.50", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="md">
          {/* Breadcrumbs */}
          <Breadcrumbs sx={{ mb: 3, fontSize: "0.85rem" }} separator={<span style={{ color: "#999" }}>/</span>}>
            <Link href="/" style={{ color: "#667288", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <HomeIcon size={14} />
              Start
            </Link>
            <Link href="/ausschreibungen" style={{ color: "#667288", textDecoration: "none" }}>
              Ausschreibungen
            </Link>
            <Typography color="text.primary" fontSize="0.85rem">{company.name}</Typography>
          </Breadcrumbs>

          <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 4, border: 1, borderColor: "divider" }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              {company.logoUrl && (
                <Image
                  src={company.logoUrl}
                  alt={`${company.name} Logo`}
                  width={56}
                  height={56}
                  loading="lazy"
                  style={{ borderRadius: 4, objectFit: "contain", backgroundColor: "#f5f5f5" }}
                  unoptimized
                />
              )}
              <Box>
                <Typography variant="h5" component="h1" fontWeight={700}>{company.name}</Typography>
              {company.industry && (
                <Typography variant="body2" color="text.secondary">{company.industry}</Typography>
              )}
            </Box>
          </Stack>

          {company.description && (
            <Typography variant="body1" sx={{ mb: 3, color: "text.secondary" }}>
              {company.description}
            </Typography>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {capabilities.map((cap) => (
              <Chip key={cap} icon={<Wrench size={14} />} label={cap} size="small" variant="outlined" />
            ))}
          </Stack>

          {certifications.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {certifications.map((cert) => (
                <Chip key={cert} icon={<ShieldCheck size={14} />} label={cert} size="small" color="info" variant="outlined" />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {regions.length > 0 && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <MapPin size={14} />
                <Typography variant="caption" color="text.secondary">{regions.join(", ")}</Typography>
              </Stack>
            )}
            {company.teamSize && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Building2 size={14} />
                <Typography variant="caption" color="text.secondary">{company.teamSize} Mitarbeiter</Typography>
              </Stack>
            )}
            {company.address && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <MapPin size={14} />
                <Typography variant="caption" color="text.secondary">{company.address}</Typography>
              </Stack>
            )}
          </Stack>
        </Paper>

        <Typography variant="h2" component="h2" fontWeight={600} sx={{ mb: 2, fontSize: { xs: "1.25rem", md: "1.5rem" } }}>
          Passende Ausschreibungen
        </Typography>

        {tendersList.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, textAlign: "center", border: 1, borderColor: "divider" }}>
            <Typography color="text.secondary">Noch keine passenden Ausschreibungen gefunden.</Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {tendersList.map((tender) => (
              <Paper
                key={tender.id}
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  border: 1,
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                      <Link
                        href={`/ausschreibung/${tender.id}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {tender.title}
                      </Link>
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
                      {tender.description.length > 250 ? `${tender.description.slice(0, 250)}...` : tender.description}
                    </Typography>

                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                      {tender.location && (
                        <Typography variant="caption" color="text.secondary">📍 {tender.location}</Typography>
                      )}
                      {tender.volume && (
                        <Typography variant="caption" color="text.secondary">💰 {tender.volume}</Typography>
                      )}
                      {tender.deadline && (
                        <Typography variant="caption" color={deadlineColor(tender.deadline)}>
                          📅 {formatDeadlineDE(tender.deadline)} ({deadlineLabel(tender.deadline)})
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  <Chip
                    label={`${tender.fit}%`}
                    color={fitColor(tender.fit)}
                    size="small"
                    sx={{ fontWeight: 700, minWidth: 52 }}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 4 }} />

          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Powered by{" "}
              <Box component="a" href="https://palemaz.com" target="_blank" rel="nofollow noopener noreferrer" sx={{ color: "primary.main", textDecoration: "none", fontWeight: 600 }}>
                Tenderhunter
              </Box>
              {" "}– KI-gestützte Ausschreibungssuche
            </Typography>
          </Box>
        </Container>
      </Box>
    </>
  );
}
