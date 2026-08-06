import { and, desc, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { insights, scores, structuredData, tenders } from "@/lib/schema";
import { computeScores, type CompanyRow } from "@/lib/scoring";
import { generateInsight } from "@/lib/insights";
import { normalizeStructured, type StructuredData as StructuredTenderData } from "@/lib/structurer";

export interface PublicProfileMatch {
  tenderId: number;
  fit: number;
  winProbability: number;
  killSwitch: boolean;
  title: string | null;
  url: string | null;
  rawText: string | null;
  jsonBlob: unknown;
  slug: string | null;
  readinessStatus: string | null;
}

export interface PublicProfileMatchOptions {
  qualifiedOnly?: boolean;
}

const fallbackStructured = (title: string): StructuredTenderData => ({
  title,
  summary: title,
  confidence: 0.3,
  hard_facts: { location: null, deadline: null, budget: null, buyer: null, contract_type: null },
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
  if (typeof value === "object" && value !== null) return normalizeStructured(value, title);
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? normalizeStructured(parsed, title) : fallbackStructured(title);
  } catch {
    return fallbackStructured(title);
  }
};

export async function scoreKnownTenders(companyId: number, companyRow: CompanyRow): Promise<number> {
  const rows = await db
    .select({
      id: tenders.id,
      title: tenders.title,
      metadataJson: tenders.metadataJson,
      structuredJson: structuredData.jsonBlob,
      readinessStatus: tenders.readinessStatus,
    })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      eq(tenders.qualityStatus, "qualified"),
      eq(tenders.readinessStatus, "ready"),
      isNotNull(structuredData.jsonBlob),
    ))
    .orderBy(desc(tenders.createdAt));

  const scoreRows = [] as Array<{
    tenderId: number;
    companyId: number;
    fit: number;
    winProbability: number;
    effort: number;
    requirementCoverage: number;
    killSwitch: boolean;
    detailsJson: Record<string, unknown>;
  }>;
  const insightRows = [] as Array<{
    tenderId: number;
    companyId: number;
    explanation: string;
    actionsJson: string[];
    missingItemsJson: string[];
  }>;

  for (const row of rows) {
    if (!row.structuredJson || row.readinessStatus !== "ready") continue;
    const structured = parseStructured(row.structuredJson, row.title ?? "");
    const metadata = typeof row.metadataJson === "object" && row.metadataJson !== null
      ? row.metadataJson as Record<string, unknown>
      : {};
    const score = computeScores(row.title ?? "", structured, companyRow, undefined, {
      metadataLocation: metadata.location,
      metadataDescription: metadata.description,
      structuredLocation: structured.hard_facts.location,
    });
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

export async function findPublicProfileMatches(
  companyRow: CompanyRow,
  excludeTenderIds: Set<number> = new Set(),
  limit = 10,
  options: PublicProfileMatchOptions = {},
): Promise<PublicProfileMatch[]> {
  const rows = await db
    .select({
      tenderId: tenders.id,
      title: tenders.title,
      url: tenders.url,
      rawText: tenders.rawText,
      metadataJson: tenders.metadataJson,
      jsonBlob: structuredData.jsonBlob,
      slug: tenders.slug,
      readinessStatus: tenders.readinessStatus,
    })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      options.qualifiedOnly
        ? eq(tenders.qualityStatus, "qualified")
        : or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
      or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, new Date())),
      isNotNull(structuredData.jsonBlob),
    ))
    .orderBy(desc(tenders.createdAt))
    .limit(2_000);

  return rows
    .filter((row) => !excludeTenderIds.has(row.tenderId) && row.jsonBlob !== null)
    .flatMap((row) => {
      const structured = parseStructured(row.jsonBlob, row.title ?? "");
      const metadata = typeof row.metadataJson === "object" && row.metadataJson !== null
        ? row.metadataJson as Record<string, unknown>
        : {};
      const score = computeScores(row.title ?? "", structured, companyRow, undefined, {
        metadataLocation: metadata.location,
        metadataDescription: metadata.description,
        structuredLocation: structured.hard_facts.location,
        allowUnknownTenderLocation: true,
      });

      if (score.kill_switch || score.fit <= 10) return [];
      return [{
        tenderId: row.tenderId,
        fit: score.fit,
        winProbability: score.win_probability,
        killSwitch: score.kill_switch,
        title: row.title,
        url: row.url,
        rawText: row.rawText,
        jsonBlob: row.jsonBlob,
        slug: row.slug,
        readinessStatus: row.readinessStatus,
      }];
    })
    .sort((a, b) => b.winProbability - a.winProbability || b.fit - a.fit || a.tenderId - b.tenderId)
    .slice(0, limit);
}
