import { db } from "@/lib/db";
import { documents, tenders, structuredData } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { eq } from "drizzle-orm";
import { enqueueJob } from "@/lib/queue";
import { JOB_CACHE_DETAIL } from "@/lib/types";
import { pickPublicDescription } from "@/lib/public-tender-scraper";
import { readTenderMeta } from "@/lib/tender-meta";
import { formatDeadlineDE, sanitizeTenderUrl } from "@/lib/date-utils";
import { detectAccessPage } from "@/lib/access-page-detector";
import { auth } from "@/lib/auth";
import { hasPremiumAccess } from "@/lib/entitlements";
import { buildDocumentAnalysis, type AnalyzedDocument } from "@/lib/document-analysis";
import { normalizeStructured } from "@/lib/structurer";

export const runtime = "nodejs";

const isActiveTender = (deadlineAt: Date | null): boolean =>
  !deadlineAt || deadlineAt.getTime() > Date.now();

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
      return json({ error: "Ausschreibung nicht gefunden", reason: "stale_index" }, { status: 404 });
    }

    const tender = rows[0];
    const session = await auth.api.getSession({ headers: request.headers });
    const hasDocumentsAccess = session?.user?.id ? await hasPremiumAccess(session.user.id) : false;
    const documentRows = await db
      .select({
        id: documents.id,
        role: documents.role,
        parseStatus: documents.parseStatus,
        downloadStatus: documents.downloadStatus,
        errorMessage: documents.errorMessage,
        extractedText: documents.extractedText,
        pageCount: documents.pageCount,
        roleConfidence: documents.roleConfidence,
      })
      .from(documents)
      .where(eq(documents.tenderId, tenderId));
    const documentAnalysis = buildDocumentAnalysis(documentRows as AnalyzedDocument[]);

    if (tender.deadlineAt && !isActiveTender(tender.deadlineAt)) {
      return json({ error: "Ausschreibung abgelaufen", reason: "expired" }, { status: 410 });
    }

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
        const accessPage = detectAccessPage(JSON.stringify(blob), { title: tender.title ?? undefined, url: tender.url });
        if (accessPage.blocked) {
          await db.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
        } else {
          const publicDescription = pickPublicDescription(blob.description, blob.summary);
          if (publicDescription) blob.description = publicDescription;
          else delete blob.description;
          const publicSummary = pickPublicDescription(blob.summary);
          if (publicSummary) blob.summary = publicSummary;
          else delete blob.summary;
          const normalized = normalizeStructured(blob, tender.title ?? "");
          blob.requirements = normalized.decision_relevant.requirements;
          blob.scope = normalized.decision_relevant.scope.join(" ");
          blob.awardCriteria = normalized.decision_relevant.award_criteria;
          if (!hasDocumentsAccess) delete blob.pdfUrls;
          if (typeof blob.sourceUrl === "string") {
            blob.sourceUrl = sanitizeTenderUrl(blob.sourceUrl, blob.sourceUrl as string) ?? "";
          }
           return json({
             ...blob,
             readinessStatus: tender.readinessStatus,
             readinessReason: tender.readinessReason,
             documentAnalysis,
             cached: true,
            documentsLocked: !hasDocumentsAccess,
            scrapedAt: cached[0].updatedAt,
          });
        }
      }
    }

    // 3. No cache — return DB data INSTANTLY, queue LLM enrichment in background
    const meta = tender.metadataJson
      ? tender.metadataJson as Record<string, unknown>
      : {};
    const tenderMeta = readTenderMeta(tender.metadataJson, tender.rawText);
    const accessPage = detectAccessPage(
      `${String(meta.description ?? "")} ${tender.rawText ?? ""}`,
      { title: tender.title ?? undefined, url: tender.url },
    );
    if (accessPage.blocked) {
      console.warn(`[tender-detail] Quelle vorübergehend blockiert für ${tenderId} (${accessPage.reason}), starte Reprocessing`);
    }

    const result = {
      title: tender.title ?? "",
      client: tenderMeta.client || "Unbekannt",
      deadline: tender.deadlineAt ? formatDeadlineDE(tender.deadlineAt) : null,
      deadlineISO: tender.deadlineAt ? new Date(tender.deadlineAt).toISOString() : null,
      description: tenderMeta.description,
      requirements: [] as string[],
      scope: "",
      contact: "",
      procedure: tender.procedureType ?? "",
      awardCriteria: [] as string[],
      duration: tender.contractDurationMonths ? `${tender.contractDurationMonths} Monate` : "",
      location: tenderMeta.location,
      referenceNumber: tenderMeta.referenceNumber,
      pdfUrls: tenderMeta.pdfUrls,
      estimatedValue: tender.contractValueMax ? `${tender.contractValueMax} EUR` : null,
      divisible: null,
      sourceUrl: sanitizeTenderUrl(tender.url, tenderMeta.sourceUrl) ?? "",
      cached: false,
      enriching: true,
      documentsLocked: !hasDocumentsAccess,
      readinessStatus: tender.readinessStatus,
      readinessReason: tender.readinessReason,
      documentAnalysis,
      scrapedAt: new Date().toISOString(),
    };
    const responsePayload = hasDocumentsAccess
      ? result
      : (({ pdfUrls: _pdfUrls, ...resultWithoutDocuments }) => resultWithoutDocuments)(result);

    // 4. Queue background enrichment (LLM extraction) — ALWAYS
    if (tender.url) {
      enqueueJob(JOB_CACHE_DETAIL, { tender_id: tenderId }, { jobKey: `${JOB_CACHE_DETAIL}:${tenderId}` }).catch((e: unknown) =>
        console.error(`[tender-detail] Enqueue failed for ${tenderId}:`, e)
      );
    }

    return json(responsePayload);
  } catch (error) {
    console.error("[tender-detail] Fehler:", error);
    return errorResponse(error);
  }
}
