import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCatalogState } from "@/lib/catalog";
import { jobs, publicScrapeRuns, publicSourceCursors, publicSourceRuns, structuredData, tenders } from "@/lib/schema";
import { JOB_SCRAPE_PUBLIC, JOB_SYNC_MEILI, type JsonValue } from "@/lib/types";
import { summarizePublicContinuationState } from "@/lib/public-pagination";

const PUBLIC_SCRAPE_INTERVAL_HOURS = Number(process.env.PUBLIC_SCRAPE_INTERVAL_HOURS ?? 48);

const asNumber = (value: unknown): number => Number(value ?? 0);

export async function getPublicContinuationMonitoringState() {
  const [sourceCursors, activeJobs] = await Promise.all([
    db
      .select()
      .from(publicSourceCursors)
      .orderBy(publicSourceCursors.sourceKey),
    db
      .select({ payload: jobs.payload })
      .from(jobs)
      .where(and(
        eq(jobs.type, JOB_SCRAPE_PUBLIC),
        inArray(jobs.status, ["pending", "running"]),
      )),
  ]);

  const activeSourceKeys = new Set<string>();
  let hasActiveFullRun = false;
  for (const job of activeJobs) {
    const payload = job.payload;
    const source = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).source
      : null;
    if (typeof source === "string" && source.trim()) {
      activeSourceKeys.add(source.trim());
    } else {
      hasActiveFullRun = true;
    }
  }

  const continuationState = summarizePublicContinuationState(
    sourceCursors.map((cursor) => ({
      sourceKey: cursor.sourceKey,
      cursor: cursor.cursorJson as Record<string, JsonValue> | null,
      exhausted: cursor.exhausted,
      continuationRequired: cursor.continuationRequired,
      lastStatus: cursor.lastStatus,
      lastError: cursor.lastError,
    })),
    activeSourceKeys,
    hasActiveFullRun,
  );

  return { sourceCursors, ...continuationState };
}

export interface PublicCatalogQualitySummary {
  total: number;
  active: number;
  indexable: number;
  byStatus: Record<string, { total: number; active: number }>;
  bySource: Record<string, Record<string, { total: number; active: number }>>;
  qualifiedCompleteness: {
    genericTitle: number;
    missingTitle: number;
    missingDeadline: number;
    missingLocation: number;
    missingDescription: number;
  };
}

export async function getPublicCatalogQualitySummary(): Promise<PublicCatalogQualitySummary> {
  const statusRows = await db
    .select({
      status: tenders.qualityStatus,
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${tenders.deadlineAt} is null or ${tenders.deadlineAt} > now())`,
    })
    .from(tenders)
    .groupBy(tenders.qualityStatus);

  const sourceRows = await db
    .select({
      source: sql<string>`coalesce(${tenders.sourceKey}, ${tenders.source})`,
      status: tenders.qualityStatus,
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${tenders.deadlineAt} is null or ${tenders.deadlineAt} > now())`,
    })
    .from(tenders)
    .groupBy(sql`coalesce(${tenders.sourceKey}, ${tenders.source})`, tenders.qualityStatus);

  const completenessRows = await db
    .select({
      genericTitle: sql<number>`count(*) filter (
        where ${tenders.qualityStatus} = 'qualified'
          and lower(trim(coalesce(${tenders.title}, ''))) in ('bekanntmachung', 'übersicht', 'uebersicht', 'ausschreibung', 'detail', 'vergabe')
      )`,
      missingTitle: sql<number>`count(*) filter (where ${tenders.qualityStatus} = 'qualified' and nullif(trim(coalesce(${tenders.title}, '')), '') is null)`,
      missingDeadline: sql<number>`count(*) filter (where ${tenders.qualityStatus} = 'qualified' and ${tenders.deadlineAt} is null)`,
      missingLocation: sql<number>`count(*) filter (
        where ${tenders.qualityStatus} = 'qualified'
          and nullif(trim(coalesce(${tenders.metadataJson}->>'location', '')), '') is null
          and nullif(trim(coalesce(${structuredData.jsonBlob}->'hard_facts'->>'location', '')), '') is null
      )`,
      missingDescription: sql<number>`count(*) filter (
        where ${tenders.qualityStatus} = 'qualified'
           and nullif(trim(coalesce(${tenders.metadataJson}->>'description', '')), '') is null
           and nullif(trim(coalesce(${tenders.metadataJson}->>'summary', '')), '') is null
           and nullif(trim(coalesce(${structuredData.jsonBlob}->>'summary', '')), '') is null
           and nullif(trim(coalesce(${structuredData.jsonBlob}->>'description', '')), '') is null
       )`,
    })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id));

  const byStatus: PublicCatalogQualitySummary["byStatus"] = {};
  for (const row of statusRows) {
    byStatus[row.status] = { total: asNumber(row.total), active: asNumber(row.active) };
  }

  const bySource: PublicCatalogQualitySummary["bySource"] = {};
  for (const row of sourceRows) {
    const source = row.source || "unknown";
    bySource[source] ??= {};
    bySource[source][row.status] = { total: asNumber(row.total), active: asNumber(row.active) };
  }

  const total = Object.values(byStatus).reduce((sum, row) => sum + row.total, 0);
  const active = Object.values(byStatus).reduce((sum, row) => sum + row.active, 0);
  const indexable = byStatus.qualified?.active ?? 0;
  const completeness = completenessRows[0];

  return {
    total,
    active,
    indexable,
    byStatus,
    bySource,
    qualifiedCompleteness: {
      genericTitle: asNumber(completeness?.genericTitle),
      missingTitle: asNumber(completeness?.missingTitle),
      missingDeadline: asNumber(completeness?.missingDeadline),
      missingLocation: asNumber(completeness?.missingLocation),
      missingDescription: asNumber(completeness?.missingDescription),
    },
  };
}

