import { randomUUID } from "node:crypto";
import { settings } from "@/lib/config";
import { processNextJob, cleanupExpiredTenders, cleanupExpiredUsTenders, recoverIncompleteTenderPipelines } from "@/lib/pipeline";
import { enqueueJob, getDeprioritizedJobType, isCriticalJobType, PUBLIC_CONTINUATION_PRIORITY, reapStaleJobs, sanitizeErrorMessage, type JobLane } from "@/lib/queue";
import { serializeSourceItems } from "@/lib/tender-sources";
import { buildPublicContinuationJobKey, shouldRetryFailedPublicFullRun, shouldSchedulePublicContinuation, shouldWaitForPublicContinuations } from "@/lib/public-pagination";
import { JOB_CRAWL, JOB_SCRAPE_PUBLIC, JOB_SCRAPE_US, type JsonValue } from "@/lib/types";
import { db } from "@/lib/db";
import { jobs, publicScrapeRuns, publicSourceCursors } from "@/lib/schema";
import { eq, desc, and, or, isNotNull, sql } from "drizzle-orm";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const US_SCHEDULE_CHECK_MS = 60 * 1000;
const PUBLIC_SCHEDULE_CHECK_MS = 60 * 1000;

const loadPublicContinuationCursors = async () => db
  .select({
    sourceKey: publicSourceCursors.sourceKey,
    cursorJson: publicSourceCursors.cursorJson,
    exhausted: publicSourceCursors.exhausted,
    continuationRequired: publicSourceCursors.continuationRequired,
    lastStatus: publicSourceCursors.lastStatus,
    lastError: publicSourceCursors.lastError,
  })
  .from(publicSourceCursors)
  .where(eq(publicSourceCursors.continuationRequired, true));

const args = new Set(process.argv.slice(2));
const runOnce = args.has("--once");
const withPollingCrawl = args.has("--with-crawl");
const workerIdPrefix = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

