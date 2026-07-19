import { eq, and, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, type Job } from "@/lib/schema";
import { settings } from "@/lib/config";
import type { JobType, JsonValue } from "@/lib/types";

/** Jobs stuck in "running" longer than this are considered stale (15 min). */
const STALE_JOB_THRESHOLD_MS = 50 * 60 * 1000;

export async function enqueueJob(
  jobType: JobType,
  payload: Record<string, JsonValue>,
  opts?: { maxRetries?: number; runAfter?: Date }
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
    })
    .returning({ id: jobs.id });

  return result[0].id;
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
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    return { ...job, status: "running" as const, lockedAt: new Date(), lockedBy: workerId };
  });
}

export async function markDone(jobId: number): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "done",
      updatedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(jobs.id, jobId));
}

export async function markFailed(jobId: number, errorMessage: string): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await tx
      .select({ retries: jobs.retries, maxRetries: jobs.maxRetries })
      .from(jobs)
      .where(eq(jobs.id, jobId))
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
        lte(jobs.lockedAt, staleThreshold)
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
        })
        .where(eq(jobs.id, job.id));
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
        })
        .where(eq(jobs.id, job.id));
    }
    reaped++;
  }

  return reaped;
}
