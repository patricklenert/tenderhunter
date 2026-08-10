import { eq, and, lte, sql, inArray, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, jobAttempts, type Job } from "@/lib/schema";
import { settings } from "@/lib/config";
import {
  JOB_CACHE_DETAIL,
  JOB_CRAWL,
  JOB_FETCH_DOCUMENTS,
  JOB_FETCH_US_DOCUMENTS,
  JOB_PARSE,
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
      priority: opts?.priority ?? 100,
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
  await db
    .update(jobs)
    .set({
      status: "done",
      updatedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      heartbeatAt: null,
      finishedAt: new Date(),
      durationMs: sql`GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ${jobs.startedAt})) * 1000)::integer`,
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "running"), eq(jobs.lockedBy, workerId)));
  await db.update(jobAttempts).set({ status: "done", finishedAt: new Date() }).where(and(eq(jobAttempts.jobId, jobId), eq(jobAttempts.status, "running")));
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

    if (newRetries > maxRetries) {
      await tx
        .update(jobs)
        .set({
          status: "failed",
          retries: newRetries,
          lastError: errorMessage.slice(0, 1000),
           updatedAt: new Date(),
           lockedAt: null,
           lockedBy: null,
           heartbeatAt: null,
           finishedAt: new Date(),
           durationMs: sql`GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ${jobs.startedAt})) * 1000)::integer`,
         })
         .where(eq(jobs.id, jobId));
      await tx.update(jobAttempts).set({ status: "failed", errorMessage: errorMessage.slice(0, 1000), finishedAt: new Date() }).where(and(eq(jobAttempts.jobId, jobId), eq(jobAttempts.status, "running")));
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
        lastError: errorMessage.slice(0, 1000),
         updatedAt: new Date(),
         lockedAt: null,
         lockedBy: null,
         heartbeatAt: null,
         finishedAt: null,
         durationMs: null,
       })
       .where(eq(jobs.id, jobId));
    await tx.update(jobAttempts).set({ status: "retrying", errorMessage: errorMessage.slice(0, 1000), finishedAt: new Date() }).where(and(eq(jobAttempts.jobId, jobId), eq(jobAttempts.status, "running")));
  });
}

/**
 * Resets jobs stuck in "running" back to "pending" so they can be retried.
 * Increments retries — jobs that exceed maxRetries are marked "failed" permanently.
 * Call this periodically (e.g. every worker poll cycle).
 * Returns the number of jobs reaped.
 */
export async function reapStaleJobs(): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);

  // Find stale jobs with their retry info
  const staleJobs = await db
    .select({ id: jobs.id, retries: jobs.retries, maxRetries: jobs.maxRetries })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "running"),
        sql`COALESCE(${jobs.heartbeatAt}, ${jobs.lockedAt}) <= ${staleThreshold.toISOString()}::timestamptz`
      )
    );

  if (staleJobs.length === 0) return 0;

  let reaped = 0;
  for (const job of staleJobs) {
    const newRetries = job.retries + 1;
    if (newRetries > job.maxRetries) {
      // Too many retries — mark as permanently failed
      await db
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
         .where(and(eq(jobs.id, job.id), eq(jobs.status, "running")));
      await db.update(jobAttempts).set({ status: "failed", errorMessage: "stale lock - max retries exceeded", finishedAt: new Date() }).where(and(eq(jobAttempts.jobId, job.id), eq(jobAttempts.status, "running")));
    } else {
      // Retry with backoff
      const backoffSeconds = Math.min(300, 30 * 2 ** (newRetries - 1));
      await db
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
         .where(and(eq(jobs.id, job.id), eq(jobs.status, "running")));
      await db.update(jobAttempts).set({ status: "retrying", errorMessage: "stale lock", finishedAt: new Date() }).where(and(eq(jobAttempts.jobId, job.id), eq(jobAttempts.status, "running")));
    }
    reaped++;
  }

  return reaped;
}
