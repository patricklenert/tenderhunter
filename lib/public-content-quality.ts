import { decodeHtmlEntities, repairKnownGermanEncoding } from "@/lib/text-normalization";

const decodePublicHtmlEntities = decodeHtmlEntities;
const repairPublicEncoding = repairKnownGermanEncoding;

const MANGLED_KEYWORDS = [
  "auftraggeber", "vergabestelle", "beschaffer", "frist", "deadline",
  "ort der ausf", "ort der leistung", "ausfuehrungsort", "erfuellungsort",
  "vergabeart", "auftragswert", "auftragsgegenstand", "leistungsbeschreibung",
];

const GLUED_PORTAL_MARKERS = [
  "service.bund.deaktuelleausschreibungen",
  "haupt-navigations-menue",
  "haupt-navigations-menu",
  "meta-navigation",
  "andereausschreibungenimbereich",
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
  /vhb\s*[-\s]*(?:bund|ausgabe)|gaeb\s*[-\s]*(?:kalkulationssoftware)?|wingaeb\.xml/iu,
  /(?:angebotsabgabe|abgabe|einreichung).{0,80}(?:bestätigen|bestaetigen|abschließen|abschliessen)/iu,
  /(?:formblatt|bieter|bewerber|eigenerklärung|eigenerklaerung).{0,80}(?:unterschrift|rechtsverbindlich|eignung)/iu,
  /(?:massnahmennummer|maßnahmenummer|vergabenummer|vergabeart).{0,60}(?:bauleistung|bewerber|offenes verfahren)/iu,
  /(?:baumassnahme|baumaßnahme)\s+leistung\s+bewerber/iu,
  /(?:ausgabe\s+\d{4}\s+stand\s+\d{4}|mitglied\s+der\s+bewerber)/iu,
];

const OBVIOUS_FORM_DUMP_MARKERS = [
  /\bvhb(?:\s*[-/]\s*|\s+)nrw\b.{0,120}\bformular\s+412a\b.{0,40}\b\d{1,2}\s*[/.]\s*\d{4}\b.{0,100}\bauftragsbekanntmachung\b/iu,
  /\bformular\s*[-–—:]\s*(?:auftrags)?bekanntmachung\b/iu,
  /\bformular\s+(?:nr\.?\s*)?\d+\s*(?:[-–—:]\s*)?(?:auftrags)?bekanntmachung\b/iu,
  /\b(?:auftrags)?bekanntmachung\s*[-–—:]\s*formular\b/iu,
  /\beforms?\s*[-–—:]\s*(?:auftrags)?bekanntmachung\b/iu,
  /\b(?:auftrags)?bekanntmachung\s*[-–—:]\s*eforms?\b/iu,
];
const SERVICE_BUND_PUBLICATION_TEMPLATE_FRAGMENT = /\bauftragsbekanntmachung\b[\s\S]{0,120}\bausgabe\s+\d{1,2}\/\d{4}\s+seite\s+\d+\s+von\s+\d+[\s\S]{0,1000}\bvergabeunterlagen\s+werden\s+elektronisch\s+zur\s+verfügung\s+gestellt\b[\s\S]{0,1000}\bmaßnahmen\s+zum\s+schutz\s+vertraulicher\s+informationen\b/iu;
const SERVICE_BUND_OFFER_SUBMISSION_TEMPLATE_FRAGMENT = /\bzugelassene\s+angebotsabgabe\b[\s\S]{0,120}\belektronisch\s+in\s+textform\b[\s\S]{0,100}\bfortgeschrittener\s*\/\s*m\s+signatur\s*\/\s*siegel\b[\s\S]{0,100}\bqualifizierter\s*\/\s*m\s+signatur\s*\/\s*siegel\b/iu;
const SERVICE_BUND_CONFIDENTIALITY_TEMPLATE_FRAGMENT = /\bmaßnahmen\s+zum\s+schutz\s+vertraulicher\s+informationen\s*:\s*abgabe\s+verschwiegenheitserklärung\b/iu;

const NAVIGATION_MARKERS = [
  "service.bund.de - aktuelle ausschreibungen",
  "haupt-navigations-menü",
  "haupt-navigations-menu",
  "meta-navigation",
  "andere ausschreibungen im bereich",
  "ausschreibungen abonnieren",
];
const STANDALONE_PORTAL_LABEL = /^(?:anmelden|anmeldung|registrieren|registrierung|login|log\s*in|sign\s*in|alle ausschreibungen)[.!:…]*$/iu;
const STANDALONE_FORM_LABEL = /^formblatt\s+\d+$/iu;

const PLACEHOLDER = /^(?:n\/?a|na|n\.\s*a\.|tbd|unknown|unbekannt|vergessen\??|nicht bekannt|zweck|null|undefined|leer|nicht angegeben|keine angabe|[-–—]+)$/iu;
const FIELD_ONLY_ARTIFACT = /^(?:sart\b|verfahrensart|verfahren|auftraggeber|vergabestelle|auftragsgegenstand|leistungsumfang|leistungsort|erfüllungsort|ausführungsort|angebotsfrist|teilnahmefrist)\s*:/iu;
const CLIENT_FIELD_LABEL = /^(?:sart|verfahrensart|verfahren|auftraggeber|vergabestelle)\s*:?[\s-]*$/iu;
const STANDALONE_FIELD_LABEL = /^(?:bekanntmachung|beschreibung|kurzbeschreibung|auftragsgegenstand|leistungsumfang|leistungsort|erfüllungsort|ausführungsort|angebotsfrist|abgabefrist|teilnahmefrist|verfahren|verfahrensart|vergabestelle|auftraggeber)\s*$/iu;
const STANDALONE_PUBLIC_FRAGMENT = /^(?:beschreibt|vorinformationen|nicht\s+innerhalb(?:\s+einer)?|innerhalb\s+einer)\.?$/iu;
const FORM_FRAGMENT = /(?:gesetzlichen vertreter|beruflichen qualifikationen|nicht erforderlich\s*$|rechtsverbindlich(?:e|en)? erklärung)/iu;
const SOURCE_ERROR = /(?:die angegebene url.*(?:404|nicht gefunden)|keine ausschreibungsdaten vor|\bsource[\s_-]*error\b|\b(?:quell|quellen)[\s_-]*fehler\b)/iu;
const INTERNAL_DOCUMENT_MARKERS = /\[(?:rollen|rolle|dokument\s*[-–—]?\s*id)\s*:[^\]\r\n]*\]/iu;
const INLINE_MARKDOWN_HEADING = /(?:^|\s)#{1,6}(?=\s|$)/u;
const INLINE_MARKDOWN_LINK = /!?\[[^\]\r\n]+\]\([^\r\n]*\)/gu;
const INLINE_MARKDOWN_CODE = /(`+)[^`\r\n]+\1/gu;
const INLINE_MARKDOWN_FORMATTING = /(~~|\*\*|__)[^\r\n]+?\1|(\*|_)[^\r\n]+?\2/gu;
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

const isUnescapedAt = (value: string, index: number): boolean => {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) backslashes += 1;
  return backslashes % 2 === 0;
};

const hasInlineMarkdown = (value: string): boolean => {
  for (const match of value.matchAll(INLINE_MARKDOWN_LINK)) {
    const start = match.index ?? 0;
    const openBracket = start + match[0].indexOf("[");
    const closeBracket = start + match[0].indexOf("](");
    const openParenthesis = closeBracket + 1;
    const closeParenthesis = start + match[0].lastIndexOf(")");
    if ([openBracket, closeBracket, openParenthesis, closeParenthesis].every((index) => isUnescapedAt(value, index))) {
      return true;
    }
  }

  for (const [pattern, delimiterGroup] of [
    [INLINE_MARKDOWN_CODE, 1],
    [INLINE_MARKDOWN_FORMATTING, 1],
    [INLINE_MARKDOWN_FORMATTING, 2],
  ] as const) {
    for (const match of value.matchAll(pattern)) {
      const delimiter = match[delimiterGroup];
      if (!delimiter) continue;
      const start = match.index ?? 0;
      const close = start + match[0].lastIndexOf(delimiter);
      if (!isUnescapedAt(value, start) || !isUnescapedAt(value, close)) continue;
      if (delimiter.startsWith("_")
        && ((start > 0 && /[\p{L}\p{N}]/u.test(value[start - 1]))
          || /[\p{L}\p{N}]/u.test(value[close + delimiter.length] ?? ""))) continue;
      return true;
    }
  }

  return false;
};

