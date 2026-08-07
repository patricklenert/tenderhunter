export type PublicSourceDefinition = {
  sourceKey: string;
  label: string;
  emptyAllowed: boolean;
  supportsContinuation: boolean;
};

const FIXED_SOURCES: Record<string, PublicSourceDefinition> = {
  "berlin-html": { sourceKey: "berlin-html", label: "Berlin", emptyAllowed: false, supportsContinuation: true },
  "bayern-api": { sourceKey: "bayern-api", label: "Bayern", emptyAllowed: false, supportsContinuation: true },
  "hamburg-de": { sourceKey: "hamburg-de", label: "Hamburg", emptyAllowed: false, supportsContinuation: true },
  "bund-rss": { sourceKey: "bund-rss", label: "Bund RSS", emptyAllowed: true, supportsContinuation: false },
  "evergabe-online": { sourceKey: "evergabe-online", label: "eVergabe Bund", emptyAllowed: false, supportsContinuation: true },
  dtvp: { sourceKey: "dtvp", label: "DTVP", emptyAllowed: false, supportsContinuation: true },
  ted: { sourceKey: "ted", label: "TED", emptyAllowed: false, supportsContinuation: true },
  bauportal: { sourceKey: "bauportal", label: "Bauportal", emptyAllowed: false, supportsContinuation: true },
  evergabe: { sourceKey: "evergabe", label: "eVergabe", emptyAllowed: false, supportsContinuation: true },
  bundesimmobilien: { sourceKey: "bundesimmobilien", label: "Bundesimmobilien", emptyAllowed: true, supportsContinuation: false },
  niedersachsen: { sourceKey: "niedersachsen", label: "Niedersachsen", emptyAllowed: false, supportsContinuation: true },
  "e-vergabe-sh": { sourceKey: "e-vergabe-sh", label: "Schleswig-Holstein", emptyAllowed: false, supportsContinuation: true },
  thueringen: { sourceKey: "thueringen", label: "Thüringen", emptyAllowed: false, supportsContinuation: true },
  "evergabe-nrw": { sourceKey: "evergabe-nrw", label: "eVergabe NRW", emptyAllowed: false, supportsContinuation: true },
  "net-bremen": { sourceKey: "net-bremen", label: "Bremen", emptyAllowed: false, supportsContinuation: true },
  "net-saarland": { sourceKey: "net-saarland", label: "Saarland", emptyAllowed: false, supportsContinuation: true },
  "sachsen-anhalt": { sourceKey: "sachsen-anhalt", label: "Sachsen-Anhalt", emptyAllowed: false, supportsContinuation: true },
};

const DYNAMIC_SOURCES = new Set([
  "nrw-brandenburg",
  "nrw-rlp-land",
  "nrw-rlp-central",
  "nrw-rlp-lbb",
  "nrw-rlp-lbm",
  "nrw-metropoleruhr",
  "nrw-vmp-rheinland",
  "nrw-blb-nrw",
  "nrw-westfalen",
  "nrw-stadt-koeln",
  "nrw-wirtschaftsregion-aachen",
  "nrw-vergabeportal-bw",
  "net-sachsen",
  "net-sachsen-sib",
  "net-muenchen",
  "net-landbw",
  "net-hessen",
  "net-berlin",
  "net-mecklenburg-vorpommern",
  "net-rhein-neckar",
]);

