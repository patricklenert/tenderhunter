import { db } from "../lib/db";
import { documents, insights, scores, structuredData, tenders } from "../lib/schema";
import { buildDocumentAnalysis, type AnalyzedDocument } from "../lib/document-analysis";
import { evaluateTenderReadiness } from "../lib/tender-readiness";
import { eq } from "drizzle-orm";
import { markCatalogDirty } from "../lib/catalog";
import { buildTenderPipelineGroupKey, enqueueJob } from "../lib/queue";
import { JOB_SCORE, JOB_SYNC_MEILI } from "../lib/types";

const apply = process.argv.includes("--apply");

const run = async () => {
  const tenderRows = await db
    .select({
      id: tenders.id,
      version: tenders.version,
      qualityStatus: tenders.qualityStatus,
      rawText: tenders.rawText,
      structuredConfidence: structuredData.confidence,
      structuredExists: structuredData.tenderId,
    })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id));
  const documentRows = await db
    .select({
      id: documents.id,
      tenderId: documents.tenderId,
      role: documents.role,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
      roleConfidence: documents.roleConfidence,
    })
    .from(documents);
  const docsByTender = new Map<number, AnalyzedDocument[]>();
  for (const document of documentRows) {
    const list = docsByTender.get(document.tenderId) ?? [];
    list.push(document);
    docsByTender.set(document.tenderId, list);
  }

  const counts = new Map<string, number>();
  for (const tender of tenderRows) {
    const analysis = buildDocumentAnalysis(docsByTender.get(tender.id) ?? []);
    const readiness = evaluateTenderReadiness({
      qualityStatus: tender.qualityStatus,
      rawText: tender.rawText,
      structuredExists: tender.structuredExists !== null,
      structuredConfidence: tender.structuredConfidence,
      documentAnalysis: analysis,
    });
    counts.set(readiness.status, (counts.get(readiness.status) ?? 0) + 1);
    if (!apply) continue;
    await db.update(tenders).set({
      readinessStatus: readiness.status,
      readinessReason: readiness.reason,
      readinessUpdatedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tenders.id, tender.id));
    if (readiness.status !== "ready") {
      await db.delete(scores).where(eq(scores.tenderId, tender.id));
      await db.delete(insights).where(eq(insights.tenderId, tender.id));
    } else if (tender.qualityStatus === "qualified" && tender.structuredExists !== null) {
      await enqueueJob(
        JOB_SCORE,
        { tender_id: tender.id, pipeline_version: tender.version },
        {
          jobKey: `${JOB_SCORE}:${tender.id}`,
          groupKey: buildTenderPipelineGroupKey(tender.id),
          dedupeCompleted: false,
        },
      );
    }
  }

  if (apply) {
    await markCatalogDirty();
    await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
  }

  console.log(`${apply ? "Angewendet" : "Dry-run"}: ${tenderRows.length} Tender`);
  console.log(Object.fromEntries(counts));
  if (!apply) console.log("Mit --apply schreiben und abgeleitete Scores für nicht bereite Tender entfernen.");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