const normalizePublicQualityText = (value: string): string =>
  repairPublicEncoding(decodePublicHtmlEntities(value)).replace(/\s+/g, " ").trim();

const PUBLIC_PAGE_MARKER = /\[\s*seite\s+\d+\s*(?:\/\s*\d+|von\s+\d+)?\s*\]/iu;
const PURE_PUBLIC_PAGE_MARKER = /^\s*\[\s*seite\s+\d+\s*(?:\/\s*\d+|von\s+\d+)?\s*\]\s*[-–—:|.]*\s*$/iu;
const PUBLIC_PAGE_DUMP_MARKERS = [
  /(?:auftrags)?bekanntmachung\b/iu,
  /\bausgabe\s+\d{1,2}\/\d{4}\b/iu,
  /\bseite\s+\d+\s+von\s+\d+\b/iu,
  /\b(?:telefon|tel\.?|fax|e-?mail|email)\b/iu,
  /\b(?:formular|formblatt|eforms?)\b/iu,
];
const COSINEX_PAGE_ARTIFACT_MARKERS = [
  /bekanntmachungs[-\s]?id\b/iu,
  /generierungsdatum\b/iu,
  /\bcosinex\b/iu,
  /\bbms\b/iu,
  /\bcsx\b/iu,
  /\bvo\s*:/iu,
  /\bvergabeart\b/iu,
];
const DOCUMENT_DUMP_HEADER = /^\s*={2,}\s*[^=\r\n]{1,240}\.(?:docx?|pdf|rtf|odt)\s*={2,}(?:\s|$)/iu;
const COVER_LETTER_BOILERPLATE = {
  departmentDate: /\bdienststelle\s+ort\s*,\s*datum\b/iu,
  procurementNumber: /\bvergabe\s*[-–—]?\s*nr\.?\b/iu,
};
const BIETERCOCKPIT_MARKER = /\bbietercockpit\b|\bbieter[\s-]+cockpit\b/iu;
const AI_BIETERCOCKPIT_MARKER = /\bai\s+bieter(?:cockpit|[\s-]+cockpit)\b/iu;
const BIETERCOCKPIT_MANUAL_MARKER = /\b(?:benutzerhandbuch|user-handbuch|handbuch|anleitung(?:en)?|registerkarte|f(?:ü|u)r\s+die\s+bearbeitung|angebotsabgabe\s+abschließen|angebotsabgabe\s+abschliessen)\b/iu;
const BIETERCOCKPIT_MANUAL_ONLY_MARKER = /\b(?:funktionsumfang|software[-\s]?dokumentation|programmstart|men(?:ü|u)leiste|vergaberecherche|leistungsverzeichnisverwaltung|mantelbogenverfahren|signaturverfahren|(?:benutzer|bieter)[-\s]?client)\b/iu;
const BIETERCOCKPIT_CONCRETE_TENDER_SCOPE_MARKER = /\b(?:liefer\w*|reinigung\w*|wartung\w*|bau(?:arbeiten|leistungen)?|sanierung\w*|dienstleistung\w*|beschaffung\w*|entwicklung\w*|planung\w*|beratung\w*|betreuung\w*|herstellung\w*|instandhaltung\w*|durchf(?:ü|u)hrung\w*|ausf(?:ü|u)hrung\w*|software(?:entwicklung|bereitstellung|pflege|wartung))\b/iu;
const DOCUMENT_INDEX_MARKERS = [
  /\babbildung\s+\d+/iu,
  /\binhaltsverzeichnis\b/iu,
  /\bnavigation\s+innerhalb\b/iu,
  /\b(?:programmstart|men(?:ü|u)leiste|signaturkarte|softzertifikat)\b/iu,
  /\bplattform[-\s]?übersicht\b/iu,
];
const NO_CONCRETE_TENDER_MARKER = /(?:\b(?:kein|keine[nr]?|nicht|ohne)\s+(?:eine?\s+)?(?:konkrete[nr]?|bestimmte[nr]?|spezifische[nr]?|eigene)?\s*ausschreibung(?:s?[-\s]?(?:text|daten|details|informationen))?\b|\bkeine[nr]?\s+(?:konkrete[nr]?|bestimmte[nr]?|spezifische[nr]?)\s+verfahrensinformationen\b|\bnicht\s+um\s+(?:eine\s+)?(?:konkrete[nr]?|spezifische[nr]?)\s+ausschreibung\b|\bkeine\s+informationen\s+zu\s+einem\s+spezifischen\s+(?:öffentlichen|oeffentlichen)\s+auftrag\b)/iu;
const DEUTSCHE_EVERGABE_DASHBOARD_MARKER = /\bdashboard\s+(?:der\s+)?deutschen?\s+e-?vergabe\b/iu;
const GENERIC_DASHBOARD_NAVIGATION_MARKER = /\b(?:allgemeine\s+plattform\s*[/|]\s*haupt[-\s]?navigation|haupt[-\s]?navigation\s*[/|]\s*allgemeine\s+plattform)\b/iu;
const EXCLUSIVE_MANUAL_MARKER = /\b(?:ausschließlich|ausschliesslich|nur)\b.{0,120}\b(?:benutzerhandbuch|user-handbuch|handbuch|anleitung|bietercockpit)\b/iu;
const STANDALONE_MANUAL = /^\s*(?:benutzerhandbuch|user-handbuch|handbuch|anleitung(?:en)?)\s*[.!:;]*\s*$/iu;

const PROCUREMENT_FORM_MARKERS = [
  /\beigenerklär(?:ung|ungen)\b|\beigenerklaer(?:ung|ungen)\b/iu,
  /\beignungsnachweis(?:e|en)?\b/iu,
  /\bnachweispflichten?\b/iu,
  /\bformbl(?:att|ätter|aetter)(?:e|en)?\b/iu,
  /\bvhb\b/iu,
  /\b(?:pflichtige|erforderliche)\s+(?:unterlagen|nachweise?)\b/iu,
];
const CHECKBOX_LOT_FORM_PREFIX = /^\s*[☒☐]\s*(?:alle|mehre?|mehrere(?:n)?|nur)\s+lose\b/iu;
const CHECKBOX_LOT_FORM_MARKERS = [
  /\bbeschr(?:änkung|aenkung)\b.{0,100}\blose\b/iu,
  /\bformular\s+311a\s+eu\b/iu,
];
const PORTAL_OVERVIEW_HEADER_MARKERS = [
  /\bvorinformationen\b/iu,
  /\b(?:aktuelle[nrs]?|laufende[nrs]?)\s+ausschreibungen\b/iu,
];
const PORTAL_WORKFLOW_MARKERS = [
  /\bvorinformationen\b/iu,
  /\b(?:aktuelle[nrs]?|laufende[nrs]?)\s+ausschreibungen\b/iu,
  /\bplattform\s+(?:ermöglicht|ermoeglicht)\s+(?:die\s+)?digitale\s+teilnahme\b/iu,
  /\beinsicht\s+(?:in\s+)?(?:die\s+)?vergabeunterlagen\b/iu,
  /\belektronische\s+angebotsabgabe\b/iu,
];
const COOKIE_MARKER = /\bcookie(?:s|[-\s]*(?:einstellungen|hinweis|banner|consent))?\b/iu;
const PUBLIC_SCOPE_MARKERS = [
  /\b(?:leistungsbeschreibung|leistungsumfang|leistungsgegenstand|auftragsgegenstand)\b/iu,
  /\b(?:ausgeschrieb(?:en|ene|ener|enes)|ausschreibung)\b.{0,80}\b(?:leistung|leistungen|arbeiten|lieferung|dienstleistung)\b/iu,
  /\bausgeschrieb\w*\s+leistung\w*\b/iu,
  /\b(?:bauarbeiten|bauleistungen|tiefbau|straßenbau|strassenbau|lieferung|lieferungen|dienstleistung(?:en)?|reinigung|wartung|sanierung|beschaffung|entwicklung|planung|beratung|betreuung|durchführung|durchfuehrung|ausführung|ausfuehrung|herstellung|instandhaltung|software|netzwerk|material|gerät|geraet)\b/iu,
  /\b(?:leistung|leistungen)\s+(?:umfasst|umfassen|ist|sind|betrifft|besteht)\b/iu,
  /\b(?:die|der|den|eine|einer|einem|das)\s+leistung(?:en)?\b/iu,
];
const ATTACHMENT_LABEL = /\b(?:anlage(?:n)?|anhang|formbl(?:att|ätter|aetter)|formular(?:e)?|unterlage(?:n)?)\b/iu;
const LEADING_NUMBERED_ATTACHMENT = /(?:^|\s)\d+\s*[.)-]\s*(?=(?:anlage(?:n)?|anhang|formbl(?:att|ätter|aetter)|formular(?:e)?|unterlage(?:n)?)\b)/giu;
const TRAILING_NUMBERED_ATTACHMENT = /\b(?:anlage(?:n)?|anhang|formbl(?:att|ätter|aetter)|formular(?:e)?|unterlage(?:n)?)\s*(?:nr\.?\s*)?\d+\b/giu;
const FORMAL_DOCUMENT_CUE = /\b(?:sehr\s+geehrte\s+damen\s+und\s+herren|vertragsbedingungen|anschreiben|dienststelle\s+ort\s*,\s*datum|formbl(?:att|ätter|aetter)|vergabe\s*[-–—]?\s*nr\.?)\b/iu;

