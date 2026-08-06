import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter");
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="))?.slice("--source=".length).trim() || null;

type CursorRow = {
  source_key: string;
  cursor_version: number;
  cursor_json: unknown;
  exhausted: boolean;
  continuation_required: boolean;
};

const loadRows = async (): Promise<CursorRow[]> => {
  if (sourceArg) {
    return sql<CursorRow[]>`
      SELECT source_key, cursor_version, cursor_json, exhausted, continuation_required
      FROM public_source_cursors
      WHERE source_key = ${sourceArg}
      ORDER BY source_key
    `;
  }

  return sql<CursorRow[]>`
    SELECT source_key, cursor_version, cursor_json, exhausted, continuation_required
    FROM public_source_cursors
    ORDER BY source_key
  `;
};

const main = async (): Promise<void> => {
  const rows = await loadRows();
  const activeJobs = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM jobs
    WHERE type = 'scrape_public_tenders' AND status IN ('pending', 'running')
  `;

  console.log(`[replay-public-cursors] Modus: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`[replay-public-cursors] Quellen: ${rows.length}, aktive Public-Jobs: ${activeJobs[0]?.count ?? 0}`);

  for (const row of rows) {
    console.log(`  ${row.source_key}: Version ${row.cursor_version} -> ${row.cursor_version + 1}, Cursor wird auf Anfang gesetzt`);
  }

  if (!apply || rows.length === 0) {
    await sql.end();
    return;
  }

  if ((activeJobs[0]?.count ?? 0) > 0) {
    throw new Error("Replay abgebrochen: Es läuft bereits ein Public-Scrape-Job.");
  }

  await sql.begin(async (transaction) => {
    for (const row of rows) {
      await transaction`
        UPDATE public_source_cursors
        SET cursor_json = '{}'::jsonb,
            exhausted = FALSE,
            continuation_required = TRUE,
            last_run_id = NULL,
            last_status = 'replay_pending',
            last_error = NULL,
            last_advanced_at = NULL,
            cursor_version = cursor_version + 1,
            updated_at = NOW()
        WHERE source_key = ${row.source_key}
          AND cursor_version = ${row.cursor_version}
      `;
    }
  });

  console.log(`[replay-public-cursors] ${rows.length} Cursor zurückgesetzt.`);
  await sql.end();
};

main().catch(async (error: unknown) => {
  console.error(error);
  await sql.end();
  process.exitCode = 1;
});
