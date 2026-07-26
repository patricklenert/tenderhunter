// Backfill tenders.slug from title + metadata.location using generateTenderSlug().
// Run once after schema migration. Idempotent — only fills rows where slug IS NULL.

import postgres from "postgres";
import { generateTenderSlug } from "../lib/tender-slug";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";

interface TenderRow {
  id: number;
  title: string | null;
  metadata_json: Record<string, unknown> | null;
  slug: string | null;
}

async function main() {
  console.log("Connecting to PostgreSQL...");
  const client = postgres(connectionString, { max: 1 });

  try {
    const rows: TenderRow[] = await client`
      SELECT id, title, metadata_json, slug FROM tenders WHERE slug IS NULL ORDER BY id ASC
    `;
    console.log(`Found ${rows.length} tenders without slug.`);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const meta = (row.metadata_json && typeof row.metadata_json === "object" ? row.metadata_json : {}) as Record<
        string,
        unknown
      >;
      const location = typeof meta.location === "string" ? meta.location.split(",")[0] : "";
      const slug = generateTenderSlug(row.title ?? "", location);

      if (!slug) {
        console.log(`  #${row.id} — could not generate slug, skipping`);
        skipped++;
        continue;
      }

      await client`UPDATE tenders SET slug = ${slug}, updated_at = NOW() WHERE id = ${row.id} AND slug IS NULL`;
      updated++;

      if (updated % 500 === 0) {
        console.log(`  ... ${updated} slugs written`);
      }
    }

    console.log(`\nBackfill complete: ${updated} slugs set, ${skipped} skipped.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
