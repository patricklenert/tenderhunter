import { eq, and, lte, sql, inArray, notInArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, jobAttempts, publicScrapeRuns, type Job } from "@/lib/schema";
import { settings } from "@/lib/config";
import { releaseOrphanedCatalogSync, releaseStaleCatalogSync } from "@/lib/catalog";
import {
  JOB_API_ANALYZE,
  JOB_CACHE_DETAIL,
  JOB_CRAWL,
  JOB_DISCOVER_COMPANY,
  JOB_FETCH_DOCUMENTS,
  JOB_FETCH_US_DOCUMENTS,
  JOB_INSIGHT,
  JOB_NOTIFY,
  JOB_PARSE,
  JOB_PREVIEW_COMPANY_URL,
  JOB_SCORE,
  JOB_SCRAPE_PUBLIC,
  JOB_SCRAPE_US,
  JOB_STRUCTURE,
  JOB_SYNC_MEILI,
  type JobType,
  type JsonValue,
} from "@/lib/types";

/** Jobs without a heartbeat for this long are considered stale. */
const STALE_JOB_THRESHOLD_MS = 15 * 60 * 1000;
const STALE_RUNTIME_GRACE_MS = 5 * 60 * 1000;
const MAX_ERROR_MESSAGE_LENGTH = 1_000;

const minutes = (value: number): number => value * 60 * 1_000;

/** Hard ceilings prevent one hung portal, browser, or model call from occupying a worker forever. */
const JOB_MAX_RUNTIME_MS: Partial<Record<JobType, number>> = {
  [JOB_CRAWL]: minutes(120),
  [JOB_SCRAPE_PUBLIC]: minutes(240),
  [JOB_SCRAPE_US]: minutes(120),
  [JOB_FETCH_DOCUMENTS]: minutes(20),
  [JOB_FETCH_US_DOCUMENTS]: minutes(30),
  [JOB_PARSE]: minutes(30),
  [JOB_STRUCTURE]: minutes(20),
  [JOB_SCORE]: minutes(15),
  [JOB_INSIGHT]: minutes(20),
  [JOB_NOTIFY]: minutes(10),
  [JOB_CACHE_DETAIL]: minutes(20),
  [JOB_SYNC_MEILI]: minutes(45),
  [JOB_DISCOVER_COMPANY]: minutes(30),
  [JOB_PREVIEW_COMPANY_URL]: minutes(20),
  [JOB_API_ANALYZE]: minutes(30),
};

export const getJobMaxRuntimeMs = (jobType: string): number =>
  JOB_MAX_RUNTIME_MS[jobType as JobType] ?? minutes(30);

export const isJobRuntimeStale = (
  startedAt: Date | null | undefined,
  jobType: string,
  now = Date.now(),
  graceMs = 0,
): boolean => Boolean(
  startedAt && now - startedAt.getTime() > getJobMaxRuntimeMs(jobType) + graceMs,
);

export const sanitizeErrorMessage = (message: string): string =>
  message.replace(/\u0000/g, "").slice(0, MAX_ERROR_MESSAGE_LENGTH);

const ACTIVE_JOB_STATUSES = ["pending", "running"] as const;

export const CRITICAL_JOB_TYPES = [
  JOB_CRAWL,
  JOB_SCRAPE_PUBLIC,
  JOB_SCRAPE_US,
  JOB_FETCH_DOCUMENTS,
  JOB_FETCH_US_DOCUMENTS,
  JOB_PARSE,
  JOB_STRUCTURE,
  JOB_SCORE,
  JOB_CACHE_DETAIL,
  JOB_SYNC_MEILI,
] as const;

export type JobLane = "critical" | "background" | "all";

export type ClaimJobOptions = {
  lane?: JobLane;
};

export const isCriticalJobType = (jobType: string): boolean =>
  (CRITICAL_JOB_TYPES as readonly string[]).includes(jobType);

export const shouldReuseCompletedJob = (
  status: string | null | undefined,
  dedupeCompleted = true,
): boolean => dedupeCompleted && status === "done";

export const buildJobKey = (jobType: string, scope: string | number, suffix?: string): string =>
  `${jobType}:${scope}${suffix ? `:${suffix}` : ""}`;

type EnqueueOptions = {
  maxRetries?: number;
  runAfter?: Date;
  jobKey?: string;
  groupKey?: string;
  priority?: number;
  /** Reuse only active jobs when false; useful for periodic work. */
  dedupeCompleted?: boolean;
};

