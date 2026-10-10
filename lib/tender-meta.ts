import {
  isCanonicalPublicDescriptionMarkdown,
  normalizePublicClient,
  pickValidatedPublicCandidate,
  pickValidatedPublicClient,
  pickValidatedPublicLocation,
  pickValidatedPublicLocationForTender,
  pickValidatedPublicProcedure,
  projectPublicDisplayFields,
} from "@/lib/public-content-quality";

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
  accessLimited: boolean;
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

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((u): u is string => typeof u === "string") : [];

const hasValue = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
};

const firstValue = (record: Record<string, unknown>, keys: string[]): unknown => {
  let fallback: unknown;
  for (const key of keys) {
    const value = record[key];
    if (fallback === undefined) fallback = value;
    if (hasValue(value)) return value;
  }
  return fallback;
};

const stringArrayFromKeys = (record: Record<string, unknown>, keys: string[]): string[] =>
  keys.flatMap((key) => asStringArray(record[key]))
    .filter((value, index, values) => values.indexOf(value) === index);

const recordFromValue = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const mergeRecords = (...values: unknown[]): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  for (const value of values) {
    for (const [key, candidate] of Object.entries(recordFromValue(value))) {
      const current = merged[key];
      const currentRecord = recordFromValue(current);
      const candidateRecord = recordFromValue(candidate);
      if (Object.keys(currentRecord).length > 0 && Object.keys(candidateRecord).length > 0) {
        merged[key] = mergeRecords(current, candidate);
      } else if (!(key in merged) || !hasValue(current)) {
        merged[key] = candidate;
      }
    }
  }
  return merged;
};

const metadataRecord = (metadataJson: unknown): Record<string, unknown> => {
  if (typeof metadataJson === "string") {
    try {
      const parsed = JSON.parse(metadataJson);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return typeof metadataJson === "object" && metadataJson !== null && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {};
};

/** Select public prose consistently from structured data and metadata. */
export const pickPublicTenderDescription = (sources: {
  structured?: unknown;
  metadata?: unknown | unknown[];
  fallbacks?: unknown[];
  /** Kept for call-site compatibility; raw analysis text is never public prose. */
  rawText?: unknown;
}): string => {
  return projectPublicDisplayFields({
    summary: [
      sources.structured,
      ...(sources.metadata === undefined
        ? []
        : Array.isArray(sources.metadata) ? sources.metadata : [sources.metadata]),
      ...(sources.fallbacks ?? []),
    ],
  }).description ?? "";
};

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
  const meta = metadataRecord(metadataJson);
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
  const hardFacts = mergeRecords(meta.hard_facts, meta.hardFacts);
  const procurement = recordFromValue(firstValue(meta, ["procurement"]));
  const descriptionMarkdownCandidate = [meta.descriptionMarkdown, meta.description_markdown]
    .find((value): value is string => isCanonicalPublicDescriptionMarkdown(value)) ?? "";
  return {
    description: pickPublicTenderDescription({ metadata: meta, rawText }),
    descriptionMarkdown: descriptionMarkdownCandidate,
    subject: pickValidatedPublicCandidate(meta.subject, meta.scope),
    client: normalizePublicClient(pickValidatedPublicClient(meta.client, meta.buyer, hardFacts.buyer, hardFacts.client)),
    location: pickValidatedPublicLocation(meta.location, meta.city, hardFacts.location, hardFacts.city),
    procedure: pickValidatedPublicProcedure(
      meta.procedure,
      meta.procedure_type,
      meta.procedureType,
      hardFacts.contract_type,
      hardFacts.contractType,
      procurement.procedure_type,
      procurement.procedureType,
    ),
    accessLimited: meta.access_limited === true || meta.accessLimited === true,
    referenceNumber: refTrimmed ? refTrimmed : null,
    pdfUrls: stringArrayFromKeys(meta, ["pdf_urls", "pdfUrls"]),
    resources,
    resourceCandidates,
    sourceUrl: asString(firstValue(meta, ["sourceUrl", "source_url"])),
  };
};

export const readPublicTenderMeta = (
  metadataJson: unknown,
  options: { title?: unknown; source?: string; sourceUrl?: string | null; rawText?: string | null } = {},
): TenderMeta => {
  const meta = readTenderMeta(metadataJson, options.rawText);
  const client = normalizePublicClient(meta.client);
  const display = projectPublicDisplayFields({
    title: options.title,
    client: [client, meta.client],
    location: [meta.location],
    summary: [meta.description],
    descriptionMarkdown: [meta.descriptionMarkdown],
  });
  return {
    ...meta,
    client: display.client ?? "",
    description: display.description ?? "",
    descriptionMarkdown: display.descriptionMarkdown ?? "",
    location: display.location ?? "",
  };
};

/** Read only the public client/location fields needed for sitemap taxonomy. */
export const readPublicTenderIndexMeta = (
  metadataJson: unknown,
  options: { title?: unknown; source?: string; sourceUrl?: string | null } = {},
): Pick<TenderMeta, "client" | "location"> => {
  const meta = metadataRecord(metadataJson);
  const hardFacts = mergeRecords(meta.hard_facts, meta.hardFacts);
  const client = normalizePublicClient(
    pickValidatedPublicClient(meta.client, meta.buyer, hardFacts.buyer, hardFacts.client),
  );
  const location = pickValidatedPublicLocation(meta.location, meta.city, hardFacts.location, hardFacts.city);
  const publicClient = normalizePublicClient(client);
  const displayTitle = pickValidatedPublicCandidate(options.title);
  const displayClient = pickValidatedPublicClient(publicClient, client);
  const displayLocation = pickValidatedPublicLocationForTender(displayTitle, displayClient, location);
  return {
    client: displayClient,
    location: displayLocation,
  };
};
