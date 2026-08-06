import "dotenv/config";
import postgres from "postgres";
import { decodeHtmlEntities } from "../lib/text-normalization";

const sql = postgres(process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter");

async function main(): Promise<void> {
  const rows = await sql<{ id: number; title: string }[]>`
    SELECT id, title
    FROM tenders
    WHERE title ~ '&(#x?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);'
  `;

  let changed = 0;
  for (const row of rows) {
    const title = decodeHtmlEntities(row.title);
    if (title === row.title) continue;
    await sql`
      UPDATE tenders
      SET title = ${title}, updated_at = NOW()
      WHERE id = ${row.id}
    `;
    changed += 1;
  }

  console.log(JSON.stringify({ scanned: rows.length, changed }));
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exitCode = 1;
});
