import { db } from "@/lib/db";
import { companyProfiles, scores, tenders, structuredData, insights, apiJobs } from "@/lib/schema";
import { requireApiKey } from "@/lib/api-auth";
import { generateSlug } from "@/lib/slug";
import { scrapeWebsite } from "@/lib/firecrawl";
import { extractCompanyProfile } from "@/lib/perplexity";
import { computeScores, llmBatchDomainMatch, type CompanyRow } from "@/lib/scoring";
import { generateInsight } from "@/lib/insights";
import { eq, and, or, desc } from "drizzle-orm";
import { normalizeStructured, type StructuredData as StructuredTenderData } from "@/lib/structurer";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://tenderhunter.palemadigital.com";

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
}

async function runAnalysis(jobId: number, url: string) {
  try {
    const normalizedUrl = normalizeUrl(url);

    const existingProfile = await findCompanyProfileByUrl(normalizedUrl);

    let companyId: number;
    let companyName: string;
    let companySlug: string;

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
      await scoreAllTenders(companyId, toCompanyRow(profile));
    } else {
      const scraped = await scrapeWebsite(normalizedUrl);
      if (!scraped.markdown || scraped.markdown.trim().length < 50) {
        await db.update(apiJobs).set({ status: "failed", error: "Website lieferte zu wenig Inhalt.", updatedAt: new Date() }).where(eq(apiJobs.id, jobId));
        return;
      }

      const canonicalUrl = normalizeUrl(scraped.url);

      if (canonicalUrl !== normalizedUrl) {
        const existingByCanonical = await db
          .select({ id: companyProfiles.id, name: companyProfiles.name, slug: companyProfiles.slug })
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
          const topTenders = await getTopTenders(companyId);
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

      await scoreAllTenders(companyId, companyRow);
    }

    const topTenders = await getTopTenders(companyId);
    const profileUrl = `${BASE_URL}/p/${companySlug}`;

    await db.update(apiJobs).set({
      status: "completed", companyId, profileUrl, tendersJson: topTenders, updatedAt: new Date(),
    }).where(eq(apiJobs.id, jobId));

  } catch (error) {
    console.error(`[api/v1/analyze] Background analysis failed for job ${jobId}:`, error);
    await db.update(apiJobs).set({
      status: "failed", error: error instanceof Error ? error.message : "Unbekannter Fehler", updatedAt: new Date(),
    }).where(eq(apiJobs.id, jobId));
  }
}

