import {
  normalizePublicDisplayCandidateForMarkdownEscaping,
  pickValidatedPublicProcedure,
} from "@/lib/public-content-quality";

export interface TenderDescriptionFacts {
  client?: unknown;
  procedure?: unknown;
  deadline?: unknown;
  location?: unknown;
  value?: unknown;
  duration?: unknown;
  reference?: unknown;
  summary?: unknown;
  subject?: unknown;
  scope?: unknown;
  requirements?: unknown;
  mandatoryDocuments?: unknown;
  awardCriteria?: unknown;
  cpv?: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeText = (value: string): string =>
  value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Escape dynamic text so it cannot create Markdown links, emphasis, HTML, or new blocks. */
export const escapeMarkdownText = (value: string): string => {
  const normalized = normalizeText(value);
  let escaped = "";
  for (const character of normalized) {
    if ("\\`*_[]{}()<>#+|!~".includes(character)) escaped += "\\";
    escaped += character;
  }
  return escaped;
};

const directText = (value: unknown): string => {
  if (typeof value === "string") return normalizePublicDisplayCandidateForMarkdownEscaping(value) ?? "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const objectText = (value: unknown): string => {
  const record = asRecord(value);
  if (!record) return "";

  for (const key of ["text", "value", "label", "description", "name", "code"]) {
    const text = directText(record[key]);
    if (text) return text;
  }

  return "";
};

const formatValue = (value: unknown): string => {
  const direct = directText(value);
  if (direct) return direct;

  const record = asRecord(value);
  if (!record) return "";

  const min = asNumber(record.min);
  const max = asNumber(record.max);
  if (min === null && max === null) return objectText(record);

  const amount = min !== null && max !== null
    ? `${min} - ${max}`
    : String(max ?? min);
  const currency = directText(record.currency);
  return currency ? `${amount} ${currency}` : amount;
};

const formatDuration = (value: unknown): string => {
  const direct = directText(value);
  if (direct) return direct;

  const record = asRecord(value);
  if (!record) return "";

  const months = asNumber(record.months);
  const years = asNumber(record.years);
  const days = asNumber(record.days);
  const parts: string[] = [];
  if (months !== null) parts.push(`${months} Monate`);
  else if (years !== null) parts.push(`${years} Jahre`);
  else if (days !== null) parts.push(`${days} Tage`);
  if (record.renewal === true) parts.push("Verlängerungsoption vorhanden");
  return parts.join(", ");
};

const listValues = (value: unknown): unknown[] => Array.isArray(value)
  ? value
  : value === null || value === undefined
    ? []
    : [value];

const formatList = (value: unknown, separator: string): string => listValues(value)
  .map((item) => directText(item) || objectText(item))
  .filter(Boolean)
  .filter((item, index, values) => values.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
  .join(separator);

const formatAwardCriterion = (value: unknown): string => {
  const direct = directText(value);
  if (direct) return direct;

  const record = asRecord(value);
  if (!record) return "";
  const criterion = directText(record.criterion ?? record.name ?? record.label ?? record.text);
  if (!criterion) return "";
  const weight = directText(record.weight);
  return weight ? `${criterion} (${weight}${typeof record.weight === "number" ? " %" : ""})` : criterion;
};

const formatAwardCriteria = (value: unknown): string => listValues(value)
  .map(formatAwardCriterion)
  .filter(Boolean)
  .join("; ");

const addBullet = (lines: string[], label: string, value: unknown): void => {
  const escaped = escapeMarkdownText(directText(value) || objectText(value));
  if (escaped) lines.push(`- **${label}:** ${escaped}`);
};

/** Build deterministic Markdown from facts that were explicitly extracted elsewhere. */
export const buildTenderDescriptionMarkdown = (facts: TenderDescriptionFacts): string => {
  const lines: string[] = [];

  addBullet(lines, "Auftraggeber", facts.client);
  addBullet(lines, "Verfahren", pickValidatedPublicProcedure(facts.procedure));
  addBullet(lines, "Angebotsfrist", facts.deadline);
  addBullet(lines, "Leistungsort", facts.location);
  addBullet(lines, "Auftragswert", formatValue(facts.value));
  addBullet(lines, "Laufzeit", formatDuration(facts.duration));
  addBullet(lines, "Referenz", facts.reference);
  addBullet(lines, "Zusammenfassung", formatList(facts.summary, " "));
  addBullet(lines, "Leistungsgegenstand", formatList(facts.subject, " "));
  addBullet(lines, "Leistungsumfang", formatList(facts.scope, " "));
  addBullet(lines, "Anforderungen", formatList(
    [...listValues(facts.requirements), ...listValues(facts.mandatoryDocuments)],
    "; ",
  ));
  addBullet(lines, "Zuschlagskriterien", formatAwardCriteria(facts.awardCriteria));
  addBullet(lines, "CPV", formatList(facts.cpv, ", "));

  return lines.join("\n");
};
