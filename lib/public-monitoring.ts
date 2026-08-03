import { desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCatalogState } from "@/lib/catalog";
import { jobs, publicScrapeRuns, publicSourceRuns, structuredData, tenders } from "@/lib/schema";
import { JOB_SYNC_MEILI } from "@/lib/types";

const PUBLIC_SCRAPE_INTERVAL_HOURS = Number(process.env.PUBLIC_SCRAPE_INTERVAL_HOURS ?? 48);

const asNumber = (value: unknown): number => Number(value ?? 0);

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
          and nullif(trim(coalesce(${structuredData.jsonBlob}->>'summary', '')), '') is null
          and nullif(trim(coalesce(${tenders.rawText}, '')), '') is null
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
  const sourceRuns = lastRun
    ? await db
      .select()
      .from(publicSourceRuns)
      .where(eq(publicSourceRuns.runId, lastRun.id))
      .orderBy(publicSourceRuns.sourceKey)
    : [];
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

  const completedAt = lastCompletedRun?.finishedAt?.getTime() ?? 0;
  const stale = completedAt === 0 || Date.now() - completedAt > PUBLIC_SCRAPE_INTERVAL_HOURS * 60 * 60 * 1_000;
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
  if (emptySources.length > 0) issues.push(`${emptySources.length} Public-Quelle(n) ohne Treffer — möglicher Portal-Ausfall (wird als leerer Erfolg gespeichert).`);
  if (syncStale) issues.push("Meilisearch-Sync ist ausstehend oder läuft noch.");
  if (lastSyncJob?.status === "failed") issues.push("Der letzte Meilisearch-Sync ist fehlgeschlagen.");

  return {
    intervalHours: PUBLIC_SCRAPE_INTERVAL_HOURS,
    stale,
    lastRun: lastRun ?? null,
    lastCompletedAt: lastCompletedRun?.finishedAt ?? null,
    sourceRuns,
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
