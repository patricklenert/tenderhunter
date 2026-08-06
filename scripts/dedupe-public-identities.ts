import postgres from "postgres";

const connectionString = process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";
const applyChanges = process.argv.includes("--apply");

type TenderRow = {
  id: number;
  source_key: string;
  external_id: string;
  title: string | null;
  raw_text: string | null;
  metadata_json: Record<string, unknown> | null;
  quality_status: string;
  created_at: Date;
};

const completenessScore = (row: TenderRow): number => (
  (row.quality_status === "qualified" ? 4 : row.quality_status === "candidate" ? 2 : 0)
  + (row.raw_text && row.raw_text.length > 100 ? 2 : 0)
  + (row.metadata_json ? 1 : 0)
  + (row.title ? 1 : 0)
);

async function main(): Promise<void> {
  const client = postgres(connectionString, { max: 1 });
  try {
    const rows: TenderRow[] = await client`
      SELECT id, source_key, external_id, title, raw_text, metadata_json, quality_status, created_at
      FROM tenders
      WHERE source_key IS NOT NULL AND external_id IS NOT NULL
      ORDER BY source_key, external_id, id
    `;
    const groups = new Map<string, TenderRow[]>();
    for (const row of rows) {
      const key = `${row.source_key}:${row.external_id}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const duplicateGroups = [...groups.entries()].filter(([, group]) => group.length > 1);
    const duplicateRows = duplicateGroups.reduce((sum, [, group]) => sum + group.length - 1, 0);
    console.log(`[dedupe-public-identities] Modus: ${applyChanges ? "APPLY" : "DRY-RUN"}`);
    console.log(`[dedupe-public-identities] Gruppen: ${groups.size}, Duplikatgruppen: ${duplicateGroups.length}, Duplikate: ${duplicateRows}`);

    for (const [key, group] of duplicateGroups) {
      const sorted = [...group].sort((left, right) => (
        completenessScore(right) - completenessScore(left)
        || left.created_at.getTime() - right.created_at.getTime()
        || left.id - right.id
      ));
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);
      console.log(`  ${key}: #${canonical.id} bleibt, ${duplicates.length} Duplikat(e)`);
      if (!applyChanges) continue;

      await client.begin(async (tx) => {
        for (const duplicate of duplicates) {
          await tx`
            DELETE FROM documents duplicate_documents
            USING documents canonical_documents
            WHERE duplicate_documents.tender_id = ${duplicate.id}
              AND canonical_documents.tender_id = ${canonical.id}
              AND duplicate_documents.sha256 = canonical_documents.sha256
          `;
          await tx`
            UPDATE documents
            SET tender_id = ${canonical.id}, updated_at = NOW()
            WHERE tender_id = ${duplicate.id}
          `;
          await tx`
            DELETE FROM structured_data duplicate_structured
            USING structured_data canonical_structured
            WHERE duplicate_structured.tender_id = ${duplicate.id}
              AND canonical_structured.tender_id = ${canonical.id}
          `;
          await tx`
            UPDATE structured_data
            SET tender_id = ${canonical.id}, updated_at = NOW()
            WHERE tender_id = ${duplicate.id}
          `;
          await tx`
            DELETE FROM scores duplicate_scores
            USING scores canonical_scores
            WHERE duplicate_scores.tender_id = ${duplicate.id}
              AND canonical_scores.tender_id = ${canonical.id}
              AND duplicate_scores.company_id = canonical_scores.company_id
          `;
          await tx`
            UPDATE scores
            SET tender_id = ${canonical.id}, updated_at = NOW()
            WHERE tender_id = ${duplicate.id}
          `;
          await tx`
            DELETE FROM insights duplicate_insights
            USING insights canonical_insights
            WHERE duplicate_insights.tender_id = ${duplicate.id}
              AND canonical_insights.tender_id = ${canonical.id}
              AND duplicate_insights.company_id = canonical_insights.company_id
          `;
          await tx`
            UPDATE insights
            SET tender_id = ${canonical.id}, updated_at = NOW()
            WHERE tender_id = ${duplicate.id}
          `;
          await tx`
            INSERT INTO tracked_tenders (tender_id, company_id, status, owner, deadline_at, notes, created_at, updated_at)
            SELECT ${canonical.id}, company_id, status, owner, deadline_at, notes, created_at, updated_at
            FROM tracked_tenders
            WHERE tender_id = ${duplicate.id}
            ON CONFLICT (company_id, tender_id) DO NOTHING
          `;
          await tx`DELETE FROM tracked_tenders WHERE tender_id = ${duplicate.id}`;
          await tx`UPDATE attribution_events SET tender_id = ${canonical.id} WHERE tender_id = ${duplicate.id}`;
          await tx`UPDATE company_url_match_cache SET tender_id = ${canonical.id} WHERE tender_id = ${duplicate.id}`;
          await tx`
            UPDATE tenders
            SET quality_status = 'duplicate',
                quality_reason = ${`Duplikat von Ausschreibung #${canonical.id}`},
                duplicate_of_tender_id = ${canonical.id},
                external_id = NULL,
                updated_at = NOW()
            WHERE id = ${duplicate.id}
          `;
        }
      });
    }

    if (applyChanges) {
      await client`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tenders_source_key_external_unique
        ON tenders(source_key, external_id)
        WHERE source_key IS NOT NULL AND external_id IS NOT NULL
      `;
      console.log("[dedupe-public-identities] Unique-Index auf (source_key, external_id) sichergestellt.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[dedupe-public-identities] Fehler:", error);
  process.exitCode = 1;
});
