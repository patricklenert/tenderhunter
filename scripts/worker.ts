import { settings } from "@/lib/config";
import { processNextJob, cleanupExpiredTenders, cleanupExpiredUsTenders } from "@/lib/pipeline";
import { enqueueJob, reapStaleJobs } from "@/lib/queue";
import { serializeSourceItems } from "@/lib/tender-sources";
import { JOB_CRAWL, JOB_SCRAPE_PUBLIC, JOB_SCRAPE_US } from "@/lib/types";
import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { eq, desc, and, or } from "drizzle-orm";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const US_SCHEDULE_CHECK_MS = 60 * 1000;

const args = new Set(process.argv.slice(2));
const runOnce = args.has("--once");
const withPollingCrawl = args.has("--with-crawl");
const workerId = `worker-${process.pid}`;

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

  const lastJob = await db
    .select({ createdAt: jobs.createdAt })
    .from(jobs)
    .where(eq(jobs.type, JOB_SCRAPE_PUBLIC))
    .orderBy(desc(jobs.createdAt))
    .limit(1);

  if (lastJob.length === 0) {
    console.log("[scheduler] Oeffentliche Ausschreibungen: noch kein Job vorhanden, starte ersten Scrape.");
    return true;
  }

  const elapsed = Date.now() - lastJob[0].createdAt.getTime();
  if (elapsed > TWO_DAYS_MS) {
    console.log(`[scheduler] Oeffentliche Ausschreibungen: letzter Scrape vor ${Math.round(elapsed / 3600000)}h, starte neuen.`);
    return true;
  }

  console.log(`[scheduler] Oeffentliche Ausschreibungen: letzter Scrape vor ${Math.round(elapsed / 3600000)}h, noch nicht noetig.`);
  return false;
};

const shouldEnqueueUsScrape = async (): Promise<boolean> => {
  const activeJobs = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.type, JOB_SCRAPE_US), or(eq(jobs.status, "pending"), eq(jobs.status, "running"))))
    .limit(1);
  if (activeJobs.length > 0) return false;

  const lastJob = await db
    .select({ createdAt: jobs.createdAt })
    .from(jobs)
    .where(eq(jobs.type, JOB_SCRAPE_US))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return lastJob.length === 0 || Date.now() - lastJob[0].createdAt.getTime() > settings.usScrapeIntervalHours * 60 * 60 * 1000;
};

const enqueueUsScrapeIfDue = async (): Promise<void> => {
  try {
    if (await shouldEnqueueUsScrape()) {
      await enqueueJob(JOB_SCRAPE_US, {}, { jobKey: JOB_SCRAPE_US });
      console.log("[scheduler] scrape_us_tenders job queued.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`[scheduler] US scrape check failed: ${message}`);
  }
};

const run = async (): Promise<void> => {
  // Reap stale jobs on startup (e.g. after a crash or deploy)
  try {
    await reapStaleJobs();
  } catch (error) {
    console.warn("[reaper] Fehler beim Aufräumen stale Jobs:", error);
  }

  await enqueueUsScrapeIfDue();

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
    }, { jobKey: JOB_CRAWL });
  }

  try {
    if (await shouldEnqueuePublicScrape()) {
      await enqueueJob(JOB_SCRAPE_PUBLIC, {}, { jobKey: JOB_SCRAPE_PUBLIC });
      console.log("[scheduler] scrape_public_tenders Job eingereiht.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannt";
    console.error(`[scheduler] Fehler beim Public-Scrape Check: ${message}`);
  }

  if (runOnce) {
    const result = await processNextJob(workerId);
    if (!result) {
      console.log("Keine Jobs verfuegbar.");
      return;
    }
    console.log(JSON.stringify(result));
    return;
  }

  console.log(`Worker ${workerId} gestartet. Polling alle ${settings.workerPollSeconds}s.`);
  let reapCounter = 0;
  let lastUsScheduleCheckAt = Date.now();
  while (true) {
    // Reap stale jobs every 10 poll cycles (~30s with default 3s poll)
    if (++reapCounter >= 10) {
      reapCounter = 0;
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

    const result = await processNextJob(workerId);
    if (result) {
      console.log(JSON.stringify(result));
    }
    await sleep(settings.workerPollSeconds * 1_000);
  }
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  console.error(`Worker-Fehler: ${message}`);
  process.exit(1);
});
