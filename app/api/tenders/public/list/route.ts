import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { desc, and, eq, or, like, gt, isNull, inArray } from "drizzle-orm";
import { cleanPublicDescription } from "@/lib/public-tender-scraper";
import { formatDeadlineDE, sanitizeTenderUrl } from "@/lib/date-utils";

export const runtime = "nodejs";

const parseParam = (url: URL, name: string, fallback: string): string =>
  url.searchParams.get(name) ?? fallback;

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(Number.parseInt(url.searchParams.get("limit") ?? "24", 10) || 24, 30));
    const category = parseParam(url, "category", "");
    const location = parseParam(url, "location", "");
    const search = parseParam(url, "search", "");

    const conditions = [];
    const minContractValue = url.searchParams.get("minContractValue");

    conditions.push(inArray(tenders.qualityStatus, ["qualified"]));
    conditions.push(or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, new Date())));

    if (category && category !== "Alle Kategorien") {
      conditions.push(eq(tenders.category, category));
    }

    if (location && location !== "Alle Standorte") {
      conditions.push(like(tenders.metadataJson, `%${location}%`));
    }

    if (search) {
      conditions.push(
        or(
          like(tenders.title, `%${search}%`),
          like(tenders.metadataJson, `%${search}%`)
        )
      );
    }

    if (minContractValue) {
      const minValue = Number.parseFloat(minContractValue);
      if (Number.isFinite(minValue) && minValue > 0) {
        conditions.push(gt(tenders.contractValueMax, minValue));
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        source: tenders.source,
        url: tenders.url,
        deadlineAt: tenders.deadlineAt,
        category: tenders.category,
        metadataJson: tenders.metadataJson,
        contractValueMin: tenders.contractValueMin,
        contractValueMax: tenders.contractValueMax,
        contractDurationMonths: tenders.contractDurationMonths,
         procedureType: tenders.procedureType,
         readinessStatus: tenders.readinessStatus,
         readinessReason: tenders.readinessReason,
         createdAt: tenders.createdAt,
      })
      .from(tenders)
      .where(where)
      .orderBy(desc(tenders.createdAt))
      .limit(limit);

    const mapped = items
      .map((item) => {
        const meta = (typeof item.metadataJson === "object" && item.metadataJson !== null
          ? item.metadataJson
          : {}) as Record<string, unknown>;

        return {
          id: item.id,
          title: item.title ?? `Ausschreibung #${item.id}`,
          client: String(meta.client ?? "Unbekannt"),
          location: String(meta.location ?? ""),
          deadline: item.deadlineAt ? formatDeadlineDE(item.deadlineAt) : null,
          deadlineISO: item.deadlineAt ? new Date(item.deadlineAt).toISOString() : null,
          category: item.category ?? "Sonstiges",
          description: cleanPublicDescription(String(meta.description ?? "")),
          referenceNumber: meta.reference_number ? String(meta.reference_number) : null,
          source: item.source,
          sourceUrl: sanitizeTenderUrl(item.url) ?? "",
          contractValueMin: item.contractValueMin,
          contractValueMax: item.contractValueMax,
          contractDurationMonths: item.contractDurationMonths,
           procedureType: item.procedureType,
           readinessStatus: item.readinessStatus,
           readinessReason: item.readinessReason,
           createdAt: item.createdAt,
        };
      })
      .filter((item) => {
        if (item.category === "Sonstiges") {
          return item.deadline || (item.client && item.client !== "Unbekannt");
        }
        return true;
      });

    return json({ items: mapped, total: mapped.length });
  } catch (error) {
    return errorResponse(error);
  }
}
