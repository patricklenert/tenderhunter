/** Portal actions and authentication pages are navigation, not attachments. */
export function isPortalActionUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const pathname = new URL(value).pathname;
    return /\.do\/?$/i.test(pathname)
      || /(?:^|\/)(?:account\/(?:login|register)|login|signin|sign-in|signup|sign-up|register|sf_security_check)(?:\/|$)/i.test(pathname);
  } catch {
    const pathname = value.split(/[?#]/, 1)[0] ?? "";
    return /\.do\/?$/i.test(pathname)
      || /(?:^|\/)(?:account\/(?:login|register)|login|signin|sign-in|signup|sign-up|register|sf_security_check)(?:\/|$)/i.test(pathname);
  }
}

export interface GenericPortalNavigationResourceInput {
  url?: string | null;
  canonicalUrl?: string | null;
  label?: string | null;
  filename?: string | null;
  resourceType?: string | null;
}

const DOCUMENT_EXTENSION_PATTERN = /\.(?:pdf|doc|docx|odt|rtf|xls|xlsx|ppt|pptx|ods|csv|zip|rar|7z|txt)$/i;

const resourcePath = (value: string): string => {
  try {
    return decodeURIComponent(new URL(value).pathname).replace(/\/+$/, "");
  } catch {
    const pathname = (value.split(/[?#]/, 1)[0] ?? "").replace(/\/+$/, "");
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  }
};

const isBareRootUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.pathname === "/" && !parsed.search;
  } catch {
    const [pathname, query] = value.split(/[?#]/, 2);
    return !pathname?.replace(/\/+$/, "") && !query;
  }
};

const GENERIC_PORTAL_NAVIGATION_LABELS = new Set([
  "service.bund.de",
  "haupt-navigations-menü",
  "meta-navigation",
  "andere ausschreibungen im bereich",
  "impressum",
  "datenschutz",
  "datenschutzerklärung",
  "nutzungsbedingungen",
  "cosinex gmbh",
  "homepage",
  "zur homepage",
  "homepage des auftraggebers",
  "website",
  "webseite",
  "website des auftraggebers",
  "webseite des auftraggebers",
  "homepage des käufers",
  "website des käufers",
  "webseite des käufers",
]);

const GENERIC_FOOTER_PATH = /(?:^|\/)(?:vergabemarktplatz-(?:impressum|datenschutz|nutzungsbedingungen|kontakt)|impressum|datenschutz|datenschutzerklärung|datenschutzerklaerung|nutzungsbedingungen)(?:\.html?|\.do)?(?:\/|$)/i;
const GENERIC_PORTAL_ROOT_PATH = /^\/?(?:VMPSatellite|VMPCenter)$/i;

/** Identifies portal chrome without suppressing tender pages or real downloads. */
export function isGenericPortalNavigationResource({
  url,
  canonicalUrl,
  label,
  filename,
  resourceType,
}: GenericPortalNavigationResourceInput): boolean {
  const type = resourceType?.trim().toLowerCase();
  const urls = [url, canonicalUrl].filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const paths = urls.map(resourcePath);

  if (
    type === "document"
    || type === "download"
    || DOCUMENT_EXTENSION_PATTERN.test(filename ?? "")
    || paths.some((path) => DOCUMENT_EXTENSION_PATTERN.test(path))
  ) return false;

  const normalizedLabel = (label ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (
    GENERIC_PORTAL_NAVIGATION_LABELS.has(normalizedLabel)
    || /^(?:abbildung zeigt )?(?:das )?logo(?: des| der| von)? (?:(?:landes|vergabemarktplatz(?:es)?|vergabeplattform|vergabeportals?) )?brandenburg$/.test(normalizedLabel)
  ) return true;

  return paths.some((path) => GENERIC_FOOTER_PATH.test(path) || GENERIC_PORTAL_ROOT_PATH.test(path))
    || urls.some(isBareRootUrl);
}
