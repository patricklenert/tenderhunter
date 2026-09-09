import { decodeHtmlEntities, repairKnownGermanEncoding } from "@/lib/text-normalization";

const decodePublicHtmlEntities = decodeHtmlEntities;
const repairPublicEncoding = repairKnownGermanEncoding;

const MANGLED_KEYWORDS = [
  "auftraggeber", "vergabestelle", "beschaffer", "frist", "deadline",
  "ort der ausf", "ort der leistung", "ausfuehrungsort", "erfuellungsort",
  "vergabeart", "auftragswert", "auftragsgegenstand", "leistungsbeschreibung",
];

const PORTAL_MARKERS = [
  "vergabeplattform", "ai vergabeplattform", "bekanntmachung", "postanschrift", "impressum",
  "datenschutzerklaerung", "zur seite drucken", "internetadresse",
];

const PORTAL_FIELD_MARKERS = [
  /(?:oeffentlicher|öffentlicher)\s+auftraggeber/iu,
  /vergabestelle/iu,
  /name\s+und\s+anschrift/iu,
  /(?:ort|haupt|ausfuehrungs|ausführungs)\s+der\s+(?:leistung|ausfuehrung|ausführung)/iu,
  /(?:angebots|abgabe|teilnahme)frist/iu,
  /vergabeart/iu,
  /(?:telefon|fax|e-?mail)\s*[:]/iu,
];

const PDF_FORM_MARKERS = [
  /vhb\s*[-\s]*(?:bund|ausgabe)|gaeb\s*[-\s]*(?:kalkulationssoftware)?|bietercockpit|wingaeb\.xml/iu,
  /(?:angebotsabgabe|abgabe|einreichung).{0,80}(?:bestätigen|bestaetigen|abschließen|abschliessen)/iu,
  /(?:formblatt|bieter|bewerber|eigenerklärung|eigenerklaerung).{0,80}(?:unterschrift|rechtsverbindlich|eignung)/iu,
  /(?:massnahmennummer|maßnahmenummer|vergabenummer|vergabeart).{0,60}(?:bauleistung|bewerber|offenes verfahren)/iu,
  /(?:baumassnahme|baumaßnahme)\s+leistung\s+bewerber/iu,
  /(?:ausgabe\s+\d{4}\s+stand\s+\d{4}|mitglied\s+der\s+bewerber)/iu,
];

const OBVIOUS_FORM_DUMP_MARKERS = [
  /\bformular\s*[-–—:]\s*(?:auftrags)?bekanntmachung\b/iu,
  /\bformular\s+(?:nr\.?\s*)?\d+\s*(?:[-–—:]\s*)?(?:auftrags)?bekanntmachung\b/iu,
  /\b(?:auftrags)?bekanntmachung\s*[-–—:]\s*formular\b/iu,
  /\beforms?\s*[-–—:]\s*(?:auftrags)?bekanntmachung\b/iu,
  /\b(?:auftrags)?bekanntmachung\s*[-–—:]\s*eforms?\b/iu,
];

const NAVIGATION_MARKERS = [
  "service.bund.de - aktuelle ausschreibungen",
  "haupt-navigations-menü",
  "haupt-navigations-menu",
  "meta-navigation",
  "andere ausschreibungen im bereich",
  "ausschreibungen abonnieren",
];

