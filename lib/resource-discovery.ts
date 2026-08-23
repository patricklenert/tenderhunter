import { JSDOM } from "jsdom";
import { decodeHtmlEntities, repairKnownGermanEncoding } from "@/lib/text-normalization";
import { documentIdentityKey } from "@/lib/document-identity";
export { isPortalActionUrl } from "@/lib/resource-url";

const DEFAULT_MAX_RESOURCES = 500;
const DEFAULT_MAX_SUBPAGE_CANDIDATES = 20;
const MAX_URL_LENGTH = 8_192;
const MAX_TEXT_LENGTH = 500;
const MAX_HEADER_LENGTH = 2_000;

export type ResourceType =
  | "api"
  | "download"
  | "document"
  | "page"
  | "image"
  | "media"
  | "stylesheet"
  | "script"
  | "font"
  | "unknown";

export type ResourceSource = "anchor" | "button" | "form" | "iframe" | "source" | "link" | "network";

export type ResourceRoleHint =
  | "bekanntmachung"
  | "leistungsbeschreibung"
  | "leistungsverzeichnis"
  | "vergabeunterlagen"
  | "teilnahmeunterlagen"
  | "eignung"
  | "zuschlagskriterien"
  | "vertragsbedingungen"
  | "formblatt"
  | "anlage"
  | "nachtrag";

export interface DiscoveredResource {
  /** The resolved URL, with its fragment removed. */
  url: string;
  /** Stable URL used for deduplication. */
  canonicalUrl: string;
  /** The original DOM value when the resource came from a link-like element. */
  href: string;
  /** Visible link text or an accessible label. */
  text: string;
  /** Alias for text for callers that use resource labels. */
  label: string;
  source: ResourceSource;
  /** All sources that produced this canonical URL after deduplication. */
  sources: ResourceSource[];
  type: ResourceType;
  roleHints: ResourceRoleHint[];
  sameOrigin: boolean;
  attribute?: string;
  rel?: string;
  method?: string;
  status?: number;
  contentType?: string | null;
  contentDisposition?: string | null;
  resourceType?: string | null;
}

export interface StructuredLinkInput {
  href?: string | null;
  url?: string | null;
  src?: string | null;
  srcset?: string | null;
  action?: string | null;
  formAction?: string | null;
  dataHref?: string | null;
  dataUrl?: string | null;
  dataDownload?: string | null;
  text?: string | null;
  label?: string | null;
  title?: string | null;
  rel?: string | null;
  contentType?: string | null;
  contentDisposition?: string | null;
  resourceType?: string | null;
  source?: ResourceSource;
  attribute?: string;
  [key: string]: unknown;
}

export interface NetworkResponseMetadata {
  url: string;
  method: string;
  status: number;
  contentType: string | null;
  contentDisposition: string | null;
  resourceType: string | null;
  [key: string]: unknown;
}

export interface NetworkResponseMetadataInput {
  url?: string | null;
  method?: string | null;
  status?: number | null;
  contentType?: string | null;
  contentDisposition?: string | null;
  resourceType?: string | null;
  [key: string]: unknown;
}

export interface ResourceExtractionOptions {
  sameOriginOnly?: boolean;
  maxResources?: number;
}

export interface SubpageRankingOptions {
  baseUrl?: string;
  keywords?: string[];
  limit?: number;
  minScore?: number;
}

export interface RankedSubpageCandidate extends DiscoveredResource {
  score: number;
}

