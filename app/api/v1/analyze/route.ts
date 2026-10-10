import { db } from "@/lib/db";
import { companyProfiles, scores, tenders, structuredData, insights, apiJobs } from "@/lib/schema";
import { requireApiKey } from "@/lib/api-auth";
import { generateSlug } from "@/lib/slug";
import { scrapeWebsite } from "@/lib/firecrawl";
import { extractCompanyProfile } from "@/lib/perplexity";
import { buildTenderMatchDocument, computeScores, getDomainEligibility, getLocationEligibility, llmBatchDomainMatch, type CompanyRow } from "@/lib/scoring";
import { findPublicProfileMatches } from "@/lib/discovery";
import { generateInsight } from "@/lib/insights";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { normalizeStructured, type StructuredData as StructuredTenderData } from "@/lib/structurer";
import { enqueueJob } from "@/lib/queue";
import { JOB_API_ANALYZE } from "@/lib/types";
import { getSiteUrl } from "@/lib/site-config";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = getSiteUrl();

interface AnalyzeBody {
  url: string;
}

const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url;
  }
};

const equivalentSchemeUrl = (url: string): string =>
  url.startsWith("https://") ? `http://${url.slice("https://".length)}` : `https://${url.slice("http://".length)}`;

interface StoredCompanyProfile {
  id: number;
  name: string;
  slug: string | null;
  websiteUrl: string | null;
  description: string | null;
  industry: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  capabilitiesJson: unknown;
  certificationsJson: unknown;
  teamSize: number | null;
  regionsJson: unknown;
  updatedAt: Date;
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

const profileNeedsRefresh = (profile: StoredCompanyProfile): boolean => {
  const hasCapabilities = stringArray(profile.capabilitiesJson).length > 0;
  const hasRegions = stringArray(profile.regionsJson).length > 0;
  const isStale = Date.now() - new Date(profile.updatedAt).getTime() > 30 * 24 * 60 * 60 * 1000;
  return !hasCapabilities || !hasRegions || !profile.industry || isStale;
};

const toCompanyRow = (profile: StoredCompanyProfile): CompanyRow => ({
  capabilities_json: JSON.stringify(stringArray(profile.capabilitiesJson)),
  certifications_json: JSON.stringify(stringArray(profile.certificationsJson)),
  regions_json: JSON.stringify(stringArray(profile.regionsJson)),
  team_size: profile.teamSize,
  industry: profile.industry,
});

async function refreshCompanyProfile(
  current: StoredCompanyProfile,
  websiteUrl: string,
): Promise<StoredCompanyProfile> {
  const scraped = await scrapeWebsite(websiteUrl);
  if (!scraped.markdown || scraped.markdown.trim().length < 50) {
    throw new Error("Website lieferte zu wenig Inhalt für die Profilaktualisierung.");
  }

  const canonicalUrl = normalizeUrl(scraped.url);
  const extracted = await extractCompanyProfile(`${scraped.html}\n${scraped.markdown}`, canonicalUrl);
  const capabilities = extracted.capabilities.length > 0 ? extracted.capabilities : stringArray(current.capabilitiesJson);
  const certifications = extracted.certifications.length > 0 ? extracted.certifications : stringArray(current.certificationsJson);
  const regions = extracted.regions.length > 0 ? extracted.regions : stringArray(current.regionsJson);
  const merged = {
    websiteUrl: canonicalUrl,
    description: extracted.description || current.description,
    industry: extracted.industry || current.industry,
    logoUrl: extracted.logo_url || current.logoUrl,
    contactEmail: extracted.contact_email || current.contactEmail,
    contactPhone: extracted.contact_phone || current.contactPhone,
    address: extracted.address || current.address,
    capabilitiesJson: capabilities,
    certificationsJson: certifications,
    teamSize: extracted.team_size ?? current.teamSize,
    regionsJson: regions,
    updatedAt: new Date(),
  };

  await db.update(companyProfiles).set(merged).where(eq(companyProfiles.id, current.id));
  return { ...current, ...merged };
}

const findCompanyProfileByUrl = async (url: string) => {
  const alternateUrl = equivalentSchemeUrl(url);
  return db
    .select()
    .from(companyProfiles)
    .where(or(eq(companyProfiles.websiteUrl, url), eq(companyProfiles.websiteUrl, alternateUrl)))
    .limit(1);
};

interface TenderResult {
  id: number;
  title: string;
  description: string;
  location: string | null;
  volume: string | null;
  fit: number;
  winProbability: number;
  url: string | null;
  deadline: string | null;
  readinessStatus: string | null;
}

type TenderResultRow = {
  id: number;
  title: string | null;
  rawText: string | null;
  jsonBlob: unknown;
  url: string | null;
  fit: number | null;
  winProbability: number | null;
  readinessStatus: string | null;
};

const toTenderResult = (row: TenderResultRow): TenderResult => {
  const blob = (row.jsonBlob ?? {}) as Record<string, unknown>;
  const hardFacts = (blob.hard_facts ?? {}) as Record<string, unknown>;
  const procurement = (blob.procurement ?? {}) as Record<string, unknown>;
  const contractValue = (procurement.contract_value ?? {}) as Record<string, unknown>;

  const description = typeof blob.description === "string" ? blob.description
    : typeof blob.summary === "string" ? blob.summary.slice(0, 300)
    : (row.rawText ?? "").slice(0, 300);

  return {
    id: row.id,
    title: row.title ?? `Ausschreibung #${row.id}`,
    description,
    location: typeof hardFacts.location === "string" ? hardFacts.location : null,
    volume: typeof hardFacts.budget === "string" ? hardFacts.budget
      : typeof contractValue.max === "number" ? `${contractValue.max.toLocaleString("de-DE")} EUR`
      : null,
    fit: Math.round(row.fit ?? 0),
    winProbability: Math.round(row.winProbability ?? 0),
    url: row.url ?? null,
    deadline: typeof hardFacts.deadline === "string" ? hardFacts.deadline : null,
    readinessStatus: row.readinessStatus,
  };
};

async function runAnalysis(jobId: number, url: string) {
  try {
    const normalizedUrl = normalizeUrl(url);

    const existingProfile = await findCompanyProfileByUrl(normalizedUrl);

    let companyId: number;
    let companyName: string;
    let companySlug: string;
    let scoringCompany: CompanyRow | undefined;

    if (existingProfile.length > 0) {
      let profile = existingProfile[0] as StoredCompanyProfile;
      companyId = profile.id;
      companyName = profile.name;
      companySlug = profile.slug ?? generateSlug(companyName);
      if (!profile.slug) {
        await db.update(companyProfiles).set({ slug: companySlug }).where(eq(companyProfiles.id, companyId));
      }
      if (profileNeedsRefresh(profile)) {
        try {
          profile = await refreshCompanyProfile(profile, normalizedUrl);
          console.log(`[api/v1/analyze] Profil aktualisiert: ${profile.name}`);
        } catch (refreshError) {
          console.warn(`[api/v1/analyze] Profilaktualisierung fehlgeschlagen, verwende bestehenden Stand:`, refreshError);
        }
      }
       scoringCompany = toCompanyRow(profile);
       await scoreAllTenders(companyId, scoringCompany);
    } else {
      const scraped = await scrapeWebsite(normalizedUrl);
      if (!scraped.markdown || scraped.markdown.trim().length < 50) {
        await db.update(apiJobs).set({ status: "failed", error: "Website lieferte zu wenig Inhalt.", updatedAt: new Date() }).where(eq(apiJobs.id, jobId));
        return;
      }

      const canonicalUrl = normalizeUrl(scraped.url);

      if (canonicalUrl !== normalizedUrl) {
         const existingByCanonical = await db
           .select()
           .from(companyProfiles)
           .where(eq(companyProfiles.websiteUrl, canonicalUrl))
           .limit(1);

        if (existingByCanonical.length > 0) {
          companyId = existingByCanonical[0].id;
          companyName = existingByCanonical[0].name;
          companySlug = existingByCanonical[0].slug ?? generateSlug(companyName);
          if (!existingByCanonical[0].slug) {
            await db.update(companyProfiles).set({ slug: companySlug }).where(eq(companyProfiles.id, companyId));
          }
           const topTenders = await getTopTenders(
             companyId,
             toCompanyRow(existingByCanonical[0] as StoredCompanyProfile),
           );
          const profileUrl = `${BASE_URL}/p/${companySlug}`;
          await db.update(apiJobs).set({
            status: "completed", companyId, profileUrl, tendersJson: topTenders, updatedAt: new Date(),
          }).where(eq(apiJobs.id, jobId));
          return;
        }
      }

      const profile = await extractCompanyProfile(`${scraped.html}\n${scraped.markdown}`, canonicalUrl);
      const slug = generateSlug(profile.name);

      const existingByName = await db
        .select({ id: companyProfiles.id, slug: companyProfiles.slug })
        .from(companyProfiles)
        .where(eq(companyProfiles.name, profile.name))
        .limit(1);

      if (existingByName.length > 0) {
        companyId = existingByName[0].id;
        companyName = profile.name;
        companySlug = existingByName[0].slug ?? slug;
        await db.update(companyProfiles).set({
          websiteUrl: canonicalUrl, description: profile.description, industry: profile.industry,
          logoUrl: profile.logo_url, contactEmail: profile.contact_email, contactPhone: profile.contact_phone,
          address: profile.address, capabilitiesJson: profile.capabilities, certificationsJson: profile.certifications,
          teamSize: profile.team_size, regionsJson: profile.regions, slug: companySlug, updatedAt: new Date(),
        }).where(eq(companyProfiles.id, companyId));
      } else {
        let uniqueSlug = slug;
        const existingSlug = await db.select({ id: companyProfiles.id }).from(companyProfiles).where(eq(companyProfiles.slug, uniqueSlug)).limit(1);
        if (existingSlug.length > 0) {
          uniqueSlug = `${slug}-${Date.now()}`;
        }

        const result = await db.insert(companyProfiles).values({
          name: profile.name, slug: uniqueSlug, websiteUrl: canonicalUrl, description: profile.description,
          industry: profile.industry, logoUrl: profile.logo_url, contactEmail: profile.contact_email,
          contactPhone: profile.contact_phone, address: profile.address, capabilitiesJson: profile.capabilities,
          certificationsJson: profile.certifications, teamSize: profile.team_size, regionsJson: profile.regions,
        }).returning({ id: companyProfiles.id });

        companyId = result[0].id;
        companyName = profile.name;
        companySlug = uniqueSlug;
      }

       const companyRow: CompanyRow = {
         capabilities_json: JSON.stringify(profile.capabilities),
        certifications_json: JSON.stringify(profile.certifications),
        regions_json: JSON.stringify(profile.regions),
        team_size: profile.team_size,
        industry: profile.industry,
       };

       scoringCompany = companyRow;
       await scoreAllTenders(companyId, companyRow);
    }

    const topTenders = await getTopTenders(companyId, scoringCompany);
    const profileUrl = `${BASE_URL}/p/${companySlug}`;

    await db.update(apiJobs).set({
      status: "completed", companyId, profileUrl, tendersJson: topTenders, updatedAt: new Date(),
    }).where(eq(apiJobs.id, jobId));

  } catch (error) {
    console.error(`[api/v1/analyze] Background analysis failed for job ${jobId}:`, error);
    await db.update(apiJobs).set({
      status: "failed", error: error instanceof Error ? error.message : "Unbekannter Fehler", updatedAt: new Date(),
    }).where(eq(apiJobs.id, jobId));
    throw error;
  }
}

async function scoreAllTenders(companyId: number, companyRow: CompanyRow) {
  const allTenders = await db
    .select({
      id: tenders.id,
      title: tenders.title,
      metadataJson: tenders.metadataJson,
      readinessStatus: tenders.readinessStatus,
    })
    .from(tenders)
    .where(and(
      eq(tenders.qualityStatus, "qualified"),
      eq(tenders.readinessStatus, "ready"),
      sql`${tenders.rawText} IS NOT NULL AND BTRIM(${tenders.rawText}) <> ''`,
    ))
    .orderBy(desc(tenders.createdAt))
    .limit(200);

  // Load structured data for all tenders
  const tenderData: Array<{
    id: number; title: string;
    structured: StructuredTenderData;
    location: {
      metadataLocation: unknown;
      metadataDescription: unknown;
      structuredLocation: string | null;
    };
  }> = [];

  for (const tender of allTenders) {
    const structuredRows = await db
      .select({ jsonBlob: structuredData.jsonBlob })
      .from(structuredData)
      .where(eq(structuredData.tenderId, tender.id))
      .limit(1);

    if (structuredRows.length > 0) {
      try {
        const parsed = normalizeStructured(structuredRows[0].jsonBlob, tender.title ?? "");
        const metadata = typeof tender.metadataJson === "object" && tender.metadataJson !== null
          ? tender.metadataJson as Record<string, unknown>
          : {};
        tenderData.push({
          id: tender.id,
          title: tender.title ?? "",
          structured: parsed,
          location: {
            metadataLocation: metadata.location,
            metadataDescription: metadata.description,
            structuredLocation: parsed.hard_facts.location,
          },
        });
      } catch { continue; }
    }
  }

  // LLM batch domain matching — understands semantics, compound words, synonyms
  const capabilities = JSON.parse(companyRow.capabilities_json || "[]") as string[];
  const regions = JSON.parse(companyRow.regions_json || "[]") as string[];
  const llmScores = await llmBatchDomainMatch(
    capabilities,
    companyRow.industry ?? null,
    regions,
    tenderData.filter((t) =>
      getLocationEligibility(companyRow, t.location).status === "match" &&
      getDomainEligibility(companyRow, t.title, t.structured, t.location).status === "match",
    ).map((t) => {
      const document = buildTenderMatchDocument(t.title, t.structured, t.location);
      return {
        id: t.id,
        title: t.title,
        scope: document.scope,
        description: document.description,
      };
    }),
  );
  console.log(`[analyze] LLM domain scores for ${llmScores.size}/${tenderData.length} tenders`);

  // Compute final scores
  for (const { id, title, structured, location } of tenderData) {
    const llmScore = llmScores.get(id);
    const scoreResult = computeScores(title, structured, companyRow, llmScore, location);
    const insight = generateInsight(scoreResult, structured);

    await db.insert(scores).values({
      tenderId: id, companyId, fit: scoreResult.fit, winProbability: scoreResult.win_probability,
      effort: scoreResult.effort, requirementCoverage: scoreResult.requirement_coverage,
      killSwitch: scoreResult.kill_switch, detailsJson: scoreResult.details,
    }).onConflictDoUpdate({
      target: [scores.tenderId, scores.companyId],
      set: { fit: scoreResult.fit, winProbability: scoreResult.win_probability, effort: scoreResult.effort,
        requirementCoverage: scoreResult.requirement_coverage, killSwitch: scoreResult.kill_switch,
        detailsJson: scoreResult.details, updatedAt: new Date() },
    });

    await db.insert(insights).values({
      tenderId: id, companyId, explanation: insight.explanation,
      actionsJson: insight.actions, missingItemsJson: insight.missing_items,
    }).onConflictDoUpdate({
      target: [insights.tenderId, insights.companyId],
      set: { explanation: insight.explanation, actionsJson: insight.actions,
        missingItemsJson: insight.missing_items, updatedAt: new Date() },
    });
  }
}

async function getTopTenders(companyId: number, companyRow?: CompanyRow): Promise<TenderResult[]> {
  const rows = await db
    .select({
      id: scores.tenderId, title: tenders.title, source: tenders.source, url: tenders.url,
      fit: scores.fit, winProbability: scores.winProbability,
      rawText: tenders.rawText,
      jsonBlob: structuredData.jsonBlob,
      readinessStatus: tenders.readinessStatus,
    })
    .from(scores)
    .leftJoin(tenders, eq(scores.tenderId, tenders.id))
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      eq(scores.companyId, companyId),
      eq(scores.killSwitch, false),
      eq(tenders.qualityStatus, "qualified"),
      eq(tenders.readinessStatus, "ready"),
      sql`${tenders.rawText} IS NOT NULL AND BTRIM(${tenders.rawText}) <> ''`,
    ))
    .orderBy(desc(scores.winProbability), desc(scores.fit))
    .limit(10);

  const filtered = rows.filter((row) => (row.fit ?? 0) >= 15);
  const MIN_TENDERS = 5;
  const results = filtered.length >= MIN_TENDERS ? filtered : rows.slice(0, MIN_TENDERS);
  const strictResults = results.map((row) => toTenderResult({
    id: row.id,
    title: row.title,
    rawText: row.rawText,
    jsonBlob: row.jsonBlob,
    url: row.url,
    fit: row.fit,
    winProbability: row.winProbability,
    readinessStatus: row.readinessStatus,
  }));

  if (!companyRow || strictResults.length >= 10) return strictResults;

  const publicMatches = await findPublicProfileMatches(
    companyRow,
    new Set(strictResults.map((row) => row.id)),
    10 - strictResults.length,
    { qualifiedOnly: true },
  );

  return [
    ...strictResults,
    ...publicMatches.map((row) => toTenderResult({
      id: row.tenderId,
      title: row.title,
      rawText: row.rawText,
      jsonBlob: row.jsonBlob,
      url: row.url,
      fit: row.fit,
      winProbability: row.winProbability,
      readinessStatus: row.readinessStatus,
    })),
  ];
}

