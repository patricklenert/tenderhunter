import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { settings } from "@/lib/config";
import { isJobRuntimeStale } from "@/lib/queue";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const dbResult = await db.execute(sql`SELECT 1 AS ok`);
    const database = dbResult[0]?.ok === 1 ? "ok" : "error";

    const queueResult = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE status = 'pending') AS pending,
        count(*) FILTER (WHERE status = 'failed') AS failed_recent,
        count(*) FILTER (WHERE status = 'running' AND heartbeat_at < now() - interval '5 minutes') AS stale_running,
        count(*) FILTER (WHERE status = 'pending' AND type IN (
          'crawl_sources', 'scrape_public_tenders', 'scrape_us_tenders',
          'fetch_documents', 'fetch_us_documents', 'parse_documents',
          'structure_tender', 'score_tender', 'cache_detail', 'sync_meilisearch'
        )) AS critical_pending,
        max(EXTRACT(EPOCH FROM (now() - created_at))) FILTER (WHERE status = 'pending') AS oldest_pending_age_seconds,
        max(EXTRACT(EPOCH FROM (now() - created_at))) FILTER (WHERE status = 'pending' AND type IN (
          'crawl_sources', 'scrape_public_tenders', 'scrape_us_tenders',
          'fetch_documents', 'fetch_us_documents', 'parse_documents',
          'structure_tender', 'score_tender', 'cache_detail', 'sync_meilisearch'
        )) AS oldest_critical_age_seconds
      FROM jobs
      WHERE status IN ('pending', 'running')
         OR (status = 'failed' AND created_at > now() - interval '24 hours')
    `);
    const row = queueResult[0] ?? {};
    const pending = Number(row.pending ?? 0);
    const failed24h = Number(row.failed_recent ?? 0);
    const criticalPending = Number(row.critical_pending ?? 0);
    const oldestPendingAgeSeconds = Number(row.oldest_pending_age_seconds ?? 0);
    const oldestCriticalAgeSeconds = Number(row.oldest_critical_age_seconds ?? 0);
    const backlogExceeded = pending > settings.maxPendingJobs;
    const criticalBacklogStale = oldestCriticalAgeSeconds > settings.maxCriticalJobAgeMinutes * 60;

    const runningJobsResult = await db.execute(sql`
      SELECT id, type, started_at, heartbeat_at
      FROM jobs
      WHERE status = 'running'
    `);
    const now = Date.now();
    const staleRunningIds = new Set(
      runningJobsResult
        .filter((runningJob) => {
          const heartbeatAt = runningJob.heartbeat_at ? new Date(String(runningJob.heartbeat_at)).getTime() : 0;
          const heartbeatStale = !heartbeatAt || now - heartbeatAt > 5 * 60 * 1_000;
          const runtimeStale = isJobRuntimeStale(
            runningJob.started_at ? new Date(String(runningJob.started_at)) : null,
            String(runningJob.type),
            now,
          );
          return heartbeatStale || runtimeStale;
        })
        .map((runningJob) => String(runningJob.id)),
    );
    const staleRunning = staleRunningIds.size;
    const runtimeStaleRunning = runningJobsResult.filter((runningJob) => isJobRuntimeStale(
      runningJob.started_at ? new Date(String(runningJob.started_at)) : null,
      String(runningJob.type),
      now,
    )).length;

    const catalogResult = await db.execute(sql`
      SELECT revision, synced_revision, sync_running, sync_started_at
      FROM catalog_state
      WHERE id = 1
      LIMIT 1
    `);
    const catalogRow = catalogResult[0] ?? {};
    const catalogSyncStartedAt = catalogRow.sync_started_at ? new Date(String(catalogRow.sync_started_at)).getTime() : 0;
    const catalogSyncStale = Boolean(catalogRow.sync_running)
      && (!catalogSyncStartedAt || now - catalogSyncStartedAt > 30 * 60 * 1_000);

    const pendingByTypeResult = await db.execute(sql`
      SELECT type, count(*) AS pending
      FROM jobs
      WHERE status = 'pending'
      GROUP BY type
      ORDER BY count(*) DESC, type
    `);
    const pendingByType = Object.fromEntries(
      pendingByTypeResult.map((pendingRow) => [String(pendingRow.type), Number(pendingRow.pending ?? 0)]),
    );

    const sourceResult = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE status IN ('failed', 'timed_out')) AS failed_recent,
        count(*) FILTER (WHERE status = 'partial') AS partial_recent,
        count(*) FILTER (WHERE status = 'empty') AS empty_recent,
        max(finished_at) AS last_finished_at
      FROM public_source_runs
      WHERE finished_at > now() - interval '24 hours'
    `);
    const sourceRow = sourceResult[0] ?? {};
    const sourceFailures24h = Number(sourceRow.failed_recent ?? 0);
    const sourcePartial24h = Number(sourceRow.partial_recent ?? 0);
    const sourceEmpty24h = Number(sourceRow.empty_recent ?? 0);
    const cursorResult = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE NOT exhausted AND continuation_required) AS non_exhausted,
        count(*) FILTER (
          WHERE NOT exhausted
            AND continuation_required
            AND NOT EXISTS (
              SELECT 1
              FROM jobs continuation
              WHERE continuation.type = 'scrape_public_tenders'
                AND continuation.status IN ('pending', 'running')
                AND continuation.job_key = 'public-continuation:' || public_source_cursors.source_key
            )
            AND (
              (
                jsonb_array_length(COALESCE(public_source_cursors.cursor_json -> 'pendingDetails', '[]'::jsonb)) = 0
                AND public_source_cursors.last_status = 'success'
              )
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(public_source_cursors.cursor_json -> 'pendingDetails', '[]'::jsonb)) AS detail
                WHERE COALESCE(detail ->> 'blocked', 'false') <> 'true'
              )
            )
        ) AS continuation_missing
      FROM public_source_cursors
    `);
    const cursorRow = cursorResult[0] ?? {};
    const nonExhaustedSources = Number(cursorRow.non_exhausted ?? 0);
    const continuationMissingSources = Number(cursorRow.continuation_missing ?? 0);
    const fullRunResult = await db.execute(sql`
      SELECT status, finished_at
      FROM public_scrape_runs
      WHERE is_full_run = TRUE
        AND finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `);
    const lastFullRun = fullRunResult[0] ?? {};
    const publicIntervalHours = Number(process.env.PUBLIC_SCRAPE_INTERVAL_HOURS ?? 48);
    const lastFullFinishedAt = lastFullRun.finished_at ? new Date(String(lastFullRun.finished_at)).getTime() : 0;
    const fullRunStale = lastFullFinishedAt === 0
      || Date.now() - lastFullFinishedAt > publicIntervalHours * 60 * 60 * 1_000;

    const status = database === "ok"
      && failed24h === 0
      && staleRunning === 0
      && sourceFailures24h === 0
      && sourcePartial24h === 0
      && continuationMissingSources === 0
      && lastFullRun.status === "success"
      && !fullRunStale
      && !backlogExceeded
      && !criticalBacklogStale
      && !catalogSyncStale
      ? "ok"
      : "degraded";
    return json({
      status,
      database,
       queue: {
         pending,
         pendingByType,
         criticalPending,
         oldestPendingAgeSeconds,
         oldestCriticalAgeSeconds,
         backlogExceeded,
          criticalBacklogStale,
          runtimeStaleRunning,
         maxPendingJobs: settings.maxPendingJobs,
         maxCriticalJobAgeMinutes: settings.maxCriticalJobAgeMinutes,
         failed24h,
         staleRunning,
        },
      catalogSync: {
        running: Boolean(catalogRow.sync_running),
        stale: catalogSyncStale,
        revision: Number(catalogRow.revision ?? 0),
        syncedRevision: Number(catalogRow.synced_revision ?? 0),
        startedAt: catalogRow.sync_started_at ?? null,
      },
      sources: {
        failed24h: sourceFailures24h,
        partial24h: sourcePartial24h,
        empty24h: sourceEmpty24h,
        lastFinishedAt: sourceRow.last_finished_at ?? null,
        nonExhausted: nonExhaustedSources,
        continuationMissing: continuationMissingSources,
        lastFullRunStatus: lastFullRun.status ?? null,
        lastFullRunFinishedAt: lastFullRun.finished_at ?? null,
        fullRunStale,
      },
    });
  } catch (error) {
    return json(
      { status: "error", error: error instanceof Error ? error.message : "unknown" },
      { status: 503 },
    );
  }
}
