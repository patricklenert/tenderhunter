import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { tenders } from "../lib/schema";
import { derivePublicExternalId, inferPublicSourceKey } from "../lib/public-source-registry";

const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  const rows = await db
    .select({ id: tenders.id, source: tenders.source, sourceKey: tenders.sourceKey, url: tenders.url, externalId: tenders.externalId })
    .from(tenders);
  let candidates = 0;
  let changed = 0;

  for (const row of rows) {
    const sourceKey = inferPublicSourceKey(row.source, row.url)
      ?? inferPublicSourceKey(row.sourceKey, row.url);
    if (!sourceKey) continue;
    const externalId = derivePublicExternalId({ sourceKey, sourceUrl: row.url, externalId: row.externalId });
    if (row.sourceKey === sourceKey && row.externalId === externalId) continue;
    candidates += 1;
    if (!apply) continue;
    await db.update(tenders).set({ sourceKey, externalId, updatedAt: new Date() }).where(eq(tenders.id, row.id));
    changed += 1;
  }

  const duplicates = await db.execute(sql`
    SELECT source_key, external_id, count(*)::int AS count
    FROM tenders
    WHERE source_key IS NOT NULL AND external_id IS NOT NULL
    GROUP BY source_key, external_id
    HAVING count(*) > 1
    ORDER BY count(*) DESC
    LIMIT 20
  `);
  if (apply && duplicates.length === 0) {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenders_source_key_external_unique
      ON tenders(source_key, external_id)
      WHERE source_key IS NOT NULL AND external_id IS NOT NULL
    `);
  }

  console.log(JSON.stringify({ apply, rows: rows.length, candidates, changed, duplicateGroups: duplicates.length, uniqueIndexCreated: apply && duplicates.length === 0 }, null, 2));
  if (duplicates.length > 0) {
    console.warn("Duplicate public identities remain; deduplicate before creating the unique source_key/external_id index.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
