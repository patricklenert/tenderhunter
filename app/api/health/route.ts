import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const dbResult = await db.execute(sql`SELECT 1 AS ok`);
    const database = dbResult[0]?.ok === 1 ? "ok" : "error";

    const queueResult = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE status = 'pending') AS pending,
        count(*) FILTER (WHERE status = 'failed') AS failed_recent,
        count(*) FILTER (WHERE status = 'running' AND heartbeat_at < now() - interval '5 minutes') AS stale_running
      FROM jobs
      WHERE status IN ('pending', 'running')
         OR (status = 'failed' AND created_at > now() - interval '24 hours')
    `);
    const row = queueResult[0] ?? {};
    const pending = Number(row.pending ?? 0);
    const failed24h = Number(row.failed_recent ?? 0);
    const staleRunning = Number(row.stale_running ?? 0);

    const sourceResult = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE status IN ('failed', 'timed_out')) AS failed_recent,
        count(*) FILTER (WHERE status = 'partial') AS partial_recent,
        count(*) FILTER (WHERE status = 'empty') AS empty_recent,
        max(finished_at) AS last_finished_at
      FROM public_source_runs
      WHERE finished_at > now() - interval '24 hours'
    `);
    const sourceRow = sourceResult[0] ?? {};
    const sourceFailures24h = Number(sourceRow.failed_recent ?? 0);
    const sourcePartial24h = Number(sourceRow.partial_recent ?? 0);
    const sourceEmpty24h = Number(sourceRow.empty_recent ?? 0);

    const status = database === "ok" && staleRunning === 0 && sourceFailures24h === 0 ? "ok" : "degraded";
    return json({
      status,
      database,
      queue: { pending, failed24h, staleRunning },
      sources: {
        failed24h: sourceFailures24h,
        partial24h: sourcePartial24h,
        empty24h: sourceEmpty24h,
        lastFinishedAt: sourceRow.last_finished_at ?? null,
      },
    });
  } catch (error) {
    return json(
      { status: "error", error: error instanceof Error ? error.message : "unknown" },
      { status: 503 },
    );
  }
}