const SOURCE_ALIASES: Record<string, string> = {
  dtvp: "dtvp",
  "d-t-v-p": "dtvp",
  "dtvp.de": "dtvp",
  ted: "ted",
  "ted.europa.eu": "ted",
  "e-vergabe": "evergabe",
  evergabe: "evergabe",
  "evergabe.de": "evergabe",
  hamburg: "hamburg-de",
  "hamburg-de": "hamburg-de",
  bayern: "bayern-api",
  "bayern-api": "bayern-api",
  "bund-rss": "bund-rss",
  bund: "bund-rss",
  "service.bund.de": "bund-rss",
  "evergabe-online": "evergabe-online",
  "e-vergabe-online": "evergabe-online",
  "e-vergabe-online.de": "evergabe-online",
  "evergabe-online.de": "evergabe-online",
  "evergabe online": "evergabe-online",
  "e-vergabe bund": "evergabe-online",
  "evergabe bund": "evergabe-online",
  "bund-evergabe": "evergabe-online",
  bauportal: "bauportal",
  "bauportal-deutschland": "bauportal",
  bundesimmobilien: "bundesimmobilien",
  niedersachsen: "niedersachsen",

  // Berlin's HTML listing links to RIB detail pages. Keep both labels on the
  // same scraper key so identity backfills do not split one source in two.
  berlin: "berlin-html",
  "berlin-html": "berlin-html",
  "berlin-rib": "berlin-html",
  "berlin/rib": "berlin-html",
  "berlin / rib": "berlin-html",
  "rib berlin": "berlin-html",
  rib: "berlin-html",
  "rib-berlin": "berlin-html",
  "meinauftrag.rib.de": "berlin-html",
  "vergabe-berlin": "berlin-html",

  // Schleswig-Holstein and Thüringen display names used by older rows and
  // manual reprocess requests.
  "schleswig-holstein": "e-vergabe-sh",
  "schleswig holstein": "e-vergabe-sh",
  "e-vergabe-sh": "e-vergabe-sh",
  "evergabe-sh": "e-vergabe-sh",
  "e-vergabe-sh.de": "e-vergabe-sh",
  sh: "e-vergabe-sh",
  thueringen: "thueringen",
  thüringen: "thueringen",
  thuringia: "thueringen",
  "verwaltung.thueringen.de": "thueringen",
  "vergabe-thueringen": "thueringen",

  // The NRW scraper has a few historically named VMP variants. These aliases
  // intentionally remain exact rather than matching every "vergabe" label.
  nrw: "evergabe-nrw",
  "nrw-portal": "evergabe-nrw",
  "vergabe-nrw": "evergabe-nrw",
  "e-vergabe-nrw": "evergabe-nrw",
  "evergabe-nrw": "evergabe-nrw",
  "evergabe nrw": "evergabe-nrw",
  "netserver berlin": "net-berlin",
  "evergabe.nrw.de": "evergabe-nrw",
  "evergabe-nrw.de": "evergabe-nrw",

  // NetServer labels and hostnames.
  "net-sachsen": "net-sachsen",
  sachsen: "net-sachsen",
  "netserver sachsen": "net-sachsen",
  "evergabe.sachsen.de": "net-sachsen",
  "net-sachsen-sib": "net-sachsen-sib",
  "sachsen-sib": "net-sachsen-sib",
  "netserver sachsen sib": "net-sachsen-sib",
  "sachsen-vergabe.de": "net-sachsen-sib",
  "net-muenchen": "net-muenchen",
  muenchen: "net-muenchen",
  münchen: "net-muenchen",
  "vergabe.muenchen.de": "net-muenchen",
  "net-landbw": "net-landbw",
  landbw: "net-landbw",
  "baden-wuerttemberg": "net-landbw",
  "vergabe.landbw.de": "net-landbw",
  "net-hessen": "net-hessen",
  hessen: "net-hessen",
  "vergabe.hessen.de": "net-hessen",
  "net-berlin": "net-berlin",
  "berlin-netserver": "net-berlin",
  "vergabekooperation.berlin": "net-berlin",
  "net-mecklenburg-vorpommern": "net-mecklenburg-vorpommern",
  "mecklenburg-vorpommern-netserver": "net-mecklenburg-vorpommern",
  "vergabe.mv-regierung.de": "net-mecklenburg-vorpommern",
  "net-rhein-neckar": "net-rhein-neckar",
  "rhein-neckar": "net-rhein-neckar",
  "vergabe.vmstart.de": "net-rhein-neckar",

  // Bremen and Saarland use the standard NetServer publication portal.
  bremen: "net-bremen",
  "net-bremen": "net-bremen",
  "bremen-netserver": "net-bremen",
  "netserver bremen": "net-bremen",
  "vergabe-bremen": "net-bremen",
  "vergabe.bremen.de": "net-bremen",
  saarland: "net-saarland",
  "net-saarland": "net-saarland",
  "saarland-netserver": "net-saarland",
  "netserver saarland": "net-saarland",
  "vergabe-saarland": "net-saarland",
  "vergabe.saarland": "net-saarland",

  // The state portal publishes a public wrapper around the underlying tender.
  "sachsen-anhalt": "sachsen-anhalt",
  "sachsen anhalt": "sachsen-anhalt",
  "evergabe-sachsen-anhalt": "sachsen-anhalt",
  "net-sachsen-anhalt": "sachsen-anhalt",
  "vergabe-sachsen-anhalt": "sachsen-anhalt",
  "evergabe.sachsen-anhalt.de": "sachsen-anhalt",
};

