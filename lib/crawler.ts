import * as cheerio from "cheerio";
import { getTenderSourceDefinition, resolveSourceItem } from "@/lib/tender-sources";
import type { SourceItem } from "@/lib/types";

const TENDER_KEYWORDS = ["ausschreibung", "bekanntmachung", "vergabe", "tender", "procurement", "notice"];

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
  const title = $("title").text().trim() || source.url;
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
    if (!absolute) {
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

  return [{ source: source.name ?? source.url, sourceKey: source.key, url: source.url, title: title.slice(0, 300), externalId: null }];
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
