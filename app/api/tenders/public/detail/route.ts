import { db } from "@/lib/db";
import { tenders, structuredData } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { eq } from "drizzle-orm";
import { enqueueJob } from "@/lib/queue";
import { JOB_CACHE_DETAIL } from "@/lib/types";
import { cleanDescription } from "@/lib/public-tender-scraper";
import { formatDeadlineDE, sanitizeTenderUrl } from "@/lib/date-utils";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { tenderId?: number };
    const tenderId = body?.tenderId;

    if (!tenderId || typeof tenderId !== "number") {
      return json({ error: "tenderId ist erforderlich" }, { status: 400 });
    }

    // 1. Load tender from DB
    const rows = await db
      .select()
      .from(tenders)
      .where(eq(tenders.id, tenderId))
      .limit(1);

    if (rows.length === 0) {
      return json({ error: "Ausschreibung nicht gefunden", reason: "expired_or_removed" }, { status: 404 });
    }

    const tender = rows[0];

    // 2. Check cached structured data (TTL: 7 days)
    const cached = await db
      .select()
      .from(structuredData)
      .where(eq(structuredData.tenderId, tenderId))
      .limit(1);

    if (cached.length > 0) {
      const age = Date.now() - new Date(cached[0].updatedAt).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (age < sevenDays) {
        const blob = cached[0].jsonBlob as Record<string, unknown>;
        if (typeof blob.description === "string") {
          blob.description = cleanDescription(blob.description);
        }
        if (typeof blob.sourceUrl === "string") {
          blob.sourceUrl = sanitizeTenderUrl(blob.sourceUrl, blob.sourceUrl as string) ?? "";
        }
        return json({
          ...blob,
          cached: true,
          scrapedAt: cached[0].updatedAt,
        });
      }
    }

    // 3. No cache — return DB data INSTANTLY, queue LLM enrichment in background
    const meta = tender.metadataJson
      ? tender.metadataJson as Record<string, unknown>
      : {};

    const result = {
      title: tender.title ?? "",
      client: String(meta.client ?? "Unbekannt"),
      deadline: tender.deadlineAt ? formatDeadlineDE(tender.deadlineAt) : null,
      deadlineISO: tender.deadlineAt ? new Date(tender.deadlineAt).toISOString() : null,
      description: cleanDescription(String(meta.description ?? tender.rawText ?? "")),
      requirements: [] as string[],
      scope: "",
      contact: "",
      procedure: tender.procedureType ?? "",
      awardCriteria: [] as string[],
      duration: tender.contractDurationMonths ? `${tender.contractDurationMonths} Monate` : "",
      location: String(meta.location ?? ""),
      referenceNumber: meta.referenceNumber ? String(meta.referenceNumber) : null,
      pdfUrls: Array.isArray(meta.pdfUrls) ? meta.pdfUrls as string[] : [],
      estimatedValue: tender.contractValueMax ? `${tender.contractValueMax} EUR` : null,
      divisible: null,
      sourceUrl: sanitizeTenderUrl(tender.url, String(meta.sourceUrl ?? "")) ?? "",
      cached: false,
      enriching: true,
      scrapedAt: new Date().toISOString(),
    };

    // 4. Queue background enrichment (LLM extraction) — ALWAYS
    if (tender.url) {
      enqueueJob(JOB_CACHE_DETAIL, { tender_id: tenderId }).catch((e: unknown) =>
        console.error(`[tender-detail] Enqueue failed for ${tenderId}:`, e)
      );
    }

    return json(result);
  } catch (error) {
    console.error("[tender-detail] Fehler:", error);
    return errorResponse(error);
  }
}