const ROLE_PATTERNS: Array<{ role: ResourceRoleHint; patterns: RegExp[] }> = [
  {
    role: "leistungsbeschreibung",
    patterns: [
      /leistungsbeschreibung/i,
      /leistungsumfang/i,
      /gegenstand\s+(?:der|des)\s+(?:ausschreibung|auftrags)/i,
      /auftragsgegenstand/i,
      /beschreibung\s+der\s+leistung/i,
    ],
  },
  {
    role: "leistungsverzeichnis",
    patterns: [/leistungsverzeichnis/i, /(?:^|[\s_-])lv(?:[\s_.-]|$)/i],
  },
  {
    role: "bekanntmachung",
    patterns: [/bekanntmachung/i, /ausschreibung/i, /vergabebekanntmachung/i, /notice/i],
  },
  {
    role: "vergabeunterlagen",
    patterns: [/vergabeunterlagen/i, /vergab[ae]unterlagen/i, /ausschreibungsunterlagen/i],
  },
  {
    role: "teilnahmeunterlagen",
    patterns: [/teilnahmeunterlagen/i, /teilnahmeantrag/i, /bewerbungsunterlagen/i],
  },
  {
    role: "eignung",
    patterns: [/eignung/i, /teilnahmebeding/i, /mindestanforder/i, /fachkunde/i, /referenz/i],
  },
  {
    role: "zuschlagskriterien",
    patterns: [/zuschlagskriter/i, /bewertung/i, /gewichtung/i, /angebotsbewert/i],
  },
  {
    role: "vertragsbedingungen",
    patterns: [/vertragsbeding/i, /vertragsentwurf/i, /lieferbeding/i, /nutzungsbeding/i],
  },
  {
    role: "formblatt",
    patterns: [/formblatt/i, /vordruck/i, /selbsterklaer/i, /mustervertrag/i],
  },
  {
    role: "anlage",
    patterns: [/anlage/i, /attachment/i, /skizze/i, /zeichnung/i],
  },
  {
    role: "nachtrag",
    patterns: [/nachtrag/i, /addendum/i, /rueckfrage/i, /faq/i],
  },
];

const DEFAULT_SUBPAGE_KEYWORDS = [
  "ausschreibung",
  "bekanntmachung",
  "vergabe",
  "unterlagen",
  "teilnahme",
  "leistungsbeschreibung",
  "leistungsverzeichnis",
  "tender",
  "notice",
  "procurement",
  "submission",
  "award",
  "document",
  "download",
];

const DOWNLOAD_PATH_PATTERN = /(?:^|\/)(?:download|downloads|attachment|attachments)(?:\/|$)/i;
const DOCUMENT_EXTENSION_PATTERN = /\.(?:pdf|doc|docx|odt|rtf|xls|xlsx|ods|csv|zip|rar|7z|txt)$/i;
const IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i;
const MEDIA_EXTENSION_PATTERN = /\.(?:m4a|mp3|mp4|mpeg|ogg|wav|webm)$/i;
const API_PATH_PATTERN = /(?:^|\/)(?:api|graphql|ajax|rest|_next\/data)(?:\/|$)/i;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const boundedText = (value: unknown): string =>
  repairKnownGermanEncoding(asString(value))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

const boundedHeader = (value: unknown): string | null => {
  const text = boundedText(value);
  return text ? text.slice(0, MAX_HEADER_LENGTH) : null;
};

const decodeUrlValue = (value: string): string => {
  try {
    return decodeHtmlEntities(value);
  } catch {
    return value;
  }
};

const getUrlOrigin = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = normalizeResourceUrl(value);
  if (!normalized) return null;
  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
};

