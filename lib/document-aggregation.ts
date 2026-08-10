import { createHash } from "node:crypto";
import type { DocumentRole } from "@/lib/schema";
import { decodeHtmlEntities } from "@/lib/text-normalization";

export interface ParsedTenderDocument {
  id: number;
  role: DocumentRole;
  roles: DocumentRole[];
  text: string;
}

const documentFingerprint = (text: string): string => createHash("sha256")
  .update(decodeHtmlEntities(text).replace(/\s+/g, " ").trim())
  .digest("hex");

/** Keep one parsed copy when a portal exposes the same document more than once. */
export const deduplicateParsedDocuments = <T extends ParsedTenderDocument>(documents: T[]): T[] => {
  const seen = new Set<string>();
  return documents.filter((document) => {
    const fingerprint = documentFingerprint(document.text);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
};