const hasSubstantiveScope = (value: string): boolean => PUBLIC_SCOPE_MARKERS.some((pattern) => pattern.test(value));

const isCosinexPageArtifact = (value: string): boolean => {
  if (PURE_PUBLIC_PAGE_MARKER.test(value)) return true;
  if (!PUBLIC_PAGE_MARKER.test(value)) return false;
  return COSINEX_PAGE_ARTIFACT_MARKERS.some((pattern) => pattern.test(value))
    || PUBLIC_PAGE_DUMP_MARKERS.filter((pattern) => pattern.test(value)).length >= 2;
};

const isExplicitDocumentDump = (value: string): boolean =>
  DOCUMENT_DUMP_HEADER.test(value)
  || (COVER_LETTER_BOILERPLATE.departmentDate.test(value)
    && COVER_LETTER_BOILERPLATE.procurementNumber.test(value));

const isBietercockpitManualDump = (value: string): boolean => {
  if (!BIETERCOCKPIT_MARKER.test(value) && !AI_BIETERCOCKPIT_MARKER.test(value)) return false;
  const hasManualCue = BIETERCOCKPIT_MANUAL_MARKER.test(value);
  const hasManualOnlyCue = BIETERCOCKPIT_MANUAL_ONLY_MARKER.test(value);
  const hasNoTenderCue = NO_CONCRETE_TENDER_MARKER.test(value);
  return hasNoTenderCue
    || (hasManualCue && (!hasSubstantiveScope(value) || EXCLUSIVE_MANUAL_MARKER.test(value)))
    || (hasManualOnlyCue && !BIETERCOCKPIT_CONCRETE_TENDER_SCOPE_MARKER.test(value));
};

const isNoConcreteTenderExplanation = (value: string): boolean =>
  NO_CONCRETE_TENDER_MARKER.test(value);

const isDeutscheEvergabeDashboardArtifact = (value: string): boolean =>
  DEUTSCHE_EVERGABE_DASHBOARD_MARKER.test(value)
  || GENERIC_DASHBOARD_NAVIGATION_MARKER.test(value);

const isPureProcurementFormDump = (value: string): boolean => {
  const markerHits = PROCUREMENT_FORM_MARKERS.filter((pattern) => pattern.test(value)).length;
  return markerHits >= 2 && !hasSubstantiveScope(value);
};

const isCheckboxLotFormDump = (value: string): boolean =>
  CHECKBOX_LOT_FORM_PREFIX.test(value)
  && CHECKBOX_LOT_FORM_MARKERS.some((pattern) => pattern.test(value));

const isPortalWorkflowDump = (value: string): boolean => {
  if (!BIETERCOCKPIT_MARKER.test(value)) return false;
  const markerHits = PORTAL_WORKFLOW_MARKERS.filter((pattern) => pattern.test(value)).length;
  const hasPortalOverviewHeader = PORTAL_OVERVIEW_HEADER_MARKERS.some((pattern) => pattern.test(value));
  const hasWorkflowCue = PORTAL_WORKFLOW_MARKERS.slice(2).some((pattern) => pattern.test(value));
  return (hasPortalOverviewHeader && hasWorkflowCue)
    || (markerHits >= 2 && !hasSubstantiveScope(value));
};

const isCookieOrSourceQualificationDump = (value: string): boolean =>
  (COOKIE_MARKER.test(value) || SOURCE_ERROR.test(value))
  && PROCUREMENT_FORM_MARKERS.some((pattern) => pattern.test(value))
  && !hasSubstantiveScope(value);

const isPureFormalDocumentDump = (value: string): boolean => {
  const attachmentLabels = value.match(new RegExp(ATTACHMENT_LABEL.source, "giu"))?.length ?? 0;
  const leadingNumbered = value.match(LEADING_NUMBERED_ATTACHMENT)?.length ?? 0;
  const trailingNumbered = value.match(TRAILING_NUMBERED_ATTACHMENT)?.length ?? 0;
  const hasMultipleNumberedAttachments = attachmentLabels >= 2 && (leadingNumbered >= 2 || trailingNumbered >= 2);
  const hasFormalCue = FORMAL_DOCUMENT_CUE.test(value);
  const hasFormalSalutation = /\bsehr\s+geehrte\s+damen\s+und\s+herren\b/iu.test(value);

  if (hasMultipleNumberedAttachments && hasFormalSalutation) return true;
  if (hasMultipleNumberedAttachments && hasFormalCue && !hasSubstantiveScope(value)) return true;
  return hasFormalSalutation
    && /\b(?:anschreiben|vertragsbedingungen|formbl(?:att|ätter|aetter)|vergabe\s*[-–—]?\s*nr\.?)\b/iu.test(value)
    && !hasSubstantiveScope(value);
};

const isDocumentIndexArtifact = (values: readonly string[]): boolean => {
  if (values.length === 0) return false;
  const joined = values.join(" ");
  const markerHits = DOCUMENT_INDEX_MARKERS.filter((pattern) => pattern.test(joined)).length;
  return markerHits >= 2 && /\b\d+\.\d+\b/iu.test(joined);
};

export const isPublicDocumentArtifact = (value: string): boolean =>
  isCosinexPageArtifact(value)
  || isExplicitDocumentDump(value)
  || isBietercockpitManualDump(value)
  || isDeutscheEvergabeDashboardArtifact(value)
  || isNoConcreteTenderExplanation(value)
  || STANDALONE_MANUAL.test(value)
  || isCheckboxLotFormDump(value)
  || isPortalWorkflowDump(value)
  || isPureProcurementFormDump(value)
  || isCookieOrSourceQualificationDump(value)
  || isPureFormalDocumentDump(value);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const looksMangled = (value: string): boolean => {
  const glueMatches = value.match(/[a-zäöüß][A-ZÄÖÜ]/g);
  if ((glueMatches?.length ?? 0) >= 2) return true;
  const lower = foldGerman(value.toLowerCase());
  if (MANGLED_KEYWORDS.filter((keyword) => lower.includes(keyword)).length >= 2) return true;
  if (MANGLED_KEYWORDS.some((keyword) =>
    new RegExp(`[a-zäöüß]${escapeRegExp(keyword)}(?=[A-ZÄÖÜ0-9])`, "u").test(value))) return true;
  if (MANGLED_KEYWORDS.some((keyword) =>
    new RegExp(`${escapeRegExp(keyword)}[A-ZÄÖÜ]`, "iu").test(value))) return true;
  const compact = lower.replace(/\s+/g, "");
  return GLUED_PORTAL_MARKERS.some((marker) => compact.includes(marker));
};

export const isPublicNavigationSummary = (value: string): boolean => {
  const normalized = repairPublicEncoding(decodePublicHtmlEntities(value))
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de-DE");
  if (!normalized) return false;
  if (STANDALONE_PORTAL_LABEL.test(normalized)) return true;
  if (NAVIGATION_MARKERS.some((marker) => normalized.includes(marker))) return true;
  return normalized.includes("service.bund.de");
};

export const isPdfFormBoilerplate = (value: string): boolean => {
  if (!value) return false;
  const normalized = normalizePublicQualityText(value);
  const withoutServiceBundTemplate = normalized.replace(
    new RegExp(SERVICE_BUND_PUBLICATION_TEMPLATE_FRAGMENT.source, `${SERVICE_BUND_PUBLICATION_TEMPLATE_FRAGMENT.flags}g`),
    " ",
  ).trim();
  // Ignore this known fragment for whole-document checks only if other text remains.
  const documentText = withoutServiceBundTemplate.length >= 30 ? withoutServiceBundTemplate : normalized;
  if (isPublicDocumentArtifact(documentText)) return true;
  if (documentText.length < 30) return false;
  return OBVIOUS_FORM_DUMP_MARKERS.some((pattern) => pattern.test(documentText))
    || PDF_FORM_MARKERS.filter((pattern) => pattern.test(documentText)).length >= 2;
};

