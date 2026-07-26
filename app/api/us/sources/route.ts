import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { usSourceRuns } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const rows = await db
    .select()
    .from(usSourceRuns)
    .orderBy(desc(usSourceRuns.finishedAt))
    .limit(100);
  const latestBySource = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    if (!latestBySource.has(row.source)) latestBySource.set(row.source, row);
  }
  return json({ sources: [...latestBySource.values()] });
}
