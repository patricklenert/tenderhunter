import {
  isCanonicalPublicDescriptionMarkdown,
  pickValidatedPublicSummaryForTitle,
} from "./public-content-quality";
import { hasPositiveAccessLimitedEvidence } from "./access-page-detector";

export type PublicDescriptionRecord = Record<string, unknown>;

export interface PublicDescriptionRepair {
  record: PublicDescriptionRecord;
  descriptionChanged: boolean;
  summaryChanged: boolean;
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

const repairField = (
  record: PublicDescriptionRecord,
  field: "description" | "summary",
  fallbacks: readonly unknown[],
  title: unknown,
): boolean => {
  if (!hasOwn(record, field)) return false;

  const original = record[field];
  const normalized = pickValidatedPublicSummaryForTitle(title, original);
  if (normalized) {
    if (typeof original === "string" && original === normalized) return false;
    record[field] = normalized;
    return true;
  }

  const sibling = field === "description" ? record.summary : record.description;
  const fallback = pickValidatedPublicSummaryForTitle(title, ...fallbacks, sibling);
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
): PublicDescriptionRepair => {
  const record = { ...input };
  return {
    record,
    descriptionChanged: repairField(record, "description", fallbacks, title),
    summaryChanged: repairField(record, "summary", fallbacks, title),
  };
};