/** Resolve a URL without allowing non-web schemes, fragments, or URL credentials through. */
export function normalizeResourceUrl(value: string | null | undefined, baseUrl?: string): string | null {
  if (typeof value !== "string") return null;

  const decoded = decodeUrlValue(value).trim();
  if (!decoded || decoded.startsWith("#") || decoded.length > MAX_URL_LENGTH) return null;

  const candidate = decoded.replace(/[\u0000-\u001f\u007f]/g, "");
  if (!candidate || /^(?!https?:)[a-z][a-z\d+.-]*:/i.test(candidate)) return null;

  let parsed: URL;
  try {
    parsed = baseUrl ? new URL(candidate, baseUrl) : new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  // A URL can carry credentials even though no request header is involved.
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return parsed.toString();
}

export const normalizeUrl = normalizeResourceUrl;

export function isSameOriginUrl(value: string, baseUrl: string): boolean {
  const resolved = normalizeResourceUrl(value, baseUrl);
  const baseOrigin = getUrlOrigin(baseUrl);
  if (!resolved || !baseOrigin) return false;

  try {
    return new URL(resolved).origin === baseOrigin;
  } catch {
    return false;
  }
}

export interface ResourceClassificationInput {
  url?: string | null;
  contentType?: string | null;
  contentDisposition?: string | null;
  resourceType?: string | null;
  source?: ResourceSource;
  rel?: string | null;
  attribute?: string | null;
}

const normalizedContentType = (value: string | null | undefined): string =>
  asString(value).toLowerCase().split(";", 1)[0].trim();

const getPathAndQuery = (value: string): { path: string; query: string } => {
  try {
    const parsed = new URL(value);
    return { path: parsed.pathname.toLowerCase(), query: parsed.search.toLowerCase() };
  } catch {
    return { path: value.toLowerCase(), query: "" };
  }
};

const isDocumentContentType = (contentType: string): boolean =>
  contentType === "application/pdf" ||
  contentType === "application/msword" ||
  contentType === "application/rtf" ||
  contentType === "text/csv" ||
  contentType === "application/vnd.ms-excel" ||
  contentType === "application/vnd.ms-powerpoint" ||
  contentType.startsWith("application/vnd.openxmlformats-officedocument.") ||
  contentType.startsWith("application/vnd.oasis.opendocument.");

const isApiContentType = (contentType: string): boolean =>
  contentType === "application/json" ||
  contentType.endsWith("+json") ||
  contentType === "text/json" ||
  contentType === "application/graphql" ||
  contentType === "text/event-stream";

/** Classify a resource from URL, response metadata, and its DOM source. */
export function classifyResourceType(
  input: ResourceClassificationInput | string,
  metadata?: Omit<ResourceClassificationInput, "url">,
): ResourceType {
  const details: ResourceClassificationInput = typeof input === "string" ? { ...metadata, url: input } : input;
  const url = asString(details.url);
  const { path, query } = getPathAndQuery(url);
  const contentType = normalizedContentType(details.contentType);
  const disposition = asString(details.contentDisposition).toLowerCase();
  const rawResourceType = asString(details.resourceType).toLowerCase();
  const rel = asString(details.rel).toLowerCase();
  const attribute = asString(details.attribute).toLowerCase();

  if (rawResourceType === "stylesheet" || contentType === "text/css" || rel.includes("stylesheet")) return "stylesheet";
  if (rawResourceType === "script" || contentType.includes("javascript") || /\.m?js$/i.test(path)) return "script";
  if (rawResourceType === "font" || contentType.startsWith("font/") || /\.(?:woff2?|ttf|otf|eot)$/i.test(path)) return "font";
  if (rawResourceType === "image" || contentType.startsWith("image/") || IMAGE_EXTENSION_PATTERN.test(path)) return "image";
  if (rawResourceType === "media" || ["audio", "video"].includes(rawResourceType) || contentType.startsWith("audio/") || contentType.startsWith("video/") || MEDIA_EXTENSION_PATTERN.test(path)) return "media";

  const isDownloadUrl = attribute === "data-download" || DOWNLOAD_PATH_PATTERN.test(path) || /(?:^|[?&])(download|attachment)(?:=|&|$)/i.test(query);
  if (isDownloadUrl || /\battachment\b/i.test(disposition)) return "download";

  if (isApiContentType(contentType) || API_PATH_PATTERN.test(path) || path.endsWith(".json") || ["xhr", "fetch", "eventsource"].includes(rawResourceType)) {
    return "api";
  }

  if (isDocumentContentType(contentType) || DOCUMENT_EXTENSION_PATTERN.test(path)) return "document";
  if (contentType === "application/octet-stream") return "download";
  if (contentType === "text/html" || contentType === "application/xhtml+xml" || rawResourceType === "document") return "page";

  if (details.source === "iframe" || details.source === "form" || details.source === "anchor" || details.source === "button" || details.source === "link") {
    return "page";
  }

  return "unknown";
}

export function assignRoleHints(input: string | { label?: string | null; text?: string | null; url?: string | null }): ResourceRoleHint[] {
  const haystack = typeof input === "string" ? input : `${asString(input.label)} ${asString(input.text)} ${asString(input.url)}`;
  const normalized = haystack.toLowerCase().replace(/[_.\-/]+/g, " ");
  return ROLE_PATTERNS.filter(({ patterns }) => patterns.some((pattern) => pattern.test(normalized))).map(({ role }) => role);
}

const isResourceSource = (value: unknown): value is ResourceSource =>
  ["anchor", "button", "form", "iframe", "source", "link", "network"].includes(value as string);

const inputValue = (input: StructuredLinkInput, key: string): string => {
  const value = input[key];
  return typeof value === "string" ? value : "";
};

const isBooleanDataAttribute = (name: string, value: string): boolean =>
  name === "data-download" && /^(?:true|false|0|1)$/i.test(value.trim());

const splitSrcset = (value: string): string[] =>
  value
    .split(",")
    .map((part) => part.trim().split(/\s+/, 1)[0])
    .filter(Boolean);

const linkValues = (input: StructuredLinkInput): Array<{ value: string; attribute: string }> => {
  const values: Array<{ value: string; attribute: string }> = [];
  const attributes = [
    "href",
    "url",
    "src",
    "action",
    "formAction",
    "dataHref",
    "dataUrl",
    "dataDownload",
  ];

  for (const attribute of attributes) {
    const value = inputValue(input, attribute) || inputValue(input, attribute.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`));
    if (value && !isBooleanDataAttribute(attribute.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`), value)) {
      const normalizedAttribute = attribute === "dataDownload"
        ? "data-download"
        : attribute === "dataHref"
          ? "data-href"
          : attribute === "dataUrl"
            ? "data-url"
            : attribute;
      values.push({ value, attribute: normalizedAttribute });
    }
  }

  const srcset = inputValue(input, "srcset") || inputValue(input, "data-srcset");
  for (const value of splitSrcset(srcset)) values.push({ value, attribute: "srcset" });
  return values;
};

