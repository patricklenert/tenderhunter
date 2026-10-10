const DOCUMENT_EXTENSION_PATTERN = /\.(?:pdf|doc|docx|odt|rtf|xls|xlsx|ods|csv|zip|rar|7z|txt)(?:$|[?#])/i;
const HTML_CONTENT_TYPE_PATTERN = /^(?:text\/html|application\/xhtml\+xml)\b/i;

export const isHtmlContentType = (value: unknown): boolean =>
  typeof value === "string" && HTML_CONTENT_TYPE_PATTERN.test(value.trim());

export const isHtmlDocumentResource = (input: {
  contentType?: unknown;
  resourceType?: unknown;
}): boolean => {
  const resourceType = typeof input.resourceType === "string" ? input.resourceType.trim().toLowerCase() : "";
  return ["document", "download"].includes(resourceType) && isHtmlContentType(input.contentType);
};

export interface DocumentIdentityInput {
  url?: string | null;
  filename?: string | null;
  contentType?: string | null;
  resourceType?: string | null;
}

const isPageLike = (input: DocumentIdentityInput, pathname: string): boolean => {
  const contentType = input.contentType ?? "";
  if (isHtmlContentType(contentType)) return true;
  if (["page", "api"].includes((input.resourceType ?? "").toLowerCase())) return true;
  if (["document", "download"].includes((input.resourceType ?? "").toLowerCase())) return false;
  if (DOCUMENT_EXTENSION_PATTERN.test(pathname)) return false;
  if (input.filename && DOCUMENT_EXTENSION_PATTERN.test(input.filename)) return false;
  return true;
};

/** Stable identity for a displayed document, ignoring portal page-state queries. */
export function documentIdentityKey(input: DocumentIdentityInput): string | null {
  if (typeof input.url !== "string" || !input.url.trim()) return null;
  const normalized = input.url.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    if (isPageLike(input, parsed.pathname)) parsed.search = "";
    return parsed.toString();
  } catch {
    return normalized.split("#", 1)[0];
  }
}

export interface DocumentIdentityRow extends DocumentIdentityInput {
  id: number;
  role?: string | null;
  roles?: unknown;
  roleHints?: unknown;
  roleSource?: string | null;
  roleConfidence?: number | null;
  downloadStatus?: string | null;
  parseStatus?: string | null;
  errorMessage?: string | null;
  extractedText?: string | null;
  aiSummary?: string | null;
  pageCount?: number | null;
}

const statusRank = (row: DocumentIdentityRow): number => {
  if (row.downloadStatus === "downloaded" && row.parseStatus === "parsed") return 4;
  if (row.downloadStatus === "downloaded") return 3;
  if (row.parseStatus === "parsed") return 2;
  if (row.downloadStatus === "failed" || row.parseStatus === "failed") return 0;
  return 1;
};

const mergeArrayValues = (first: unknown, second: unknown): unknown => {
  const values = [
    ...(Array.isArray(first) ? first : []),
    ...(Array.isArray(second) ? second : []),
  ];
  return values.filter((value, index) => values.indexOf(value) === index);
};

/** Collapse page/query duplicates while retaining the strongest row and its role hints. */
export function deduplicateDocumentRows<T extends DocumentIdentityRow>(rows: readonly T[]): T[] {
  const byIdentity = new Map<string, T>();
  for (const row of rows) {
    const key = documentIdentityKey(row) ?? `id:${row.id}`;
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, row);
      continue;
    }

    const preferred = statusRank(row) > statusRank(existing)
      ? row
      : statusRank(row) === statusRank(existing) && row.id < existing.id
        ? row
        : existing;
    const secondary = preferred === existing ? row : existing;
    const merged = { ...preferred } as T & Record<string, unknown>;
    if ("roles" in preferred || "roles" in secondary) merged.roles = mergeArrayValues(preferred.roles, secondary.roles);
    if ("roleHints" in preferred || "roleHints" in secondary) merged.roleHints = mergeArrayValues(preferred.roleHints, secondary.roleHints);
    for (const field of ["roleSource", "roleConfidence", "pageCount", "aiSummary", "errorMessage", "extractedText"] as const) {
      if (!merged[field] && secondary[field]) merged[field] = secondary[field] as never;
    }
    if ((!merged.role || merged.role === "other") && secondary.role && secondary.role !== "other") merged.role = secondary.role;
    byIdentity.set(key, merged);
  }
  return [...byIdentity.values()];
}
