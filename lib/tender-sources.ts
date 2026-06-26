import type { SourceItem } from "@/lib/types";

export interface TenderSourceDefinition {
  key: string;
  name: string;
  defaultUrl: string;
  aliases: string[];
}

const DEFAULT_SOURCE_KEYS = ["ted", "dtvp", "bund"] as const;

export const TENDER_SOURCE_DEFINITIONS: readonly TenderSourceDefinition[] = [
  {
    key: "ted",
    name: "TED",
    defaultUrl: "https://ted.europa.eu",
    aliases: ["ted.europa.eu"],
  },
  {
    key: "dtvp",
    name: "DTVP",
    defaultUrl: "https://www.dtvp.de",
    aliases: ["dtvp.de", "www.dtvp.de"],
  },
  {
    key: "bund",
    name: "bund.de",
    defaultUrl: "https://www.service.bund.de",
    aliases: ["service.bund.de", "www.service.bund.de", "bund.de", "www.bund.de"],
  },
] as const;

const SOURCE_BY_KEY = new Map(TENDER_SOURCE_DEFINITIONS.map((definition) => [definition.key, definition]));

const normalizeHost = (value: string): string => value.toLowerCase().replace(/^www\./, "");

const dedupeSources = (items: SourceItem[]): SourceItem[] => {
  const seen = new Set<string>();
  const result: SourceItem[] = [];

  for (const item of items) {
    const identity = `${item.key ?? "generic"}:${item.url}`;
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    result.push(item);
  }

  return result;
};

export const getTenderSourceDefinition = (key?: string | null, url?: string | null): TenderSourceDefinition | null => {
  if (key) {
    const byKey = SOURCE_BY_KEY.get(key.trim().toLowerCase());
    if (byKey) {
      return byKey;
    }
  }

  if (!url) {
    return null;
  }

  try {
    const hostname = normalizeHost(new URL(url).hostname);
    return TENDER_SOURCE_DEFINITIONS.find((definition) => definition.aliases.some((alias) => normalizeHost(alias) === hostname)) ?? null;
  } catch {
    return null;
  }
};

export const buildDefaultTenderSources = (): SourceItem[] =>
  DEFAULT_SOURCE_KEYS.map((key) => {
    const definition = SOURCE_BY_KEY.get(key);
    if (!definition) {
      throw new Error(`Unbekannte Standardquelle: ${key}`);
    }
    return { key: definition.key, name: definition.name, url: definition.defaultUrl };
  });

export const resolveSourceItem = (source: Partial<SourceItem> & { url: string }): SourceItem | null => {
  const url = source.url.trim();
  if (!url) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const definition = getTenderSourceDefinition(source.key, parsedUrl.toString());
  return {
    key: definition?.key ?? source.key,
    name: source.name?.trim() || definition?.name || normalizeHost(parsedUrl.hostname),
    url: parsedUrl.toString(),
  };
};

const resolveConfiguredToken = (token: string): SourceItem | null => {
  const normalized = token.trim();
  if (!normalized) {
    return null;
  }

  const definition = SOURCE_BY_KEY.get(normalized.toLowerCase());
  if (definition) {
    return { key: definition.key, name: definition.name, url: definition.defaultUrl };
  }

  return resolveSourceItem({ url: normalized });
};

export const parseConfiguredTenderSources = (rawValue: string | undefined): SourceItem[] => {
  const tokens = (rawValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (tokens.length === 0) {
    return buildDefaultTenderSources();
  }

  return dedupeSources(tokens.map(resolveConfiguredToken).filter((item): item is SourceItem => item !== null));
};

export const serializeSourceItems = (items: SourceItem[]) =>
  items.map((item) => ({
    ...(item.key ? { key: item.key } : {}),
    ...(item.name ? { name: item.name } : {}),
    url: item.url,
  }));
