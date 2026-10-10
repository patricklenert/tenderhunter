import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, structuredData, tenders } from "@/lib/schema";
import { buildDocumentAnalysis, type AnalyzedDocument } from "@/lib/document-analysis";
import { buildTenderCheck } from "@/lib/tender-check";
import { extractPublicPortalFacts } from "@/lib/public-tender-scraper";
import { formatDeadlineDE } from "@/lib/date-utils";
import { normalizeStructured } from "@/lib/structurer";
import { readPublicTenderMeta } from "@/lib/tender-meta";
import { buildTenderCalendarIcs, calendarFilename } from "@/lib/tender-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseTenderId = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function GET(request: Request): Promise<Response> {
  const tenderId = parseTenderId(new URL(request.url).searchParams.get("tenderId"));
  if (tenderId === null) return Response.json({ error: "ungueltige tenderId" }, { status: 400 });

  const rows = await db
    .select()
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(eq(tenders.id, tenderId), eq(tenders.qualityStatus, "qualified")))
    .limit(1);
  const row = rows[0];
  if (!row) return Response.json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
  if (row.tenders.deadlineAt && row.tenders.deadlineAt.getTime() <= Date.now()) {
    return Response.json({ error: "Ausschreibung abgelaufen" }, { status: 410 });
  }

  const documentRows = await db
    .select({
      id: documents.id,
      url: documents.url,
      filename: documents.filename,
      contentType: documents.contentType,
      role: documents.role,
      roles: documents.roles,
      roleSource: documents.roleSource,
      roleConfidence: documents.roleConfidence,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));

  const tender = row.tenders;
  const documentAnalysis = buildDocumentAnalysis(documentRows as AnalyzedDocument[]);
  const metadata = typeof tender.metadataJson === "object" && tender.metadataJson !== null
    ? tender.metadataJson as Record<string, unknown>
    : {};
  const tenderMeta = readPublicTenderMeta(metadata, {
    title: tender.title,
    source: tender.source,
    sourceUrl: tender.url,
  });
  const portalFacts = extractPublicPortalFacts(tenderMeta.description);
  const fallbackFacts = {
    buyer: portalFacts.client || tenderMeta.client || null,
     procedure: portalFacts.procedure || tenderMeta.procedure || (tender.rawText?.trim() ? tender.procedureType : null) || null,
    deadline: portalFacts.deadline || (tender.deadlineAt ? formatDeadlineDE(tender.deadlineAt) : null),
    location: portalFacts.location || tenderMeta.location || null,
    summary: tenderMeta.description || null,
    scope: portalFacts.subject || tenderMeta.subject || null,
  };
   const structured = normalizeStructured(
     row.structured_data?.jsonBlob ?? metadata,
    tender.title ?? "",
    fallbackFacts,
  );
  const check = buildTenderCheck({
    tenderId,
    tenderDeadlineAt: tender.deadlineAt,
    structured,
    rawText: tender.rawText,
    documents: documentRows as AnalyzedDocument[],
    documentAnalysis,
  });
  const events = check.events.filter((event) => new Date(event.startsAt).getTime() >= Date.now());
  if (events.length === 0) return Response.json({ error: "Keine zukünftigen Termine erkannt" }, { status: 404 });

  const title = tender.title ?? `Ausschreibung ${tenderId}`;
  return new Response(buildTenderCalendarIcs({ tenderId, title, url: tender.url, events }), {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${calendarFilename(title)}-${tenderId}.ics"`,
    },
  });
}
