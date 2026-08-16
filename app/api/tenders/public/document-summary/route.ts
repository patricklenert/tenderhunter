import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, tenders } from "@/lib/schema";
import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, RateLimitError } from "@/lib/rate-limit";
import { generateDocumentSummary } from "@/lib/document-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handleError = (error: unknown): Response => {
  if (error instanceof RateLimitError) {
    return json(
      { error: error.message, code: error.code },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
    );
  }
  return errorResponse(error);
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody<{ documentId?: unknown }>(request);
    const documentId = typeof body.documentId === "number" ? body.documentId : Number(body.documentId);
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
      return json({ error: "documentId ist erforderlich", code: "DOCUMENT_ID_REQUIRED" }, { status: 422 });
    }

    const rows = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        role: documents.role,
        downloadStatus: documents.downloadStatus,
        parseStatus: documents.parseStatus,
        extractedText: documents.extractedText,
        aiSummary: documents.aiSummary,
      })
      .from(documents)
      .innerJoin(tenders, eq(tenders.id, documents.tenderId))
      .where(and(eq(documents.id, documentId), eq(tenders.qualityStatus, "qualified")))
      .limit(1);

    const document = rows[0];
    if (!document) {
      return json({ error: "Dokument nicht gefunden", code: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    if (document.aiSummary) {
      return json({ documentId, summary: document.aiSummary, cached: true });
    }

    if (document.downloadStatus !== "downloaded" || document.parseStatus !== "parsed" || !document.extractedText?.trim()) {
      return json(
        { error: "Dieses Dokument wurde noch nicht erfolgreich analysiert.", code: "DOCUMENT_NOT_READY" },
        { status: 409 },
      );
    }

    await consumeRateLimit(`document-summary-ip:${clientIp(request)}`, 20, 60 * 60 * 1000);
    let summary: string;
    try {
      summary = await generateDocumentSummary({
        filename: document.filename,
        role: document.role,
        extractedText: document.extractedText,
      });
    } catch (error) {
      console.error("[document-summary] LLM nicht verfuegbar:", error);
      return json(
        { error: "Die Zusammenfassung ist momentan nicht verfuegbar. Bitte spaeter erneut versuchen.", code: "SUMMARY_UNAVAILABLE" },
        { status: 503 },
      );
    }

    await db
      .update(documents)
      .set({ aiSummary: summary, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    return json({ documentId, summary, cached: false });
  } catch (error) {
    console.error("[document-summary] Fehler:", error);
    return handleError(error);
  }
}
