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
  {
    key: "evergabe-online",
    name: "eVergabe Bund",
    defaultUrl: "https://www.evergabe-online.de",
    aliases: ["evergabe-online.de", "www.evergabe-online.de"],
  },
  {
    key: "evergabe-de",
    name: "deutsche-eVergabe",
    defaultUrl: "https://portal.deutsche-evergabe.de",
    aliases: ["deutsche-evergabe.de", "portal.deutsche-evergabe.de", "evergabe-de"],
  },
  {
    key: "it-ausschreibung",
    name: "IT-Ausschreibung.de",
    defaultUrl: "https://www.it-ausschreibung.de/ausschreibungen",
    aliases: ["it-ausschreibung.de", "it-ausschreibung"],
  },
  {
    key: "net-bremen",
    name: "Vergabeplattform Bremen",
    defaultUrl: "https://vergabe.bremen.de/NetServer/",
    aliases: ["vergabe.bremen.de", "www.vergabe.bremen.de"],
  },
  {
    key: "net-saarland",
    name: "Vergabeplattform Saarland",
    defaultUrl: "https://vergabe.saarland/NetServer/",
    aliases: ["vergabe.saarland", "www.vergabe.saarland"],
  },
  {
    key: "sachsen-anhalt",
    name: "eVergabe Sachsen-Anhalt",
    defaultUrl: "https://evergabe.sachsen-anhalt.de",
    aliases: ["evergabe.sachsen-anhalt.de", "www.evergabe.sachsen-anhalt.de"],
  },
  {
    key: "mv",
    name: "Vergabemarktplatz Mecklenburg-Vorpommern",
    defaultUrl: "https://vergabe.mv-regierung.de/NetServer/",
    aliases: ["vergabe.mv-regierung.de", "www.vergabemarktplatz-mv.de"],
  },
] as const;

const SOURCE_BY_KEY = new Map(TENDER_SOURCE_DEFINITIONS.map((definition) => [definition.key, definition]));

const normalizeHost = (value: string): string => {
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^www\./, "").split("/", 1)[0];
  }
};

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
    const normalizedKey = key.trim().toLowerCase();
    const byKey = SOURCE_BY_KEY.get(normalizedKey)
      ?? TENDER_SOURCE_DEFINITIONS.find((definition) => definition.aliases.some((alias) => normalizeHost(alias) === normalizeHost(normalizedKey)));
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
  const aliasDefinition = definition ?? getTenderSourceDefinition(normalized);
  if (aliasDefinition) {
    return { key: aliasDefinition.key, name: aliasDefinition.name, url: aliasDefinition.defaultUrl };
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
