import { db } from "@/lib/db";
import { settings } from "@/lib/config";
import { companyProfiles, tenders, scores, jobs, insights, userCompanies } from "@/lib/schema";
import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { scrapeWebsite } from "@/lib/firecrawl";
import { extractCompanyProfile } from "@/lib/perplexity";
import { enqueueJob } from "@/lib/queue";
import { JOB_CRAWL, JOB_DISCOVER_COMPANY } from "@/lib/types";
import { and, desc, eq, gte, or } from "drizzle-orm";
import { buildDefaultTenderSources, serializeSourceItems } from "@/lib/tender-sources";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";

interface DiscoverBody {
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

type StepStatus = "pending" | "active" | "done";

const ACTIVE_JOB_STATUSES = new Set(["pending", "running"]);

const toStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

const toRoundedPercent = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
};

const toRoundedScore = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
};

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const normalizeScoreDetails = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const details = value as Record<string, unknown>;
  return {
    domainMatch: toRoundedPercent(details.domain_match),
    requirementCoverage: toRoundedPercent(details.requirement_coverage),
    regionMatch: toRoundedPercent(details.region_match),
    sizeMatch: toRoundedPercent(details.size_match),
    complexity: toRoundedPercent(details.complexity),
    locationStatus: toOptionalString(details.location_status),
    locationReason: toOptionalString(details.location_reason),
    tenderBundesland: toOptionalString(details.tender_bundesland),
    tenderCity: toOptionalString(details.tender_city),
    locationSource: toOptionalString(details.location_source),
    domainStatus: toOptionalString(details.domain_status),
    domainReason: toOptionalString(details.domain_reason),
    domainSource: toOptionalString(details.domain_source),
  };
};

const listMatchedTenders = async (companyId: number, since: Date) => {
  const rows = await db
    .select({
      id: scores.tenderId,
      title: tenders.title,
      source: tenders.source,
      url: tenders.url,
      fit: scores.fit,
      winProbability: scores.winProbability,
      effort: scores.effort,
      requirementCoverage: scores.requirementCoverage,
      killSwitch: scores.killSwitch,
      detailsJson: scores.detailsJson,
      explanation: insights.explanation,
      actionsJson: insights.actionsJson,
      missingItemsJson: insights.missingItemsJson,
    })
    .from(scores)
    .leftJoin(tenders, eq(scores.tenderId, tenders.id))
    .leftJoin(insights, and(eq(insights.tenderId, scores.tenderId), eq(insights.companyId, scores.companyId)))
    .where(
      and(
        eq(scores.companyId, companyId),
        eq(scores.killSwitch, false),
        gte(scores.updatedAt, since),
        or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
      ),
    )
    .orderBy(desc(scores.winProbability), desc(scores.fit))
    .limit(200);

  return rows.map((row) => ({
      id: row.id,
      title: row.title ?? `Ausschreibung #${row.id}`,
      source: row.source ?? "Unbekannte Quelle",
      url: row.url ?? null,
      fit: toRoundedScore(row.fit),
      winProbability: toRoundedScore(row.winProbability),
      effort: toRoundedScore(row.effort),
      requirementCoverage: toRoundedPercent(row.requirementCoverage),
      killSwitch: row.killSwitch,
      explanation: row.explanation,
      actions: toStringList(row.actionsJson),
      missingItems: toStringList(row.missingItemsJson),
      details: normalizeScoreDetails(row.detailsJson),
    }));
};

const getSessionSources = () => {
  if (settings.defaultSources.length === 0) {
    return buildDefaultTenderSources();
  }

  return settings.defaultSources;
};