const shouldEnqueuePublicScrape = async (): Promise<boolean> => {
  // Only a pending/running FULL run blocks the next full scrape. Continuation
  // jobs carry payload.source and must never suppress full-run scheduling.
  const activeJobs = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, JOB_SCRAPE_PUBLIC),
        or(eq(jobs.status, "pending"), eq(jobs.status, "running")),
        sql`${jobs.payload} ->> 'source' IS NULL`,
      )
    )
    .limit(1);

  if (activeJobs.length > 0) {
    console.log(`[scheduler] Oeffentliche Ausschreibungen: aktiver Full-Run existiert (${activeJobs[0].status}), ueberspringe.`);
    return false;
  }

  const lastRun = await db
    .select({ status: publicScrapeRuns.status, finishedAt: publicScrapeRuns.finishedAt })
    .from(publicScrapeRuns)
    .where(and(eq(publicScrapeRuns.isFullRun, true), isNotNull(publicScrapeRuns.finishedAt)))
    .orderBy(desc(publicScrapeRuns.finishedAt))
    .limit(1);

  const pendingContinuations = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, JOB_SCRAPE_PUBLIC),
        or(eq(jobs.status, "pending"), eq(jobs.status, "running")),
        sql`${jobs.payload} ->> 'source' IS NOT NULL`,
      )
    )
    .limit(1);
  const latestFullRun = lastRun[0];
  const now = new Date();
  const retryFailedFullRun = latestFullRun?.status === "failed"
    && shouldRetryFailedPublicFullRun(latestFullRun.finishedAt, now);
  if (shouldWaitForPublicContinuations({
    hasActiveContinuations: pendingContinuations.length > 0,
    lastFullRunFinishedAt: latestFullRun?.finishedAt,
    intervalHours: settings.publicScrapeIntervalHours,
    retryFailedFullRun,
    now,
  })) {
    console.log("[scheduler] Oeffentliche Ausschreibungen: ausstehende Continuation-Jobs, Full-Run noch nicht fällig.");
    return false;
  }
  if (pendingContinuations.length > 0) {
    console.log("[scheduler] Oeffentliche Ausschreibungen: Full-Run fällig trotz ausstehender Continuation-Jobs.");
  }

  if (lastRun.length === 0 || !lastRun[0].finishedAt) {
    console.log("[scheduler] Oeffentliche Ausschreibungen: noch kein Job vorhanden, starte ersten Scrape.");
    return true;
  }

  if (lastRun[0].status === "failed") {
    const continuation = await loadPublicContinuationCursors();
    if (continuation.length === 0 && !shouldRetryFailedPublicFullRun(lastRun[0].finishedAt)) {
      console.log("[scheduler] Öffentliche Ausschreibungen: Full-Run fehlgeschlagen, Retry-Cooldown aktiv.");
      return false;
    }
    const canRetry = continuation.length === 0 || continuation.some((row) => shouldSchedulePublicContinuation(
      row.cursorJson as Record<string, JsonValue>,
      row.exhausted,
      row.continuationRequired,
      row.lastStatus,
      row.lastError,
    ));
    if (canRetry) {
      console.log(`[scheduler] Oeffentliche Ausschreibungen: letzter Lauf ${lastRun[0].status}, starte Recovery-Scrape.`);
      return true;
    }
    console.log("[scheduler] Oeffentliche Ausschreibungen: letzter Lauf fehlgeschlagen, aber alle Quellen sind noch im Backoff.");
    return false;
  }

  if (lastRun[0].status === "partial") {
    const continuation = await loadPublicContinuationCursors();
    if (continuation.some((row) => shouldSchedulePublicContinuation(
      row.cursorJson as Record<string, JsonValue>,
      row.exhausted,
      row.continuationRequired,
      row.lastStatus,
      row.lastError,
    ))) {
      console.log("[scheduler] Oeffentliche Ausschreibungen: nicht erschöpfte Quelle vorhanden, starte Recovery.");
      return true;
    }
  }

  const elapsed = Date.now() - lastRun[0].finishedAt.getTime();
  if (elapsed > settings.publicScrapeIntervalHours * 60 * 60 * 1000) {
    console.log(`[scheduler] Oeffentliche Ausschreibungen: letzter Scrape vor ${Math.round(elapsed / 3600000)}h, starte neuen.`);
    return true;
  }

  console.log(`[scheduler] Oeffentliche Ausschreibungen: letzter Scrape vor ${Math.round(elapsed / 3600000)}h, noch nicht noetig.`);
  return false;
};

