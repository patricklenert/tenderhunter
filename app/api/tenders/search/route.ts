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
import { projectPublicDisplayFields } from "@/lib/public-content-quality";
import { auth } from "@/lib/auth";
import { isSmallVendorTenderModeEnabled, SMALL_VENDOR_HIGHLIGHT_THRESHOLD, deriveCompactBadges } from "@/lib/small-vendor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
    const smallVendorMode = isSmallVendorTenderModeEnabled(session?.user ?? null);
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
    const sort: "deadline" | "newest" | "smallVendorFit" = url.searchParams.get("sort") === "newest" ? "newest" : url.searchParams.get("sort") === "smallVendorFit" && smallVendorMode ? "smallVendorFit" : "deadline";
    const smallVendorFitMinRaw = url.searchParams.get("smallVendorFitMin");
    let smallVendorFitMin: number | undefined;
    if (smallVendorMode && smallVendorFitMinRaw !== null) {
      if (["1", "true"].includes(smallVendorFitMinRaw)) {
        smallVendorFitMin = SMALL_VENDOR_HIGHLIGHT_THRESHOLD;
      } else {
        const parsed = Number.parseInt(smallVendorFitMinRaw, 10);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
          smallVendorFitMin = parsed;
        }
      }
    }
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
      ...(smallVendorFitMin !== undefined ? { smallVendorFitMin } : {}),
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
      const baseDisplay = projectPublicDisplayFields({
        title: hit.title,
        client: hit.client,
      });
      const title = baseDisplay.title || `Ausschreibung #${hit.id}`;
      const client = baseDisplay.client || "Unbekannt";
      const display = projectPublicDisplayFields({
        title,
        client,
        location: [hit.location, hit.city],
        summary: hit.description,
      });
      const city = projectPublicDisplayFields({
        title,
        client,
        location: hit.city,
      }).location;
      const compact = smallVendorMode
        ? {
            fit: hit.smallVendorFit ?? 0,
            priceWeightPct: hit.priceWeightPct,
            lowEntryBarrier: hit.lowEntryBarrier,
            remoteFriendly: hit.remoteFriendly,
            isItDomain: hit.isItDomain,
            isLot: hit.isLot,
          }
        : null;
      return {
        id: hit.id,
        title,
        client,
        location: display.location || "",
        bundesland: hit.bundesland,
        city,
        category: hit.category,
         description: display.description || "",
        deadline: hit.deadlineAt ? formatDeadlineDE(new Date(hit.deadlineAt * 1000)) : null,
        deadlineISO: hit.deadlineAt ? new Date(hit.deadlineAt * 1000).toISOString() : null,
        source: hit.source,
         sourceUrl: sanitizeTenderUrl(hit.sourceUrl) ?? "",
        slug: hit.slug ?? null,
        pdfCount: hit.pdfCount,
        readinessStatus: hit.readinessStatus,
        contractValueMax: hit.contractValueMax,
        ...(compact
          ? { smallVendor: { fit: compact.fit, priceWeightPct: compact.priceWeightPct, badges: deriveCompactBadges(compact) } }
          : {}),
      };
    });

    return json({
      items,
      total: result.estimatedTotalHits,
      todayNewCount,
      processingTimeMs: result.processingTimeMs,
      ...(smallVendorMode ? { smallVendorMode: true } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