const maxCount = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1_000, Math.floor(value as number)));
};

const makeResource = (
  input: StructuredLinkInput,
  rawHref: string,
  baseUrl: string,
): DiscoveredResource | null => {
  const url = normalizeResourceUrl(rawHref, baseUrl);
  if (!url) return null;

  const source = isResourceSource(input.source) ? input.source : "anchor";
  const text = boundedText(input.text || input.label || input.title);
  const label = text;
  const contentType = boundedHeader(input.contentType ?? input["content-type"]);
  const contentDisposition = boundedHeader(input.contentDisposition ?? input["content-disposition"]);
  const resourceType = boundedHeader(input.resourceType);
  const type = classifyResourceType({
    url,
    contentType,
    contentDisposition,
    resourceType,
    source,
    rel: input.rel,
    attribute: input.attribute,
  });
  const canonicalUrl = documentIdentityKey({ url, contentType, resourceType: type }) ?? url;

  return {
    url,
    canonicalUrl,
    href: rawHref.slice(0, MAX_URL_LENGTH),
    text,
    label,
    source,
    sources: [source],
    type,
    roleHints: assignRoleHints({ label, text, url }),
    sameOrigin: isSameOriginUrl(url, baseUrl),
    attribute: input.attribute,
    rel: boundedText(input.rel) || undefined,
    method: boundedText(input.method).toUpperCase() || undefined,
    status: typeof input.status === "number" && Number.isFinite(input.status) ? input.status : undefined,
    contentType,
    contentDisposition,
    resourceType,
  };
};

