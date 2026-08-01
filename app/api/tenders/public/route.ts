import { db } from "@/lib/db";
import { jobs, publicScrapeRuns, publicSourceRuns, tenders } from "@/lib/schema";
import { enqueueJob } from "@/lib/queue";
import { json, errorResponse } from "@/lib/http";
import { JOB_SCRAPE_PUBLIC } from "@/lib/types";
import { eq, desc, and, count, gte } from "drizzle-orm";
import { requireSession } from "@/lib/api-auth";
import { getPublicCatalogQualitySummary, getPublicScrapeMonitoring } from "@/lib/public-monitoring";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const lastJob = await db
      .select({
        id: jobs.id,
        status: jobs.status,
        createdAt: jobs.createdAt,
        lastError: jobs.lastError,
      })
      .from(jobs)
      .where(eq(jobs.type, JOB_SCRAPE_PUBLIC))
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    const lastRun = await db.select().from(publicScrapeRuns).orderBy(desc(publicScrapeRuns.startedAt)).limit(1);
    const sourceRuns = lastRun[0]
      ? await db.select().from(publicSourceRuns).where(eq(publicSourceRuns.runId, lastRun[0].id)).orderBy(publicSourceRuns.sourceKey)
      : [];

    const pendingJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.type, JOB_SCRAPE_PUBLIC), eq(jobs.status, "pending")));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentTenders = await db
      .select({ total: count() })
      .from(tenders)
      .where(
        and(
          gte(tenders.createdAt, sevenDaysAgo),
          eq(tenders.source, "search")
        )
      );

    const [quality, monitoring] = await Promise.all([
      getPublicCatalogQualitySummary(),
      getPublicScrapeMonitoring(),
    ]);

    return json({
      lastRun: lastRun[0]
        ? {
            id: lastRun[0].id,
            jobId: lastRun[0].jobId,
            status: lastRun[0].status,
            startedAt: lastRun[0].startedAt,
            finishedAt: lastRun[0].finishedAt,
             totalFound: lastRun[0].totalFound,
             afterDedup: lastRun[0].afterDedup,
             acceptedCount: lastRun[0].acceptedCount,
             insertedCount: lastRun[0].insertedCount,
             updatedCount: lastRun[0].updatedCount,
             skippedExpired: lastRun[0].skippedExpired,
             errorMessage: lastRun[0].errorMessage,
             sources: sourceRuns,
          }
        : lastJob[0]
        ? {
            id: lastJob[0].id,
            status: lastJob[0].status,
            createdAt: lastJob[0].createdAt,
            lastError: lastJob[0].lastError,
          }
        : null,
      pendingJobs: pendingJobs.length,
      tendersLast7Days: recentTenders[0]?.total ?? 0,
      quality,
      monitoring,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const pendingJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.type, JOB_SCRAPE_PUBLIC), eq(jobs.status, "pending")));

    if (pendingJobs.length > 0) {
      return json({
        message: "Scrape-Job laeuft bereits oder wartet.",
        jobId: pendingJobs[0].id,
      });
    }

    const jobId = await enqueueJob(JOB_SCRAPE_PUBLIC, {}, { jobKey: JOB_SCRAPE_PUBLIC, priority: 150 });

    return json({
      message: "Oeffentliche Ausschreibungen Scrape gestartet.",
      jobId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
