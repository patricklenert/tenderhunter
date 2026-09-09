import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { jobs, publicSourceCursors } from "../lib/schema";
import { enqueueJob, PUBLIC_CONTINUATION_PRIORITY } from "../lib/queue";
import { cursorPendingDetails, shouldSchedulePublicContinuation, type PublicSourceCursor } from "../lib/public-pagination";
import { JOB_SCRAPE_PUBLIC } from "../lib/types";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="))?.slice("--source=".length).trim() || null;
const limitArg = Number.parseInt(process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? "25", 10);
const limit = Number.isFinite(limitArg) ? Math.max(1, Math.min(limitArg, 100)) : 25;

type CursorRow = {
  sourceKey: string;
  cursorJson: unknown;
  exhausted: boolean;
  continuationRequired: boolean;
  lastStatus: string | null;
  lastError: string | null;
};

type RecoveryCandidate = CursorRow & {
  pendingCount: number;
  retryablePendingCount: number;
  reason: string;
};

const loadCursors = async (): Promise<CursorRow[]> => {
  const query = db
    .select({
      sourceKey: publicSourceCursors.sourceKey,
      cursorJson: publicSourceCursors.cursorJson,
      exhausted: publicSourceCursors.exhausted,
      continuationRequired: publicSourceCursors.continuationRequired,
      lastStatus: publicSourceCursors.lastStatus,
      lastError: publicSourceCursors.lastError,
    })
    .from(publicSourceCursors);

  if (sourceArg) {
    return query.where(eq(publicSourceCursors.sourceKey, sourceArg));
  }
  return query;
};

const main = async (): Promise<void> => {
  const cursors = await loadCursors();
  const activeRows = await db
    .select({ jobKey: jobs.jobKey })
    .from(jobs)
    .where(and(
      eq(jobs.type, JOB_SCRAPE_PUBLIC),
      inArray(jobs.status, ["pending", "running"]),
    ));
  const activeKeys = new Set(activeRows.flatMap((row) => row.jobKey ? [row.jobKey] : []));

  const candidates: RecoveryCandidate[] = cursors.flatMap((cursor) => {
    if (!cursor.continuationRequired) return [];
    const pending = cursorPendingDetails((cursor.cursorJson ?? {}) as PublicSourceCursor);
    const retryable = pending.filter((reference) => reference.blocked !== true);
    const jobKey = `public-continuation:${cursor.sourceKey}`;
    if (!shouldSchedulePublicContinuation(
      cursor.cursorJson as PublicSourceCursor,
      cursor.exhausted,
      cursor.continuationRequired,
      cursor.lastStatus,
      cursor.lastError,
    ) || activeKeys.has(jobKey)) return [];

    return [{
      ...cursor,
      pendingCount: pending.length,
      retryablePendingCount: retryable.length,
      reason: retryable.length > 0 ? "retryable pending details" : `source status ${cursor.lastStatus ?? "unknown"}`,
    }];
  }).slice(0, limit);

  console.log(`[recover-public-queue] Modus: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`[recover-public-queue] Kandidaten: ${candidates.length}, aktive Public-Jobs: ${activeKeys.size}`);
  for (const candidate of candidates) {
    console.log(`  ${candidate.sourceKey}: ${candidate.reason}; pending=${candidate.pendingCount}, retryable=${candidate.retryablePendingCount}`);
  }

  if (apply) {
    for (const candidate of candidates) {
      const jobId = await enqueueJob(JOB_SCRAPE_PUBLIC, { source: candidate.sourceKey }, {
        jobKey: `public-continuation:${candidate.sourceKey}`,
        groupKey: "public-scrape",
        priority: PUBLIC_CONTINUATION_PRIORITY,
        dedupeCompleted: false,
      });
      console.log(`  ${candidate.sourceKey}: Job #${jobId} eingereiht.`);
    }
  }
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end({ timeout: 5 }).catch(() => undefined);
  });