const resourceTypePriority: Record<ResourceType, number> = {
  unknown: 0,
  page: 1,
  image: 2,
  media: 2,
  stylesheet: 2,
  script: 2,
  font: 2,
  api: 3,
  document: 4,
  download: 5,
};

const mergeResource = (first: DiscoveredResource, next: DiscoveredResource): DiscoveredResource => {
  const sources = [...first.sources];
  for (const source of next.sources) {
    if (!sources.includes(source)) sources.push(source);
  }

  const roleHints = [...first.roleHints];
  for (const role of next.roleHints) {
    if (!roleHints.includes(role)) roleHints.push(role);
  }

  return {
    ...first,
    type: resourceTypePriority[next.type] > resourceTypePriority[first.type] ? next.type : first.type,
    sources,
    roleHints,
    sameOrigin: first.sameOrigin && next.sameOrigin,
    label: first.label || next.label,
    text: first.text || next.text,
    rel: first.rel || next.rel,
    method: first.method || next.method,
    status: first.status ?? next.status,
    contentType: first.contentType || next.contentType,
    contentDisposition: first.contentDisposition || next.contentDisposition,
    resourceType: first.resourceType || next.resourceType,
  };
};

/** Deduplicate resources by their normalized canonical URL while preserving input order. */
export function deduplicateResources(resources: ReadonlyArray<DiscoveredResource>): DiscoveredResource[] {
  const byUrl = new Map<string, DiscoveredResource>();
  for (const resource of resources) {
    const existing = byUrl.get(resource.canonicalUrl);
    byUrl.set(resource.canonicalUrl, existing ? mergeResource(existing, resource) : resource);
  }
  return [...byUrl.values()];
}

export function mergeDiscoveredResources(...groups: ReadonlyArray<DiscoveredResource>[]): DiscoveredResource[] {
  return deduplicateResources(groups.flat());
}

/** Convert structured DOM-like links into safe, typed resources. */
export function extractResourcesFromLinks(
  links: ReadonlyArray<StructuredLinkInput>,
  baseUrl: string,
  options?: ResourceExtractionOptions,
): DiscoveredResource[] {
  const normalizedBase = normalizeResourceUrl(baseUrl);
  if (!normalizedBase) return [];

  const resources: DiscoveredResource[] = [];
  const maxResources = maxCount(options?.maxResources, DEFAULT_MAX_RESOURCES);
  for (const link of links) {
    for (const { value, attribute } of linkValues(link)) {
      const resource = makeResource({ ...link, attribute }, value, normalizedBase);
      if (!resource || (options?.sameOriginOnly && !resource.sameOrigin)) continue;
      resources.push(resource);
    }
  }

  return deduplicateResources(resources).slice(0, maxResources);
}

const elementText = (element: Element): string => {
  for (const value of [
    element.textContent,
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("alt"),
  ]) {
    const text = boundedText(value);
    if (text) return text;
  }
  return "";
};

const elementLinks = (
  document: Document,
  selector: string,
  source: ResourceSource,
  attributes: string[],
): StructuredLinkInput[] => {
  const links: StructuredLinkInput[] = [];
  for (const element of Array.from(document.querySelectorAll(selector))) {
    const text = elementText(element);
    const common: StructuredLinkInput = {
      text,
      rel: element.getAttribute("rel"),
      contentType: element.getAttribute("type"),
      source,
    };

    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const link: StructuredLinkInput = { ...common, attribute };
      if (attribute === "srcset") link.srcset = value;
      else if (attribute === "href") link.href = value;
      else if (attribute === "action") link.action = value;
      else if (attribute === "formaction") link.formAction = value;
      else if (attribute === "data-href") link.dataHref = value;
      else if (attribute === "data-url") link.dataUrl = value;
      else if (attribute === "data-download") link.dataDownload = value;
      else if (attribute === "src" || attribute === "data-src") link.src = value;
      else link.href = value;
      links.push(link);
    }
  }
  return links;
};