// Keep analysis stages ahead of ingestion and scraping work. This prevents a
// large public-scrape backlog from starving documents that are already queued.
export const JOB_PRIORITIES: Partial<Record<JobType, number>> = {
  [JOB_CRAWL]: 40,
  [JOB_SCRAPE_PUBLIC]: 40,
  [JOB_SCRAPE_US]: 40,
  [JOB_PARSE]: 140,
  [JOB_STRUCTURE]: 130,
  [JOB_SCORE]: 120,
  [JOB_CACHE_DETAIL]: 110,
  [JOB_FETCH_DOCUMENTS]: 100,
  [JOB_FETCH_US_DOCUMENTS]: 95,
  [JOB_SYNC_MEILI]: 135,
};

export async function enqueueJob(
  jobType: JobType,
  payload: Record<string, JsonValue>,
  opts?: EnqueueOptions
): Promise<number> {
  const runAfter = opts?.runAfter ?? new Date();
  const maxRetries = opts?.maxRetries ?? settings.maxJobRetries;
  const dedupeCompleted = opts?.dedupeCompleted ?? true;

  const insertJob = async () => db
    .insert(jobs)
    .values({
      type: jobType,
      payload: payload,
      status: "pending",
      retries: 0,
      maxRetries,
      priority: opts?.priority ?? JOB_PRIORITIES[jobType] ?? 100,
      runAfter,
      jobKey: opts?.jobKey,
      groupKey: opts?.groupKey,
    })
    .onConflictDoNothing()
    .returning({ id: jobs.id });

  if (opts?.jobKey) {
    const active = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.jobKey, opts.jobKey), inArray(jobs.status, ACTIVE_JOB_STATUSES)))
      .orderBy(sql`${jobs.id} DESC`)
      .limit(1);
    if (active.length > 0) return active[0].id;

    const latest = await db
      .select({ id: jobs.id, status: jobs.status })
      .from(jobs)
      .where(eq(jobs.jobKey, opts.jobKey))
      .orderBy(sql`${jobs.id} DESC`)
      .limit(1);
    // A completed job represents the unchanged work identified by this key.
    // Failed jobs intentionally fall through so a new retry row preserves the
    // old failure history without resetting it.
    if (shouldReuseCompletedJob(latest[0]?.status, dedupeCompleted)) return latest[0].id;
  }

  const result = await insertJob();

  if (result.length > 0) return result[0].id;

  if (!opts?.jobKey) {
    throw new Error(`Job ${jobType} konnte nicht eingereiht werden`);
  }

  const active = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.jobKey, opts.jobKey), inArray(jobs.status, ACTIVE_JOB_STATUSES)))
    .limit(1);

  if (active.length === 0) {
    const completed = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.jobKey, opts.jobKey))
      .orderBy(sql`${jobs.id} DESC`)
      .limit(1);
    if (completed.length > 0 && completed[0].id) {
      const status = await db
        .select({ status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, completed[0].id))
        .limit(1);
      if (shouldReuseCompletedJob(status[0]?.status, dedupeCompleted)) return completed[0].id;

      if (status[0]?.status === "done" && !dedupeCompleted) {
        const retriedInsert = await insertJob();
        if (retriedInsert.length > 0) return retriedInsert[0].id;

        const racedActive = await db
          .select({ id: jobs.id })
          .from(jobs)
          .where(and(eq(jobs.jobKey, opts.jobKey), inArray(jobs.status, ACTIVE_JOB_STATUSES)))
          .limit(1);
        if (racedActive.length > 0) return racedActive[0].id;
      }

      // This is only reachable when a concurrent insert raced with the retry
      // path. Re-queue the failed row without deleting or rewriting history.
      const retried = await db
        .update(jobs)
        .set({
          status: "pending",
          runAfter,
          lockedAt: null,
          lockedBy: null,
          heartbeatAt: null,
          finishedAt: null,
          durationMs: null,
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.id, completed[0].id), eq(jobs.status, "failed")))
        .returning({ id: jobs.id });
      if (retried.length > 0) return retried[0].id;
    }
    throw new Error(`Job ${jobType} mit Key ${opts.jobKey} konnte nicht eingereiht werden`);
  }
  return active[0].id;
}