for (const sourceKey of DYNAMIC_SOURCES) {
  const shortKey = sourceKey.replace(/^nrw-/, "");
  if (!SOURCE_ALIASES[shortKey]) SOURCE_ALIASES[shortKey] = sourceKey;
  if (!SOURCE_ALIASES[sourceKey]) SOURCE_ALIASES[sourceKey] = sourceKey;
}

const normalizeSourceToken = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/\/+$/, "")
  .replace(/^www\./, "")
  .replace(/[_.]+/g, ".")
  .replace(/\s+/g, " ");

const hostMatches = (hostname: string, domain: string): boolean =>
  hostname === domain || hostname.endsWith(`.${domain}`);

interface HostSourceRule {
  domains: string[];
  sourceKey: string;
  path?: RegExp;
}

const HOST_SOURCE_RULES: HostSourceRule[] = [
  { domains: ["dtvp.de"], sourceKey: "dtvp" },
  { domains: ["ted.europa.eu"], sourceKey: "ted" },
  { domains: ["bauportal-deutschland.de"], sourceKey: "bauportal" },
  { domains: ["evergabe.de"], sourceKey: "evergabe" },
  { domains: ["bundesimmobilien.de"], sourceKey: "bundesimmobilien" },
  { domains: ["vergabe.niedersachsen.de"], sourceKey: "niedersachsen" },
  { domains: ["auftraege.bayern.de"], sourceKey: "bayern-api" },
  { domains: ["hamburg.de", "vergabe-hamburg.de"], sourceKey: "hamburg-de", path: /ausschreib|vergabe/i },
  { domains: ["service.bund.de"], sourceKey: "bund-rss", path: /ausschreib/i },
  { domains: ["evergabe-online.de"], sourceKey: "evergabe-online" },
  { domains: ["berlin.de"], sourceKey: "berlin-html", path: /vergabeplattform|ausschreib/i },
  { domains: ["meinauftrag.rib.de"], sourceKey: "berlin-html" },
  { domains: ["e-vergabe-sh.de"], sourceKey: "e-vergabe-sh" },
  { domains: ["verwaltung.thueringen.de", "thueringen.de"], sourceKey: "thueringen", path: /evergabe|vergabe|ausschreib/i },
  { domains: ["evergabe.nrw.de"], sourceKey: "evergabe-nrw" },
  { domains: ["vergabemarktplatz.brandenburg.de"], sourceKey: "nrw-brandenburg" },
  { domains: ["lbb.vergabe.rlp.de"], sourceKey: "nrw-rlp-lbb" },
  { domains: ["lbm.vergabe.rlp.de"], sourceKey: "nrw-rlp-lbm" },
  { domains: ["landesverwaltung.vergabe.rlp.de"], sourceKey: "nrw-rlp-land" },
  { domains: ["vergabe.rlp.de"], sourceKey: "nrw-rlp-central" },
  { domains: ["vergabe.metropoleruhr.de"], sourceKey: "nrw-metropoleruhr" },
  { domains: ["vmp-rheinland.de"], sourceKey: "nrw-vmp-rheinland" },
  { domains: ["evergabe.blb.nrw.de"], sourceKey: "nrw-blb-nrw" },
  { domains: ["vergabe-westfalen.de"], sourceKey: "nrw-westfalen" },
  { domains: ["vergabe.stadt-koeln.de"], sourceKey: "nrw-stadt-koeln" },
  { domains: ["vergaben-wirtschaftsregion-aachen.de"], sourceKey: "nrw-wirtschaftsregion-aachen" },
  { domains: ["vergabeportal-bw.de"], sourceKey: "nrw-vergabeportal-bw" },
  { domains: ["evergabe.sachsen.de"], sourceKey: "net-sachsen" },
  { domains: ["sachsen-vergabe.de"], sourceKey: "net-sachsen-sib" },
  { domains: ["vergabe.muenchen.de"], sourceKey: "net-muenchen" },
  { domains: ["vergabe.landbw.de"], sourceKey: "net-landbw" },
  { domains: ["vergabe.hessen.de"], sourceKey: "net-hessen" },
  { domains: ["vergabekooperation.berlin"], sourceKey: "net-berlin" },
  { domains: ["vergabe.mv-regierung.de"], sourceKey: "net-mecklenburg-vorpommern" },
  { domains: ["vergabe.vmstart.de"], sourceKey: "net-rhein-neckar" },
  { domains: ["vergabe.bremen.de"], sourceKey: "net-bremen" },
  { domains: ["vergabe.saarland"], sourceKey: "net-saarland" },
  { domains: ["evergabe.sachsen-anhalt.de"], sourceKey: "sachsen-anhalt" },
];

