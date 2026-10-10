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
  const byFingerprint = new Map<string, T>();
  for (const document of documents) {
    const fingerprint = documentFingerprint(document.text);
    const existing = byFingerprint.get(fingerprint);
    if (!existing) {
      byFingerprint.set(fingerprint, document);
      continue;
    }

    const mergedRoles = [...existing.roles, ...document.roles]
      .filter((role, index, roles) => roles.indexOf(role) === index);
    byFingerprint.set(fingerprint, {
      ...existing,
      roles: mergedRoles,
      role: existing.role === "other" && document.role !== "other" ? document.role : existing.role,
    });
  }
  return [...byFingerprint.values()];
};
