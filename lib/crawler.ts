import * as cheerio from "cheerio";
import { scrapeWebsite } from "@/lib/firecrawl";
import { isSameOriginUrl, normalizeResourceUrl, rankSubpageCandidates, type DiscoveredResource } from "@/lib/resource-discovery";
import { getTenderSourceDefinition, resolveSourceItem } from "@/lib/tender-sources";
import type { SourceItem } from "@/lib/types";

const TENDER_KEYWORDS = ["ausschreibung", "bekanntmachung", "vergabe", "tender", "procurement", "notice"];
const NON_DETAIL_PATHS = /(?:^|\/)(?:about|contact|datenschutz|impressum|privacy|terms|faq|help|login|register|search|results?|listing|overview|uebersicht|sitemap|news)(?:\/|$)/i;
const DETAIL_PATHS = /(?:^|\/)(?:detail|notice|project|tender|procurement|ausschreibung|bekanntmachung|vergabe)(?:\/|$)/i;
const DETAIL_QUERY_KEYS = /^(?:id|nid|pid|oid|notice(?:-?id)?|project(?:-?id)?|tender(?:-?id)?|verfahren|guid)$/i;
const MAX_RENDERED_CANDIDATES = 40;
const MAX_RENDERED_SUBPAGE_CANDIDATES = 12;

interface DiscoveryRules {
  includeHref: RegExp[];
  includeText?: RegExp[];
  excludeHref?: RegExp[];
  seedPaths?: string[];
  extractExternalId?: (url: URL, label: string) => string | null;
}

export interface DiscoveredTender {
  source: string;
  sourceKey?: string;
  url: string;
  title: string;
  externalId?: string | null;
}

const toAbsoluteUrl = (href: string, baseUrl: string): string | null => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
};

const fetchHtml = async (url: string): Promise<{ html: string; title: string }> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Quelle nicht erreichbar (${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  return { html, title: $("title").text().trim() || url };
};

const pushDiscoveredTender = (
  results: DiscoveredTender[],
  seen: Set<string>,
  source: SourceItem,
  url: string,
  title: string,
  externalId?: string | null,
) => {
  if (seen.has(url)) {
    return;
  }

  seen.add(url);
  results.push({
    source: source.name ?? source.url,
    sourceKey: source.key,
    url,
    title: title.slice(0, 300),
    externalId: externalId ?? null,
  });
};

const resourceLabel = (resource: DiscoveredResource): string => resource.label || resource.text || resource.url;

/**
 * Rendered pages often expose both a listing route and actual detail routes.
 * Keep only same-origin candidates with a detail signal so the source homepage
 * is never persisted as a tender merely because it rendered successfully.
 */
export const isLikelyTenderDetailUrl = (candidateUrl: string, label: string, sourceUrl: string): boolean => {
  const normalized = normalizeResourceUrl(candidateUrl, sourceUrl);
  const source = normalizeResourceUrl(sourceUrl);
  if (!normalized || !source || !isSameOriginUrl(normalized, source) || normalized === source) return false;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return false;
  }

  const text = `${label} ${parsed.pathname} ${parsed.search}`.toLowerCase();
  const hasDetailPath = DETAIL_PATHS.test(parsed.pathname);
  const hasIdentifier = Array.from(parsed.searchParams.keys()).some((key) => DETAIL_QUERY_KEYS.test(key))
    || /(?:^|\/)(?:\d{2,}|[a-z]{1,8}[-_]?\d{2,})(?:\/|$)/i.test(parsed.pathname)
    || (hasDetailPath && /(?:detail|notice|project|tender|procurement|ausschreibung|bekanntmachung|vergabe)\/[^/]+/i.test(parsed.pathname));
  if (NON_DETAIL_PATHS.test(parsed.pathname) && !(hasDetailPath && hasIdentifier)) return false;
  const hasTenderKeyword = TENDER_KEYWORDS.some((keyword) => text.includes(keyword));
  if (!hasTenderKeyword && !(hasDetailPath && hasIdentifier)) return false;
  const isBareListing = /(?:^|\/)(?:ausschreibungen?|bekanntmachungen?|vergaben?|tenders?|notices?)(?:\/)?$/i.test(parsed.pathname);
  const genericLabel = /^(?:ausschreibung|bekanntmachung|detail|vergabe|tender|notice|procurement)$/i.test(label.trim());

  return hasIdentifier || (!isBareListing && hasDetailPath && !genericLabel && label.trim().length >= 12);
};

const renderedTenderCandidates = (source: SourceItem, page: Awaited<ReturnType<typeof scrapeWebsite>>, limit: number): DiscoveredTender[] => {
  const ranked = rankSubpageCandidates(page.links, {
    baseUrl: page.url,
    limit: MAX_RENDERED_SUBPAGE_CANDIDATES,
  });
  const candidates = [...ranked, ...page.links, ...page.resources];
  const seen = new Set<string>();
  const results: DiscoveredTender[] = [];

  for (const resource of candidates) {
    if (results.length >= Math.min(limit, MAX_RENDERED_CANDIDATES)) break;
    if (resource.type !== "page" && resource.type !== "unknown") continue;
    if (resource.source === "form" && resource.sources.every((source) => source === "form")) continue;
    if (!isLikelyTenderDetailUrl(resource.url, resourceLabel(resource), page.url)) continue;

    const canonicalUrl = normalizeResourceUrl(resource.url, page.url);
    if (!canonicalUrl || seen.has(canonicalUrl)) continue;
    pushDiscoveredTender(results, seen, source, canonicalUrl, resourceLabel(resource));
  }

  return results;
};

