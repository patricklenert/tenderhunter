import { pickPublicDescription } from "@/lib/public-tender-scraper";

// The public scraper stores metadata in snake_case (lib/pipeline.ts:1745-1753).
// Legacy/cached paths and the structured-data blob may use camelCase.
// These helpers read both canonically so callers don't need to guess.

export interface TenderMeta {
  description: string;
  client: string;
  location: string;
  referenceNumber: string | null;
  pdfUrls: string[];
  sourceUrl: string;
}

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((u): u is string => typeof u === "string") : [];

export const readTenderMeta = (
  metadataJson: unknown,
  rawText?: string | null,
): TenderMeta => {
  const meta = (typeof metadataJson === "object" && metadataJson !== null
    ? metadataJson
    : {}) as Record<string, unknown>;
  const refNum = meta.reference_number ?? meta.referenceNumber;
  const refTrimmed = typeof refNum === "string" ? refNum.trim() : "";
  return {
    description: pickPublicDescription(meta.description, rawText),
    client: asString(meta.client),
    location: asString(meta.location),
    referenceNumber: refTrimmed ? refTrimmed : null,
    pdfUrls: asStringArray(meta.pdf_urls ?? meta.pdfUrls),
    sourceUrl: asString(meta.sourceUrl),
  };
};