export async function GET(request: Request): Promise<Response> {
  const premiumOrResponse = await requirePremiumSession(request);
  if (premiumOrResponse instanceof Response) return premiumOrResponse;

  try {
    const url = new URL(request.url);
    const companyId = Number.parseInt(url.searchParams.get("companyId") ?? "", 10);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return json({ error: "ungueltige companyId" }, { status: 400 });
    }

    const sinceRaw = url.searchParams.get("since") ?? "";
    const since = new Date(sinceRaw);
    if (Number.isNaN(since.getTime())) {
      return json({ error: "ungueltiger Zeitpunkt" }, { status: 400 });
    }
    const discoveryId = url.searchParams.get("discoveryId") ?? "";
    const discoveryGroup = discoveryId ? `discover:${companyId}:${discoveryId}` : "";

    const companyRows = await db
      .select({ id: companyProfiles.id, name: companyProfiles.name })
      .from(companyProfiles)
      .where(eq(companyProfiles.id, companyId))
      .limit(1);

    if (companyRows.length === 0) {
      return json({ error: "Firma nicht gefunden" }, { status: 404 });
    }

    const sessionJobs = await db
      .select({
        type: jobs.type,
        status: jobs.status,
        lastError: jobs.lastError,
      })
      .from(jobs)
      .where(
        discoveryId
          ? or(
              eq(jobs.groupKey, discoveryGroup),
              and(eq(jobs.type, JOB_CRAWL), gte(jobs.createdAt, since)),
            )
          : gte(jobs.createdAt, since),
      )
      .orderBy(jobs.id);

    const matched = await listMatchedTenders(companyId, since);
    const crawlJobs = sessionJobs.filter((job) => job.type === JOB_CRAWL);
    const activeJobs = sessionJobs.filter((job) => ACTIVE_JOB_STATUSES.has(job.status));
    const activeCrawlJobs = crawlJobs.filter((job) => ACTIVE_JOB_STATUSES.has(job.status));
    const activeProcessingJobs = activeJobs.filter((job) => job.type !== JOB_CRAWL);
    const failedJobs = sessionJobs.filter((job) => job.status === "failed");

    const stepStatus = {
      crawl: activeCrawlJobs.length > 0 ? "active" : crawlJobs.length > 0 ? "done" : "pending",
      score: activeProcessingJobs.length > 0 ? "active" : crawlJobs.length > 0 && activeCrawlJobs.length === 0 ? "done" : "pending",
    } as const satisfies Record<string, StepStatus>;

    let phase: "processing" | "completed" | "failed" = "processing";
    if (crawlJobs.length > 0 && activeJobs.length === 0) {
      phase = failedJobs.length > 0 && matched.length === 0 ? "failed" : "completed";
    }

    const byType = Array.from(
      sessionJobs.reduce((map, job) => {
        map.set(job.type, (map.get(job.type) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
    ).map(([type, count]) => ({ type, count }));

    return json({
      company: companyRows[0],
      matched,
      status: {
        phase,
        error: phase === "failed" ? failedJobs[0]?.lastError ?? "Pipeline fehlgeschlagen." : null,
        summary: {
          matchCount: matched.length,
          pendingJobs: sessionJobs.filter((job) => job.status === "pending").length,
          runningJobs: sessionJobs.filter((job) => job.status === "running").length,
          failedJobs: failedJobs.length,
        },
        queueLanes: byType,
        steps: [
          { key: "scrape", label: "Website laden", status: "done" },
          { key: "profile", label: "Unternehmensprofil erkennen", status: "done" },
          { key: "crawl", label: "Ausschreibungen suchen", status: stepStatus.crawl },
          { key: "score", label: "Passung berechnen", status: stepStatus.score },
        ],
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const listCachedTenders = async (companyId: number) => {
  const rows = await db
    .select({
      id: scores.tenderId,
      title: tenders.title,
      source: tenders.source,
      url: tenders.url,
      fit: scores.fit,
      winProbability: scores.winProbability,
      effort: scores.effort,
      requirementCoverage: scores.requirementCoverage,
      killSwitch: scores.killSwitch,
      detailsJson: scores.detailsJson,
      explanation: insights.explanation,
      actionsJson: insights.actionsJson,
      missingItemsJson: insights.missingItemsJson,
    })
    .from(scores)
    .leftJoin(tenders, eq(scores.tenderId, tenders.id))
    .leftJoin(insights, and(eq(insights.tenderId, scores.tenderId), eq(insights.companyId, scores.companyId)))
    .where(
      and(
        eq(scores.companyId, companyId),
        eq(scores.killSwitch, false),
        or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
      ),
    )
    .orderBy(desc(scores.winProbability), desc(scores.fit))
    .limit(200);

  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? `Ausschreibung #${row.id}`,
    source: row.source ?? "Unbekannte Quelle",
    url: row.url ?? null,
    fit: toRoundedScore(row.fit),
    winProbability: toRoundedScore(row.winProbability),
    effort: toRoundedScore(row.effort),
    requirementCoverage: toRoundedPercent(row.requirementCoverage),
    killSwitch: row.killSwitch,
    explanation: row.explanation,
    actions: toStringList(row.actionsJson),
    missingItems: toStringList(row.missingItemsJson),
    details: normalizeScoreDetails(row.detailsJson),
  }));
};

export async function POST(request: Request): Promise<Response> {
  const premiumOrResponse = await requirePremiumSession(request);
  if (premiumOrResponse instanceof Response) return premiumOrResponse;

  try {
    const userId = premiumOrResponse.session.user.id;

    const body = await parseJsonBody<DiscoverBody>(request);
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return errorResponse(new Error("URL ist erforderlich."));

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return errorResponse(new Error("Ungueltige URL."));
    }

    const normalizedUrl = normalizeUrl(parsedUrl.toString());

    const existingProfile = await db
      .select({
        id: companyProfiles.id,
        name: companyProfiles.name,
        websiteUrl: companyProfiles.websiteUrl,
        capabilitiesJson: companyProfiles.capabilitiesJson,
        certificationsJson: companyProfiles.certificationsJson,
        teamSize: companyProfiles.teamSize,
        regionsJson: companyProfiles.regionsJson,
        description: companyProfiles.description,
        industry: companyProfiles.industry,
        logoUrl: companyProfiles.logoUrl,
        contactEmail: companyProfiles.contactEmail,
        contactPhone: companyProfiles.contactPhone,
        address: companyProfiles.address,
      })
      .from(companyProfiles)
      .where(eq(companyProfiles.websiteUrl, normalizedUrl))
      .limit(1);

    if (existingProfile.length > 0) {
      const existing = existingProfile[0];

      if (userId) {
        await db
          .insert(userCompanies)
          .values({ userId, companyId: existing.id, isActive: true })
          .onConflictDoNothing();
        await db
          .update(userCompanies)
          .set({ isActive: true })
          .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, existing.id)));
      }

      const matched = await listCachedTenders(existing.id);

      return json({
        company: { id: existing.id, name: existing.name },
        extracted: {
          name: existing.name,
          capabilities: Array.isArray(existing.capabilitiesJson) ? existing.capabilitiesJson as string[] : [],
          certifications: Array.isArray(existing.certificationsJson) ? existing.certificationsJson as string[] : [],
          regions: Array.isArray(existing.regionsJson) ? existing.regionsJson as string[] : [],
          team_size: existing.teamSize,
          description: existing.description ?? "",
          industry: existing.industry ?? null,
          logo_url: existing.logoUrl ?? null,
          contact_email: existing.contactEmail ?? null,
          contact_phone: existing.contactPhone ?? null,
          address: existing.address ?? null,
        },
        matched,
        sessionStartedAt: new Date().toISOString(),
        cached: true,
      });
    }

    const scraped = await scrapeWebsite(parsedUrl.toString());
    if (!scraped.markdown || scraped.markdown.trim().length < 50) {
      return errorResponse(new Error("Die Website lieferte zu wenig Inhalt. Bitte eine andere URL versuchen."));
    }

    const profile = await extractCompanyProfile(scraped.markdown, scraped.url);
    const sessionStartedAt = new Date();

    const result = await db
      .insert(companyProfiles)
      .values({
        name: profile.name,
        websiteUrl: normalizedUrl,
        description: profile.description,
        industry: profile.industry,
        logoUrl: profile.logo_url,
        contactEmail: profile.contact_email,
        contactPhone: profile.contact_phone,
        address: profile.address,
        capabilitiesJson: profile.capabilities,
        certificationsJson: profile.certifications,
        teamSize: profile.team_size,
        regionsJson: profile.regions,
        createdAt: sessionStartedAt,
        updatedAt: sessionStartedAt,
      })
      .onConflictDoUpdate({
        target: companyProfiles.name,
        set: {
          websiteUrl: normalizedUrl,
          description: profile.description,
          industry: profile.industry,
          logoUrl: profile.logo_url,
          contactEmail: profile.contact_email,
          contactPhone: profile.contact_phone,
          address: profile.address,
          capabilitiesJson: profile.capabilities,
          certificationsJson: profile.certifications,
          teamSize: profile.team_size,
          regionsJson: profile.regions,
          updatedAt: sessionStartedAt,
        },
      })
      .returning({ id: companyProfiles.id });

    const companyId = result[0]?.id ?? 0;

    if (userId) {
      await db
        .update(userCompanies)
        .set({ isActive: false })
        .where(eq(userCompanies.userId, userId));
      await db
        .insert(userCompanies)
        .values({ userId, companyId, isActive: true })
        .onConflictDoNothing();
    }

    const discoveryId = crypto.randomUUID();
    const discoveryGroup = `discover:${companyId}:${discoveryId}`;

    await enqueueJob(JOB_CRAWL, {
      sources: serializeSourceItems(getSessionSources()),
    }, { jobKey: JOB_CRAWL, groupKey: discoveryGroup });
    const scoreJobId = await enqueueJob(
      JOB_DISCOVER_COMPANY,
      { company_id: companyId, discovery_id: discoveryId },
      {
        jobKey: `${JOB_DISCOVER_COMPANY}:${companyId}:${discoveryId}`,
        groupKey: discoveryGroup,
      },
    );

    return json({
      company: { id: companyId, name: profile.name },
      extracted: profile,
      matched: [],
      discoveryId,
      enqueuedJobId: scoreJobId,
      sessionStartedAt: sessionStartedAt.toISOString(),
      cached: false,
    }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
