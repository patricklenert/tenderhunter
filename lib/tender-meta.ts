import { pickPublicDescription } from "@/lib/public-tender-scraper";

// The public scraper stores metadata in snake_case (lib/pipeline.ts:1745-1753).
// Legacy/cached paths and the structured-data blob may use camelCase.
// These helpers read both canonically so callers don't need to guess.

export interface TenderMeta {
  description: string;
  descriptionMarkdown: string;
  subject: string;
  client: string;
  location: string;
  procedure: string;
  referenceNumber: string | null;
  pdfUrls: string[];
  resources: TenderResourceMeta[];
  resourceCandidates: TenderResourceMeta[];
  sourceUrl: string;
}

export interface TenderResourceMeta {
  url: string;
  canonicalUrl: string;
  label: string;
  text: string;
  type: string | null;
  resourceType: string | null;
  roleHints: string[];
  source: string | null;
  filename: string | null;
  sourcePageUrl: string | null;
  discoveryMethod: string | null;
  method: string | null;
  status: string | number | null;
  sameOrigin: boolean | null;
  contentType: string | null;
  contentDisposition: string | null;
}

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((u): u is string => typeof u === "string") : [];

const optionalString = (value: unknown): string | null => {
  const result = asString(value).trim();
  return result || null;
};

const resourceFromValue = (value: unknown): TenderResourceMeta | null => {
  const record = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const url = optionalString(typeof value === "string" ? value : record.url ?? record.href ?? record.canonicalUrl ?? record.canonical_url);
  if (!url) return null;

  const label = optionalString(record.label ?? record.text ?? record.linkText ?? record.link_text ?? record.title) ?? "";
  const text = optionalString(record.text ?? record.label) ?? "";
  const roleHints = asStringArray(record.roleHints ?? record.role_hints)
    .map((role) => role.trim())
    .filter(Boolean);
  const rawStatus = record.status;
  const status = typeof rawStatus === "string" || typeof rawStatus === "number" ? rawStatus : null;

  return {
    url,
    canonicalUrl: optionalString(record.canonicalUrl ?? record.canonical_url) ?? url,
    label,
    text,
    type: optionalString(record.type),
    resourceType: optionalString(record.resourceType ?? record.resource_type ?? record["resource-type"]),
    roleHints: roleHints.filter((role, index) => roleHints.indexOf(role) === index),
    source: optionalString(record.source),
    filename: optionalString(record.filename),
    sourcePageUrl: optionalString(record.sourcePageUrl ?? record.source_page_url),
    discoveryMethod: optionalString(record.discoveryMethod ?? record.discovery_method),
    method: optionalString(record.method),
    status,
    sameOrigin: typeof record.sameOrigin === "boolean" ? record.sameOrigin : null,
    contentType: optionalString(record.contentType ?? record.content_type),
    contentDisposition: optionalString(record.contentDisposition ?? record.content_disposition),
  };
};

const mergeResourceMeta = (first: TenderResourceMeta, next: TenderResourceMeta): TenderResourceMeta => ({
  ...first,
  canonicalUrl: first.canonicalUrl || next.canonicalUrl,
  label: first.label || next.label,
  text: first.text || next.text,
  type: first.type || next.type,
  resourceType: first.resourceType || next.resourceType,
  roleHints: [...first.roleHints, ...next.roleHints].filter((role, index, roles) => roles.indexOf(role) === index),
  source: first.source || next.source,
  filename: first.filename || next.filename,
  sourcePageUrl: first.sourcePageUrl || next.sourcePageUrl,
  discoveryMethod: first.discoveryMethod || next.discoveryMethod,
  method: first.method || next.method,
  status: first.status ?? next.status,
  sameOrigin: first.sameOrigin ?? next.sameOrigin,
  contentType: first.contentType || next.contentType,
  contentDisposition: first.contentDisposition || next.contentDisposition,
});

const readResourceArray = (meta: Record<string, unknown>, keys: string[]): TenderResourceMeta[] => {
  const resources: TenderResourceMeta[] = [];
  const byUrl = new Map<string, TenderResourceMeta>();
  for (const key of keys) {
    if (!Array.isArray(meta[key])) continue;
    for (const value of meta[key]) {
      const resource = resourceFromValue(value);
      if (!resource) continue;
      const existing = byUrl.get(resource.canonicalUrl) ?? byUrl.get(resource.url);
      if (existing) {
        const merged = mergeResourceMeta(existing, resource);
        byUrl.set(existing.canonicalUrl, merged);
        byUrl.set(existing.url, merged);
        const index = resources.indexOf(existing);
        if (index >= 0) resources[index] = merged;
      } else {
        byUrl.set(resource.canonicalUrl, resource);
        byUrl.set(resource.url, resource);
        resources.push(resource);
      }
    }
  }
  return resources;
};

export const readTenderMeta = (
  metadataJson: unknown,
  rawText?: string | null,
): TenderMeta => {
  const meta = typeof metadataJson === "string"
    ? (() => {
      try {
        const parsed = JSON.parse(metadataJson);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : {};
      } catch {
        return {};
      }
    })()
    : (typeof metadataJson === "object" && metadataJson !== null && !Array.isArray(metadataJson)
      ? metadataJson
      : {}) as Record<string, unknown>;
  const refNum = meta.reference_number ?? meta.referenceNumber;
  const refTrimmed = typeof refNum === "string" ? refNum.trim() : "";
  const resources = readResourceArray(meta, ["resources"]);
  const resourceCandidates = readResourceArray(meta, [
    "resources",
    "resource_candidates",
    "resourceCandidates",
    "subpage_candidates",
    "subpageCandidates",
  ]);
  return {
    description: pickPublicDescription(meta.description, rawText),
    descriptionMarkdown: firstString(meta.descriptionMarkdown, meta.description_markdown),
    subject: asString(meta.subject ?? meta.scope),
    client: asString(meta.client),
    location: asString(meta.location),
    procedure: asString(meta.procedure ?? meta.procedure_type),
    referenceNumber: refTrimmed ? refTrimmed : null,
    pdfUrls: asStringArray(meta.pdf_urls ?? meta.pdfUrls),
    resources,
    resourceCandidates,
    sourceUrl: asString(meta.sourceUrl ?? meta.source_url),
  };
};
