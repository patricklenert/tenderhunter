import { desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { insights, scores, structuredData, tenders } from "@/lib/schema";
import { computeScores, type CompanyRow } from "@/lib/scoring";
import { generateInsight } from "@/lib/insights";
import type { StructuredData as StructuredTenderData } from "@/lib/structurer";

const fallbackStructured = (title: string): StructuredTenderData => ({
  title,
  summary: title,
  confidence: 0.3,
  hard_facts: { location: "Deutschland", deadline: null, budget: null, buyer: null, contract_type: null },
  decision_relevant: {
    scope: title.split(" ").filter((word) => word.length > 3),
    requirements: [],
    mandatory_documents: [],
    award_criteria: [],
  },
  procurement: {
    contract_value: { min: null, max: null, currency: "EUR" },
    contract_duration: { months: null, renewal: false },
    award_criteria_detailed: [],
    participation_requirements: [],
    cpv_codes: [],
    procedure_type: "offen",
  },
});

const parseStructured = (value: unknown, title: string): StructuredTenderData => {
  if (typeof value === "object" && value !== null) return value as StructuredTenderData;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed as StructuredTenderData : fallbackStructured(title);
  } catch {
    return fallbackStructured(title);
  }
};

export async function scoreKnownTenders(companyId: number, companyRow: CompanyRow, limit = 200): Promise<number> {
  const rows = await db
    .select({
      id: tenders.id,
      title: tenders.title,
      structuredJson: structuredData.jsonBlob,
    })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")))
    .orderBy(desc(tenders.createdAt))
    .limit(limit);

  const scoreRows = [] as Array<{
    tenderId: number;
    companyId: number;
    fit: number;
    winProbability: number;
    effort: number;
    requirementCoverage: number;
    killSwitch: boolean;
    detailsJson: Record<string, number>;
  }>;
  const insightRows = [] as Array<{
    tenderId: number;
    companyId: number;
    explanation: string;
    actionsJson: string[];
    missingItemsJson: string[];
  }>;

  for (const row of rows) {
    const structured = parseStructured(row.structuredJson, row.title ?? "");
    const score = computeScores(row.title ?? "", structured, companyRow);
    const insight = generateInsight(score, structured);
    scoreRows.push({
      tenderId: row.id,
      companyId,
      fit: score.fit,
      winProbability: score.win_probability,
      effort: score.effort,
      requirementCoverage: score.requirement_coverage,
      killSwitch: score.kill_switch,
      detailsJson: score.details,
    });
    insightRows.push({
      tenderId: row.id,
      companyId,
      explanation: insight.explanation,
      actionsJson: insight.actions,
      missingItemsJson: insight.missing_items,
    });
  }

  if (scoreRows.length > 0) {
    await db
      .insert(scores)
      .values(scoreRows)
      .onConflictDoUpdate({
        target: [scores.tenderId, scores.companyId],
        set: {
          fit: sql`excluded.fit`,
          winProbability: sql`excluded.win_probability`,
          effort: sql`excluded.effort`,
          requirementCoverage: sql`excluded.requirement_coverage`,
          killSwitch: sql`excluded.kill_switch`,
          detailsJson: sql`excluded.details_json`,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(insights)
      .values(insightRows)
      .onConflictDoUpdate({
        target: [insights.tenderId, insights.companyId],
        set: {
          explanation: sql`excluded.explanation`,
          actionsJson: sql`excluded.actions_json`,
          missingItemsJson: sql`excluded.missing_items_json`,
          updatedAt: new Date(),
        },
      });
  }

  return scoreRows.length;
}