const PLACEHOLDER = /^(?:n\/?a|na|n\.\s*a\.|tbd|unknown|unbekannt|vergessen\??|nicht bekannt|zweck|null|undefined|leer|nicht angegeben|keine angabe|[-–—]+)$/iu;
const FIELD_ONLY_ARTIFACT = /^(?:sart\b|verfahrensart|verfahren|auftraggeber|vergabestelle|auftragsgegenstand|leistungsumfang|leistungsort|erfüllungsort|ausführungsort|angebotsfrist|teilnahmefrist)\s*:/iu;
const CLIENT_FIELD_LABEL = /^(?:sart|verfahrensart|verfahren|auftraggeber|vergabestelle)\s*:?[\s-]*$/iu;
const STANDALONE_FIELD_LABEL = /^(?:bekanntmachung|beschreibung|kurzbeschreibung|auftragsgegenstand|leistungsumfang|leistungsort|erfüllungsort|ausführungsort|angebotsfrist|abgabefrist|teilnahmefrist|verfahren|verfahrensart|vergabestelle|auftraggeber)\s*$/iu;
const FORM_FRAGMENT = /(?:gesetzlichen vertreter|beruflichen qualifikationen|nicht erforderlich\s*$|rechtsverbindlich(?:e|en)? erklärung)/iu;
const SOURCE_ERROR = /(?:die angegebene url.*(?:404|nicht gefunden)|keine ausschreibungsdaten vor)/iu;
const INTERNAL_DOCUMENT_MARKERS = /\[(?:rollen|rolle|dokument\s*[-–—]?\s*id)\s*:[^\]\r\n]*\]/iu;
const INLINE_MARKDOWN_HEADING = /(?:^|\s)#{1,6}(?=\s|$)/u;
const UNSAFE_CANONICAL_HINT = /(?:<\/?[a-z]|&(?:#\d+|#x[\da-f]+|[a-z]+);|�|Ã.|Â.|service\.bund\.de|haupt-navigations|meta-navigation|formular|bietercockpit|login|anmelden|passwort)/iu;
const CANONICAL_DESCRIPTION_LABELS = new Set([
  "Auftraggeber",
  "Verfahren",
  "Angebotsfrist",
  "Leistungsort",
  "Auftragswert",
  "Laufzeit",
  "Referenz",
  "Zusammenfassung",
  "Leistungsgegenstand",
  "Leistungsumfang",
  "Anforderungen",
  "Zuschlagskriterien",
  "CPV",
  "Hinweis",
]);

const foldGerman = (value: string): string => value
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const looksMangled = (value: string): boolean => {
  const glueMatches = value.match(/[a-zäöüß][A-ZÄÖÜ]/g);
  if ((glueMatches?.length ?? 0) >= 2) return true;
  const lower = foldGerman(value.toLowerCase());
  if (MANGLED_KEYWORDS.filter((keyword) => lower.includes(keyword)).length >= 2) return true;
  return MANGLED_KEYWORDS.some((keyword) =>
    new RegExp(`[a-zäöüß]${escapeRegExp(keyword)}`, "iu").test(value));
};

export const isPublicNavigationSummary = (value: string): boolean => {
  const normalized = repairPublicEncoding(decodePublicHtmlEntities(value))
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de-DE");
  if (!normalized) return false;
  if (NAVIGATION_MARKERS.some((marker) => normalized.includes(marker))) return true;
  return normalized.includes("service.bund.de");
};

export const isPdfFormBoilerplate = (value: string): boolean => {
  if (!value || value.trim().length < 30) return false;
  const normalized = repairPublicEncoding(decodePublicHtmlEntities(value)).replace(/\s+/g, " ").trim();
  return OBVIOUS_FORM_DUMP_MARKERS.some((pattern) => pattern.test(normalized))
    || PDF_FORM_MARKERS.filter((pattern) => pattern.test(normalized)).length >= 2;
};

const isLoginOrParticipationWall = (value: string): boolean =>
  /(?:login|log\s*in|sign\s*in|anmelden|registrieren).{0,100}(?:erforderlich|required|notwendig|zuerst|zugriff|benutzername|passwort)/iu.test(value)
  || /(?:zugriff|unterlagen|leistungsbeschreibung).{0,120}(?:erst|nur|nach).{0,100}(?:teilnahme|registrierung|anmeldung)/iu.test(value)
  || /(?:m(?:ü|u)ssen sie|bitte).{0,100}(?:am vergabeverfahren teilnehmen|die teilnahme(?: am verfahren)? best(?:ä|ae)tigen)/iu.test(value)
  || /(?:vollst(?:ä|ae)ndige leistungsbeschreibung|vergabeunterlagen).{0,180}nach teilnahme/iu.test(value);

const isRawPortalDescription = (value: string): boolean => {
  const normalized = foldGerman(repairPublicEncoding(decodePublicHtmlEntities(value)))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  const markerHits = PORTAL_FIELD_MARKERS.filter((pattern) => pattern.test(normalized)).length;
  const hasNoticeHeader = /bekanntmachung\s+(?:oeffentliche\s+)?ausschreibung/iu.test(normalized);
  return (hasNoticeHeader && markerHits >= 1) || markerHits >= 3;
};

const isMarkdownRemnant = (value: string): boolean => {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const separatorTokens = value.match(/(?:^|\s)[-–—_=|]{1,3}(?=\s|$)/g) ?? [];
  return lines.length === 0
    || lines.some((line) => /^#{1,6}(?:\s|$)/.test(line) || /^[-*+]\s/.test(line) || /^\d+[.)]\s/.test(line))
    || separatorTokens.length >= 5
    || lines.every((line) => /^[-–—=*_|#:]+$/.test(line));
};

const normalizePublicClientValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const candidate = repairPublicEncoding(decodePublicHtmlEntities(value))
    .replace(/^(?:(?:öffentlicher|oeffentlicher)\s+)?auftraggeber\s*\/\s*ausschreibende\s+stelle\s*:?\s*/iu, "")
    .replace(/^(?:öffentlicher|oeffentlicher)\s+auftraggeber(?:\s*\(vergabestelle\))?\s*:?[\s-]*/iu, "")
    .replace(/^(?:auftraggeber|ausschreibende(?:r|s)?\s+stelle|vergabestelle|beschaffer)\s*:?[\s-]*/iu, "")
    .replace(/\s+(?:angebotsfrist|veröffentlichungsende|veroeffentlichungsende|erfüllungsort|erfuellungsort|cpv(?:-code)?|verfahren)\b[\s\S]*$/iu, "")
    .trim();
  const normalized = normalizePublicDisplayCandidate(candidate);
  if (!normalized || normalized.length > 180 || CLIENT_FIELD_LABEL.test(normalized)) return "";
  if (/(?:benutzername|passwort|login|anmeldung|registrieren|einladungscode|gesetzlichen vertreter|beruflichen qualifikationen|nicht erforderlich\s*$)/iu.test(normalized)) return "";
  return normalized;
};

/** Normalize one public display candidate, returning null for unsafe or unusable text. */
export const normalizePublicDisplayCandidate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const decoded = repairPublicEncoding(decodePublicHtmlEntities(value))
    .replace(/\u00ad/g, "")
    .trim();
  if (!decoded || isMarkdownRemnant(decoded) || INTERNAL_DOCUMENT_MARKERS.test(decoded) || INLINE_MARKDOWN_HEADING.test(decoded)) return null;
  const normalized = decoded
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.length > 5_000) return null;
  if (/�|Ã.|Â.|â[\u0080-\u00bf]|ð[\u0080-\u00bf]|&(?:#\d+|#x[\da-f]+|[a-z]+);/iu.test(normalized)) return null;
  if (SOURCE_ERROR.test(normalized)) return null;
  if (/<\/?[a-z][^>]*>/iu.test(normalized)) return null;
  if (PLACEHOLDER.test(normalized) || /^(?:\{\{.*\}\}|\[\[.*\]\]|\$\{.*\})$/u.test(normalized)) return null;
  if (/^sart$/iu.test(normalized) || STANDALONE_FIELD_LABEL.test(normalized)) return null;
  if (FIELD_ONLY_ARTIFACT.test(normalized) || FORM_FRAGMENT.test(normalized)) return null;
  if (isPublicNavigationSummary(normalized) || isPdfFormBoilerplate(normalized) || isLoginOrParticipationWall(normalized)) return null;
  if (isRawPortalDescription(normalized)) return null;
  if (looksMangled(normalized)) return null;
  const lower = foldGerman(normalized.toLowerCase());
  if (lower.includes("vergabeplattform") || PORTAL_MARKERS.filter((marker) => lower.includes(marker)).length >= 2) return null;
  return normalized;
};

/** Normalize an authority independently from any description or location fallback. */
export const normalizePublicClient = (value: unknown, fallback = ""): string =>
  normalizePublicClientValue(value) || normalizePublicClientValue(fallback);

/** Select the first authority that passes the same normalization and validation. */
export const pickValidatedPublicClient = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const normalized = normalizePublicClient(candidate);
    if (normalized) return normalized;
  }
  return "";
};

/** Select the first candidate that passes the same normalization and validation. */
export const pickValidatedPublicCandidate = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const normalized = normalizePublicDisplayCandidate(candidate);
    if (normalized) return normalized;
  }
  return "";
};

