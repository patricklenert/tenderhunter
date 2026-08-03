import { db } from "@/lib/db";
import { scores, tenders, insights } from "@/lib/schema";
import { json } from "@/lib/http";
import { eq, and, desc } from "drizzle-orm";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const premiumOrResponse = await requirePremiumSession(request);
  if (premiumOrResponse instanceof Response) return premiumOrResponse;

  const companyId = Number.parseInt((await params).companyId, 10);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return json({ error: "ungueltige companyId" }, { status: 400 });
  }

  const rows = await db
    .select({
      tenderId: scores.tenderId,
      title: tenders.title,
      source: tenders.source,
      fit: scores.fit,
      winProbability: scores.winProbability,
      effort: scores.effort,
      requirementCoverage: scores.requirementCoverage,
      killSwitch: scores.killSwitch,
      explanation: insights.explanation,
      actionsJson: insights.actionsJson,
      missingItemsJson: insights.missingItemsJson,
      updatedAt: scores.updatedAt,
    })
    .from(scores)
    .leftJoin(tenders, eq(scores.tenderId, tenders.id))
    .leftJoin(insights, and(eq(insights.tenderId, scores.tenderId), eq(insights.companyId, scores.companyId)))
    .where(and(
      eq(scores.companyId, companyId),
      eq(scores.killSwitch, false),
      eq(tenders.qualityStatus, "qualified"),
      eq(tenders.readinessStatus, "ready"),
    ))
    .orderBy(desc(scores.winProbability), desc(scores.fit))
    .limit(200);

  return json({ company_id: companyId, items: rows });
}
