import postgres from "postgres";
import { extractPortalProjectId } from "../lib/tender-identity";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";
const applyChanges = process.argv.includes("--apply");

const PORTAL_SOURCES = [
  "brandenburg",
  "rlp-land",
  "rlp-lbb",
  "rlp-lbm",
  "metropoleruhr",
  "vmp-rheinland",
  "blb-nrw",
  "westfalen",
  "stadt-koeln",
  "wirtschaftsregion-aachen",
  "vergabeportal-bw",
];

interface TenderRow {
  id: number;
  source: string;
  url: string;
  title: string | null;
  external_id: string | null;
  metadata_json: Record<string, unknown> | null;
  raw_text: string | null;
  quality_status: string;
  created_at: Date;
}

function getStableIdentity(row: TenderRow): string | null {
  if (row.external_id?.trim()) return row.external_id.trim();

  const projectId = extractPortalProjectId(row.url);
  if (projectId) return projectId;

  const reference = row.metadata_json?.reference_number;
  return typeof reference === "string" && /^CX[A-Z0-9]{6,}$/i.test(reference.trim())
    ? reference.trim()
    : null;
}

function completenessScore(row: TenderRow): number {
  return (row.quality_status === "qualified" ? 4 : row.quality_status === "candidate" ? 2 : 0)
    + (row.raw_text && row.raw_text.length > 100 ? 2 : 0)
    + (row.metadata_json ? 1 : 0)
    + (row.title ? 1 : 0);
}

async function main(): Promise<void> {
  const client = postgres(connectionString, { max: 1 });

  try {
    const rows: TenderRow[] = await client`
      SELECT id, source, url, title, external_id, metadata_json, raw_text,
             quality_status, created_at
      FROM tenders
      WHERE source IN ${client(PORTAL_SOURCES)}
      ORDER BY source, id
    `;

    const groups = new Map<string, TenderRow[]>();
    for (const row of rows) {
      const identity = getStableIdentity(row);
      if (!identity) continue;
      const key = `${row.source}:${identity}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }

    const duplicateGroups = [...groups.entries()].filter(([, group]) => group.length > 1);
    const duplicateCount = duplicateGroups.reduce((sum, [, group]) => sum + group.length - 1, 0);
    console.log(`[dedupe-public] Modus: ${applyChanges ? "APPLY" : "DRY-RUN"}`);
    console.log(`[dedupe-public] Geprueft: ${rows.length}, Gruppen: ${groups.size}, Duplikatgruppen: ${duplicateGroups.length}, Duplikate: ${duplicateCount}`);

    if (applyChanges) {
      await client`
        DELETE FROM insights
        WHERE tender_id IN (
          SELECT id FROM tenders
          WHERE source IN ${client(PORTAL_SOURCES)} AND quality_status = 'duplicate'
        )
      `;
      await client`
        DELETE FROM scores
        WHERE tender_id IN (
          SELECT id FROM tenders
          WHERE source IN ${client(PORTAL_SOURCES)} AND quality_status = 'duplicate'
        )
      `;
    }

    for (const [key, group] of duplicateGroups) {
      const sorted = [...group].sort((left, right) =>
        completenessScore(right) - completenessScore(left)
        || left.created_at.getTime() - right.created_at.getTime()
        || left.id - right.id,
      );
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);
      if (!applyChanges) {
        console.log(`  ${key}: #${canonical.id} bleibt, ${duplicates.map((row) => `#${row.id}`).join(", ")} werden markiert`);
      }

      if (!applyChanges) continue;

      const identity = getStableIdentity(canonical);
      if (!identity) continue;

      await client.begin(async (tx) => {
        await tx`
          UPDATE tenders
          SET external_id = ${identity}, updated_at = NOW()
          WHERE id = ${canonical.id}
        `;

        for (const duplicate of duplicates) {
          await tx`
            INSERT INTO tracked_tenders (
              tender_id, company_id, status, owner, deadline_at, notes, created_at, updated_at
            )
            SELECT ${canonical.id}, company_id, status, owner, deadline_at, notes, created_at, updated_at
            FROM tracked_tenders
            WHERE tender_id = ${duplicate.id}
            ON CONFLICT (company_id, tender_id) DO NOTHING
          `;
          await tx`
            DELETE FROM tracked_tenders WHERE tender_id = ${duplicate.id}
          `;
          await tx`
            UPDATE attribution_events
            SET tender_id = ${canonical.id}
            WHERE tender_id = ${duplicate.id}
          `;
          await tx`
            DELETE FROM insights WHERE tender_id = ${duplicate.id}
          `;
          await tx`
            DELETE FROM scores WHERE tender_id = ${duplicate.id}
          `;
          await tx`
            UPDATE tenders
            SET quality_status = 'duplicate',
                quality_reason = ${`Duplikat von Ausschreibung #${canonical.id} (Portal-ID ${identity})`},
                duplicate_of_tender_id = ${canonical.id},
                external_id = NULL,
                updated_at = NOW()
            WHERE id = ${duplicate.id}
          `;
        }
      });
    }

    if (applyChanges && duplicateGroups.length > 0) {
      await client`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tenders_source_external_unique
        ON tenders(source, external_id)
        WHERE external_id IS NOT NULL
      `;
      console.log("[dedupe-public] Unique-Index auf (source, external_id) sichergestellt.");
    }

    if (!applyChanges && duplicateCount > 0) {
      console.log("[dedupe-public] Keine Daten geändert. Mit --apply erneut ausführen.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("[dedupe-public] Fehler:", error);
  process.exitCode = 1;
});
