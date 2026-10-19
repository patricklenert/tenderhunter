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
  "karte anschauen",
  "facebook",
  "twitter",
  "information per e-mail weiterempfehlen",
]);

const GENERIC_FOOTER_PATH = /(?:^|\/)(?:vergabemarktplatz-(?:impressum|datenschutz|nutzungsbedingungen|kontakt)|impressum|datenschutz|datenschutzerklärung|datenschutzerklaerung|nutzungsbedingungen)(?:\.html?|\.do)?(?:\/|$)/i;
const GENERIC_PORTAL_ROOT_PATH = /^\/?(?:VMPSatellite|VMPCenter)$/i;
const GENERIC_SOCIAL_SHARE_PATH = /(?:^|\/)(?:sharer\/sharer\.php|intent\/tweet|sharing\/share-offsite)(?:\/|$)/i;
const MV_PUBLIC_PROCUREMENT_INFO_LABELS = new Set([
  "informationen zur öffentlichen auftragsvergabe",
  "öffentliche auftragsvergabe",
  "vergabe öffentlicher aufträge",
  "infoportal - lebenslage öffentliche aufträge in m-v",
]);
const MV_CURRENT_PROCEDURES_LABELS = new Set([
  "aktuelle ausschreibungen",
  "aktuelle vergabeverfahren",
  "aktuelle verfahren",
  "laufende und abgeschlossene vergabeverfahren im land",
]);

const isServiceBundNavigationUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    if (!/(?:^|\.)service\.bund\.de$/i.test(parsed.hostname)) return false;
    const path = resourcePath(value);
    return /\/Content\//i.test(path)
      || /\/IMPORTE\/Ausschreibungen\/[^/]+\/\d{4}\/\d{2}\/IMPORTE\/Ausschreibungen\//i.test(path);
  } catch {
    return false;
  }
};

const isBundProcessFormNavigationUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "www.bund.de"
      && parsed.pathname === "/Content/DE/Ausschreibungen/Suche/Formular.html"
      && parsed.searchParams.get("view") === "processForm";
  } catch {
    return false;
  }
};

const isMvRegierungNavigationUrl = (value: string, label: string): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== "vergabe.mv-regierung.de") return false;
    const path = parsed.pathname.replace(/\/+$/, "") || "/";

    if (path === "/NetServer") return label === "zur startseite";
    if (path === "/NetServer/LanguageSelectServlet") {
      return parsed.searchParams.get("language") === "en_US" && label === "english";
    }
    if (path === "/NetServer/PublicationSearchControllerServlet") {
      return label === "liefer- und dienstleistungen"
        || (
          parsed.searchParams.get("function") === "SearchPublications"
          && parsed.searchParams.get("thContext") === "publications"
        );
    }
    if (path === "/NetServer/LoginControllerServlet") {
      return parsed.searchParams.get("function") === "LoginForm" && label === "registrierung";
    }
    return path === "/NetServer/index.jsp"
      && (
        (
          parsed.searchParams.get("function") === "Generic"
          && parsed.searchParams.get("Page") === "hintOfferSubmission"
          && parsed.searchParams.get("thContext") === "home"
        )
        || (
          parsed.searchParams.get("function") === "Generic"
          && parsed.searchParams.get("Page") === "impressum"
          && parsed.searchParams.get("thContext") === "home"
        )
        || (
          parsed.searchParams.get("function") === "Generic"
          && /^hint_11_3_vgv/i.test(parsed.searchParams.get("Page") ?? "")
        )
      );
  } catch {
    return false;
  }
};

const isMvRegierungChromeOrActionUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "vergabe.mv-regierung.de"
      && (
        /^\/NetServer\/_commonfiles\/css\/[^/]+\.css$/.test(parsed.pathname)
        || parsed.pathname === "/NetServer/_commonfiles/css/jquery-ui/jquery-ui.min.css"
        || parsed.pathname === "/NetServer/_images/img/favicon.ico"
        || parsed.pathname === "/NetServer/ParticipationControllerServlet"
      );
  } catch {
    return false;
  }
};

const isOtherMvNavigationUrl = (value: string, label: string): boolean => {
  try {
    const hostname = new URL(value).hostname;
    return ((hostname === "service.m-v.de" || hostname === "www.service.m-v.de")
        && MV_PUBLIC_PROCUREMENT_INFO_LABELS.has(label))
      || (hostname === "lxwww2.mvnet.de" && MV_CURRENT_PROCEDURES_LABELS.has(label));
  } catch {
    return false;
  }
};

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

  return urls.some((value) => isBundProcessFormNavigationUrl(value)
      || isMvRegierungNavigationUrl(value, normalizedLabel)
      || isMvRegierungChromeOrActionUrl(value)
      || isOtherMvNavigationUrl(value, normalizedLabel))
    || paths.some((path) => GENERIC_FOOTER_PATH.test(path)
      || GENERIC_PORTAL_ROOT_PATH.test(path)
      || GENERIC_SOCIAL_SHARE_PATH.test(path))
    || urls.some(isServiceBundNavigationUrl)
    || urls.some(isBareRootUrl);
}
