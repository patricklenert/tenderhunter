import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { markCatalogDirty } from "../lib/catalog";
import { structuredData, tenders } from "../lib/schema";
import {
  buildPublicAccessLimitedDescription,
  derivePublicTenderCategory,
  extractPublicCpvCodes,
  extractPublicPortalFacts,
} from "../lib/public-tender-scraper";
import { normalizeStructured } from "../lib/structurer";
import { enqueueJob } from "../lib/queue";
import { JOB_SYNC_MEILI } from "../lib/types";

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const asStrings = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
);

const isAccessLimited = (value: string): boolean =>
  /vollständige Leistungsbeschreibung[\s\S]{0,180}nach Teilnahme/i.test(value);

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: tenders.id,
      title: tenders.title,
      category: tenders.category,
      rawText: tenders.rawText,
      metadataJson: tenders.metadataJson,
      deadlineAt: tenders.deadlineAt,
      procedureType: tenders.procedureType,
      structuredJson: structuredData.jsonBlob,
    })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id));

  let categoryUpdates = 0;
  let briefUpdates = 0;

  for (const row of rows) {
    const metadata = asRecord(row.metadataJson);
    const structured = asRecord(row.structuredJson);
    const procurement = asRecord(structured.procurement);
    const rawText = [row.rawText, metadata.description, structured.summary]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n");
    const categoryContext = [row.title]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    const cpvCodes = [
      ...asStrings(metadata.cpvCodes),
      ...asStrings(metadata.cpv_codes),
      ...asStrings(procurement.cpv_codes),
      ...extractPublicCpvCodes(rawText),
    ];
    const nextCategory = derivePublicTenderCategory(
      row.category,
      cpvCodes,
      categoryContext,
    );

    if (nextCategory !== row.category && (nextCategory === "IT-Dienstleistungen" || row.category === "IT-Dienstleistungen")) {
      await db.update(tenders)
        .set({ category: nextCategory, updatedAt: new Date() })
        .where(eq(tenders.id, row.id));
      categoryUpdates += 1;
    }

    if (!row.structuredJson || !structured.decision_relevant || !structured.commercialBrief) continue;
    const brief = asRecord(structured.commercialBrief);
    const rationale = typeof brief.rationale === "string" ? brief.rationale.trim() : "";
    const facts = extractPublicPortalFacts(rawText);
    const accessLimited = isAccessLimited(rawText);
    const shouldRepairRationale = accessLimited
      || (rationale.length >= 280 && !/[.!?)]$/.test(rationale));
    if (!shouldRepairRationale) continue;

    const normalized = normalizeStructured(structured, row.title ?? "", {
      buyer: facts.client || (typeof metadata.client === "string" ? metadata.client : null),
      procedure: facts.procedure || (typeof metadata.procedure === "string" ? metadata.procedure : null) || row.procedureType,
      deadline: facts.deadline || (row.deadlineAt ? row.deadlineAt.toISOString() : null),
      location: facts.location || (typeof metadata.location === "string" ? metadata.location : null),
      scope: facts.subject || (typeof metadata.subject === "string" ? metadata.subject : null),
    });
    if (accessLimited && normalized.commercialBrief) {
      const repairedRationale = buildPublicAccessLimitedDescription(normalized.title, facts);
      if (repairedRationale === rationale) continue;
      normalized.commercialBrief.rationale = repairedRationale;
    }

    await db.update(structuredData)
      .set({ jsonBlob: normalized, updatedAt: new Date() })
      .where(eq(structuredData.tenderId, row.id));
    briefUpdates += 1;
  }

  if (categoryUpdates > 0 || briefUpdates > 0) {
    await markCatalogDirty();
    await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
  }

  console.log(JSON.stringify({ categoryUpdates, briefUpdates }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
