import "dotenv/config";
import postgres from "postgres";
import { markCatalogDirty } from "../lib/catalog";
import { parseDeadlineDate } from "../lib/date-utils";
import { syncTendersToMeili } from "../lib/meilisearch";
import { extractPublicPortalFacts } from "../lib/public-tender-scraper";
import { resolvePublicDeadlineRepair } from "../lib/public-deadline-backfill";
import { readPublicTenderMeta } from "../lib/tender-meta";

const connectionString = process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";

interface TenderDeadlineRow {
  id: number;
  title: string | null;
  source: string;
  url: string;
  metadata_json: unknown;
  deadline_at: Date | string | null;
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const limitArgument = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArgument ? Number(limitArgument.slice("--limit=".length)) : null;
const batchArgument = process.argv.find((arg) => arg.startsWith("--batch-size="));
const batchSize = batchArgument ? Number(batchArgument.slice("--batch-size=".length)) : 100;
const afterArgument = process.argv.find((arg) => arg.startsWith("--after-id="));
const afterId = afterArgument ? Number(afterArgument.slice("--after-id=".length)) : 0;
const syncMeili = args.has("--sync-meili");

async function main(): Promise<void> {
  if (limit !== null && (!Number.isInteger(limit) || limit <= 0 || limit > 10_000)) {
    throw new Error("--limit muss zwischen 1 und 10000 liegen");
  }
  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 1_000) {
    throw new Error("--batch-size muss zwischen 1 und 1000 liegen");
  }
  if (!Number.isInteger(afterId) || afterId < 0) {
    throw new Error("--after-id muss eine nichtnegative Ganzzahl sein");
  }

  const client = postgres(connectionString, { max: 1 });
  try {
    const maximumRows = limit ?? batchSize;
    const rows: TenderDeadlineRow[] = [];
    let cursor = afterId;
    while (rows.length < maximumRows) {
      const pageSize = Math.min(batchSize, maximumRows - rows.length);
      const page = await client<TenderDeadlineRow[]>`
        SELECT id, title, source, url, metadata_json, deadline_at
        FROM tenders
        WHERE id > ${cursor}
        ORDER BY id ASC
        LIMIT ${pageSize}
      `;
      if (page.length === 0) break;
      rows.push(...page);
      cursor = page[page.length - 1].id;
    }

    let changed = 0;
    let unchanged = 0;
    let missingSourceDeadline = 0;
    let invalidSourceDeadline = 0;
    let unverifiedMismatch = 0;
    let concurrentChanges = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const metadata = readPublicTenderMeta(row.metadata_json, {
          title: row.title,
          source: row.source,
          sourceUrl: row.url,
        });
        const sourceDeadlineText = extractPublicPortalFacts(metadata.description).deadline;
        if (!sourceDeadlineText) {
          missingSourceDeadline += 1;
          continue;
        }

        const sourceDeadlineAt = parseDeadlineDate(sourceDeadlineText);
        if (!sourceDeadlineAt) {
          invalidSourceDeadline += 1;
          console.warn(`#${row.id} ignoriert: ungültige Quellfrist ${JSON.stringify(sourceDeadlineText)}`);
          continue;
        }
        const storedDeadlineAt = parseDeadlineDate(row.deadline_at);
        const correctedDeadlineAt = resolvePublicDeadlineRepair(sourceDeadlineText, row.deadline_at);
        if (!correctedDeadlineAt) {
          if (storedDeadlineAt?.getTime() === sourceDeadlineAt.getTime()) unchanged += 1;
          else unverifiedMismatch += 1;
          continue;
        }

        if (dryRun) {
          changed += 1;
          console.log(`#${row.id} ${row.source}: ${storedDeadlineAt?.toISOString() ?? "null"} -> ${correctedDeadlineAt.toISOString()}`);
          continue;
        }

        const updatedRows = await client<{ id: number }[]>`
          UPDATE tenders
          SET deadline_at = ${correctedDeadlineAt}, updated_at = NOW()
          WHERE id = ${row.id}
            AND deadline_at IS NOT DISTINCT FROM ${row.deadline_at}
          RETURNING id
        `;
        if (updatedRows.length > 0) {
          changed += 1;
          console.log(`#${row.id} ${row.source}: Frist auf ${correctedDeadlineAt.toISOString()} korrigiert`);
        } else {
          concurrentChanges += 1;
        }
      } catch (error) {
        failed += 1;
        console.error(`#${row.id} Backfill fehlgeschlagen:`, error);
      }
    }

    console.log(JSON.stringify({
      dryRun,
      scanned: rows.length,
      changed,
      unchanged,
      missingSourceDeadline,
      invalidSourceDeadline,
      unverifiedMismatch,
      concurrentChanges,
      failed,
    }));

    if (!dryRun && changed > 0) await markCatalogDirty();
    if (!dryRun && syncMeili && changed > 0) await syncTendersToMeili();
    if (failed > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Public-Deadline-Backfill fehlgeschlagen:", error);
  process.exitCode = 1;
});
