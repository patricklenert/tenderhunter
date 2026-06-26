import { db } from "@/lib/db";
import { jobs, tenders } from "@/lib/schema";
import { enqueueJob } from "@/lib/queue";
import { json, errorResponse } from "@/lib/http";
import { JOB_SCRAPE_PUBLIC } from "@/lib/types";
import { eq, desc, and, count, gte } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
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

    return json({
      lastRun: lastJob[0]
        ? {
            id: lastJob[0].id,
            status: lastJob[0].status,
            createdAt: lastJob[0].createdAt,
            lastError: lastJob[0].lastError,
          }
        : null,
      pendingJobs: pendingJobs.length,
      tendersLast7Days: recentTenders[0]?.total ?? 0,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(): Promise<Response> {
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

    const jobId = await enqueueJob(JOB_SCRAPE_PUBLIC, {});

    return json({
      message: "Oeffentliche Ausschreibungen Scrape gestartet.",
      jobId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
