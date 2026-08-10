import "dotenv/config";
import postgres from "postgres";
import {
  buildPublicAccessLimitedDescriptionMarkdown,
  cleanPublicDescription,
  extractPublicPortalFacts,
} from "../lib/public-tender-scraper";
import { isParticipationWallText } from "../lib/access-page-detector";
import { buildTenderDescriptionMarkdown, type TenderDescriptionFacts } from "../lib/tender-description";

const connectionString = process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";

type JsonRecord = Record<string, unknown>;

interface TenderRow {
  id: number;
  title: string | null;
  raw_text: string | null;
  metadata_json: unknown;
  deadline_at: Date | string | null;
  procedure_type: string | null;
  contract_value_min: number | null;
  contract_value_max: number | null;
  contract_duration_months: number | null;
  json_blob: unknown;
}

interface ParsedRecord {
  value: JsonRecord;
  valid: boolean;
}

const parseRecord = (value: unknown): ParsedRecord => {
  if (value === null || value === undefined) return { value: {}, valid: true };
  if (typeof value === "object" && !Array.isArray(value)) return { value: value as JsonRecord, valid: true };
  if (typeof value !== "string") return { value: {}, valid: false };

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { value: parsed as JsonRecord, valid: true }
      : { value: {}, valid: false };
  } catch {
    return { value: {}, valid: false };
  }
};

const text = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const hasValue = (value: unknown): boolean => {
  if (text(value)) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
};

const firstValue = (...values: unknown[]): unknown => values.find(hasValue) ?? null;

const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const stringList = (value: unknown): string[] => list(value).map(text).filter(Boolean);

const listHasValue = (value: unknown): boolean => list(value).some((item) =>
  Boolean(text(item)) || Boolean(item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length > 0));

const firstString = (...values: unknown[]): string => values.map(text).find(Boolean) ?? "";

const firstList = (...values: unknown[]): unknown[] => values.find(listHasValue) as unknown[] ?? [];

const formatDateValue = (value: Date | string | null): string => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return text(value);
};

const cleanFactText = (value: unknown): string => {
  const candidate = text(value);
  return candidate ? cleanPublicDescription(candidate) : "";
};

const structuredFacts = (
  row: TenderRow,
  metadata: JsonRecord,
  blob: JsonRecord,
): TenderDescriptionFacts => {
  const hardFacts = parseRecord(blob.hard_facts).value;
  const decisionRelevant = parseRecord(blob.decision_relevant).value;
  const procurement = parseRecord(blob.procurement).value;
  const contractValue = parseRecord(procurement.contract_value).value;
  const contractDuration = parseRecord(procurement.contract_duration).value;

  const requirements = [
    ...list(decisionRelevant.requirements),
    ...list(decisionRelevant.mandatory_documents),
    ...list(procurement.participation_requirements),
    ...list(blob.requirements),
    ...list(metadata.requirements),
  ];
  const awardCriteria = firstList(
    procurement.award_criteria_detailed,
    decisionRelevant.award_criteria,
    blob.awardCriteria,
    blob.award_criteria,
    metadata.awardCriteria,
  );
  const cpv = firstList(
    procurement.cpv_codes,
    blob.cpvCodes,
    blob.cpv_codes,
    metadata.cpvCodes,
    metadata.cpv_codes,
  );

  const databaseValue = row.contract_value_min !== null || row.contract_value_max !== null
    ? {
      min: row.contract_value_min,
      max: row.contract_value_max,
      currency: "EUR",
    }
    : null;
  const databaseDuration = row.contract_duration_months !== null
    ? `${row.contract_duration_months} Monate`
    : null;

  return {
    client: firstString(metadata.client, blob.client, hardFacts.buyer),
    procedure: firstString(metadata.procedure, blob.procedure, procurement.procedure_type, hardFacts.contract_type, row.procedure_type),
    deadline: firstString(metadata.deadline, blob.deadline, hardFacts.deadline, formatDateValue(row.deadline_at)),
    location: firstString(metadata.location, blob.location, hardFacts.location),
    value: firstValue(metadata.estimatedValue, metadata.estimated_value, blob.estimatedValue, blob.estimated_value, hardFacts.budget, contractValue, databaseValue),
    duration: firstValue(metadata.duration, blob.duration, contractDuration, databaseDuration),
    reference: firstString(metadata.referenceNumber, metadata.reference_number, blob.referenceNumber, blob.reference_number),
    summary: cleanFactText(firstString(blob.summary, blob.description, metadata.description)),
    subject: firstString(blob.subject, metadata.subject),
    scope: firstString(
      blob.scope,
      metadata.scope,
      metadata.subject,
      stringList(decisionRelevant.scope).join(" "),
    ),
    requirements,
    awardCriteria,
    cpv,
  };
};

const isAccessLimited = (metadata: JsonRecord, rawText: string, description: string): boolean =>
  metadata.access_limited === true
  || isParticipationWallText(rawText)
  || isParticipationWallText(description)
  || /vollständige Leistungsbeschreibung[\s\S]{0,180}nach Teilnahme/i.test(`${rawText} ${description}`);