const sourceKeyFromHost = (value: string): string | null => {
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const hostname = parsed.hostname.toLowerCase();
    return HOST_SOURCE_RULES.find((rule) =>
      rule.domains.some((domain) => hostMatches(hostname, domain))
      && (!rule.path || rule.path.test(parsed.pathname)),
    )?.sourceKey ?? null;
  } catch {
    return null;
  }
};

export const getPublicSourceDefinition = (sourceKey: string): PublicSourceDefinition | null => {
  const key = normalizeSourceToken(sourceKey);
  const canonicalKey = SOURCE_ALIASES[key] ?? key;
  if (FIXED_SOURCES[canonicalKey]) return FIXED_SOURCES[canonicalKey];
  if (DYNAMIC_SOURCES.has(canonicalKey)) {
    return { sourceKey: canonicalKey, label: canonicalKey, emptyAllowed: false, supportsContinuation: true };
  }
  return null;
};

export const resolvePublicSourceKey = (value: string): string | null => {
  const key = normalizeSourceToken(value);
  const alias = SOURCE_ALIASES[key] ?? SOURCE_ALIASES[value.trim().toLowerCase()] ?? value.trim();
  if (getPublicSourceDefinition(alias)) return alias;
  const inferred = sourceKeyFromHost(value.trim());
  return inferred && getPublicSourceDefinition(inferred) ? inferred : null;
};

export const inferPublicSourceKey = (source: string | null | undefined, url: string): string | null => {
  const fromSource = source ? resolvePublicSourceKey(source) : null;
  if (fromSource) return fromSource;

  try {
    const inferred = sourceKeyFromHost(url);
    if (inferred) return inferred;
  } catch {
    return null;
  }
  return null;
};

export const isPublicSourceKey = (value: string): boolean => getPublicSourceDefinition(value) !== null;

export const canonicalPublicTenderUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = "";
    url.pathname = url.pathname.replace(/;jsessionid=[^/;?]*/gi, "");
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(?:utm_|fbclid$|gclid$|session|jsessionid|cookieCheck$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value.replace(/;jsessionid=[^/;?]*/gi, "");
  }
};

type PublicTenderIdentityInput = {
  sourceKey: string;
  sourceUrl: string;
  externalId?: string | null;
};

export const derivePublicExternalId = ({ sourceKey, sourceUrl, externalId }: PublicTenderIdentityInput): string | null => {
  if (externalId?.trim()) return externalId.trim();

  const patterns = [
    /projectForwarding\.do\?pid=(\d+)/i,
    /\/tenderdetails\.html\?[^#]*\bid=(\d+)/i,
    /\/recherche-aktueller-vergaben\?[^#]*\bidp=([^&#]+)/i,
    /(?:[?&#](?:oid|TWOID)=)([A-Za-z0-9_-]{6,})/i,
    /(?:[?&#](?:T_ID|TIDGUID|guid|noticeId)=|\/notice\/)([A-Za-z0-9_-]{6,})/i,
    /(?:\/ausschreibung\/|\/project\/)([A-Za-z0-9_-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = sourceUrl.match(pattern);
    if (match?.[1]) return match[1];
  }

  const canonicalUrl = canonicalPublicTenderUrl(sourceUrl);
  return canonicalUrl ? `url:${sourceKey}:${canonicalUrl}` : null;
};

export const publicSourceDefinitions = (): PublicSourceDefinition[] => [
  ...Object.values(FIXED_SOURCES),
];