const enqueuePublicContinuationsIfNeeded = async (): Promise<void> => {
  try {
    // A full run owns the source cursors for all portals. Do not start a
    // continuation beside it, otherwise both jobs can advance the same cursor.
    const activeFullRuns = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.type, JOB_SCRAPE_PUBLIC),
          or(eq(jobs.status, "pending"), eq(jobs.status, "running")),
          sql`${jobs.payload} ->> 'source' IS NULL`,
        ),
      )
      .limit(1);
    if (activeFullRuns.length > 0) return;

    const activeContinuationRows = await db
      .select({ sourceKey: sql<string>`${jobs.payload} ->> 'source'` })
      .from(jobs)
      .where(and(
        eq(jobs.type, JOB_SCRAPE_PUBLIC),
        or(eq(jobs.status, "pending"), eq(jobs.status, "running")),
        sql`${jobs.payload} ->> 'source' IS NOT NULL`,
      ));
    const activeContinuationSources = new Set(activeContinuationRows.map((row) => row.sourceKey));

    const cursors = await loadPublicContinuationCursors();

    for (const cursor of cursors.filter((row) => (
      shouldSchedulePublicContinuation(
        row.cursorJson as Record<string, JsonValue>,
        row.exhausted,
        row.continuationRequired,
        row.lastStatus,
        row.lastError,
      ) && !activeContinuationSources.has(row.sourceKey)
    ))) {
      try {
        await enqueueJob(JOB_SCRAPE_PUBLIC, { source: cursor.sourceKey }, {
          jobKey: buildPublicContinuationJobKey(cursor.sourceKey),
          groupKey: "public-scrape",
          // Older document-fetch jobs must be allowed to drain between source
          // continuations; queue aging still lets this work make progress.
          priority: PUBLIC_CONTINUATION_PRIORITY,
          runAfter: new Date(Date.now() + 30_000),
          dedupeCompleted: false,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unbekannt";
        console.error(`[scheduler] Public-Continuation ${cursor.sourceKey} fehlgeschlagen: ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannt";
    console.error(`[scheduler] Continuation-Check fehlgeschlagen: ${message}`);
  }
};

const shouldEnqueueUsScrape = async (): Promise<boolean> => {
  const activeJobs = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.type, JOB_SCRAPE_US), or(eq(jobs.status, "pending"), eq(jobs.status, "running"))))
    .limit(1);
  if (activeJobs.length > 0) return false;

  const lastJob = await db
    .select({ createdAt: jobs.createdAt, status: jobs.status, finishedAt: jobs.finishedAt })
    .from(jobs)
    .where(eq(jobs.type, JOB_SCRAPE_US))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  if (lastJob.length === 0) return true;

  const intervalMs = settings.usScrapeIntervalHours * 60 * 60 * 1000;
  if (lastJob[0].status === "failed") {
    // The queue already exhausted its bounded retries. Do not create a new
    // failed job every scheduler tick; retry again with the normal interval.
    return !lastJob[0].finishedAt || Date.now() - lastJob[0].finishedAt.getTime() > intervalMs;
  }
  return Date.now() - lastJob[0].createdAt.getTime() > intervalMs;
};

const enqueueUsScrapeIfDue = async (): Promise<void> => {
  try {
    if (await shouldEnqueueUsScrape()) {
      await enqueueJob(JOB_SCRAPE_US, {}, { jobKey: JOB_SCRAPE_US, dedupeCompleted: false });
      console.log("[scheduler] scrape_us_tenders job queued.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`[scheduler] US scrape check failed: ${message}`);
  }
};

const enqueuePublicScrapeIfDue = async (): Promise<void> => {
  try {
    if (await shouldEnqueuePublicScrape()) {
      await enqueueJob(JOB_SCRAPE_PUBLIC, {}, { jobKey: JOB_SCRAPE_PUBLIC, groupKey: "public-scrape", dedupeCompleted: false });
      console.log("[scheduler] scrape_public_tenders Job eingereiht.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannt";
    console.error(`[scheduler] Public-Scrape Check fehlgeschlagen: ${message}`);
  }
};

const initialize = async (): Promise<void> => {
  // Reap stale jobs on startup (e.g. after a crash or deploy)
  try {
    const reaped = await reapStaleJobs();
    if (reaped > 0) {
      console.log(`[reaper] ${reaped} stale Job(s) beim Start bereinigt.`);
    }
  } catch (error) {
    console.warn("[reaper] Fehler beim Aufräumen stale Jobs:", error);
  }

  await enqueueUsScrapeIfDue();
  await enqueuePublicContinuationsIfNeeded();

  // Cleanup expired tenders on startup
  try {
    const { deleted } = await cleanupExpiredTenders();
    if (deleted > 0) {
      console.log(`[cleanup] ${deleted} abgelaufene Ausschreibungen entfernt.`);
    }
  } catch (error) {
    console.warn("[cleanup] Fehler beim Aufräumen abgelaufener Ausschreibungen:", error);
  }

  try {
    const { deleted } = await cleanupExpiredUsTenders();
    if (deleted > 0) {
      console.log(`[cleanup] ${deleted} expired U.S. opportunities removed.`);
    }
  } catch (error) {
    console.warn("[cleanup] U.S. opportunity cleanup failed:", error);
  }

  if (withPollingCrawl && settings.defaultSources.length > 0) {
    await enqueueJob(JOB_CRAWL, {
      sources: serializeSourceItems(settings.defaultSources),
    }, { jobKey: JOB_CRAWL, dedupeCompleted: false });
  }

  try {
    if (await shouldEnqueuePublicScrape()) {
      await enqueueJob(JOB_SCRAPE_PUBLIC, {}, { jobKey: JOB_SCRAPE_PUBLIC, groupKey: "public-scrape", dedupeCompleted: false });
      console.log("[scheduler] scrape_public_tenders Job eingereiht.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannt";
    console.error(`[scheduler] Fehler beim Public-Scrape Check: ${message}`);
  }

};

const REAPER_INTERVAL_MS = 30_000;
const TENDER_RECOVERY_INTERVAL_MS = 60_000;

const startReaper = (): NodeJS.Timeout => {
  return setInterval(async () => {
    try {
      const reaped = await reapStaleJobs();
      if (reaped > 0) {
        console.log(`[reaper] ${reaped} stale Job(s) bereinigt.`);
      }
    } catch (error) {
      console.warn("[reaper] Fehler:", error);
    }
  }, REAPER_INTERVAL_MS);
};

const startTenderRecovery = (): NodeJS.Timeout => {
  let running = false;
  return setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const recovered = await recoverIncompleteTenderPipelines();
      if (recovered > 0) {
        console.log(`[recovery] ${recovered} unvollständige Tender-Pipeline(s) geprüft.`);
      }
    } catch (error) {
      console.warn("[recovery] Tender-Pipeline-Scan fehlgeschlagen:", error);
    } finally {
      running = false;
    }
  }, TENDER_RECOVERY_INTERVAL_MS);
};

const runWorkerLoop = async (workerId: string): Promise<void> => {
  console.log(`Worker ${workerId} gestartet. Polling alle ${settings.workerPollSeconds}s.`);
  let lastUsScheduleCheckAt = Date.now();
  let lastPublicScheduleCheckAt = Date.now();
  let criticalStreak = 0;
  let lastCriticalType: string | null = null;
  let criticalTypeStreak = 0;
  const criticalBurst = 5;
  const criticalTypeBurst = 5;
  while (true) {
    if (Date.now() - lastUsScheduleCheckAt >= US_SCHEDULE_CHECK_MS) {
      lastUsScheduleCheckAt = Date.now();
      await enqueueUsScrapeIfDue();
    }

    if (Date.now() - lastPublicScheduleCheckAt >= PUBLIC_SCHEDULE_CHECK_MS) {
      lastPublicScheduleCheckAt = Date.now();
      await enqueuePublicContinuationsIfNeeded();
      await enqueuePublicScrapeIfDue();
    }

    const lane: JobLane = criticalStreak < criticalBurst ? "critical" : "background";
    let result: Awaited<ReturnType<typeof processNextJob>>;
    try {
      result = await processNextJob(workerId, {
        lane,
        deprioritizeType: getDeprioritizedJobType(lastCriticalType, criticalTypeStreak, criticalTypeBurst),
        terminateOnTimeout: true,
      });
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : "Unbekannter Fehler");
      console.error(`[worker] Job-Verarbeitung konnte nicht abgeschlossen werden: ${message}`);
      await sleep(1_000);
      continue;
    }
    if (result) {
      if (lane === "critical" && isCriticalJobType(result.job_type)) {
        criticalStreak += 1;
        if (lastCriticalType === result.job_type) {
          criticalTypeStreak += 1;
        } else {
          lastCriticalType = result.job_type;
          criticalTypeStreak = 1;
        }
      } else {
        criticalStreak = 0;
        lastCriticalType = null;
        criticalTypeStreak = 0;
      }
      console.log(JSON.stringify(result));
      continue;
    }
    await sleep(settings.workerPollSeconds * 1_000);
  }
};

const run = async (): Promise<void> => {
  await initialize();
  if (runOnce) {
    const result = await processNextJob(`${workerIdPrefix}-once`, { lane: "all", terminateOnTimeout: true });
    if (!result) {
      console.log("Keine Jobs verfuegbar.");
      return;
    }
    console.log(JSON.stringify(result));
    return;
  }

  const reaperHandle = startReaper();
  const recoveryHandle = startTenderRecovery();
  try {
    await Promise.all(
      Array.from({ length: settings.workerConcurrency }, (_, index) =>
        runWorkerLoop(`${workerIdPrefix}-${index + 1}`),
      ),
    );
  } finally {
    clearInterval(reaperHandle);
    clearInterval(recoveryHandle);
  }
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  console.error(`Worker-Fehler: ${message}`);
  process.exit(1);
});