const LOCATION_ARTIFACTS = /(?:karte\s+anschauen|anzahl\s+lose|nuts(?:-\d+)?[-\s]code|ort\s+der\s+(?:leistung(?:serbringung)?|ausfuehrung|ausführung)|erfuellungsort|erfüllungsort|hinweis\s*:|zu\s+(?:richten|senden|uebermitteln|übermitteln)\b)/iu;

/** Location fields need stricter checks because portals expose labels as values. */
export const pickValidatedPublicLocation = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const locationCandidate = typeof candidate === "string"
      ? candidate.replace(/^(?:Haupterfüllungsort|Erfüllungsort|Ausführungsort|Hauptleistungsort|Leistungsort)\s*:\s*/iu, "")
      : candidate;
    const normalized = normalizePublicDisplayCandidate(locationCandidate);
    if (normalized && !LOCATION_ARTIFACTS.test(normalized)) return normalized;
  }
  return "";
};

/** Reject long location values that are just a copied tender-title prefix. */
export const pickValidatedPublicLocationForTender = (title: unknown, client: unknown, ...candidates: unknown[]): string => {
  const normalizedTitle = normalizePublicDisplayCandidate(title);
  const normalizedClient = normalizePublicDisplayCandidate(client);
  const titleKey = normalizedTitle ? foldGerman(normalizedTitle.toLocaleLowerCase("de-DE")) : "";
  const clientKey = normalizedClient ? foldGerman(normalizedClient.toLocaleLowerCase("de-DE")) : "";

  for (const candidate of candidates) {
    const location = pickValidatedPublicLocation(candidate);
    if (!location) continue;
    if (!normalizedTitle) return location;

    const locationKey = foldGerman(location.toLocaleLowerCase("de-DE"));
    if (clientKey && locationKey.length >= 10 && clientKey.includes(locationKey)) continue;
    if (locationKey.length >= 20 && (locationKey === titleKey || titleKey.startsWith(locationKey))) continue;
    return location;
  }

  return "";
};

/** Only builder output is safe to pass to the Markdown renderer. */
export const isCanonicalPublicDescriptionMarkdown = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.trim()) return false;
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0 || /^#{1,6}\s/u.test(value)) return false;
  const hasUnescapedMarkdown = (text: string): boolean => /(?:^|[^\\])(?:[`*_{}\[\]<>#|~]|\]\()/u.test(text);
  return lines.every((line) => {
    const match = line.match(/^- \*\*([^*]+):\*\* (.+)$/u);
    if (!match?.[1]) return false;
    if (!CANONICAL_DESCRIPTION_LABELS.has(match[1])) return false;
    if (!match[2]?.trim() || hasUnescapedMarkdown(match[2])) return false;
    if (match[1].toLocaleLowerCase("de-DE") === "hinweis") {
      return match[2].length <= 1_000 && !UNSAFE_CANONICAL_HINT.test(match[2]);
    }
    return normalizePublicDisplayCandidate(match[2]) !== null;
  });
};
