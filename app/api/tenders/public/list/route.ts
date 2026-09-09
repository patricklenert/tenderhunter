import { db } from "@/lib/db";
import { structuredData, tenders } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { desc, and, eq, or, like, gt, isNull, inArray } from "drizzle-orm";
import { readPublicTenderMeta } from "@/lib/tender-meta";
import { pickPublicDescription } from "@/lib/public-tender-scraper";
import { normalizeStructured } from "@/lib/structurer";
import { pickValidatedPublicLocationForTender, pickValidatedPublicCandidate } from "@/lib/public-content-quality";
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
         rawText: tenders.rawText,
         structuredJson: structuredData.jsonBlob,
        contractValueMin: tenders.contractValueMin,
        contractValueMax: tenders.contractValueMax,
        contractDurationMonths: tenders.contractDurationMonths,
         procedureType: tenders.procedureType,
         readinessStatus: tenders.readinessStatus,
         readinessReason: tenders.readinessReason,
         createdAt: tenders.createdAt,
      })
       .from(tenders)
       .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(where)
      .orderBy(desc(tenders.createdAt))
      .limit(limit);

    const mapped = items
      .map((item) => {
         const meta = readPublicTenderMeta(item.metadataJson, {
          title: item.title,
          source: item.source,
          sourceUrl: item.url,
          rawText: item.rawText,
        });
        const fallbackFacts = {
          buyer: meta.client,
          procedure: meta.procedure || item.procedureType,
          location: meta.location,
          summary: meta.description,
          scope: meta.subject,
          deadline: item.deadlineAt ? formatDeadlineDE(item.deadlineAt) : null,
        };
        const structured = normalizeStructured(item.structuredJson ?? item.metadataJson, item.title ?? "", fallbackFacts);
        const title = pickValidatedPublicCandidate(structured.title, item.title) || `Ausschreibung #${item.id}`;
        const client = structured.hard_facts.buyer || "Unbekannt";
         const description = pickPublicDescription(
           structured.summary,
           meta.description,
         );

        return {
          id: item.id,
          title,
          client,
          location: pickValidatedPublicLocationForTender(title, client, structured.hard_facts.location, meta.location),
          deadline: item.deadlineAt ? formatDeadlineDE(item.deadlineAt) : null,
          deadlineISO: item.deadlineAt ? new Date(item.deadlineAt).toISOString() : null,
          category: item.category ?? "Sonstiges",
          description,
          referenceNumber: meta.referenceNumber,
          source: item.source,
          sourceUrl: sanitizeTenderUrl(item.url) ?? "",
          contractValueMin: item.contractValueMin,
          contractValueMax: item.contractValueMax,
          contractDurationMonths: item.contractDurationMonths,
           procedureType: structured.procurement.procedure_type || item.procedureType,
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
