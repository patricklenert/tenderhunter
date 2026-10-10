import "dotenv/config";
import postgres from "postgres";
import {
  buildPublicAccessLimitedDescription,
  extractPublicPortalFacts,
  isPublicNavigationSummary,
  isRawPortalDescription,
  pickPublicDescription,
} from "../lib/public-tender-scraper";
import { hasPositivePublicAccessEvidence } from "../lib/public-description-backfill";
import { markCatalogDirty } from "../lib/catalog";
import { enqueueJob } from "../lib/queue";
import { JOB_SYNC_MEILI } from "../lib/types";

const sql = postgres(process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const readNumberArgument = (prefix: string): number | null => {
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? Number(value.slice(prefix.length)) : null;
};
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
  console.log(`[backfill-public-access-summaries] ${dryRun ? "DRY-RUN " : ""}#${id} ${message}`);
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

  let changed = 0;
  let scanned = 0;
  let skipped = 0;
  let failed = 0;
  let cursor = afterId;
  let remaining = targetId !== null ? 1 : (limit ?? batchSize);

  while (remaining > 0) {
    const pageSize = Math.min(batchSize, remaining);
    const rows = await sql<{
      id: number;
      title: string;
      metadata_json: Record<string, unknown> | string | null;
      raw_text: string | null;
    }[]>`
      SELECT id, title, metadata_json, raw_text
      FROM tenders
      WHERE quality_status <> 'duplicate'
        AND ${targetId !== null ? sql`id = ${targetId}` : sql`id > ${cursor}`}
      ORDER BY id ASC
      LIMIT ${pageSize}
    `;
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      try {
        const metadataWasString = typeof row.metadata_json === "string";
        let metadata: Record<string, unknown>;
        if (metadataWasString) {
          const parsed = JSON.parse(row.metadata_json as string) as unknown;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("metadata_json ist kein JSON-Objekt");
          }
          metadata = parsed as Record<string, unknown>;
        } else {
          metadata = row.metadata_json && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
            ? row.metadata_json
            : {};
        }
        const rawDescription = metadata.access_limited === true && row.raw_text && row.raw_text.length > 100
          ? row.raw_text
          : [metadata.description, row.raw_text]
            .filter((value): value is string => typeof value === "string" && value.length > 0)
            .join(" ");
        const isAccessLimited = hasPositivePublicAccessEvidence(
          metadata.access_limited === true || metadata.accessLimited === true,
          rawDescription,
        );
        const storedDescription = typeof metadata.description === "string" ? metadata.description : "";
        const isNavigationSummary = isPublicNavigationSummary(storedDescription)
          || isRawPortalDescription(storedDescription);
        const needsSummaryRepair = isAccessLimited || isNavigationSummary;
        if (!needsSummaryRepair && !metadataWasString) {
          skipped += 1;
          continue;
        }

        const nextMetadata = { ...metadata };
        if (isAccessLimited) {
          const facts = extractPublicPortalFacts(rawDescription);
          nextMetadata.description = buildPublicAccessLimitedDescription(row.title, facts);
          if (facts.client) nextMetadata.client = facts.client;
          if (facts.procedure) nextMetadata.procedure = facts.procedure;
          if (facts.location) nextMetadata.location = facts.location;
          if (facts.subject) nextMetadata.subject = facts.subject;
          nextMetadata.access_limited = true;
          nextMetadata.description_source = "portal_summary";
        } else if (isNavigationSummary) {
          const fallback = pickPublicDescription(metadata.summary);
          if (fallback) nextMetadata.description = fallback;
          else delete nextMetadata.description;
          if (nextMetadata.description_source === "portal_summary") delete nextMetadata.description_source;
        }
        if (!metadataWasString && sameJson(metadata, nextMetadata)) {
          skipped += 1;
          continue;
        }

        if (!dryRun) {
          await sql`
            UPDATE tenders
            SET metadata_json = ${sql.json(nextMetadata as never)},
                updated_at = NOW()
            WHERE id = ${row.id}
          `;
        }
        changed += 1;
        logChange(row.id, "metadata_json wird aktualisiert");
      } catch (error) {
        failed += 1;
        console.error(`[backfill-public-access-summaries] #${row.id} fehlgeschlagen:`, error);
      }
    }

    cursor = rows[rows.length - 1].id;
    remaining -= rows.length;
    if (targetId !== null) break;
  }

  let syncQueued = false;
  if (changed > 0 && !dryRun) {
    await markCatalogDirty();
    await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
    syncQueued = true;
  }

  console.log(JSON.stringify({ dryRun, afterId, lastId: cursor, scanned, changed, skipped, failed, syncQueued }));
  await sql.end();
  if (failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exitCode = 1;
});
