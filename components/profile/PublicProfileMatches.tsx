import { and, desc, eq, gt, sql } from "drizzle-orm";
import Link from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import { db } from "@/lib/db";
import { scores, tenders, structuredData } from "@/lib/schema";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { findPublicProfileMatches, type PublicProfileMatch } from "@/lib/discovery";
import { decodeHtmlEntities } from "@/lib/text-normalization";
import { normalizePublicClient, pickValidatedPublicCandidate, pickValidatedPublicLocationForTender } from "@/lib/public-content-quality";
import { pickPublicTenderDescription } from "@/lib/tender-meta";
import { daysUntil, getDeadlineState, parseDeadlineDate } from "@/lib/date-utils";
import {
  buildProfileSummary,
  sortProfileTenders,
  truncateProfileText,
  PUBLIC_PROFILE_FALLBACK_CANDIDATE_LIMIT,
  type ProfileTender,
} from "@/lib/public-profile";
import { TenderSectionHeader } from "@/components/profile/TenderSectionHeader";
import { TenderCard } from "@/components/profile/TenderCard";

interface PublicProfileCompany {
  id: number;
  name: string;
  industry: string | null;
  capabilitiesJson: unknown;
  certificationsJson: unknown;
  regionsJson: unknown;
  teamSize: number | null;
}

const mapProfileMatch = (row: PublicProfileMatch): ProfileTender => {
  const blob = (row.jsonBlob ?? {}) as Record<string, unknown>;
  const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
  const hardFacts = (blob.hard_facts ?? {}) as Record<string, unknown>;
  const procurement = (blob.procurement ?? {}) as Record<string, unknown>;
  const contractValue = (procurement.contract_value ?? {}) as Record<string, unknown>;
  const parsedDeadline = parseDeadlineDate(row.deadlineAt ?? (typeof hardFacts.deadline === "string" ? hardFacts.deadline : null));
  const description = pickPublicTenderDescription({ structured: blob, metadata, rawText: row.rawText });
  const rawTitle = pickValidatedPublicCandidate(blob.title, row.title) || `Ausschreibung #${row.tenderId}`;
  const client = normalizePublicClient(hardFacts.buyer) || normalizePublicClient(metadata.client);
  const location = pickValidatedPublicLocationForTender(rawTitle, client, hardFacts.location, metadata.location) || null;

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

export async function PublicProfileMatches({ company }: { company: PublicProfileCompany }) {
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

  const persistedTenders = matchedRows.map(mapProfileMatch);
  const persistedTenderIds = new Set(persistedTenders.map((tender) => tender.id));
  const persistedCurrent = persistedTenders.filter((tender) => tender.deadlineState !== "expired");
  const fallbackRows = persistedCurrent.length < 10
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
  const fallbackTenders = fallbackRows.map(mapProfileMatch);
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

  return (
    <Box component="section" aria-labelledby="profile-matches-heading" sx={{ mt: { xs: 2.5, md: 3.5 }, p: { xs: 1.5, sm: 2, md: 2.5 }, bgcolor: "#e4edf3", border: "1px solid #d3e0e8", borderRadius: "18px" }}>
      <Typography sx={{ mb: 1, color: "#667288", fontSize: "0.8rem" }}>
        {tendersList.length} Treffer · Bester Fit {bestFit === null ? "–" : `${bestFit}%`}
        {summary.expiredCount > 0 ? ` · ${summary.expiredCount} abgelaufen` : ""}
      </Typography>
      <TenderSectionHeader count={summary.currentCount} summary={summary} />
      {tendersList.length === 0 ? (
        <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center", bgcolor: "#fbfcfd", borderRadius: "12px", border: "1px solid #dce6ed" }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1, fontWeight: 700 }}>Aktuell keine passenden Ausschreibungen</Typography>
          <Typography sx={{ color: "#667288", fontSize: "0.875rem", maxWidth: 620, mx: "auto", lineHeight: 1.7 }}>
            Für dieses Firmenprofil wurden derzeit keine passenden aktiven Vergaben gefunden. Neue Ausschreibungen werden laufend ergänzt. Nutzen Sie bis dahin unsere aktuellen Vergaben, Tools und Vorlagen.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Link href="/ausschreibungen" style={{ color: "#c45342", fontWeight: 700, textDecoration: "none" }}>Alle Ausschreibungen</Link>
            <Link href="/tools" style={{ color: "#c45342", fontWeight: 700, textDecoration: "none" }}>Vergabe-Tools</Link>
            <Link href="/vorlagen" style={{ color: "#c45342", fontWeight: 700, textDecoration: "none" }}>Vorlagen &amp; Muster</Link>
          </Stack>
        </Box>
      ) : (
        <>
          {currentTenders.length > 0 && <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, m: 0 }}>
            {currentTenders.map((tender) => <Box component="li" key={tender.id}><TenderCard {...tender} /></Box>)}
          </Stack>}
          {expiredTenders.length > 0 && <Box component="section" aria-labelledby="expired-matches-heading" sx={{ mt: { xs: 3, md: 4 } }}>
            <Typography id="expired-matches-heading" component="h2" sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#475569" }}>Abgelaufene Ausschreibungen</Typography>
            <Typography sx={{ color: "#7b8798", fontSize: "0.75rem", mt: 0.25, mb: 1 }}>Zur Einordnung, nicht mehr im aktuellen Fokus · {expiredTenders.length} Treffer</Typography>
            <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, m: 0 }}>
              {expiredTenders.map((tender) => <Box component="li" key={tender.id}><TenderCard {...tender} /></Box>)}
            </Stack>
          </Box>}
        </>
      )}
    </Box>
  );
}