export async function claimNextJob(workerId: string, options: ClaimJobOptions = {}): Promise<Job | null> {
  return await db.transaction(async (tx) => {
    const selectNext = async (lane: JobLane) => {
      const conditions = [
        eq(jobs.status, "pending"),
        lte(jobs.runAfter, new Date()),
      ];
      if (lane === "critical") {
        conditions.push(inArray(jobs.type, [...CRITICAL_JOB_TYPES]));
      } else if (lane === "background") {
        conditions.push(notInArray(jobs.type, [...CRITICAL_JOB_TYPES]));
      }

      return tx
        .select()
        .from(jobs)
        .where(and(...conditions))
        .orderBy(sql`${jobs.priority} DESC`, jobs.createdAt, jobs.id)
        .limit(1)
        .for("update", { skipLocked: true });
    };

    const requestedLane = options.lane ?? "all";
    let rows = await selectNext(requestedLane);
    if (rows.length === 0 && requestedLane !== "all") {
      rows = await selectNext("all");
    }

    if (rows.length === 0) return null;

    const job = rows[0];

    await tx
      .update(jobs)
      .set({
        status: "running",
        lockedAt: new Date(),
        lockedBy: workerId,
        startedAt: new Date(),
        heartbeatAt: new Date(),
        finishedAt: null,
        durationMs: null,
        queueLatencyMs: sql`GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ${jobs.createdAt})) * 1000)::integer`,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    await tx.insert(jobAttempts).values({
      jobId: job.id,
      attemptNumber: job.retries + 1,
      workerId,
      status: "running",
    });

    const now = new Date();
    return {
      ...job,
      status: "running" as const,
      lockedAt: now,
      lockedBy: workerId,
      startedAt: now,
      heartbeatAt: now,
      finishedAt: null,
      durationMs: null,
      queueLatencyMs: Math.max(0, now.getTime() - job.createdAt.getTime()),
    };
  });
}

export async function heartbeatJob(jobId: number, workerId: string): Promise<void> {
  const now = new Date();
  await db
    .update(jobs)
    .set({ heartbeatAt: now, lockedAt: now, updatedAt: now })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "running"), eq(jobs.lockedBy, workerId)));
}

export async function markDone(jobId: number, workerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const finishedAt = new Date();
    const updated = await tx
      .update(jobs)
      .set({
        status: "done",
        updatedAt: finishedAt,
        lockedAt: null,
        lockedBy: null,
        heartbeatAt: null,
        finishedAt,
        durationMs: sql`GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ${jobs.startedAt})) * 1000)::integer`,
      })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "running"), eq(jobs.lockedBy, workerId)))
      .returning({ id: jobs.id });

    // A stale handler may finish after the job has already been reaped and
    // claimed again. In that case it must not close the newer attempt.
    if (updated.length === 0) return;

    await tx
      .update(jobAttempts)
      .set({ status: "done", finishedAt })
      .where(and(
        eq(jobAttempts.jobId, jobId),
        eq(jobAttempts.status, "running"),
        eq(jobAttempts.workerId, workerId),
      ));
  });
}

export async function markFailed(jobId: number, workerId: string, errorMessage: string): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await tx
      .select({ retries: jobs.retries, maxRetries: jobs.maxRetries, startedAt: jobs.startedAt })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "running"), eq(jobs.lockedBy, workerId)))
      .limit(1)
      .for("update");

    if (row.length === 0) return;

    const { retries, maxRetries } = row[0];
    const newRetries = retries + 1;
    const safeErrorMessage = sanitizeErrorMessage(errorMessage);

    if (newRetries > maxRetries) {
      await tx
        .update(jobs)
        .set({
          status: "failed",
          retries: newRetries,
          lastError: safeErrorMessage,
           updatedAt: new Date(),
           lockedAt: null,
           lockedBy: null,
           heartbeatAt: null,
           finishedAt: new Date(),
           durationMs: sql`GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ${jobs.startedAt})) * 1000)::integer`,
         })
         .where(eq(jobs.id, jobId));
        await tx.update(jobAttempts).set({ status: "failed", errorMessage: safeErrorMessage, finishedAt: new Date() }).where(and(
          eq(jobAttempts.jobId, jobId),
          eq(jobAttempts.status, "running"),
          eq(jobAttempts.workerId, workerId),
        ));
      return;
    }

    const backoffSeconds = Math.min(300, 30 * 2 ** (newRetries - 1));
    const runAfter = new Date(Date.now() + backoffSeconds * 1000);

    await tx
      .update(jobs)
      .set({
        status: "pending",
        retries: newRetries,
        runAfter,
        lastError: safeErrorMessage,
         updatedAt: new Date(),
         lockedAt: null,
         lockedBy: null,
         heartbeatAt: null,
         finishedAt: null,
         durationMs: null,
       })
       .where(eq(jobs.id, jobId));
      await tx.update(jobAttempts).set({ status: "retrying", errorMessage: safeErrorMessage, finishedAt: new Date() }).where(and(
        eq(jobAttempts.jobId, jobId),
        eq(jobAttempts.status, "running"),
        eq(jobAttempts.workerId, workerId),
      ));
  });
}

/**
 * Resets jobs stuck in "running" back to "pending" so they can be retried.
 * Increments retries — jobs that exceed maxRetries are marked "failed" permanently.
 * Call this periodically (e.g. every worker poll cycle).
 * Returns the number of jobs reaped.
 */