export async function getPublicScrapeMonitoring() {
  const [lastRun] = await db
    .select()
    .from(publicScrapeRuns)
    .orderBy(desc(publicScrapeRuns.startedAt))
    .limit(1);
  const [lastCompletedRun] = await db
    .select()
    .from(publicScrapeRuns)
    .where(or(eq(publicScrapeRuns.status, "success"), eq(publicScrapeRuns.status, "partial")))
    .orderBy(desc(publicScrapeRuns.finishedAt))
    .limit(1);
  const [lastFullRun] = await db
    .select()
    .from(publicScrapeRuns)
    .where(eq(publicScrapeRuns.isFullRun, true))
    .orderBy(desc(publicScrapeRuns.startedAt))
    .limit(1);
  const [lastHealthyFullRun] = await db
    .select()
    .from(publicScrapeRuns)
    .where(and(eq(publicScrapeRuns.isFullRun, true), eq(publicScrapeRuns.status, "success")))
    .orderBy(desc(publicScrapeRuns.finishedAt))
    .limit(1);
  const sourceRuns = lastRun
    ? await db
      .select()
      .from(publicSourceRuns)
      .where(eq(publicSourceRuns.runId, lastRun.id))
      .orderBy(publicSourceRuns.sourceKey)
      : [];
  const continuationState = await getPublicContinuationMonitoringState();
  const { sourceCursors, nonExhaustedSources, blockedSources, continuationMissingSources } = continuationState;
  const [lastSyncJob] = await db
    .select({
      id: jobs.id,
      status: jobs.status,
      lastError: jobs.lastError,
      createdAt: jobs.createdAt,
      finishedAt: jobs.finishedAt,
    })
    .from(jobs)
    .where(eq(jobs.type, JOB_SYNC_MEILI))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  const catalog = await getCatalogState();

  const healthyCompletedAt = lastHealthyFullRun?.finishedAt?.getTime() ?? 0;
  const stale = healthyCompletedAt === 0 || Date.now() - healthyCompletedAt > PUBLIC_SCRAPE_INTERVAL_HOURS * 60 * 60 * 1_000;
  const failedSources = sourceRuns
    .filter((run) => ["failed", "timed_out", "partial"].includes(run.status))
    .map((run) => ({ sourceKey: run.sourceKey, status: run.status, errorMessage: run.errorMessage }));
  const emptySources = sourceRuns
    .filter((run) => run.status === "empty")
    .map((run) => run.sourceKey);
  const syncStale = Boolean(catalog && (catalog.syncRunning || catalog.revision > catalog.syncedRevision));
  const issues: string[] = [];
  if (stale) issues.push(`Public-Scrape ist älter als ${PUBLIC_SCRAPE_INTERVAL_HOURS} Stunden.`);
  if (failedSources.length > 0) issues.push(`${failedSources.length} Public-Quelle(n) fehlgeschlagen oder unvollständig.`);
  if (lastFullRun?.status === "partial" || lastFullRun?.status === "failed") issues.push(`Der letzte vollständige Public-Lauf ist ${lastFullRun.status}.`);
  if (continuationMissingSources.length > 0) issues.push(`${continuationMissingSources.length} Quelle(n) benötigen Fortsetzung, haben aber keinen aktiven Folgejob.`);
  if (emptySources.length > 0) issues.push(`${emptySources.length} Public-Quelle(n) ohne Treffer — möglicher Portal-Ausfall (wird als leerer Erfolg gespeichert).`);
  if (syncStale) issues.push("Meilisearch-Sync ist ausstehend oder läuft noch.");
  if (lastSyncJob?.status === "failed") issues.push("Der letzte Meilisearch-Sync ist fehlgeschlagen.");

  return {
    intervalHours: PUBLIC_SCRAPE_INTERVAL_HOURS,
    stale,
    lastRun: lastRun ?? null,
    lastCompletedAt: lastCompletedRun?.finishedAt ?? null,
    lastFullRun: lastFullRun ?? null,
    lastHealthyFullRun: lastHealthyFullRun ?? null,
    sourceRuns,
    sourceCursors,
    nonExhaustedSources,
    blockedSources,
    continuationMissingSources,
    failedSources,
    emptySources,
    catalog: catalog
      ? {
          revision: catalog.revision,
          syncedRevision: catalog.syncedRevision,
          syncRunning: catalog.syncRunning,
          updatedAt: catalog.updatedAt,
        }
      : null,
    lastSyncJob: lastSyncJob ?? null,
    syncStale,
    issues,
  };
}