export async function runApiAnalysisJob(payload: {
  apiJobId: number;
  url: string;
  mode?: "full" | "rescore";
  companyId?: number;
  profileSlug?: string;
}): Promise<void> {
  if (payload.mode !== "rescore") {
    await runAnalysis(payload.apiJobId, payload.url);
    return;
  }

  try {
    if (!payload.companyId || !payload.profileSlug) {
      throw new Error("Rescore-Job benötigt companyId und profileSlug.");
    }

    const profileRows = await db
      .select({
        capabilitiesJson: companyProfiles.capabilitiesJson,
        certificationsJson: companyProfiles.certificationsJson,
        regionsJson: companyProfiles.regionsJson,
        teamSize: companyProfiles.teamSize,
        industry: companyProfiles.industry,
      })
      .from(companyProfiles)
      .where(eq(companyProfiles.id, payload.companyId))
      .limit(1);

    if (profileRows.length === 0) throw new Error("Unternehmensprofil nicht gefunden.");

    const companyRow: CompanyRow = {
      capabilities_json: JSON.stringify(profileRows[0].capabilitiesJson),
      certifications_json: JSON.stringify(profileRows[0].certificationsJson),
      regions_json: JSON.stringify(profileRows[0].regionsJson),
      team_size: profileRows[0].teamSize,
      industry: profileRows[0].industry,
    };

    await scoreAllTenders(payload.companyId, companyRow);

    await db.update(apiJobs).set({
      status: "completed",
      companyId: payload.companyId,
      profileUrl: `${BASE_URL}/p/${payload.profileSlug}`,
      tendersJson: await getTopTenders(payload.companyId, companyRow),
      updatedAt: new Date(),
    }).where(eq(apiJobs.id, payload.apiJobId));
  } catch (error) {
    await db.update(apiJobs).set({
      status: "failed",
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
      updatedAt: new Date(),
    }).where(eq(apiJobs.id, payload.apiJobId));
    throw error;
  }
}