const buildRowDescriptionMarkdown = (row: TenderRow, metadata: JsonRecord, blob: JsonRecord): string => {
  const description = text(metadata.description);
  const portalText = [row.raw_text, description].filter((value): value is string => Boolean(value && value.trim())).join(" ");
  if (isAccessLimited(metadata, row.raw_text ?? "", description)) {
    return buildPublicAccessLimitedDescriptionMarkdown(
      row.title ?? "",
      extractPublicPortalFacts(portalText),
    );
  }

  const facts = structuredFacts(row, metadata, blob);
  facts.summary = facts.summary || cleanFactText(row.raw_text);
  return buildTenderDescriptionMarkdown(facts);
};

const canonicalMarkdown = (record: JsonRecord, markdown: string): JsonRecord => {
  if (!markdown.trim()) return record;
  const next: JsonRecord = { ...record, descriptionMarkdown: markdown };
  delete next.description_markdown;
  return next;
};

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const idArgument = process.argv.find((arg) => arg.startsWith("--id="));
const targetId = idArgument ? Number(idArgument.slice("--id=".length)) : null;
const limitArgument = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArgument ? Number(limitArgument.slice("--limit=".length)) : null;

async function main(): Promise<void> {
  if (targetId !== null && (!Number.isInteger(targetId) || targetId <= 0)) {
    throw new Error("--id muss eine positive Ganzzahl sein");
  }
  if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("--limit muss eine positive Ganzzahl sein");
  }

  const client = postgres(connectionString, { max: 1 });
  try {
    const rows: TenderRow[] = targetId
      ? await client<TenderRow[]>`
          SELECT t.id, t.title, t.raw_text, t.metadata_json, t.deadline_at,
                 t.procedure_type, t.contract_value_min, t.contract_value_max,
                 t.contract_duration_months, sd.json_blob
          FROM tenders t
          LEFT JOIN structured_data sd ON sd.tender_id = t.id
          WHERE t.id = ${targetId}
          ORDER BY t.id ASC
        `
      : await client<TenderRow[]>`
          SELECT t.id, t.title, t.raw_text, t.metadata_json, t.deadline_at,
                 t.procedure_type, t.contract_value_min, t.contract_value_max,
                 t.contract_duration_months, sd.json_blob
          FROM tenders t
          LEFT JOIN structured_data sd ON sd.tender_id = t.id
          ORDER BY t.id ASC
        `;

    const candidates = rows.slice(0, limit ?? rows.length);
    let metadataChanged = 0;
    let structuredChanged = 0;
    let skippedMalformed = 0;
    let failed = 0;

    for (const row of candidates) {
      try {
        const parsedMetadata = parseRecord(row.metadata_json);
        const parsedStructured = parseRecord(row.json_blob);
        const existingMetadataMarkdown = firstString(parsedMetadata.value.descriptionMarkdown, parsedMetadata.value.description_markdown);
        const existingStructuredMarkdown = firstString(parsedStructured.value.descriptionMarkdown, parsedStructured.value.description_markdown);
        const generatedMarkdown = buildRowDescriptionMarkdown(row, parsedMetadata.value, parsedStructured.value);
        const markdown = generatedMarkdown || existingMetadataMarkdown || existingStructuredMarkdown;

        const nextMetadata = canonicalMarkdown(parsedMetadata.value, markdown);
        const nextStructured = canonicalMarkdown(parsedStructured.value, markdown);
        const shouldUpdateMetadata = Boolean(markdown) && parsedMetadata.valid && !sameJson(parsedMetadata.value, nextMetadata);
        const shouldUpdateStructured = Boolean(markdown) && row.json_blob !== null && parsedStructured.valid && !sameJson(parsedStructured.value, nextStructured);

        if (!parsedMetadata.valid || (row.json_blob !== null && !parsedStructured.valid)) skippedMalformed += 1;
        if (shouldUpdateMetadata) metadataChanged += 1;
        if (shouldUpdateStructured) structuredChanged += 1;

        if (dryRun) {
          console.log(`#${row.id} ${row.title ?? "(ohne Titel)"}: metadata=${shouldUpdateMetadata ? "update" : "ok"}, structured=${shouldUpdateStructured ? "update" : "skip"}`);
          continue;
        }

        if (shouldUpdateMetadata) {
          await client`
            UPDATE tenders
            SET metadata_json = ${client.json(nextMetadata as never)}, updated_at = NOW()
            WHERE id = ${row.id}
          `;
        }
        if (shouldUpdateStructured) {
          await client`
            UPDATE structured_data
            SET json_blob = ${client.json(nextStructured as never)}, updated_at = NOW()
            WHERE tender_id = ${row.id}
          `;
        }
      } catch (error) {
        failed += 1;
        console.error(`#${row.id} Backfill fehlgeschlagen:`, error);
      }
    }

    console.log(JSON.stringify({
      dryRun,
      scanned: candidates.length,
      metadataChanged,
      structuredChanged,
      skippedMalformed,
      failed,
    }));
    if (failed > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Description-Markdown-Backfill fehlgeschlagen:", error);
  process.exitCode = 1;
});