/** Extract the requested link-like DOM values without executing page JavaScript. */
export function extractStructuredLinksFromHtml(html: string, baseUrl: string): StructuredLinkInput[] {
  const normalizedBase = normalizeResourceUrl(baseUrl);
  if (!normalizedBase || typeof html !== "string") return [];

  let document: Document;
  try {
    document = new JSDOM(html, { url: normalizedBase }).window.document;
  } catch {
    return [];
  }

  return [
    ...elementLinks(document, "a", "anchor", ["href", "data-href", "data-url", "data-download"]),
    ...elementLinks(document, "button", "button", ["href", "formaction", "data-href", "data-url", "data-download"]),
    ...elementLinks(document, "input", "button", ["formaction", "data-href", "data-url", "data-download"]),
    ...elementLinks(document, "form", "form", ["action", "data-href", "data-url", "data-download"]),
    ...elementLinks(document, "iframe", "iframe", ["src", "data-src", "data-href", "data-url"]),
    ...elementLinks(document, "source", "source", ["src", "srcset", "data-src", "data-href", "data-url"]),
    ...elementLinks(document, "link", "link", ["href", "data-href", "data-url"]),
  ];
}

export function extractResourcesFromHtml(
  html: string,
  baseUrl: string,
  options?: ResourceExtractionOptions,
): DiscoveredResource[] {
  return extractResourcesFromLinks(extractStructuredLinksFromHtml(html, baseUrl), baseUrl, options);
}

const networkValue = (input: NetworkResponseMetadataInput, camelCase: string, kebabCase: string): unknown =>
  input[camelCase] ?? input[kebabCase];

/** Normalize the small, non-sensitive metadata subset retained for a network response. */
export function normalizeNetworkResponseMetadata(
  input: NetworkResponseMetadataInput,
  baseUrl?: string,
): NetworkResponseMetadata | null {
  const urlValue = networkValue(input, "url", "url");
  const url = normalizeResourceUrl(typeof urlValue === "string" ? urlValue : null, baseUrl);
  if (!url) return null;

  const methodValue = networkValue(input, "method", "method");
  const statusValue = networkValue(input, "status", "status");
  const resourceTypeValue = networkValue(input, "resourceType", "resource-type");
  const status = typeof statusValue === "number" && Number.isFinite(statusValue) ? Math.trunc(statusValue) : 0;

  return {
    url,
    method: (boundedText(methodValue).toUpperCase() || "GET").slice(0, 32),
    status,
    contentType: boundedHeader(networkValue(input, "contentType", "content-type")),
    contentDisposition: boundedHeader(networkValue(input, "contentDisposition", "content-disposition")),
    resourceType: boundedHeader(resourceTypeValue),
  };
}

export function isCapturableNetworkResponse(input: NetworkResponseMetadataInput): boolean {
  const normalized = normalizeNetworkResponseMetadata(input);
  if (!normalized) return false;
  const type = classifyResourceType(normalized);
  return type === "api" || type === "document" || type === "download" || (type === "page" && normalized.resourceType === "document");
}

export function extractResourcesFromNetworkMetadata(
  metadata: ReadonlyArray<NetworkResponseMetadataInput>,
  baseUrl: string,
  options?: ResourceExtractionOptions,
): DiscoveredResource[] {
  const normalizedBase = normalizeResourceUrl(baseUrl);
  if (!normalizedBase) return [];

  const resources: DiscoveredResource[] = [];
  const maxResources = maxCount(options?.maxResources, DEFAULT_MAX_RESOURCES);
  for (const item of metadata) {
    const response = normalizeNetworkResponseMetadata(item, normalizedBase);
    if (!response || (options?.sameOriginOnly !== false && !isSameOriginUrl(response.url, normalizedBase))) continue;
    if (!isCapturableNetworkResponse(response)) continue;

    const resource = makeResource(
      {
        href: response.url,
        text: "",
        label: "",
        source: "network",
        contentType: response.contentType,
        contentDisposition: response.contentDisposition,
        resourceType: response.resourceType,
        method: response.method,
        status: response.status,
      },
      response.url,
      normalizedBase,
    );
    if (resource) resources.push(resource);
  }

  return deduplicateResources(resources).slice(0, maxResources);
}

