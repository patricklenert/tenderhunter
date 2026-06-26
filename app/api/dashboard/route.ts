import { db } from "@/lib/db";
import { tenders, companyProfiles, jobs, insights, scores, trackedTenders } from "@/lib/schema";
import { json } from "@/lib/http";
import { ACTIVE_TRACKED_TENDER_STATUSES } from "@/lib/tracked-tender-types";
import { and, avg, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const scoreEligible = or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate"));
    const now = new Date();
    const dueSoon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [tendersCount] = await db.select({ count: count() }).from(tenders);
    const [companiesCount] = await db.select({ count: count() }).from(companyProfiles);
    const [jobsOpenCount] = await db
      .select({ count: count() })
      .from(jobs)
      .where(inArray(jobs.status, ["pending", "running"]));
    const [insightsCount] = await db.select({ count: count() }).from(insights);
    const [avgWinResult] = await db
      .select({ value: avg(scores.winProbability) })
      .from(scores)
      .leftJoin(tenders, eq(scores.tenderId, tenders.id))
      .where(scoreEligible);
    const [killSwitchCountResult] = await db
      .select({ count: count() })
      .from(scores)
      .leftJoin(tenders, eq(scores.tenderId, tenders.id))
      .where(and(eq(scores.killSwitch, true), scoreEligible));

    const trackedByStatus = await db
      .select({
        status: trackedTenders.status,
        count: count(),
      })
      .from(trackedTenders)
      .groupBy(trackedTenders.status)
      .orderBy(trackedTenders.status);

    const [trackedDueSoon] = await db
      .select({ count: count() })
      .from(trackedTenders)
      .where(
        and(
          inArray(trackedTenders.status, [...ACTIVE_TRACKED_TENDER_STATUSES]),
          gte(trackedTenders.deadlineAt, now),
          lte(trackedTenders.deadlineAt, dueSoon),
        ),
      );

    const qualityByStatus = await db
      .select({
        status: tenders.qualityStatus,
        count: count(),
      })
      .from(tenders)
      .groupBy(tenders.qualityStatus)
      .orderBy(tenders.qualityStatus);

    const qualityBySource = await db
      .select({
        sourceKey: tenders.sourceKey,
        source: tenders.source,
        total: count(),
        qualified: sql<number>`sum(case when ${tenders.qualityStatus} = 'qualified' then 1 else 0 end)`.as("qualified"),
        candidate: sql<number>`sum(case when ${tenders.qualityStatus} = 'candidate' then 1 else 0 end)`.as("candidate"),
        rejected: sql<number>`sum(case when ${tenders.qualityStatus} = 'rejected' then 1 else 0 end)`.as("rejected"),
        duplicate: sql<number>`sum(case when ${tenders.qualityStatus} = 'duplicate' then 1 else 0 end)`.as("duplicate"),
      })
      .from(tenders)
      .groupBy(tenders.sourceKey, tenders.source)
      .orderBy(desc(sql`count(*)`), tenders.source);

    const topRecommendations = await db
      .select({
        tenderId: scores.tenderId,
        tenderTitle: tenders.title,
        companyName: companyProfiles.name,
        fit: scores.fit,
        winProbability: scores.winProbability,
        killSwitch: scores.killSwitch,
      })
      .from(scores)
      .leftJoin(tenders, eq(scores.tenderId, tenders.id))
      .leftJoin(companyProfiles, eq(scores.companyId, companyProfiles.id))
      .where(scoreEligible)
      .orderBy(desc(scores.winProbability), desc(scores.fit))
      .limit(10);

    const queueLanes = await db
      .select({
        type: jobs.type,
        count: count(),
      })
      .from(jobs)
      .where(inArray(jobs.status, ["pending", "running"]))
      .groupBy(jobs.type)
      .orderBy(count(), jobs.type);

    return json({
      tenders: tendersCount.count,
      companies: companiesCount.count,
      jobsOpen: jobsOpenCount.count,
      insights: insightsCount.count,
      avgWinProbability: Number(avgWinResult.value ?? 0),
      killSwitchCount: killSwitchCountResult.count,
      trackedWorkflow: {
        total: trackedByStatus.reduce((sum, item) => sum + item.count, 0),
        dueSoon: trackedDueSoon.count,
        byStatus: trackedByStatus,
      },
      sourceQuality: {
        byStatus: qualityByStatus,
        bySource: qualityBySource,
      },
      topRecommendations,
      queueLanes,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 500 });
  }
}
