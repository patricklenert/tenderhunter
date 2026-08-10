import { settings } from "@/lib/config";
import { processNextJob, cleanupExpiredTenders, cleanupExpiredUsTenders } from "@/lib/pipeline";
import { enqueueJob, isCriticalJobType, reapStaleJobs, type JobLane } from "@/lib/queue";
import { serializeSourceItems } from "@/lib/tender-sources";
import { shouldSchedulePublicContinuation } from "@/lib/public-pagination";
import { JOB_CRAWL, JOB_SCRAPE_PUBLIC, JOB_SCRAPE_US, type JsonValue } from "@/lib/types";
import { db } from "@/lib/db";
import { jobs, publicScrapeRuns, publicSourceCursors } from "@/lib/schema";
import { eq, desc, and, or } from "drizzle-orm";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const US_SCHEDULE_CHECK_MS = 60 * 1000;
const PUBLIC_SCHEDULE_CHECK_MS = 60 * 1000;

const args = new Set(process.argv.slice(2));
const runOnce = args.has("--once");
const withPollingCrawl = args.has("--with-crawl");
const workerIdPrefix = `worker-${process.pid}`;

const shouldEnqueuePublicScrape = async (): Promise<boolean> => {
  const activeJobs = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, JOB_SCRAPE_PUBLIC),
        or(eq(jobs.status, "pending"), eq(jobs.status, "running")),
      )
    )
    .limit(1);

  if (activeJobs.length > 0) {
    console.log(`[scheduler] Oeffentliche Ausschreibungen: aktiver Job existiert (${activeJobs[0].status}), ueberspringe.`);
    return false;
  }

  const lastRun = await db
    .select({ status: publicScrapeRuns.status, finishedAt: publicScrapeRuns.finishedAt })
    .from(publicScrapeRuns)
    .where(eq(publicScrapeRuns.isFullRun, true))
    .orderBy(desc(publicScrapeRuns.finishedAt))
    .limit(1);

  if (lastRun.length === 0 || !lastRun[0].finishedAt) {
    console.log("[scheduler] Oeffentliche Ausschreibungen: noch kein Job vorhanden, starte ersten Scrape.");
    return true;
  }

  if (lastRun[0].status === "failed") {
    console.log(`[scheduler] Oeffentliche Ausschreibungen: letzter Lauf ${lastRun[0].status}, starte Recovery-Scrape.`);
    return true;
  }

  if (lastRun[0].status === "partial") {
    const continuation = await db
      .select({ sourceKey: publicSourceCursors.sourceKey })
      .from(publicSourceCursors)
      .where(and(eq(publicSourceCursors.exhausted, false), eq(publicSourceCursors.continuationRequired, true)))
      .limit(1);
    if (continuation.length > 0) {
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
  const cursors = await db
    .select({
      sourceKey: publicSourceCursors.sourceKey,
      cursorJson: publicSourceCursors.cursorJson,
      exhausted: publicSourceCursors.exhausted,
      continuationRequired: publicSourceCursors.continuationRequired,
      lastStatus: publicSourceCursors.lastStatus,
      lastError: publicSourceCursors.lastError,
    })
    .from(publicSourceCursors)
    .where(and(eq(publicSourceCursors.exhausted, false), eq(publicSourceCursors.continuationRequired, true)));

  for (const cursor of cursors.filter((row) => shouldSchedulePublicContinuation(
    row.cursorJson as Record<string, JsonValue>,
    row.exhausted,
    row.continuationRequired,
    row.lastStatus,
    row.lastError,
  ))) {
    try {
      await enqueueJob(JOB_SCRAPE_PUBLIC, { source: cursor.sourceKey }, {
        jobKey: `public-continuation:${cursor.sourceKey}`,
        groupKey: `public-source:${cursor.sourceKey}`,
        priority: 140,
        runAfter: new Date(Date.now() + 30_000),
        dedupeCompleted: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannt";
      console.error(`[scheduler] Public-Continuation ${cursor.sourceKey} fehlgeschlagen: ${message}`);
    }
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
    .select({ createdAt: jobs.createdAt, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.type, JOB_SCRAPE_US))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return lastJob.length === 0 || lastJob[0].status === "failed" || Date.now() - lastJob[0].createdAt.getTime() > settings.usScrapeIntervalHours * 60 * 60 * 1000;
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
      await enqueueJob(JOB_SCRAPE_PUBLIC, {}, { jobKey: JOB_SCRAPE_PUBLIC, priority: 150, dedupeCompleted: false });
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
    await reapStaleJobs();
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
      await enqueueJob(JOB_SCRAPE_PUBLIC, {}, { jobKey: JOB_SCRAPE_PUBLIC, dedupeCompleted: false });
      console.log("[scheduler] scrape_public_tenders Job eingereiht.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannt";
    console.error(`[scheduler] Fehler beim Public-Scrape Check: ${message}`);
  }

};

const runWorkerLoop = async (workerId: string): Promise<void> => {
  console.log(`Worker ${workerId} gestartet. Polling alle ${settings.workerPollSeconds}s.`);
  let lastUsScheduleCheckAt = Date.now();
  let lastPublicScheduleCheckAt = Date.now();
  let lastReapAt = Date.now();
  let criticalStreak = 0;
  const criticalBurst = 5;
  while (true) {
    // Reap on wall-clock time so a busy worker does not run the reaper too often.
    if (Date.now() - lastReapAt >= 30_000) {
      lastReapAt = Date.now();
      try {
        await reapStaleJobs();
      } catch (error) {
        console.warn("[reaper] Fehler:", error);
      }
    }

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
    const result = await processNextJob(workerId, { lane });
    if (result) {
      if (lane === "critical" && isCriticalJobType(result.job_type)) {
        criticalStreak += 1;
      } else {
        criticalStreak = 0;
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
    const result = await processNextJob(`${workerIdPrefix}-once`, { lane: "all" });
    if (!result) {
      console.log("Keine Jobs verfuegbar.");
      return;
    }
    console.log(JSON.stringify(result));
    return;
  }

  await Promise.all(
    Array.from({ length: settings.workerConcurrency }, (_, index) =>
      runWorkerLoop(`${workerIdPrefix}-${index + 1}`),
    ),
  );
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  console.error(`Worker-Fehler: ${message}`);
  process.exit(1);
});
