export type AccessPageReason =
  | "cookies_required"
  | "login_required"
  | "access_denied"
  | "session_expired"
  | "not_found"
  | "paywall_or_terms"
  | "navigation_page"
  | "participation_required";

export interface AccessPageDetection {
  blocked: boolean;
  reason: AccessPageReason | null;
  confidence: number;
  signals: string[];
}

interface DetectAccessPageOptions {
  title?: string;
  url?: string;
}

const stripMarkup = (value: string): string =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasAny = (value: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(value));

const PARTICIPATION_WALL_PATTERNS: RegExp[] = [
  /um zugriff auf dieses modul zu erhalten[^.]{0,80}vergabeverfahren teilnehmen/,
  /müssen sie am vergabeverfahren teilnehmen/,
  /bestätigen sie die teilnahme am verfahren um folgende vorteile/,
  /ohne bestätigung der teilnahme an diesem verfahren[^.]{0,60}keine e-?mail benachrichtigung/,
  /teilen sie sich dem vergabeverfahren zu/,
];

/** Returns true for VMPCenter/VMPSatellite "participation wall" boilerplate that
 *  gates the actual tender documents behind a "Jetzt teilnehmen" confirmation. */
export function isParticipationWallText(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return PARTICIPATION_WALL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function detectAccessPage(
  text: string,
  options: DetectAccessPageOptions = {},
): AccessPageDetection {
  const content = stripMarkup([options.title, text].filter(Boolean).join(" "));
  const url = (options.url ?? "").toLowerCase();
  const signals: string[] = [];

  const cookieRequired = hasAny(content, [
    /fehlend(?:e|en|er)? cookies?/,
    /missing cookies?/,
    /cookies?\s+(?:are\s+)?(?:required|needed|not enabled)/,
    /(?:enable|aktivieren|erlauben)\s+(?:your\s+)?cookies?/,
    /cookies?.{0,30}(?:erforderlich|aktiviert werden müssen)/,
  ]);
  if (cookieRequired) signals.push("cookies_required");

  const loginRequired = hasAny(content, [
    /(?:login|log in|sign in|anmelden).{0,50}(?:required|erforderlich|notwendig|first|zuerst)/,
    /(?:please|bitte)\s+(?:log in|sign in|anmelden)/,
    /zugriff nur nach anmeldung/,
    /authentication required/,
  ]) || /(?:\/|^)(?:login|signin|sign-in|account\/login|auth\/realms)(?:\/|\?|$)/.test(url);
  if (loginRequired) signals.push("login_required");

  const accessDenied = hasAny(content, [
    /access denied/,
    /zugriff verweigert/,
    /unauthori[sz]ed/,
    /not authorized/,
    /kein zugriff auf diese seite/,
  ]);
  if (accessDenied) signals.push("access_denied");

  const sessionExpired = hasAny(content, [
    /session (?:has )?expired/,
    /sitzung ist abgelaufen/,
    /ihre sitzung wurde beendet/,
    /session abgelaufen/,
  ]);
  if (sessionExpired) signals.push("session_expired");

  const notFound = hasAny(content, [
    /requested url was not found/,
    /seite konnte nicht gefunden werden/,
    /seite nicht gefunden/,
    /404\s+not found/,
    /the requested url/,
  ]);
  if (notFound) signals.push("not_found");

  const paywallOrTerms = hasAny(content, [
    /nutzungsbedingungen für bieter/,
    /rib tender/,
    /jetzt freischalten/,
    /kostenfreier zugang/,
    /paywall/,
    /subscribe to access/,
    /partner(?:system|portal)/,
  ]);
  if (paywallOrTerms) signals.push("paywall_or_terms");

  const participationWall = isParticipationWallText(content);
  if (participationWall) signals.push("participation_required");

  const navigationPage = hasAny(content, [
    /ausschreibungen finden/,
    /alle ausschreibungen/,
    /suchergebnisse?\b/,
    /kategorie(?:n|übersicht)?/,
  ]);
  const tenderSignals = hasAny(content, [
    /angebotsfrist|einreichungsfrist|submission deadline/,
    /auftraggeber|vergabestelle|contracting authority/,
    /leistungsumfang|gegenstand der beschaffung|scope of (?:the )?contract/,
    /verfahrensart|procedure type/,
  ]);
  if (navigationPage && !tenderSignals) signals.push("navigation_page");

  const strongBlocked = cookieRequired || accessDenied || sessionExpired || notFound || paywallOrTerms || participationWall;
  const blocked = strongBlocked || (loginRequired && content.length < 8000) || (navigationPage && !tenderSignals);
  if (!blocked) {
    return { blocked: false, reason: null, confidence: 0, signals };
  }

  const reason: AccessPageReason = cookieRequired
    ? "cookies_required"
    : loginRequired
      ? "login_required"
      : accessDenied
        ? "access_denied"
        : sessionExpired
          ? "session_expired"
          : notFound
            ? "not_found"
            : paywallOrTerms
              ? "paywall_or_terms"
              : participationWall
                ? "participation_required"
                : "navigation_page";

  const confidence = Math.min(1, 0.7 + Math.max(0, signals.length - 1) * 0.1);
  return { blocked: true, reason, confidence, signals };
}