type ApiAnalysisQueuePayload = {
  apiJobId: number;
  url: string;
  mode?: "full" | "rescore";
  companyId?: number;
  profileSlug?: string;
};

const enqueueApiAnalysis = (payload: ApiAnalysisQueuePayload): Promise<number> =>
  enqueueJob(
    JOB_API_ANALYZE,
    {
      api_job_id: payload.apiJobId,
      url: payload.url,
      ...(payload.mode ? { mode: payload.mode } : {}),
      ...(payload.companyId !== undefined ? { company_id: payload.companyId } : {}),
      ...(payload.profileSlug ? { profile_slug: payload.profileSlug } : {}),
    },
    {
      jobKey: `${JOB_API_ANALYZE}:${payload.apiJobId}`,
      priority: 200,
    },
  );

export async function POST(request: Request): Promise<Response> {
  const authError = requireApiKey(request);
  if (authError) return authError;

  let body: AnalyzeBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungueltiger JSON-Body." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return Response.json({ error: "URL ist erforderlich." }, { status: 400 });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return Response.json({ error: "Ungueltige URL." }, { status: 400 });
  }

  const normalizedUrl = normalizeUrl(parsedUrl.toString());

  const existingProfile = await findCompanyProfileByUrl(normalizedUrl);

  if (existingProfile.length > 0) {
    const existing = existingProfile[0];
    let slug = existing.slug;
    if (!slug) {
      slug = generateSlug(existing.name);
      await db.update(companyProfiles).set({ slug }).where(eq(companyProfiles.id, existing.id));
    }

    if (profileNeedsRefresh(existing as StoredCompanyProfile)) {
      const jobResult = await db.insert(apiJobs).values({
        companyUrl: normalizedUrl, status: "processing", companyId: existing.id,
      }).returning({ id: apiJobs.id });

       const jobId = jobResult[0].id;
       try {
         await enqueueApiAnalysis({ apiJobId: jobId, url: normalizedUrl });
       } catch (error) {
         await db.update(apiJobs).set({ status: "failed", error: error instanceof Error ? error.message : "Analyse konnte nicht eingeplant werden.", updatedAt: new Date() }).where(eq(apiJobs.id, jobId));
         throw error;
       }
      return Response.json({ jobId, status: "processing" });
    }

     const topTenders = await getTopTenders(
       existing.id,
       toCompanyRow(existing as StoredCompanyProfile),
     );

    if (topTenders.length === 0) {
      const jobResult = await db.insert(apiJobs).values({
        companyUrl: normalizedUrl, status: "processing", companyId: existing.id,
      }).returning({ id: apiJobs.id });

      const jobId = jobResult[0].id;
       try {
         await enqueueApiAnalysis({
           apiJobId: jobId,
           url: normalizedUrl,
           mode: "rescore",
           companyId: existing.id,
           profileSlug: slug,
         });
       } catch (error) {
         await db.update(apiJobs).set({ status: "failed", error: error instanceof Error ? error.message : "Analyse konnte nicht eingeplant werden.", updatedAt: new Date() }).where(eq(apiJobs.id, jobId));
         throw error;
       }

      return Response.json({ jobId, status: "processing" });
    }

    const profileUrl = `${BASE_URL}/p/${slug}`;

    const jobResult = await db.insert(apiJobs).values({
      companyUrl: normalizedUrl, status: "completed", companyId: existing.id,
      profileUrl, tendersJson: topTenders,
    }).returning({ id: apiJobs.id });

    return Response.json({
      jobId: jobResult[0].id,
      status: "completed",
      profileUrl,
      company: { id: existing.id, name: existing.name },
      tenders: topTenders,
    });
  }

  const jobResult = await db.insert(apiJobs).values({
    companyUrl: normalizedUrl, status: "processing",
  }).returning({ id: apiJobs.id });

   const jobId = jobResult[0].id;
   try {
     await enqueueApiAnalysis({ apiJobId: jobId, url: normalizedUrl });
   } catch (error) {
     await db.update(apiJobs).set({ status: "failed", error: error instanceof Error ? error.message : "Analyse konnte nicht eingeplant werden.", updatedAt: new Date() }).where(eq(apiJobs.id, jobId));
     throw error;
   }

  return Response.json({ jobId, status: "processing" });
}
