import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { json } from "@/lib/http";
import { desc } from "drizzle-orm";

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

  return json({ items });
}
