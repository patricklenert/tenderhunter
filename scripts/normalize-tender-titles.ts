import "dotenv/config";
import postgres from "postgres";
import { cleanTenderTitle } from "../lib/public-tender-scraper";
import { generateTenderSlug } from "../lib/tender-slug";

const sql = postgres(process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter");

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const rows = await sql<{ id: number; title: string | null; slug: string | null; metadata_json: unknown }[]>`
    SELECT id, title, slug, metadata_json
    FROM tenders
    WHERE title IS NOT NULL
  `;

  let changed = 0;
  for (const row of rows) {
    const metadata = row.metadata_json && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
      ? row.metadata_json as Record<string, unknown>
      : {};
    const reference = typeof metadata.reference_number === "string"
      ? metadata.reference_number
      : typeof metadata.referenceNumber === "string" ? metadata.referenceNumber : null;
    const title = cleanTenderTitle(row.title ?? "", reference);
    if (!title || title === row.title) continue;
    const location = typeof metadata.location === "string" ? metadata.location : undefined;
    const slug = generateTenderSlug(title, location);
    if (dryRun) {
      console.log(`#${row.id}: ${row.title} -> ${title}`);
      changed += 1;
      continue;
    }
    await sql`
      UPDATE tenders
      SET title = ${title}, slug = ${slug}, updated_at = NOW()
      WHERE id = ${row.id}
    `;
    changed += 1;
  }

  console.log(JSON.stringify({ dryRun, scanned: rows.length, changed }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exitCode = 1;
});