const isSpecificNoticeValue = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLocaleLowerCase("de");
  return normalized.length >= 8
    && !/^(?:öffentliche ausschreibung|auftragsbekanntmachung|vergabebekanntmachung|siehe vergabeunterlagen|gemäß vergabeunterlagen|keine angabe|nicht angegeben|wird nachgereicht|[-–—.\s]+)$/iu.test(normalized);
};

/** Recognize filled-in tender notices for internal analysis without changing public boilerplate filtering. */
export const isPopulatedTenderNotice = (value: string): boolean => {
  if (!value) return false;
  const normalized = normalizePublicQualityText(value);
  const reference = normalized.match(/\b(?:Vergabenummer|Vergabe\s*[-–—]?\s*Nr\.?|Aktenzeichen)\s*:?\s*([A-Z0-9][A-Z0-9._/-]{3,})\b/iu)?.[1];
  const hasReference = Boolean(reference && /\d/u.test(reference));
  const procedureTitle = normalized.match(/\bBezeichnung des Verfahrens\s*:\s*(.{12,160}?)(?=\s+\d+\.\s+[A-ZÄÖÜ])/iu)?.[1];
  const hasProcedureTitle = isSpecificNoticeValue(procedureTitle)
    && !/^(?:\d+\.\s*)?(?:art der vergabe|öffentliche ausschreibung|auftragsbekanntmachung)\b/iu.test(procedureTitle ?? "");
  const scope = normalized.match(/\b(?:Art\s+und\s+Umfang\s+der\s+Leistung|Art\s+der\s+Leistung|Leistungsgegenstand|Auftragsgegenstand)\s*[:)]\s*(.{4,100}?)(?=\s+(?:Umfang\b|[a-z]\)|Angebotsfrist\b|Abgabefrist\b|Frist\b)|[.;]|$)/iu)?.[1];
  const hasScope = isSpecificNoticeValue(scope)
    && !/\b(?:beschreibung der leistung|siehe|gemäß|laut vergabeunterlagen)\b/iu.test(scope ?? "");
  const hasDeadline = /\b(?:Angebotsfrist|Abgabefrist|Einreichungsfrist|Schlusstermin|Ablauf der Angebotsfrist)\b.{0,100}?\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/iu.test(normalized);

  const signalCount = [hasReference, hasProcedureTitle, hasScope, hasDeadline].filter(Boolean).length;
  const hasTenderIdentity = hasReference || hasProcedureTitle;
  const hasTenderDetail = hasProcedureTitle || hasScope || hasDeadline;
  return signalCount >= 2 && hasTenderIdentity && hasTenderDetail;
};

