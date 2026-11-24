import "dotenv/config";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { jobAttempts, jobs, publicScrapeRuns } from "../lib/schema";

const key = `test:queue:${Date.now()}`;
const createdIds: number[] = [];
const createdRunIds: number[] = [];

const markDone = async (db: typeof import("../lib/db").db, id: number): Promise<void> => {
  await db.update(jobs).set({ status: "done", finishedAt: new Date(), updatedAt: new Date() }).where(eq(jobs.id, id));
};

const main = async (): Promise<void> => {
  const databaseUrl = process.env.QUEUE_TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Set QUEUE_TEST_DATABASE_URL to a disposable PostgreSQL database; this test runs the global stale-job reaper.");
  }
  process.env.DATABASE_URL = databaseUrl;

  const [{ db }, { claimNextJob, enqueueJob, markDone: markQueueJobDone, markFailed, reapStaleJobs }] = await Promise.all([
    import("../lib/db"),
    import("../lib/queue"),
  ]);

  try {
    const first = await enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key, dedupeCompleted: false });
    createdIds.push(first);

    await markDone(db, first);
    const second = await enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key, dedupeCompleted: false });
    createdIds.push(second);
    assert.notEqual(second, first, "periodic work must be reinserted after completion");

    assert.equal(
      await enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key }),
      second,
      "active work must still be coalesced",
    );

    await markDone(db, second);
    assert.equal(
      await enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key }),
      second,
      "one-shot work must reuse completed work by default",
    );

    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () => enqueueJob("cache_detail", { tender_id: 1 }, { jobKey: key, dedupeCompleted: false })),
    );
    const concurrentIds = [...new Set(concurrent)];
    assert.equal(concurrentIds.length, 1, "concurrent periodic enqueues must leave one active row");
    createdIds.push(...concurrentIds);

    const publicJob = await enqueueJob("scrape_public_tenders", {}, {
      jobKey: `${key}:public`,
      groupKey: "public-scrape",
      maxRetries: 2,
      priority: 150,
      dedupeCompleted: false,
    });
    createdIds.push(publicJob);
    const publicWorker = `${key}:public-worker`;
    const claimedPublic = await claimNextJob(publicWorker, { lane: "critical" });
    assert.equal(claimedPublic?.id, publicJob, "public scrape job should be claimable for run bookkeeping");
    const publicRun = await db.insert(publicScrapeRuns).values({
      jobId: publicJob,
      isFullRun: true,
      status: "running",
    }).returning({ id: publicScrapeRuns.id });
    createdRunIds.push(publicRun[0].id);

    await markFailed(publicJob, claimedPublic!.lockedBy!, "transient public scrape error");
    const closedRun = await db.select({ status: publicScrapeRuns.status, finishedAt: publicScrapeRuns.finishedAt })
      .from(publicScrapeRuns)
      .where(eq(publicScrapeRuns.id, publicRun[0].id));
    assert.equal(closedRun[0]?.status, "failed", "retryable public scrape failure must close its run row");
    assert.ok(closedRun[0]?.finishedAt, "failed public scrape run must have finishedAt");
    await db.update(jobs).set({ status: "failed", finishedAt: new Date(), updatedAt: new Date() }).where(eq(jobs.id, publicJob));

    const usScrapeFirst = await enqueueJob("scrape_us_tenders", {}, {
      jobKey: `${key}:us-scrape-first`,
      priority: 250,
      dedupeCompleted: false,
    });
    const usFetchAfterScrape = await enqueueJob("fetch_us_documents", { us_tender_id: 1 }, {
      jobKey: `${key}:us-fetch-after-scrape`,
      groupKey: `${key}:us-tender:1`,
      priority: 240,
      dedupeCompleted: false,
    });
    createdIds.push(usScrapeFirst, usFetchAfterScrape);
    const claimedUsScrape = await claimNextJob(`${key}:us-scrape-worker`, { lane: "all" });
    assert.equal(claimedUsScrape?.id, usScrapeFirst, "US scrape should be claimed ahead of its document job");
    assert.equal(
      await claimNextJob(`${key}:us-fetch-blocked-worker`, { lane: "all" }),
      null,
      "US document processing must wait while the scrape can replace attachment metadata",
    );
    await markQueueJobDone(usScrapeFirst, claimedUsScrape!.lockedBy!);
    const claimedUsFetch = await claimNextJob(`${key}:us-fetch-worker`, { lane: "all" });
    assert.equal(claimedUsFetch?.id, usFetchAfterScrape, "US document job should run after the scrape completes");
    await markQueueJobDone(usFetchAfterScrape, claimedUsFetch!.lockedBy!);

    const usFetchFirst = await enqueueJob("fetch_us_documents", { us_tender_id: 2 }, {
      jobKey: `${key}:us-fetch-first`,
      groupKey: `${key}:us-tender:2`,
      priority: 250,
      dedupeCompleted: false,
    });
    const usScrapeAfterFetch = await enqueueJob("scrape_us_tenders", {}, {
      jobKey: `${key}:us-scrape-after-fetch`,
      priority: 240,
      dedupeCompleted: false,
    });
    createdIds.push(usFetchFirst, usScrapeAfterFetch);
    const claimedUsFetchFirst = await claimNextJob(`${key}:us-fetch-first-worker`, { lane: "all" });
    assert.equal(claimedUsFetchFirst?.id, usFetchFirst, "US document job should be claimable before a later scrape");
    assert.equal(
      await claimNextJob(`${key}:us-scrape-blocked-worker`, { lane: "all" }),
      null,
      "a US scrape must wait while a document job writes attachment metadata",
    );
    await markQueueJobDone(usFetchFirst, claimedUsFetchFirst!.lockedBy!);
    const claimedUsScrapeAfterFetch = await claimNextJob(`${key}:us-scrape-after-fetch-worker`, { lane: "all" });
    assert.equal(claimedUsScrapeAfterFetch?.id, usScrapeAfterFetch, "US scrape should run after document processing completes");
    await markQueueJobDone(usScrapeAfterFetch, claimedUsScrapeAfterFetch!.lockedBy!);

    const orphanJob = await enqueueJob("cache_detail", { tender_id: 2 }, {
      jobKey: `${key}:orphan`,
      dedupeCompleted: false,
    });
    createdIds.push(orphanJob);
    const orphanAttempt = await db.insert(jobAttempts).values({
      jobId: orphanJob,
      attemptNumber: 1,
      workerId: `${key}:orphan-worker`,
      status: "running",
    }).returning({ id: jobAttempts.id });
    await db.update(jobs).set({ status: "failed", finishedAt: new Date(), updatedAt: new Date() }).where(eq(jobs.id, orphanJob));

    await reapStaleJobs();
    const closedAttempt = await db.select({ status: jobAttempts.status, finishedAt: jobAttempts.finishedAt })
      .from(jobAttempts)
      .where(eq(jobAttempts.id, orphanAttempt[0].id));
    assert.equal(closedAttempt[0]?.status, "failed", "orphaned attempts of failed jobs must be closed");
    assert.ok(closedAttempt[0]?.finishedAt, "orphaned attempts must receive finishedAt");

    console.log("Queue database tests passed.");
  } finally {
    if (createdRunIds.length > 0) {
      await db.delete(publicScrapeRuns).where(inArray(publicScrapeRuns.id, [...new Set(createdRunIds)]));
    }
    if (createdIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, [...new Set(createdIds)]));
    }
    await db.$client.end({ timeout: 5 }).catch(() => undefined);
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
