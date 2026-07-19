import { eq, and, lte, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, type Job } from "@/lib/schema";
import { settings } from "@/lib/config";
import type { JobType, JsonValue } from "@/lib/types";

/** Jobs without a heartbeat for this long are considered stale. */
const STALE_JOB_THRESHOLD_MS = 15 * 60 * 1000;

const ACTIVE_JOB_STATUSES = ["pending", "running"] as const;

type EnqueueOptions = {
  maxRetries?: number;
  runAfter?: Date;
  jobKey?: string;
  groupKey?: string;
};

export async function enqueueJob(
  jobType: JobType,
  payload: Record<string, JsonValue>,
  opts?: EnqueueOptions
): Promise<number> {
  const runAfter = opts?.runAfter ?? new Date();
  const maxRetries = opts?.maxRetries ?? settings.maxJobRetries;

  const result = await db
    .insert(jobs)
    .values({
      type: jobType,
      payload: payload,
      status: "pending",
      retries: 0,
      maxRetries,
      runAfter,
      jobKey: opts?.jobKey,
      groupKey: opts?.groupKey,
    })
    .onConflictDoNothing()
    .returning({ id: jobs.id });

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
    throw new Error(`Job ${jobType} mit Key ${opts.jobKey} konnte nicht eingereiht werden`);
  }
  return active[0].id;
}

export async function claimNextJob(workerId: string): Promise<Job | null> {
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, "pending"),
          lte(jobs.runAfter, new Date())
        )
      )
      .orderBy(jobs.createdAt)
      .limit(1)
      .for("update", { skipLocked: true });

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
    }
    reaped++;
  }

  return reaped;
}