/** Detect a known service.bund.de notice template when it appears as a field value or quote. */
export const isPdfFormBoilerplateFragment = (value: string): boolean => {
  if (!value) return false;
  const normalized = repairPublicEncoding(decodePublicHtmlEntities(value))
    .replace(/\u00ad/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return isPdfFormBoilerplate(normalized)
    || SERVICE_BUND_PUBLICATION_TEMPLATE_FRAGMENT.test(normalized)
    || SERVICE_BUND_OFFER_SUBMISSION_TEMPLATE_FRAGMENT.test(normalized)
    || SERVICE_BUND_CONFIDENTIALITY_TEMPLATE_FRAGMENT.test(normalized);
};

const isLoginOrParticipationWall = (value: string): boolean =>
  /(?:login|log\s*in|sign\s*in|anmelden|registrieren).{0,100}(?:erforderlich|required|notwendig|zuerst|zugriff|benutzername|passwort)/iu.test(value)
  || /(?:melden\s+sie\s+sich(?:\s+an)?|loggen\s+sie\s+sich\s+ein|anmelden|registrieren).{0,100}\b(?:um|damit)\b.{0,120}\b(?:zugriff|ausschreibung|bekanntmachung|vergabeunterlagen|ausschreibungsunterlagen|unterlagen|leistungsbeschreibung|ausschreibungsdetails)\b/iu.test(value)
  || /(?:teilnahme|anmeldung|registrierung)\s+(?:ist\s+)?(?:erforderlich|notwendig).{0,100}\b(?:zugriff|vergabeunterlagen|ausschreibungsunterlagen|unterlagen|leistungsbeschreibung|ausschreibungsdetails)\b/iu.test(value)
  || /(?:passwort|benutzername).{0,120}(?:melden sie sich|anmelden|registrieren|zugriff)/iu.test(value)
  || /(?:melden sie sich|anmelden|registrieren).{0,120}(?:passwort|benutzername)/iu.test(value)
  || /zugriff\s+auf\s+(?:dieses\s+)?(?:modul|unterlagen).{0,120}(?:erhalten|teilnehmen|anmelden)/iu.test(value)
  || /(?:zugriff|unterlagen|leistungsbeschreibung).{0,120}(?:erst|nur|nach).{0,100}(?:teilnahme|registrierung|anmeldung)/iu.test(value)
  || /(?:m(?:ü|u)ssen sie|bitte).{0,100}(?:am vergabeverfahren teilnehmen|die teilnahme(?: am verfahren)? best(?:ä|ae)tigen)/iu.test(value)
  || /(?:vollst(?:ä|ae)ndige leistungsbeschreibung|vergabeunterlagen).{0,180}nach teilnahme/iu.test(value);

export const isRawPortalDescription = (value: string): boolean => {
  const normalized = foldGerman(normalizePublicQualityText(value))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  const markerHits = PORTAL_FIELD_MARKERS.filter((pattern) => pattern.test(normalized)).length;
  const hasNoticeHeader = /bekanntmachung\s+(?:oeffentliche\s+)?ausschreibung/iu.test(normalized);
  return (hasNoticeHeader && markerHits >= 1)
    || markerHits >= 3
    || isPublicDocumentArtifact(normalized);
};

const isMarkdownRemnant = (value: string): boolean => {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const separatorTokens = value.match(/(?:^|\s)[-–—_=|]{1,3}(?=\s|$)/g) ?? [];
  return lines.length === 0
    || lines.some((line) => /^#{1,6}(?:\s|$)/.test(line) || /^[-*+]\s/.test(line))
    || separatorTokens.length >= 5
    || lines.every((line) => /^[-–—=*_|#:]+$/.test(line));
};

// Some portals glue the end of a navigation label to the procedure value,
// e.g. "Offenes Verfahren (sangaben)". These fragments are not procedure
// facts; only the exact known trailing forms may be removed.
const PUBLIC_PROCEDURE_PORTAL_FRAGMENT = /\b(?:sangaben|losangaben|angaben\s+zu\s+den\s+losen)\b/iu;
const PUBLIC_PROCEDURE_PORTAL_FRAGMENT_ONLY = /^\s*\(?\s*(?:sangaben|losangaben|angaben\s+zu\s+den\s+losen)\s*\)?\s*$/iu;
const PUBLIC_PROCEDURE_PORTAL_SUFFIX = /(?:\s+\(?\s*(?:sangaben|losangaben|angaben\s+zu\s+den\s+losen)\s*\)?|\(\s*(?:sangaben|losangaben|angaben\s+zu\s+den\s+losen)\s*\))\s*$/iu;
const PUBLIC_PROCEDURE_DANGLING_SUFFIX = /\s+(?:mit|ohne)$/iu;
// One observed portal form cuts the known procedure label after this
// adjective. The omitted noun must not be completed; keep only the base.
const PUBLIC_PROCEDURE_TRUNCATED_ADJECTIVE_SUFFIX = /\s+mit\s+öffentlichem$/iu;

const normalizeProcedurePortalFragment = (value: string): string | null => {
  const trimmed = value.trim();
  const withoutTrailingPunctuation = trimmed.replace(/[.!?,;:]+$/u, "").trim();
  if (PUBLIC_PROCEDURE_PORTAL_FRAGMENT_ONLY.test(withoutTrailingPunctuation)) return null;

  let candidate = withoutTrailingPunctuation;
  let changed = false;
  while (PUBLIC_PROCEDURE_PORTAL_SUFFIX.test(candidate)) {
    const next = candidate.replace(PUBLIC_PROCEDURE_PORTAL_SUFFIX, "").trim();
    if (next === candidate) break;
    candidate = next;
    changed = true;
  }

  return changed ? candidate || null : trimmed;
};

// Access-page extraction can stop immediately before "Teilnahme", leaving a
// connector such as "mit" or "ohne" at the end of the procedure. Keep the
// factual base only; never complete the missing suffix ourselves.
const normalizeProcedureCandidateValue = (value: string): string | null => {
  const normalized = normalizeProcedurePortalFragment(value);
  if (!normalized) return null;

  const withoutTrailingPunctuation = normalized.replace(/[.!?,;:]+$/u, "").trim();
  if (/^(?:mit|ohne)$/iu.test(withoutTrailingPunctuation)) return null;

  const truncatedAdjectiveSuffix = withoutTrailingPunctuation.match(PUBLIC_PROCEDURE_TRUNCATED_ADJECTIVE_SUFFIX);
  if (truncatedAdjectiveSuffix?.index !== undefined) {
    const base = withoutTrailingPunctuation.slice(0, truncatedAdjectiveSuffix.index).trim();
    return base ? normalizeProcedurePortalFragment(base) : null;
  }

  const danglingSuffix = withoutTrailingPunctuation.match(PUBLIC_PROCEDURE_DANGLING_SUFFIX);
  if (!danglingSuffix || danglingSuffix.index === undefined) return normalized;

  const base = withoutTrailingPunctuation.slice(0, danglingSuffix.index).trim();
  return base ? normalizeProcedurePortalFragment(base) : null;
};

const ACCESS_ONLY_PUBLIC_PROCEDURE = /^(?:zugänglich|verfügbar|nicht\s+verfügbar|nicht\s+zugänglich)\.?$/iu;

const PUBLIC_CPV_PREFIX = /^\d{8}-\d(?=\s|$)/u;
const VMP_SEMVER_SUFFIX = /\s+VMP\s+\d+\.\d+\.\d+[.!?]?$/iu;

/** Remove the VMP portal version only from a CPV-prefixed subject value. */
export const normalizePublicCpvSubject = (value: string): string =>
  PUBLIC_CPV_PREFIX.test(value) ? value.replace(VMP_SEMVER_SUFFIX, "") : value;

const GENERATED_ACCESS_PREFIX = /^Für „([^“\r\n]{1,300})“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar\./iu;
const GENERATED_ACCESS_NOTE_TEXT = "Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal derzeit nicht öffentlich verfügbar.";
const GENERATED_ACCESS_NOTE = /(?:Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal derzeit nicht öffentlich verfügbar\.|Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich\.)$/iu;
const GENERATED_ACCESS_FACT_LABELS: Record<string, string> = {
  auftraggeber: "Auftraggeber",
  verfahren: "Verfahren",
  angebotsfrist: "Angebotsfrist",
  leistungsort: "Leistungsort",
  leistungsgegenstand: "Leistungsgegenstand",
  leistungsumfang: "Leistungsumfang",
};
const GENERATED_ACCESS_FACT = /^(Auftraggeber|Verfahren|Angebotsfrist|Leistungsort|Leistungsgegenstand|Leistungsumfang)\s*:\s*(.*?)\s*$/iu;
const GENERATED_ACCESS_EMBEDDED_FACT_LABEL = /(?:Auftraggeber|Verfahren|Angebotsfrist|Leistungsort|Leistungsgegenstand|Leistungsumfang)\s*:/iu;

type GeneratedAccessFact = {
  label: string;
  value: string;
};

type GeneratedAccessSummaryParse =
  | { kind: "not-generated" }
  | { kind: "invalid" }
  | { kind: "valid"; prefix: string; note: string; facts: GeneratedAccessFact[] };

const isAccessOnlyGeneratedProcedure = (value: string): boolean => {
  const normalized = value.replace(/[.!?]+$/u, "").replace(/\s+/g, " ").trim();
  return /^(?:zugänglich|verfügbar|nicht\s+verfügbar|nicht\s+zugänglich)$/iu.test(normalized)
    || isLoginOrParticipationWall(normalized)
    || /^(?:teilnehmen|bestätigen|zugriff|anmelden|anmeldung|registrieren|registrierung|login|log\s*in|sign\s*in|passwort|benutzername)\b/iu.test(normalized)
    || /^(?:teilnahme|anmeldung|registrierung|login|log\s*in|sign\s*in|zugriff|anmelden|registrieren)\b.{0,120}(?:erforderlich|notwendig|zuerst|bestätigen|zugänglich|verfügbar|erhalten)/iu.test(normalized)
    || /^(?:(?:nur|erst)\s+)?nach\s+(?:der\s+)?(?:teilnahme|anmeldung|registrierung)\b.*(?:zugänglich|verfügbar)$/iu.test(normalized)
    || /(?:vollständige\s+leistungsbeschreibung|vergabeunterlagen|folgende\s+vorteile|am\s+vergabeverfahren\s+teilnehmen)/iu.test(normalized);
};

const isSafeGeneratedAccessValue = (value: string): boolean => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 1_000) return false;
  if (
    INTERNAL_DOCUMENT_MARKERS.test(normalized)
    || INLINE_MARKDOWN_HEADING.test(normalized)
    || /�|Ã.|Â.|â[\u0080-\u00bf]|ð[\u0080-\u00bf]|&(?:#\d+|#x[\da-f]+|[a-z]+);/iu.test(normalized)
    || SOURCE_ERROR.test(normalized)
    || /<\/?[a-z][^>]*>/iu.test(normalized)
    || PLACEHOLDER.test(normalized)
    || STANDALONE_FIELD_LABEL.test(normalized)
    || FIELD_ONLY_ARTIFACT.test(normalized)
    || FORM_FRAGMENT.test(normalized)
    || isPublicNavigationSummary(normalized)
    || isPdfFormBoilerplate(normalized)
    || isLoginOrParticipationWall(normalized)
    || isRawPortalDescription(normalized)
    || looksMangled(normalized)
  ) return false;
  const lower = foldGerman(normalized.toLowerCase());
  return !lower.includes("vergabeplattform")
    && PORTAL_MARKERS.filter((marker) => lower.includes(marker)).length < 2;
};

const parseGeneratedAccessLimitedSummary = (value: string): GeneratedAccessSummaryParse => {
  const prefixMatch = value.match(GENERATED_ACCESS_PREFIX);
  if (!prefixMatch) return { kind: "not-generated" };

  const noteMatch = value.match(GENERATED_ACCESS_NOTE);
  const noteIndex = noteMatch?.index;
  if (!noteMatch || noteIndex === undefined || noteIndex <= prefixMatch[0].length) {
    return { kind: "invalid" };
  }

  const title = prefixMatch[1]?.trim() ?? "";
  if (!isSafeGeneratedAccessValue(title)) return { kind: "invalid" };

  const middleRaw = value.slice(prefixMatch[0].length, noteIndex);
  const middle = middleRaw.trim();
  if (!middle) {
    return { kind: "valid", prefix: prefixMatch[0], note: noteMatch[0], facts: [] };
  }

  const factHeader = middle.match(/^Öffentlich sichtbar sind\s*:\s*/iu);
  if (!factHeader) return { kind: "invalid" };

  let factText = middle.slice(factHeader[0].length).trim();
  factText = factText.replace(/[.!?]+$/u, "").replace(/(?:;\s*)+$/u, "").trim();
  if (!factText) {
    return { kind: "valid", prefix: prefixMatch[0], note: noteMatch[0], facts: [] };
  }

  const facts: GeneratedAccessFact[] = [];
  const seenLabels = new Set<string>();
  for (const rawFact of factText.split(/\s*;\s*/u)) {
    const factMatch = rawFact.match(GENERATED_ACCESS_FACT);
    if (!factMatch?.[1] || !factMatch[2]) return { kind: "invalid" };

    const key = factMatch[1].toLocaleLowerCase("de-DE");
    const label = GENERATED_ACCESS_FACT_LABELS[key];
    if (!label || seenLabels.has(label)) return { kind: "invalid" };

    let factValue = factMatch[2].replace(/[.!?]+$/u, "").trim();
    if (!factValue) return { kind: "invalid" };
    if (label === "Verfahren") {
      const normalizedProcedure = normalizeProcedureCandidateValue(factValue);
      if (!normalizedProcedure || isAccessOnlyGeneratedProcedure(normalizedProcedure)) continue;
      factValue = normalizedProcedure;
    }
    if (label === "Leistungsgegenstand") factValue = normalizePublicCpvSubject(factValue);
    if (GENERATED_ACCESS_EMBEDDED_FACT_LABEL.test(factValue)) return { kind: "invalid" };
    if (!isSafeGeneratedAccessValue(factValue)) return { kind: "invalid" };
    seenLabels.add(label);
    facts.push({ label, value: factValue });
  }

  return { kind: "valid", prefix: prefixMatch[0], note: noteMatch[0], facts };
};

// This is an intentionally generated, neutral explanation used when a portal
// exposes only public facts. It must not be confused with raw wall text, and
// malformed variants must not be allowed through the login-wall exception.
const isGeneratedAccessLimitedSummary = (value: string): boolean =>
  parseGeneratedAccessLimitedSummary(value).kind === "valid";

/** Remove only an invalid generated access fact; unknown variants are rejected. */
const normalizeGeneratedAccessLimitedSummary = (value: string): string | null | undefined => {
  const parsed = parseGeneratedAccessLimitedSummary(value);
  if (parsed.kind === "not-generated") return undefined;
  if (parsed.kind === "invalid") return null;
  const details = parsed.facts.map(({ label, value: factValue }) => `${label}: ${factValue}`).join("; ");
  const factSentence = details ? ` Öffentlich sichtbar sind: ${details}.` : "";
  return `${parsed.prefix}${factSentence} ${GENERATED_ACCESS_NOTE_TEXT}`;
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
  if (/^[,;:]/u.test(normalized)
    || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:[\s,].*)?$/u.test(normalized)
    || /\bname\s+und\s+anschrift\b/iu.test(normalized)
    || /\bvergabeunterlagen\b.{0,120}\b(?:angefordert|eingesehen|anforderung)\b/iu.test(normalized)
    || /^(?:bei|für|fuer|zur)\s+(?:der|dem|den|die)\b/iu.test(normalized)) return "";
  if (/(?:benutzername|passwort|login|anmeldung|registrieren|einladungscode|gesetzlichen vertreter|beruflichen qualifikationen|nicht erforderlich\s*$)/iu.test(normalized)) return "";
  return normalized;
};

/** Normalize one public display candidate, returning null for unsafe or unusable text. */
const normalizePublicDisplayCandidateInternal = (value: unknown, allowInlineMarkdown: boolean): string | null => {
  if (typeof value !== "string") return null;
  const decoded = repairPublicEncoding(decodePublicHtmlEntities(value))
    .replace(/\u00ad/g, "")
    .trim();
  if (!decoded || isMarkdownRemnant(decoded) || INTERNAL_DOCUMENT_MARKERS.test(decoded)
    || INLINE_MARKDOWN_HEADING.test(decoded)
    || (!allowInlineMarkdown && hasInlineMarkdown(decoded))) return null;
  const normalized = decoded
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const procedureNormalized = normalizeProcedurePortalFragment(normalized);
  if (!procedureNormalized) return null;
  const generated = normalizeGeneratedAccessLimitedSummary(procedureNormalized);
  if (generated === null) return null;
  const candidate = generated ?? procedureNormalized;
  if (!candidate || candidate.length > 5_000) return null;
  if (/�|Ã.|Â.|â[\u0080-\u00bf]|ð[\u0080-\u00bf]|&(?:#\d+|#x[\da-f]+|[a-z]+);/iu.test(candidate)) return null;
  if (SOURCE_ERROR.test(candidate)) return null;
  if (/<\/?[a-z][^>]*>/iu.test(candidate)) return null;
  if (PLACEHOLDER.test(candidate)
    || STANDALONE_PUBLIC_FRAGMENT.test(candidate)
    || STANDALONE_FORM_LABEL.test(candidate)
    || /^(?:\{\{.*\}\}|\[\[.*\]\]|\$\{.*\})$/u.test(candidate)) return null;
  if (/^sart$/iu.test(candidate) || STANDALONE_FIELD_LABEL.test(candidate)) return null;
  if (FIELD_ONLY_ARTIFACT.test(candidate) || FORM_FRAGMENT.test(candidate)) return null;
  if (
    isPublicNavigationSummary(candidate)
    || isPdfFormBoilerplateFragment(candidate)
    || (isLoginOrParticipationWall(candidate) && !isGeneratedAccessLimitedSummary(candidate))
  ) return null;
  if (isRawPortalDescription(candidate)) return null;
  if (looksMangled(candidate) && !isGeneratedAccessLimitedSummary(candidate)) return null;
  const lower = foldGerman(candidate.toLowerCase());
  if (lower.includes("vergabeplattform") || PORTAL_MARKERS.filter((marker) => lower.includes(marker)).length >= 2) return null;
  return candidate;
};

export const normalizePublicDisplayCandidate = (value: unknown): string | null =>
  normalizePublicDisplayCandidateInternal(value, false);

/** Validate builder input before it escapes inline Markdown syntax for display. */
export const normalizePublicDisplayCandidateForMarkdownEscaping = (value: unknown): string | null =>
  normalizePublicDisplayCandidateInternal(value, true);

const normalizeSourceEvidenceText = (value: string): string =>
  repairPublicEncoding(decodePublicHtmlEntities(value))
    .normalize("NFC")
    .replace(/[\u00ad\u200b\ufeff]/gu, "")
    .replace(/\u00a0/gu, " ")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const BUYER_SOURCE_LABEL = /[*_]{0,3}(?:(?:öffentlicher|oeffentlicher)\s+)?(?:auftraggeber(?:in)?|vergabestelle|beschaffer|ausschreibende(?:r|s)?\s+stelle|contracting\s+authority|buyer)[*_]{0,3}\s*[:\-]?\s*[*_]{0,3}\s*$/iu;
const LOCATION_SOURCE_LABEL = /[*_]{0,3}(?:leistungsort|erfüllungsort|erfuellungsort|ausführungsort|ausfuehrungsort|ort\s+der\s+(?:leistung|ausführung|ausfuehrung)|hauptleistungsort|location|place\s+of\s+performance)[*_]{0,3}\s*[:\-]?\s*[*_]{0,3}\s*$/iu;
const DEADLINE_SOURCE_LABEL = /[*_]{0,3}(?:angebotsfrist|abgabefrist|einreichungsfrist|bewerbungsschluss|teilnahmefrist|bietfrist|ablauf\s+der\s+(?:angebots)?frist|fristende|deadline|submission\s+deadline)[*_]{0,3}\s*[:\-]?\s*[*_]{0,3}\s*$/iu;
const EXPLICIT_DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\b/gu;

const dateAsIso = (value: string): string | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year)
      && date.getUTCMonth() + 1 === Number(month)
      && date.getUTCDate() === Number(day)
      ? `${year}-${month}-${day}`
      : null;
  }
  const german = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/u);
  if (!german) return null;
  const [, day, month, year] = german;
  return dateAsIso(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
};

const hasLabeledSourceValue = (candidate: string, source: string, label: RegExp): boolean => {
  let position = source.indexOf(candidate);
  while (position >= 0) {
    const before = source.slice(Math.max(0, position - 220), position);
    if (label.test(before) || label.test(candidate)) return true;
    position = source.indexOf(candidate, position + 1);
  }
  return false;
};

/**
 * Checks LLM-extracted public facts against source text. Free-form text must be
 * source-verbatim after only whitespace, HTML-entity, and known-encoding fixes.
 */
export const isSourceBackedPublicValue = (
  value: unknown,
  sourceText: string,
  field: "buyer" | "deadline" | "location" | "verbatim" = "verbatim",
): boolean => {
  if (typeof value !== "string" || !value.trim() || !sourceText) return false;
  const candidate = normalizeSourceEvidenceText(value);
  const source = normalizeSourceEvidenceText(sourceText);
  if (!candidate || !source) return false;

  if (field === "deadline") {
    const candidateDate = candidate.match(EXPLICIT_DATE)?.[0];
    const isoDate = candidateDate ? dateAsIso(candidateDate) : null;
    if (!isoDate) return false;
    const candidateTime = candidate.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/u);
    EXPLICIT_DATE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EXPLICIT_DATE.exec(source)) !== null) {
      if (dateAsIso(match[1]) !== isoDate) continue;
      const before = source.slice(Math.max(0, match.index - 220), match.index);
      if (!DEADLINE_SOURCE_LABEL.test(before)) continue;
      if (candidateTime) {
        const after = source.slice(match.index + match[0].length, match.index + match[0].length + 30);
        const sourceTime = after.match(/^\s*[,;]?\s*([01]?\d|2[0-3]):([0-5]\d)\b/u);
        if (!sourceTime || sourceTime[0].replace(/\D/gu, "") !== candidateTime[0].replace(/\D/gu, "")) continue;
      }
      EXPLICIT_DATE.lastIndex = 0;
      return true;
    }
    EXPLICIT_DATE.lastIndex = 0;
    return false;
  }

  if (!source.includes(candidate)) return false;
  if (field === "buyer") return hasLabeledSourceValue(candidate, source, BUYER_SOURCE_LABEL);
  if (field === "location") return hasLabeledSourceValue(candidate, source, LOCATION_SOURCE_LABEL);
  return true;
};