export async function reapStaleJobs(): Promise<number> {
  const now = Date.now();
  const staleThreshold = new Date(now - STALE_JOB_THRESHOLD_MS);

  // Heartbeats detect dead processes. Runtime ceilings detect handlers that are
  // alive enough to heartbeat but no longer making progress.
  const runningJobs = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      retries: jobs.retries,
      maxRetries: jobs.maxRetries,
      startedAt: jobs.startedAt,
      heartbeatAt: jobs.heartbeatAt,
      lockedAt: jobs.lockedAt,
      lockedBy: jobs.lockedBy,
    })
    .from(jobs)
    .where(eq(jobs.status, "running"));

  const staleJobs = runningJobs.filter((job) => {
    const lastHeartbeat = job.heartbeatAt ?? job.lockedAt;
    return isJobRuntimeStale(job.startedAt, job.type, now, STALE_RUNTIME_GRACE_MS)
      || !lastHeartbeat
      || lastHeartbeat.getTime() <= staleThreshold.getTime();
  });

  let reaped = 0;

  for (const job of staleJobs) {
    const newRetries = job.retries + 1;
    const runtimeStale = isJobRuntimeStale(job.startedAt, job.type, now, STALE_RUNTIME_GRACE_MS);
    const staleCondition = and(
      eq(jobs.id, job.id),
      eq(jobs.status, "running"),
      or(
        sql`COALESCE(${jobs.heartbeatAt}, ${jobs.lockedAt}) IS NULL`,
        sql`COALESCE(${jobs.heartbeatAt}, ${jobs.lockedAt}) <= ${staleThreshold.toISOString()}::timestamptz`,
        job.startedAt
          ? lte(jobs.startedAt, new Date(now - getJobMaxRuntimeMs(job.type) - STALE_RUNTIME_GRACE_MS))
          : sql`false`,
      ),
    );
    const reason = runtimeStale ? "job runtime exceeded" : "stale worker lock";
    const runError = newRetries > job.maxRetries
      ? `${reason}; max retries exceeded`
      : `${reason}; retry scheduled`;
    const reapedJob = await db.transaction(async (tx) => {
      let updated: Array<{ id: number }>;

      if (newRetries > job.maxRetries) {
        // Too many retries — mark as permanently failed
        updated = await tx
          .update(jobs)
          .set({
            status: "failed",
            retries: newRetries,
            lastError: sql`COALESCE(${jobs.lastError}, '') || ' [reaped: stale lock - max retries exceeded]'`,
            updatedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            heartbeatAt: null,
            finishedAt: new Date(),
            durationMs: sql`GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ${jobs.startedAt})) * 1000)::integer`,
          })
          .where(staleCondition)
          .returning({ id: jobs.id });
      } else {
        // Retry with backoff
        const backoffSeconds = Math.min(300, 30 * 2 ** (newRetries - 1));
        updated = await tx
          .update(jobs)
          .set({
            status: "pending",
            retries: newRetries,
            runAfter: new Date(Date.now() + backoffSeconds * 1000),
            lastError: sql`COALESCE(${jobs.lastError}, '') || ' [reaped: stale lock]'`,
            updatedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            heartbeatAt: null,
            startedAt: null,
            finishedAt: null,
            durationMs: null,
          })
          .where(staleCondition)
          .returning({ id: jobs.id });
      }

      // Keep the job transition and its attempt/run bookkeeping atomic. A new
      // worker may otherwise claim the reset row before the old attempt is
      // closed, causing the new attempt to be marked retrying as well.
      if (updated.length === 0) return false;
      const attemptWhere = job.lockedBy
        ? and(
          eq(jobAttempts.jobId, job.id),
          eq(jobAttempts.status, "running"),
          eq(jobAttempts.workerId, job.lockedBy),
        )
        : and(eq(jobAttempts.jobId, job.id), eq(jobAttempts.status, "running"));
      await tx.update(jobAttempts).set({
        status: newRetries > job.maxRetries ? "failed" : "retrying",
        errorMessage: runError,
        finishedAt: new Date(),
      }).where(attemptWhere);
      await tx.update(publicScrapeRuns).set({
        status: "failed",
        errorMessage: runError,
        finishedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(publicScrapeRuns.jobId, job.id), eq(publicScrapeRuns.status, "running")));
      return true;
    });
    if (reapedJob) reaped++;
  }

  const releasedOrphanedCatalogSync = await releaseOrphanedCatalogSync();
  const releasedStaleCatalogSync = await releaseStaleCatalogSync();
  if (releasedOrphanedCatalogSync || releasedStaleCatalogSync) {
    console.warn("[reaper] Verwaisten Meilisearch-Katalog-Lock freigegeben.");
  }

  return reaped;
}