export const extractResourcesFromNetworkResponses = extractResourcesFromNetworkMetadata;

type ResourceCandidateInput = DiscoveredResource | StructuredLinkInput | string;

const isDiscoveredResource = (candidate: DiscoveredResource | StructuredLinkInput): candidate is DiscoveredResource =>
  typeof candidate.url === "string" &&
  typeof candidate.canonicalUrl === "string" &&
  Array.isArray(candidate.roleHints) &&
  Array.isArray(candidate.sources);

const asCandidateResource = (candidate: ResourceCandidateInput, baseUrl: string): DiscoveredResource | null => {
  if (typeof candidate === "string") {
    return extractResourcesFromLinks([{ href: candidate, source: "anchor" }], baseUrl, { maxResources: 1 })[0] ?? null;
  }

  if (isDiscoveredResource(candidate)) {
    return { ...candidate, sameOrigin: isSameOriginUrl(candidate.url, baseUrl) };
  }

  return extractResourcesFromLinks([candidate], baseUrl, { maxResources: 1 })[0] ?? null;
};

const scoreSubpage = (resource: DiscoveredResource, keywords: string[]): number => {
  const labelText = `${resource.label} ${resource.text}`.toLowerCase();
  const urlText = resource.url.toLowerCase();
  const roles = resource.roleHints.join(" ");
  let score = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) continue;
    if (labelText.includes(normalizedKeyword)) score += 5;
    if (urlText.includes(normalizedKeyword)) score += 3;
    if (roles.includes(normalizedKeyword)) score += 2;
  }

  return score;
};

/** Return a bounded, deterministic list of same-origin page candidates likely to contain tender details. */
export function rankSubpageCandidates(
  candidates: ReadonlyArray<ResourceCandidateInput>,
  options?: SubpageRankingOptions,
): RankedSubpageCandidate[] {
  const explicitBase = options?.baseUrl ? normalizeResourceUrl(options.baseUrl) : null;
  const inferredBase = explicitBase ?? candidates
    .map((candidate) => (typeof candidate === "string" ? normalizeResourceUrl(candidate) : normalizeResourceUrl(candidate.url)))
    .find((value): value is string => Boolean(value));
  if (!inferredBase) return [];

  const keywords = (options?.keywords?.length ? options.keywords : DEFAULT_SUBPAGE_KEYWORDS)
    .map((keyword) => boundedText(keyword).toLowerCase())
    .filter(Boolean)
    .slice(0, 64);
  const minScore = Number.isFinite(options?.minScore) ? (options?.minScore as number) : 1;
  const limit = maxCount(options?.limit, DEFAULT_MAX_SUBPAGE_CANDIDATES);
  const resources = deduplicateResources(
    candidates
      .map((candidate) => asCandidateResource(candidate, inferredBase))
      .filter((resource): resource is DiscoveredResource => Boolean(resource))
      .filter((resource) => resource.sameOrigin)
      .filter((resource) => resource.url !== inferredBase)
      .filter((resource) => resource.type === "page" || resource.type === "unknown"),
  );

  return resources
    .map((resource) => ({ ...resource, score: scoreSubpage(resource, keywords) }))
    .filter((resource) => resource.score >= minScore)
    .sort((left, right) => right.score - left.score || left.canonicalUrl.localeCompare(right.canonicalUrl))
    .slice(0, limit);
}

export const rankSubpages = rankSubpageCandidates;