async function scoreAllTenders(companyId: number, companyRow: CompanyRow) {
  const allTenders = await db
    .select({ id: tenders.id, title: tenders.title })
    .from(tenders)
    .where(or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")))
    .orderBy(desc(tenders.createdAt))
    .limit(200);

  // Load structured data for all tenders
  const tenderData: Array<{
    id: number; title: string;
    structured: StructuredTenderData;
    hasStructured: boolean;
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
        tenderData.push({ id: tender.id, title: tender.title ?? "", structured: parsed, hasStructured: true });
      } catch { continue; }
    } else {
      const text = tender.title ?? "";
      const mockStructured: StructuredTenderData = {
        title: text, summary: text, confidence: 0.3,
        hard_facts: { location: "Deutschland", deadline: null, budget: null, buyer: null, contract_type: null },
        decision_relevant: { scope: text.split(" ").filter((w) => w.length > 3), requirements: [], mandatory_documents: [], award_criteria: [] },
        procurement: { contract_value: { min: null, max: null, currency: "EUR" }, contract_duration: { months: null, renewal: false }, award_criteria_detailed: [], participation_requirements: [], cpv_codes: [], procedure_type: "offen" },
      };
      tenderData.push({ id: tender.id, title: text, structured: mockStructured, hasStructured: false });
    }
  }

  // LLM batch domain matching — understands semantics, compound words, synonyms
  const capabilities = JSON.parse(companyRow.capabilities_json || "[]") as string[];
  const regions = JSON.parse(companyRow.regions_json || "[]") as string[];
  const llmScores = await llmBatchDomainMatch(
    capabilities,
    companyRow.industry ?? null,
    regions,
    tenderData.map((t) => ({
      id: t.id,
      title: t.title,
      scope: t.structured.decision_relevant.scope.join(" "),
      description: t.structured.summary ?? "",
    })),
  );
  console.log(`[analyze] LLM domain scores for ${llmScores.size}/${tenderData.length} tenders`);

  // Compute final scores
  for (const { id, title, structured } of tenderData) {
    const llmScore = llmScores.get(id);
    const scoreResult = computeScores(title, structured, companyRow, llmScore);
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

async function getTopTenders(companyId: number): Promise<TenderResult[]> {
  const rows = await db
    .select({
      id: scores.tenderId, title: tenders.title, source: tenders.source, url: tenders.url,
      fit: scores.fit, winProbability: scores.winProbability,
      rawText: tenders.rawText,
      jsonBlob: structuredData.jsonBlob,
    })
    .from(scores)
    .leftJoin(tenders, eq(scores.tenderId, tenders.id))
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      eq(scores.companyId, companyId),
      or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
    ))
    .orderBy(desc(scores.winProbability), desc(scores.fit))
    .limit(10);

  const filtered = rows.filter((row) => (row.fit ?? 0) >= 15);
  const MIN_TENDERS = 5;
  const results = filtered.length >= MIN_TENDERS ? filtered : rows.slice(0, MIN_TENDERS);

  return results.map((row) => {
    const blob = (row.jsonBlob ?? {}) as Record<string, unknown>;
    const hardFacts = (blob.hard_facts ?? {}) as Record<string, unknown>;
    const procurement = (blob.procurement ?? {}) as Record<string, unknown>;
    const contractValue = (procurement.contract_value ?? {}) as Record<string, unknown>;

    const description = typeof blob.description === "string" ? blob.description
      : typeof blob.summary === "string" ? blob.summary.slice(0, 300)
      : (row.rawText ?? "").slice(0, 300);

    const location = typeof hardFacts.location === "string" ? hardFacts.location : null;
    const volume = typeof hardFacts.budget === "string" ? hardFacts.budget
      : typeof contractValue.max === "number" ? `${contractValue.max.toLocaleString("de-DE")} EUR`
      : null;
    const deadline = typeof hardFacts.deadline === "string" ? hardFacts.deadline : null;

    return {
      id: row.id,
      title: row.title ?? `Ausschreibung #${row.id}`,
      description,
      location,
      volume,
      fit: Math.round(row.fit ?? 0),
      winProbability: Math.round(row.winProbability ?? 0),
      url: row.url ?? null,
      deadline,
    };
  });
}

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
      setTimeout(() => runAnalysis(jobId, normalizedUrl), 0);
      return Response.json({ jobId, status: "processing" });
    }

    const topTenders = await getTopTenders(existing.id);

    if (topTenders.length === 0) {
      const jobResult = await db.insert(apiJobs).values({
        companyUrl: normalizedUrl, status: "processing", companyId: existing.id,
      }).returning({ id: apiJobs.id });

      const jobId = jobResult[0].id;
      const companyId = existing.id;
      setTimeout(async () => {
        try {
          const profileRow = await db
            .select({ capabilitiesJson: companyProfiles.capabilitiesJson, certificationsJson: companyProfiles.certificationsJson, regionsJson: companyProfiles.regionsJson, teamSize: companyProfiles.teamSize, industry: companyProfiles.industry })
            .from(companyProfiles)
            .where(eq(companyProfiles.id, companyId))
            .limit(1);

          if (profileRow.length > 0) {
            const companyRow: CompanyRow = {
              capabilities_json: JSON.stringify(profileRow[0].capabilitiesJson),
              certifications_json: JSON.stringify(profileRow[0].certificationsJson),
              regions_json: JSON.stringify(profileRow[0].regionsJson),
              team_size: profileRow[0].teamSize,
              industry: profileRow[0].industry,
            };
            await scoreAllTenders(companyId, companyRow);
          }

          const freshTenders = await getTopTenders(companyId);
          const profileUrl = `${BASE_URL}/p/${slug}`;
          await db.update(apiJobs).set({
            status: "completed", companyId, profileUrl, tendersJson: freshTenders, updatedAt: new Date(),
          }).where(eq(apiJobs.id, jobId));
        } catch (error) {
          console.error(`[api/v1/analyze] Rescore failed for job ${jobId}:`, error);
          await db.update(apiJobs).set({
            status: "failed", error: error instanceof Error ? error.message : "Unbekannter Fehler", updatedAt: new Date(),
          }).where(eq(apiJobs.id, jobId));
        }
      }, 0);

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
  setTimeout(() => runAnalysis(jobId, normalizedUrl), 0);

  return Response.json({ jobId, status: "processing" });
}