/** Remove unsupported LLM-produced tender facts before they reach persistence. */
export const groundPublicTenderFields = <T extends Record<string, unknown>>(fields: T, sourceText: string): T => {
  const grounded: Record<string, unknown> = { ...fields };
  const fieldRules: Array<[string, "buyer" | "deadline" | "location" | "verbatim", unknown]> = [
    ["title", "verbatim", ""],
    ["client", "buyer", ""],
    ["deadline", "deadline", null],
    ["description", "verbatim", ""],
    ["procedure", "verbatim", null],
    ["scope", "verbatim", ""],
    ["estimatedValue", "verbatim", null],
    ["duration", "verbatim", null],
    ["referenceNumber", "verbatim", null],
    ["location", "location", null],
    ["contact", "verbatim", ""],
  ];
  for (const [key, field, emptyValue] of fieldRules) {
    const value = grounded[key];
    if (value !== null && value !== undefined
      && (typeof value !== "string" || !isSourceBackedPublicValue(value, sourceText, field))) {
      grounded[key] = emptyValue;
      continue;
    }

    if (typeof value !== "string") continue;
    const normalized = key === "client"
      ? normalizePublicClient(value)
      : key === "procedure"
        ? normalizePublicProcedureCandidate(value)
        : key === "location"
          ? pickValidatedPublicLocationForTender(grounded.title, grounded.client, value)
          : normalizePublicDisplayCandidate(value);
    grounded[key] = normalized || emptyValue;
  }
  for (const key of ["requirements", "awardCriteria", "cpvCodes"]) {
    const value = grounded[key];
    if (Array.isArray(value)) {
      grounded[key] = value.flatMap((item) => {
        if (typeof item !== "string" || !isSourceBackedPublicValue(item, sourceText)) return [];
        const normalized = normalizePublicDisplayCandidate(item);
        return normalized ? [normalized] : [];
      });
    }
  }
  const pdfUrls = grounded.pdfUrls;
  if (Array.isArray(pdfUrls)) {
    grounded.pdfUrls = pdfUrls.filter((item) =>
      typeof item === "string" && isSourceBackedPublicValue(item, sourceText),
    );
  }
  return grounded as T;
};

