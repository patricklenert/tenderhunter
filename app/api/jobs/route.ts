import { db } from "@/lib/db";
import { jobs, jobAttempts } from "@/lib/schema";
import { json } from "@/lib/http";
import { desc, inArray } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const limitRaw = new URL(request.url).searchParams.get("limit") ?? "100";
  const limit = Math.max(1, Math.min(Number.parseInt(limitRaw, 10) || 100, 500));

  const items = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      retries: jobs.retries,
      maxRetries: jobs.maxRetries,
      runAfter: jobs.runAfter,
      lastError: jobs.lastError,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .orderBy(desc(jobs.id))
    .limit(limit);

  const attempts = items.length > 0
    ? await db
      .select({ jobId: jobAttempts.jobId, status: jobAttempts.status })
      .from(jobAttempts)
      .where(inArray(jobAttempts.jobId, items.map((item) => item.id)))
      .orderBy(desc(jobAttempts.id))
    : [];
  const attemptSummary = new Map<number, { count: number; lastStatus: string | null }>();
  for (const attempt of attempts) {
    const current = attemptSummary.get(attempt.jobId) ?? { count: 0, lastStatus: attempt.status };
    current.count += 1;
    attemptSummary.set(attempt.jobId, current);
  }

  return json({
    items: items.map((item) => ({
      ...item,
      attemptCount: attemptSummary.get(item.id)?.count ?? 0,
      lastAttemptStatus: attemptSummary.get(item.id)?.lastStatus ?? null,
    })),
  });
}
