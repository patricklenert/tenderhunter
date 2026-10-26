import {
  isCanonicalPublicDescriptionMarkdown,
  isPublicCandidateFromTruncatedArray,
  isTruncatedPublicTokenArray,
  normalizePublicTextList,
  pickValidatedPublicSummaryForTender,
} from "./public-content-quality";
import { hasPositiveAccessLimitedEvidence } from "./access-page-detector";

export type PublicDescriptionRecord = Record<string, unknown>;

export interface PublicDescriptionRepair {
  record: PublicDescriptionRecord;
  descriptionChanged: boolean;
  summaryChanged: boolean;
  scopeChanged: boolean;
}

export const hasPositivePublicAccessEvidence = (
  explicitlyAccessLimited: unknown,
  text: unknown,
): boolean => explicitlyAccessLimited === true
  || hasPositiveAccessLimitedEvidence(false, text);

export const selectPublicDescriptionMarkdown = (
  record: PublicDescriptionRecord,
  generatedMarkdown: string,
  publicFieldsChanged: boolean,
): string => {
  const existing = [record.descriptionMarkdown, record.description_markdown]
    .find((value): value is string => isCanonicalPublicDescriptionMarkdown(value)) ?? "";
  if (!publicFieldsChanged && existing) return existing;
  return isCanonicalPublicDescriptionMarkdown(generatedMarkdown) ? generatedMarkdown : existing;
};

export const shouldSyncPublicDescriptionBackfillMeili = (
  dryRun: boolean,
  syncMeili: boolean,
): boolean => !dryRun && syncMeili;

const hasOwn = (record: PublicDescriptionRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const getScopeRecords = (record: PublicDescriptionRecord): PublicDescriptionRecord[] => [
  record,
  ...[record.decision_relevant, record.decisionRelevant]
    .filter((value): value is PublicDescriptionRecord => Boolean(value && typeof value === "object" && !Array.isArray(value))),
];

const getScopeSources = (records: readonly PublicDescriptionRecord[]): unknown[] =>
  records.flatMap((record) => [record.scope, record.subject]);

const clearInvalidScopeFields = (records: readonly PublicDescriptionRecord[]): boolean => {
  let changed = false;
  for (const record of records) {
    for (const key of ["scope", "subject"]) {
      if (!hasOwn(record, key)) continue;
      const value = record[key];
      const nonEmptyUnusableArray = Array.isArray(value)
        && value.length > 0
        && normalizePublicTextList(value).length === 0;
      if (isTruncatedPublicTokenArray(value) || nonEmptyUnusableArray) {
        record[key] = [];
        changed = true;
      }
    }
  }
  return changed;
};

const repairField = (
  record: PublicDescriptionRecord,
  field: "description" | "summary",
  fallbacks: readonly unknown[],
  title: unknown,
  scopeSources: readonly unknown[],
  client: unknown,
): boolean => {
  if (!hasOwn(record, field)) return false;

  const original = record[field];
  const isTruncatedScopePrefix = scopeSources.some((scope) =>
    isPublicCandidateFromTruncatedArray(original, scope));
  const normalized = isTruncatedScopePrefix ? "" : pickValidatedPublicSummaryForTender(title, client, original);
  if (normalized) {
    if (typeof original === "string" && original === normalized) return false;
    record[field] = normalized;
    return true;
  }

  const sibling = field === "description" ? record.summary : record.description;
  const fallback = pickValidatedPublicSummaryForTender(title, client, ...fallbacks, sibling);
  if (fallback) {
    if (typeof original === "string" && original === fallback) return false;
    record[field] = fallback;
    return true;
  }

  delete record[field];
  return true;
};

/**
 * Repair only persisted public description fields. The caller supplies public
 * fallbacks from other already-extracted records; raw analysis text is not
 * accepted here and can therefore never become a public description.
 */
export const repairPublicDescriptionFields = (
  input: PublicDescriptionRecord,
  fallbacks: readonly string[] = [],
  title?: unknown,
  client?: unknown,
): PublicDescriptionRepair => {
  const record = { ...input };
  for (const key of ["decision_relevant", "decisionRelevant"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      record[key] = { ...(nested as PublicDescriptionRecord) };
    }
  }
  const scopeRecords = getScopeRecords(record);
  const scopeSources = getScopeSources(scopeRecords);
  const scopeChanged = clearInvalidScopeFields(scopeRecords);
  return {
    record,
    descriptionChanged: repairField(record, "description", fallbacks, title, scopeSources, client),
    summaryChanged: repairField(record, "summary", fallbacks, title, scopeSources, client),
    scopeChanged,
  };
};
