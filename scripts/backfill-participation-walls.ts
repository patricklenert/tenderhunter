import postgres from "postgres";
import { isParticipationWallText } from "@/lib/access-page-detector";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";

interface TenderRow {
  id: number;
  title: string | null;
  url: string;
  description: string | null;
  quality_status: string;
}

const REASON =
  "Teilnahme-Wand statt Leistungsbeschreibung (Portal sperrt die Vergabeunterlagen hinter einer Teilnahme-Bestaetigung).";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "Modus: APPLY (Aenderungen werden geschrieben)" : "Modus: DRY-RUN (keine Aenderungen, --apply zum Ausfuehren)");

  console.log("Connecting to PostgreSQL...");
  const client = postgres(connectionString, { max: 1 });

  try {
    const rows: TenderRow[] = await client`
      SELECT id, title, url, metadata_json->>'description' AS description, quality_status
      FROM tenders
      WHERE quality_status IN ('qualified', 'candidate')
      ORDER BY id ASC
    `;

    const wallRows = rows.filter((row) => isParticipationWallText(row.description ?? ""));
    console.log(
      `\n${rows.length} sichtbare Ausschreibungen geprueft, ${wallRows.length} mit Teilnahme-Wand als Beschreibung erkannt.\n`,
    );

    if (wallRows.length === 0) {
      console.log("Nichts zu tun.");
      return;
    }

    for (const row of wallRows) {
      console.log(
        `  #${row.id} [${row.quality_status}] "${(row.title ?? row.url).slice(0, 70)}" -> rejected`,
      );
      if (!apply) continue;

      await client`
        UPDATE tenders SET
          quality_status = 'rejected',
          quality_reason = ${REASON},
          duplicate_of_tender_id = NULL,
          updated_at = NOW()
        WHERE id = ${row.id}
      `;
      await client`DELETE FROM insights WHERE tender_id = ${row.id}`;
      await client`DELETE FROM scores WHERE tender_id = ${row.id}`;
    }

    if (apply && wallRows.length > 0) {
      // Mark catalog dirty + enqueue a Meili sync so rejected tenders drop from the
      // search index (sync does a full deleteAll + rebuild from qualified tenders).
      await client`INSERT INTO catalog_state (id, revision, synced_revision, sync_running)
                   VALUES (1, 1, 0, false)
                   ON CONFLICT (id) DO UPDATE SET revision = catalog_state.revision + 1, updated_at = NOW()`;
      await client`INSERT INTO jobs (type, payload, status, priority, retries, max_retries, run_after, job_key)
                   VALUES ('sync_meilisearch', '{}'::jsonb, 'pending', 100, 0, 3, NOW(), 'sync_meilisearch')
                   ON CONFLICT DO NOTHING`;
      console.log("Meili-Sync eingeplant (Katalog als dirty markiert).");
    }

    console.log(
      apply
        ? `\nFertig: ${wallRows.length} Ausschreibungen auf 'rejected' gesetzt (inkl. Bereinigung von insights/scores).`
        : `\nDry-Run: ${wallRows.length} Treffer. Erneut mit --apply ausfuehren, um zu schreiben.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