type PublicProjectionField = "title" | "client" | "location" | "summary" | "descriptionMarkdown" | "procedure";

const parsePublicJsonValue = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/u.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

const projectionFieldKeys: Record<PublicProjectionField, string[]> = {
  title: ["title", "name"],
  client: ["client", "buyer", "authority", "contractingAuthority", "hard_facts", "hardFacts"],
  location: ["location", "city", "address", "hard_facts", "hardFacts"],
  summary: [
    "summary",
    "description",
    "subject",
    "scope",
    "decision_relevant",
    "decisionRelevant",
  ],
  descriptionMarkdown: ["descriptionMarkdown", "description_markdown", "markdown"],
  procedure: [
    "procedure",
    "procedure_type",
    "procedureType",
    "contract_type",
    "contractType",
    "procurement",
    "hard_facts",
    "hardFacts",
  ],
};

const projectionScalarKeys = ["text", "value", "label", "name", "code"];

const PROSE_CONNECTOR_WORDS = new Set([
  "aber", "als", "an", "auf", "aus", "bei", "bis", "das", "dass", "dem", "den", "der", "des",
  "die", "durch", "ein", "eine", "einer", "einem", "einen", "für", "gegen", "im", "in", "innerhalb",
  "ist", "mit", "nach", "nicht", "nur", "oder", "ohne", "sich", "sowie", "und", "von", "vor", "zu",
  "zum", "zur",
]);

const isLikelyTokenizedProseArray = (values: readonly string[]): boolean => {
  if (values.length < 2) return false;

  const oneWordValues = values.filter((value) => value.trim().split(/\s+/u).length === 1).length;
  const shortValues = values.filter((value) => {
    const normalized = value.trim();
    return normalized.length <= 40 && normalized.split(/\s+/u).length <= 2;
  }).length;
  const connectorValues = values.filter((value) => {
    const word = value.trim().toLocaleLowerCase("de-DE").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    return PROSE_CONNECTOR_WORDS.has(word);
  }).length;
  const joinedValues = values.join(" ");
  const hasManualArtifactCue = BIETERCOCKPIT_MARKER.test(joinedValues)
    && (BIETERCOCKPIT_MANUAL_MARKER.test(joinedValues)
      || BIETERCOCKPIT_MANUAL_ONLY_MARKER.test(joinedValues)
      || /\bbeschreibt\b/iu.test(joinedValues));
  const hasPortalArtifactCue = /\b(?:vorinformationen|plattform|vergabeverfahren)\b/iu.test(joinedValues)
    && /\b(?:teilnahme|einsicht|vergabeunterlagen|bietercockpit)\b/iu.test(joinedValues);

  return oneWordValues >= Math.ceil(values.length * 0.75)
    && shortValues >= Math.ceil(values.length * 0.75)
    && (connectorValues > 0 || hasManualArtifactCue || hasPortalArtifactCue);
};

/**
 * Expand one untrusted value without ever stringifying an entire object into
 * public prose. Nested structured values are traversed in their canonical
 * priority order; arrays found inside a prose field also get a joined
 * candidate so a scope list can become a readable summary.
 */
const expandProjectionCandidate = (
  value: unknown,
  field: PublicProjectionField,
  depth = 0,
): unknown[] => {
  if (depth > 8 || value === null || value === undefined) return [];

  const parsed = parsePublicJsonValue(value);
  if (parsed !== value) return expandProjectionCandidate(parsed, field, depth + 1);

  if (typeof value === "string" || typeof value === "number") return [value];

  if (Array.isArray(value)) {
    const scalarValues = value
      .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
      .map(String)
      .filter((item) => item.trim().length > 0);
    const expanded = value.flatMap((item) => expandProjectionCandidate(item, field, depth + 1));
    if (scalarValues.length > 1 && isLikelyTokenizedProseArray(scalarValues)) {
      const nestedExpanded = value
        .filter((item) => item !== null && typeof item === "object")
        .flatMap((item) => expandProjectionCandidate(item, field, depth + 1));
      return [scalarValues.join(" "), ...nestedExpanded];
    }
    if ((field === "summary" || field === "descriptionMarkdown") && scalarValues.length > 1) {
      return [scalarValues.join(" "), ...expanded];
    }
    return expanded;
  }

  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const knownValues = projectionFieldKeys[field].flatMap((key) => (
    Object.prototype.hasOwnProperty.call(record, key)
      ? expandProjectionCandidate(record[key], field, depth + 1)
      : []
  ));
  if (knownValues.length > 0) return knownValues;

  return projectionScalarKeys.flatMap((key) => (
    Object.prototype.hasOwnProperty.call(record, key)
      ? expandProjectionCandidate(record[key], field, depth + 1)
      : []
  ));
};

const projectionCandidates = (
  value: unknown | readonly unknown[] | undefined,
  field: PublicProjectionField,
): unknown[] => {
  const values = value === undefined ? [] : Array.isArray(value) ? [...value] : [value];
  const expanded = values.flatMap((candidate) => expandProjectionCandidate(candidate, field));
  return expanded.filter((candidate, index, candidates) => {
    if (typeof candidate !== "string") return true;
    return candidates.findIndex((other) => other === candidate) === index;
  });
};

/**
 * Normalize a structured text list without turning tokenized prose into a
 * collection of individually valid words. Phrase arrays and real short lists
 * remain itemized; a likely sentence split into tokens is rejected as a unit.
 */
