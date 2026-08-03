import { json, errorResponse } from "@/lib/http";
import { searchTenders } from "@/lib/meilisearch";
import { formatDeadlineDE, getGermanLastThreeDaysUnixRange } from "@/lib/date-utils";

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
    const lastThreeDaysRange = getGermanLastThreeDaysUnixRange();
    const baseSearchParams = {
      query,
      bundesland: bundesland || null,
      city: city || null,
      limit,
      page,
    };

    const result = await searchTenders({
      ...baseSearchParams,
      ...(todayNew
        ? { firstSeenAtFrom: lastThreeDaysRange.from, firstSeenAtTo: lastThreeDaysRange.to }
        : {}),
    });
    const todayNewCount = todayNew
      ? result.estimatedTotalHits
      : (await searchTenders({
          ...baseSearchParams,
          firstSeenAtFrom: lastThreeDaysRange.from,
          firstSeenAtTo: lastThreeDaysRange.to,
          limit: 1,
          page: 1,
        })).estimatedTotalHits;

    const items = result.hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      client: hit.client,
      location: hit.location,
      bundesland: hit.bundesland,
      city: hit.city,
      category: hit.category,
      description: hit.description,
      deadline: hit.deadlineAt ? formatDeadlineDE(new Date(hit.deadlineAt * 1000)) : null,
      deadlineISO: hit.deadlineAt ? new Date(hit.deadlineAt * 1000).toISOString() : null,
      source: hit.source,
      sourceUrl: hit.sourceUrl,
      slug: hit.slug ?? null,
      pdfCount: hit.pdfCount,
      readinessStatus: hit.readinessStatus,
      contractValueMax: hit.contractValueMax,
    }));

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
