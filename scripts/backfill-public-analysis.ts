import "dotenv/config";
import { asc, eq, gt } from "drizzle-orm";
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

const args = new Set(process.argv.slice(2));
const readNumberArgument = (prefix: string): number | null => {
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? Number(value.slice(prefix.length)) : null;
};

const dryRun = args.has("--dry-run");
const targetId = readNumberArgument("--id=");
const limit = readNumberArgument("--limit=");
const batchSize = readNumberArgument("--batch-size=") ?? 100;
const afterId = readNumberArgument("--after-id=") ?? 0;

const stableJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableJson(nested)]),
    );
  }
  return value;
};

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(stableJson(left)) === JSON.stringify(stableJson(right));

const logChange = (id: number, message: string): void => {
  console.log(`[backfill-public-analysis] ${dryRun ? "DRY-RUN " : ""}#${id} ${message}`);
};

async function main(): Promise<void> {
  if (targetId !== null && (!Number.isSafeInteger(targetId) || targetId <= 0)) {
    throw new Error("--id muss eine positive Ganzzahl sein");
  }
  if (limit !== null && (!Number.isSafeInteger(limit) || limit <= 0 || limit > 10_000)) {
    throw new Error("--limit muss zwischen 1 und 10000 liegen");
  }
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0 || batchSize > 1_000) {
    throw new Error("--batch-size muss zwischen 1 und 1000 liegen");
  }
  if (!Number.isSafeInteger(afterId) || afterId < 0) {
    throw new Error("--after-id muss eine nichtnegative Ganzzahl sein");
  }

  let categoryUpdates = 0;
  let briefUpdates = 0;
  let scanned = 0;
  let skipped = 0;
  let failed = 0;
  let cursor = afterId;
  let remaining = targetId !== null ? 1 : (limit ?? batchSize);

  const selectRows = () => db
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

  while (remaining > 0) {
    const pageSize = Math.min(batchSize, remaining);
    const rows = targetId !== null
      ? await selectRows().where(eq(tenders.id, targetId)).limit(1)
      : cursor > 0
        ? await selectRows().where(gt(tenders.id, cursor)).orderBy(asc(tenders.id)).limit(pageSize)
        : await selectRows().orderBy(asc(tenders.id)).limit(pageSize);
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      try {
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
          if (!dryRun) {
            await db.update(tenders)
              .set({ category: nextCategory, updatedAt: new Date() })
              .where(eq(tenders.id, row.id));
          }
          categoryUpdates += 1;
          logChange(row.id, `category ${row.category ?? "null"} -> ${nextCategory}`);
        }

        if (!row.structuredJson || !structured.decision_relevant || !structured.commercialBrief) {
          skipped += 1;
          continue;
        }
        const brief = asRecord(structured.commercialBrief);
        const rationale = typeof brief.rationale === "string" ? brief.rationale.trim() : "";
        const facts = extractPublicPortalFacts(rawText);
        const accessLimited = isAccessLimited(rawText);
        const shouldRepairRationale = accessLimited
          || (rationale.length >= 280 && !/[.!?)]$/.test(rationale));
        if (!shouldRepairRationale) {
          skipped += 1;
          continue;
        }

        const normalized = normalizeStructured(structured, row.title ?? "", {
          buyer: facts.client || (typeof metadata.client === "string" ? metadata.client : null),
          procedure: facts.procedure || (typeof metadata.procedure === "string" ? metadata.procedure : null) || row.procedureType,
          deadline: facts.deadline || (row.deadlineAt ? row.deadlineAt.toISOString() : null),
          location: facts.location || (typeof metadata.location === "string" ? metadata.location : null),
          scope: facts.subject || (typeof metadata.subject === "string" ? metadata.subject : null),
        });
        const repairedRationale = accessLimited && normalized.commercialBrief
          ? buildPublicAccessLimitedDescription(normalized.title, facts)
          : null;
        const nextStructured = repairedRationale && normalized.commercialBrief
          ? {
              ...normalized,
              commercialBrief: {
                ...normalized.commercialBrief,
                rationale: repairedRationale,
              },
            }
          : normalized;

        if (sameJson(nextStructured, structured)) {
          skipped += 1;
          continue;
        }
        if (!dryRun) {
          await db.update(structuredData)
            .set({ jsonBlob: nextStructured, updatedAt: new Date() })
            .where(eq(structuredData.tenderId, row.id));
        }
        briefUpdates += 1;
        logChange(row.id, "commercialBrief/structured_data wird aktualisiert");
      } catch (error) {
        failed += 1;
        console.error(`[backfill-public-analysis] #${row.id} fehlgeschlagen:`, error);
      }
    }

    cursor = rows[rows.length - 1].id;
    remaining -= rows.length;
    if (targetId !== null) break;
  }

  let syncQueued = false;
  if (categoryUpdates > 0 || briefUpdates > 0) {
    if (!dryRun) {
      await markCatalogDirty();
      await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
      syncQueued = true;
    }
  }

  console.log(JSON.stringify({
    dryRun,
    afterId,
    lastId: cursor,
    scanned,
    categoryUpdates,
    briefUpdates,
    skipped,
    failed,
    syncQueued,
  }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
