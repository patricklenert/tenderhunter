import { normalizePublicTextList } from "@/lib/public-content-quality";

const recordValue = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const hasSufficientNestedCachedDetail = (value: unknown): boolean => {
  const blob = recordValue(value);
  const hardFacts = recordValue(blob?.hard_facts);
  const decisionRelevant = recordValue(blob?.decision_relevant);
  return Boolean(
    hardFacts?.deadline
      && decisionRelevant
      && normalizePublicTextList(decisionRelevant.scope).length > 0,
  );
};

export const mergeCacheDetailDescription = (
  existingDescription: string,
  existingSummary: unknown,
  incomingDescription: string,
): { description: string; summary: unknown; updated: boolean } => {
  const incomingWins = incomingDescription.length > 20
    && incomingDescription.length < 5_000
    && incomingDescription.length > existingDescription.length;
  if (incomingWins) {
    return {
      description: incomingDescription,
      summary: incomingDescription.slice(0, 3_000),
      updated: true,
    };
  }
  return { description: existingDescription, summary: existingSummary, updated: false };
};