const discoverWithRules = async (source: SourceItem, limit: number, rules: DiscoveryRules): Promise<DiscoveredTender[]> => {
  const seedUrls = [source.url, ...(rules.seedPaths ?? []).map((seedPath) => new URL(seedPath, source.url).toString())];
  const results: DiscoveredTender[] = [];
  const seen = new Set<string>();

  for (const seedUrl of seedUrls) {
    if (results.length >= limit) {
      break;
    }

    let html = "";
    try {
      const document = await fetchHtml(seedUrl);
      html = document.html;
    } catch {
      continue;
    }

    const $ = cheerio.load(html);
    $("a[href]").each((_, element) => {
      if (results.length >= limit) {
        return;
      }

      const href = $(element).attr("href");
      if (!href) {
        return;
      }

      const absolute = toAbsoluteUrl(href, seedUrl);
      if (!absolute || !absolute.startsWith("http")) {
        return;
      }

      const absoluteUrl = new URL(absolute);
      const label = $(element).text().trim() || absolute;
      const textHaystack = `${label} ${absolute}`.toLowerCase();
      const hrefMatches = rules.includeHref.some((pattern) => pattern.test(absolute));
      const textMatches = (rules.includeText ?? []).some((pattern) => pattern.test(textHaystack));
      const excluded = (rules.excludeHref ?? []).some((pattern) => pattern.test(absolute));

      if (excluded || (!hrefMatches && !textMatches)) {
        return;
      }

      pushDiscoveredTender(results, seen, source, absoluteUrl.toString(), label, rules.extractExternalId?.(absoluteUrl, label));
    });
  }

  if (results.length > 0) {
    return results;
  }

  return [];
};

const discoverGenericTenders = async (source: SourceItem, limit: number): Promise<DiscoveredTender[]> => {
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Quelle nicht erreichbar (${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results: DiscoveredTender[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    if (results.length >= limit) {
      return;
    }

    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const absolute = toAbsoluteUrl(href, source.url);
    if (!absolute || !/^https?:\/\//i.test(absolute)) {
      return;
    }

    const label = $(element).text().trim() || absolute;
    const haystack = `${label} ${absolute}`.toLowerCase();
    if (!TENDER_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
      return;
    }

    pushDiscoveredTender(results, seen, source, absolute, label);
  });

  if (results.length > 0) {
    return results;
  }

  // A successful static response can still be an empty SPA shell. Render it
  // once, without clicking or submitting controls, and inspect only bounded
  // same-origin DOM/data-attribute/network-derived links.
  try {
    const rendered = await scrapeWebsite(source.url, {
      onlyMainContent: false,
      waitUntil: "networkidle",
      waitMs: 1_000,
      requestUrlGuard: (requestUrl) => isSameOriginUrl(requestUrl, source.url),
    });
    return renderedTenderCandidates(source, rendered, limit);
  } catch {
    // Keep a failed rendered fallback non-fatal for generic source crawling.
    return [];
  }
};

const extractTedExternalId = (url: URL): string | null => {
  const queryValue = url.searchParams.get("notice-id") ?? url.searchParams.get("noticeId");
  if (queryValue) {
    return queryValue;
  }

  return url.pathname.match(/(?:detail|notice)\/?([A-Za-z0-9-]{6,})/i)?.[1] ?? url.pathname.match(/(\d{5,})/)?.[1] ?? null;
};

const extractDtvpExternalId = (url: URL): string | null => url.toString().match(/CXP[A-Z0-9-]+/i)?.[0]?.toUpperCase() ?? null;

const extractBundExternalId = (url: URL): string | null => {
  const id = url.searchParams.get("id") ?? url.searchParams.get("nn");
  if (id) {
    return id;
  }

  const segment = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  return segment.replace(/\.[a-z0-9]+$/i, "") || null;
};

export const discoverTendersFromSource = async (sourceInput: SourceItem, limit = 40): Promise<DiscoveredTender[]> => {
  const source = resolveSourceItem(sourceInput);
  if (!source) {
    throw new Error("ungueltige Quelle");
  }

  const definition = getTenderSourceDefinition(source.key, source.url);
  if (!definition) {
    return discoverGenericTenders(source, limit);
  }

  switch (definition.key) {
    case "ted": {
      const items = await discoverWithRules(source, limit, {
        seedPaths: ["/en/search/result"],
        includeHref: [/\/notice/i, /\/search\/search-result/i],
        includeText: [/tender/i, /notice/i, /contract/i, /vergabe/i, /ausschreibung/i],
        excludeHref: [/login/i, /register/i, /help/i, /faq/i],
        extractExternalId: extractTedExternalId,
      });
      return items.length > 0 ? items : discoverGenericTenders(source, limit);
    }
    case "dtvp": {
      const items = await discoverWithRules(source, limit, {
        includeHref: [/CXP[A-Z0-9-]+/i, /notice/i, /bekanntmachung/i, /vergabe/i],
        includeText: [/vergabe/i, /bekanntmachung/i, /ausschreibung/i, /teilnahme/i],
        excludeHref: [/login/i, /kontakt/i, /impressum/i],
        extractExternalId: extractDtvpExternalId,
      });
      return items.length > 0 ? items : discoverGenericTenders(source, limit);
    }
    case "bund": {
      const items = await discoverWithRules(source, limit, {
        includeHref: [/ausschreibung/i, /bekanntmachung/i, /vergabe/i],
        includeText: [/ausschreibung/i, /bekanntmachung/i, /vergabe/i, /beschaffung/i],
        excludeHref: [/impressum/i, /kontakt/i, /datenschutz/i],
        extractExternalId: extractBundExternalId,
      });
      return items.length > 0 ? items : discoverGenericTenders(source, limit);
    }
    default:
      return discoverGenericTenders(source, limit);
  }
};
