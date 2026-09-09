import { json, errorResponse } from "@/lib/http";
import { searchTenders } from "@/lib/meilisearch";
import {
  formatDeadlineDE,
  getGermanLastThreeDaysUnixRange,
  isTenderDeadlineFilter,
  resolveTenderDeadlineFilter,
  sanitizeTenderUrl,
} from "@/lib/date-utils";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { gte, lt, and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { pickPublicDescription } from "@/lib/public-tender-scraper";
import { normalizePublicClient, pickValidatedPublicCandidate, pickValidatedPublicLocationForTender } from "@/lib/public-content-quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const bundesland = url.searchParams.get("bundesland");
    const city = url.searchParams.get("city");
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "24", 10) || 24, 1), 30);
    const page = Math.max(Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1);
    const todayNew = ["1", "true"].includes(url.searchParams.get("todayNew") ?? "");
    const deadlineFilterValue = url.searchParams.get("deadlineFilter") ?? "all";
    if (!isTenderDeadlineFilter(deadlineFilterValue)) {
      throw new Error("Ungültiger Fristenfilter");
    }
    const now = new Date();
    const deadlineBounds = resolveTenderDeadlineFilter(
      deadlineFilterValue,
      url.searchParams.get("deadlineFrom"),
      url.searchParams.get("deadlineTo"),
      now,
    );
    const sort: "deadline" | "newest" = url.searchParams.get("sort") === "newest" ? "newest" : "deadline";
    const lastThreeDaysRange = getGermanLastThreeDaysUnixRange();
    const baseSearchParams = {
      query,
      bundesland: bundesland || null,
      city: city || null,
      limit,
      page,
      ...deadlineBounds,
      sort,
    };

    const result = await searchTenders({
      ...baseSearchParams,
      ...(todayNew
        ? { firstSeenAtFrom: lastThreeDaysRange.from, firstSeenAtTo: lastThreeDaysRange.to }
        : {}),
    });

    const fromTimestamp = new Date(lastThreeDaysRange.from * 1000);
    const toTimestamp = new Date(lastThreeDaysRange.to * 1000);
    const countConditions = [
      eq(tenders.qualityStatus, "qualified"),
      gte(tenders.firstSeenAt, fromTimestamp),
      lt(tenders.firstSeenAt, toTimestamp),
      or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
    ];
    if (deadlineBounds.hasDeadline === false) {
      countConditions.push(isNull(tenders.deadlineAt));
    }
    if (deadlineBounds.deadlineAtFrom !== undefined) {
      countConditions.push(gte(tenders.deadlineAt, new Date(deadlineBounds.deadlineAtFrom * 1000)));
    }
    if (deadlineBounds.deadlineAtTo !== undefined) {
      countConditions.push(lt(tenders.deadlineAt, new Date(deadlineBounds.deadlineAtTo * 1000)));
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenders)
      .where(and(...countConditions));
    const todayNewCount = count;

    const items = result.hits.map((hit) => {
      const title = pickValidatedPublicCandidate(hit.title) || `Ausschreibung #${hit.id}`;
      const client = normalizePublicClient(hit.client) || "Unbekannt";
      return {
        id: hit.id,
        title,
        client,
        location: pickValidatedPublicLocationForTender(title, client, hit.location),
        bundesland: hit.bundesland,
         city: pickValidatedPublicLocationForTender(title, client, hit.city) || null,
        category: hit.category,
         description: pickPublicDescription(hit.description),
        deadline: hit.deadlineAt ? formatDeadlineDE(new Date(hit.deadlineAt * 1000)) : null,
        deadlineISO: hit.deadlineAt ? new Date(hit.deadlineAt * 1000).toISOString() : null,
        source: hit.source,
         sourceUrl: sanitizeTenderUrl(hit.sourceUrl) ?? "",
        slug: hit.slug ?? null,
        pdfCount: hit.pdfCount,
        readinessStatus: hit.readinessStatus,
        contractValueMax: hit.contractValueMax,
      };
    });

    return json({
      items,
      total: result.estimatedTotalHits,
      todayNewCount,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