export const normalizePublicTextList = (value: unknown): string[] => {
  const parsed = parsePublicJsonValue(value);
  const values = Array.isArray(parsed) ? parsed : [parsed];
  const scalarValues = values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  const joined = scalarValues.join(" ");
  if (isLikelyTokenizedProseArray(scalarValues)
    || isDocumentIndexArtifact(scalarValues)
    || isPublicDocumentArtifact(joined)) return [];

  const normalized = scalarValues
    .map((item) => STANDALONE_FORM_LABEL.test(item)
      ? normalizePublicQualityText(item)
      : normalizePublicDisplayCandidate(item))
    .filter((item): item is string => Boolean(item));
  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = item.toLocaleLowerCase("de-DE");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Normalize an authority independently from any description or location fallback. */
export const normalizePublicClient = (value: unknown, fallback = ""): string => {
  for (const candidate of [...projectionCandidates(value, "client"), ...projectionCandidates(fallback, "client")]) {
    const normalized = normalizePublicClientValue(candidate);
    if (normalized) return normalized;
  }
  return "";
};

/** Select the first authority that passes the same normalization and validation. */
export const pickValidatedPublicClient = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    for (const expanded of projectionCandidates(candidate, "client")) {
      const normalized = normalizePublicClientValue(expanded);
      if (normalized) return normalized;
    }
  }
  return "";
};

/** Select the first candidate that passes the same normalization and validation. */
export const pickValidatedPublicCandidate = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    for (const expanded of projectionCandidates(candidate, "summary")) {
      const normalized = normalizePublicDisplayCandidate(expanded);
      if (normalized) return normalized;
    }
  }
  return "";
};

/** Select the first public prose candidate that is both display-safe and backed by its source. */
export const pickSourceBackedPublicCandidate = (sourceText: string, ...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    for (const expanded of projectionCandidates(candidate, "summary")) {
      const normalized = normalizePublicDisplayCandidate(expanded);
      if (normalized && isSourceBackedPublicValue(normalized, sourceText)) return normalized;
    }
  }
  return "";
};

/** Normalize and select public procedure values without inventing a value. */
export const normalizePublicProcedureCandidate = (value: unknown): string | null => {
  const normalized = normalizePublicDisplayCandidate(value);
  const procedure = normalized ? normalizeProcedureCandidateValue(normalized) : null;
  if (!procedure || ACCESS_ONLY_PUBLIC_PROCEDURE.test(procedure) || PUBLIC_PROCEDURE_PORTAL_FRAGMENT.test(procedure)) return null;
  if (procedure !== normalized && !normalizePublicDisplayCandidate(procedure)) return null;
  return procedure;
};

/** Select the first valid procedure, allowing later aliases to replace portal residue. */
export const pickValidatedPublicProcedure = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    for (const expanded of projectionCandidates(candidate, "procedure")) {
      const normalized = normalizePublicProcedureCandidate(expanded);
      if (normalized) return normalized;
    }
  }
  return "";
};

const LOCATION_ARTIFACTS = /(?:karte\s+anschauen|anzahl\s+lose|nuts(?:-\d+)?[-\s]code|ort\s+der\s+(?:leistung(?:serbringung)?|ausfuehrung|ausführung)|erfuellungsort|erfüllungsort|postleitzahl|hinweis\s*:|zu\s+(?:richten|senden|uebermitteln|übermitteln)\b)/iu;

/** Location fields need stricter checks because portals expose labels as values. */
export const pickValidatedPublicLocation = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    for (const expanded of projectionCandidates(candidate, "location")) {
      const locationCandidate = typeof expanded === "string"
        ? expanded.replace(/^(?:Haupterfüllungsort|Erfüllungsort|Ausführungsort|Hauptleistungsort|Leistungsort)\s*:\s*/iu, "")
        : expanded;
      const normalized = normalizePublicDisplayCandidate(locationCandidate);
      if (normalized && !LOCATION_ARTIFACTS.test(normalized)) return normalized;
    }
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
  const hasUnescapedMarkdown = (text: string): boolean => {
    for (let index = 0; index < text.length; index += 1) {
      if (!"`*_{}[]<>#|~".includes(text[index])) continue;
      let precedingBackslashes = 0;
      for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
        precedingBackslashes += 1;
      }
      if (precedingBackslashes % 2 === 0) return true;
    }
    return false;
  };
  return lines.every((line) => {
    const match = line.match(/^- \*\*([^*]+):\*\* (.+)$/u);
    if (!match?.[1]) return false;
    if (!CANONICAL_DESCRIPTION_LABELS.has(match[1])) return false;
    if (!match[2]?.trim() || hasUnescapedMarkdown(match[2])) return false;
    if (match[1].toLocaleLowerCase("de-DE") === "hinweis") {
      return match[2].length <= 1_000
        && !UNSAFE_CANONICAL_HINT.test(match[2])
        && normalizePublicDisplayCandidate(match[2]) !== null;
    }
    return normalizePublicDisplayCandidate(match[2]) !== null;
  });
};

/** True when canonical Markdown already presents a fact section elsewhere in the detail view. */
export const hasCanonicalPublicDescriptionSection = (value: unknown, label: string): boolean =>
  isCanonicalPublicDescriptionMarkdown(value)
  && CANONICAL_DESCRIPTION_LABELS.has(label)
  && value.split(/\r?\n/u).some((line) => line.trim().startsWith(`- **${label}:**`));

/** Select the first generated, canonical Markdown candidate. */
export const pickCanonicalPublicDescriptionMarkdown = (...candidates: unknown[]): string | null =>
  projectionCandidates(candidates, "descriptionMarkdown")
    .find((candidate): candidate is string => isCanonicalPublicDescriptionMarkdown(candidate)) ?? null;

export interface PublicDisplayProjectionInput {
  title?: unknown | readonly unknown[];
  client?: unknown | readonly unknown[];
  location?: unknown | readonly unknown[];
  summary?: unknown | readonly unknown[];
  description?: unknown | readonly unknown[];
  descriptionMarkdown?: unknown | readonly unknown[];
}

export interface PublicDisplayProjection {
  title: string | null;
  client: string | null;
  location: string | null;
  summary: string | null;
  description: string | null;
  descriptionMarkdown: string | null;
}

/**
 * Project all public tender display fields through one deterministic boundary.
 * Callers may provide fallback candidates in priority order; each candidate is
 * normalized and validated before the next one is considered.
 */
export const projectPublicDisplayFields = (
  input: PublicDisplayProjectionInput,
): PublicDisplayProjection => {
  const title = pickValidatedPublicCandidate(...projectionCandidates(input.title, "title")) || null;
  const client = pickValidatedPublicClient(...projectionCandidates(input.client, "client")) || null;
  const location = pickValidatedPublicLocationForTender(
    title,
    client,
    ...projectionCandidates(input.location, "location"),
  ) || null;
  const description = pickValidatedPublicCandidate(
    ...projectionCandidates(input.summary, "summary"),
    ...projectionCandidates(input.description, "summary"),
  ) || null;
  const descriptionMarkdown = projectionCandidates(input.descriptionMarkdown, "descriptionMarkdown")
    .find((candidate): candidate is string => isCanonicalPublicDescriptionMarkdown(candidate)) ?? null;

  return {
    title,
    client,
    location,
    summary: description,
    description,
    descriptionMarkdown,
  };
};

export interface PublicTenderProjectionInput {
  title?: unknown;
  metadata?: unknown;
  structured?: unknown;
  clientFallbacks?: readonly unknown[];
  locationFallbacks?: readonly unknown[];
  summaryFallbacks?: readonly unknown[];
  descriptionMarkdownFallbacks?: readonly unknown[];
}

/**
 * Project a tender's legacy metadata and current structured data with one
 * stable precedence order. The raw analysis corpus is deliberately absent
 * from this API: callers may use it for freshness/access detection, but must
 * never pass it as public prose.
 */
export const projectPublicTenderRecord = (
  input: PublicTenderProjectionInput,
): PublicDisplayProjection => {
  const structured = input.structured === undefined ? [] : [input.structured];
  const metadata = input.metadata === undefined ? [] : [input.metadata];
  return projectPublicDisplayFields({
    title: [input.title, ...structured, ...metadata],
    client: [...structured, ...metadata, ...(input.clientFallbacks ?? [])],
    location: [...structured, ...metadata, ...(input.locationFallbacks ?? [])],
    summary: [...structured, ...metadata, ...(input.summaryFallbacks ?? [])],
    descriptionMarkdown: [
      ...structured,
      ...metadata,
      ...(input.descriptionMarkdownFallbacks ?? []),
    ],
  });
};
