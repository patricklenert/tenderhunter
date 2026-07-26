import postgres from "postgres";
import { extractStructuredData, type StructuredData } from "@/lib/structurer";
import { isRawPortalDescription } from "@/lib/public-tender-scraper";

const connectionString = process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";

type JsonRecord = Record<string, unknown>;

interface CandidateRow {
  id: number;
  title: string | null;
  raw_text: string | null;
  metadata_json: JsonRecord | null;
  json_blob: JsonRecord | string | null;
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const noLlm = args.has("--no-llm");
const idArgument = process.argv.find((arg) => arg.startsWith("--id="));
const targetId = idArgument ? Number(idArgument.slice("--id=".length)) : null;
const limitArgument = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArgument ? Number(limitArgument.slice("--limit=".length)) : null;

const asRecord = (value: unknown): JsonRecord => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {};
    } catch {
      return {};
    }
  }
  return {};
};

const isAffected = (row: CandidateRow): boolean => {
  const rawText = row.raw_text ?? "";
  const metadataDescription = typeof row.metadata_json?.description === "string"
    ? row.metadata_json.description
    : "";
  const blob = asRecord(row.json_blob);
  const summary = typeof blob.summary === "string" ? blob.summary : "";
  const hasStructuredData = row.json_blob !== null;
  const malformedJsonBlob = typeof row.json_blob === "string";
  const isLegacySummary = summary.length === 3_000;
  const hasRawPortalText = isRawPortalDescription(metadataDescription) || isRawPortalDescription(rawText);
  const isUnprocessedRawPortalText = hasRawPortalText
    && (!hasStructuredData || isRawPortalDescription(summary));

  return malformedJsonBlob
    || isUnprocessedRawPortalText
    || isLegacySummary;
};

const updateStructuredData = async (client: postgres.Sql, row: CandidateRow, structured: StructuredData): Promise<void> => {
  await client`
    INSERT INTO structured_data (tender_id, json_blob, confidence, created_at, updated_at)
    VALUES (${row.id}, ${client.json(JSON.parse(JSON.stringify(structured)))}, ${structured.confidence}, NOW(), NOW())
    ON CONFLICT (tender_id) DO UPDATE SET
      json_blob = EXCLUDED.json_blob,
      confidence = EXCLUDED.confidence,
      updated_at = NOW()
  `;

  await client`
    UPDATE tenders SET
      contract_value_min = ${structured.procurement.contract_value.min},
      contract_value_max = ${structured.procurement.contract_value.max},
      contract_duration_months = ${structured.procurement.contract_duration.months},
      procedure_type = ${structured.procurement.procedure_type},
      updated_at = NOW()
    WHERE id = ${row.id}
  `;
};

async function main(): Promise<void> {
  if (targetId !== null && (!Number.isInteger(targetId) || targetId <= 0)) {
    throw new Error("--id muss eine positive Ganzzahl sein");
  }
  if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("--limit muss eine positive Ganzzahl sein");
  }

  const client = postgres(connectionString, { max: 1 });
  try {
    const rows: CandidateRow[] = targetId
      ? await client`
          SELECT t.id, t.title, t.raw_text, t.metadata_json, sd.json_blob
          FROM tenders t
          LEFT JOIN structured_data sd ON sd.tender_id = t.id
          WHERE t.id = ${targetId} AND t.raw_text IS NOT NULL
          ORDER BY t.id ASC
        `
      : await client`
          SELECT t.id, t.title, t.raw_text, t.metadata_json, sd.json_blob
          FROM tenders t
          LEFT JOIN structured_data sd ON sd.tender_id = t.id
          WHERE t.raw_text IS NOT NULL
          ORDER BY t.id ASC
        `;

    const candidates = rows.filter(isAffected).slice(0, limit ?? rows.length);
    console.log(`${dryRun ? "Dry-run: " : ""}${candidates.length} betroffene Tender gefunden.`);

    let migrated = 0;
    let failed = 0;
    for (const row of candidates) {
      const rawText = row.raw_text?.trim() ?? "";
      if (!rawText) continue;

      if (dryRun) {
        console.log(`  #${row.id} ${row.title ?? "(ohne Titel)"}`);
        continue;
      }

      try {
         const structured = await extractStructuredData(row.title ?? "Unbenannte Ausschreibung", rawText, { useLLM: !noLlm });
        await updateStructuredData(client, row, structured);
        migrated++;
        console.log(`  #${row.id} ${row.title ?? "(ohne Titel)"} -> Summary ${structured.summary.length} Zeichen`);
      } catch (error) {
        failed++;
        console.error(`  #${row.id} Migration fehlgeschlagen:`, error);
      }
    }

    if (!dryRun) {
      console.log(`Migration abgeschlossen: ${migrated} aktualisiert, ${failed} fehlgeschlagen.`);
      if (failed > 0) process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Tender-Beschreibungsmigration fehlgeschlagen:", error);
  process.exit(1);
});
