import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, jobs } from "@/lib/schema";
import { requireApiKey } from "@/lib/api-auth";
import { enqueueJob } from "@/lib/queue";
import {
  JOB_CACHE_DETAIL,
  JOB_FETCH_DOCUMENTS,
  JOB_PARSE,
  JOB_SCORE,
  JOB_SCRAPE_PUBLIC,
  JOB_STRUCTURE,
  type JobType,
} from "@/lib/types";

export const runtime = "nodejs";

const TENDER_STAGES: Record<string, JobType> = {
  fetch_documents: JOB_FETCH_DOCUMENTS,
  parse_documents: JOB_PARSE,
  structure_tender: JOB_STRUCTURE,
  score_tender: JOB_SCORE,
  cache_detail: JOB_CACHE_DETAIL,
};

export async function POST(request: Request): Promise<Response> {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json() as {
      jobId?: number;
      tenderId?: number;
      documentId?: number;
      source?: string;
      stage?: string;
    };

    const scopes = [body.jobId, body.tenderId, body.documentId, body.source].filter((value) => value !== undefined);
    if (scopes.length !== 1) {
      return Response.json({ error: "Genau einen Reprocess-Scope angeben: jobId, tenderId, documentId oder source." }, { status: 400 });
    }

    if (body.jobId !== undefined) {
      const job = await db.select({ id: jobs.id, status: jobs.status }).from(jobs).where(eq(jobs.id, body.jobId)).limit(1);
      if (job.length === 0) return Response.json({ error: "Job nicht gefunden." }, { status: 404 });
      await db.update(jobs).set({
        status: "pending",
        retries: 0,
        runAfter: new Date(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        heartbeatAt: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: new Date(),
      }).where(eq(jobs.id, body.jobId));
      return Response.json({ requeued: true, jobId: body.jobId });
    }

    if (body.tenderId !== undefined) {
      const type = TENDER_STAGES[body.stage ?? "fetch_documents"];
      if (!type) return Response.json({ error: "Unbekannte Tender-Stufe." }, { status: 400 });
      const jobId = await enqueueJob(type, { tender_id: body.tenderId }, { jobKey: `reprocess:${type}:${body.tenderId}:${Date.now()}` });
      return Response.json({ requeued: true, jobId, tenderId: body.tenderId, stage: type });
    }

    if (body.documentId !== undefined) {
      const document = await db.select({ tenderId: documents.tenderId }).from(documents).where(eq(documents.id, body.documentId)).limit(1);
      if (document.length === 0) return Response.json({ error: "Dokument nicht gefunden." }, { status: 404 });
      const jobId = await enqueueJob(JOB_PARSE, { tender_id: document[0].tenderId }, { jobKey: `reprocess:${JOB_PARSE}:document:${body.documentId}:${Date.now()}` });
      return Response.json({ requeued: true, jobId, documentId: body.documentId, tenderId: document[0].tenderId });
    }

    const jobId = await enqueueJob(JOB_SCRAPE_PUBLIC, { source: body.source ?? "" }, { jobKey: `reprocess:${JOB_SCRAPE_PUBLIC}:${body.source}:${Date.now()}`, priority: 130 });
    return Response.json({ requeued: true, jobId, source: body.source });
  } catch (error) {
    console.error("[jobs/reprocess] Fehler:", error);
    return Response.json({ error: "Reprocess konnte nicht eingereiht werden." }, { status: 500 });
  }
}
