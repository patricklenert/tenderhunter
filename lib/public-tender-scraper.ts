import OpenAI from "openai";
import * as cheerio from "cheerio";
import { scrapeWebsite, htmlToBasicMarkdown, type ScrapedPage } from "@/lib/firecrawl";
import { callLLM } from "@/lib/llm";
import { detectAccessPage, isParticipationWallText } from "@/lib/access-page-detector";
import { stripSessionId } from "@/lib/tender-identity";
import { settings } from "@/lib/config";
import type { JsonValue } from "@/lib/types";
import { decodeHtmlEntities } from "@/lib/text-normalization";
import { buildTenderDescriptionMarkdown, escapeMarkdownText } from "@/lib/tender-description";
import {
  cursorBoolean,
  cursorNumber,
  cursorString,
  cursorPendingDetails,
  cursorPosition,
  createPublicSourceCursorV2,
  encodeDtvpSearchHash,
  publicDetailReference,
  sourceResult,
  type PublicCursorCommit,
  type PublicDetailReference,
  type PublicSourceCursor,
  type PublicSourceScrapeResult,
} from "@/lib/public-pagination";
import { canonicalPublicTenderUrl, derivePublicExternalId, resolvePublicSourceKey } from "@/lib/public-source-registry";
import {
  extractResourcesFromHtml,
  mergeDiscoveredResources,
  rankSubpageCandidates,
  type DiscoveredResource,
  type RankedSubpageCandidate,
} from "@/lib/resource-discovery";

const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";

function fixBrokenUmlauts(text: string): string {
  // Replace U+FFFD (replacement char) with nothing — the original char is lost
  let result = text.replace(/\uFFFD/g, "");
  // Fix known broken German words from Latin-1/UTF-8 mojibake
  const fixes: [RegExp, string][] = [
    [/Strasse/g, "Straße"], [/strasse/g, "straße"],
    [/Gebaeude/g, "Gebäude"], [/gebaeude/g, "gebäude"],
    [/Gelaende/g, "Gelände"], [/gelaende/g, "gelände"],
    [/Friedhoefe/g, "Friedhöfe"], [/friedhoefe/g, "friedhöfe"],
    [/Plaetze/g, "Plätze"], [/plaetze/g, "plätze"],
    [/Gruenflaeche/g, "Grünfläche"], [/gruenflaeche/g, "grünfläche"],
    [/Gruen/g, "Grün"], [/gruen/g, "grün"],
    [/Baeume/g, "Bäume"], [/baeume/g, "bäume"],
    [/Muell/g, "Müll"], [/muell/g, "müll"],
    [/Staedtisch/g, "Städtisch"], [/staedtisch/g, "städtisch"],
    [/gaertnerisch/g, "gärtnerisch"], [/Gaertnerisch/g, "Gärtnerisch"],
    [/oeffentl/g, " öffentl"], [/Oeffentl/g, "Öffentl"],
    [/ueber/g, "über"], [/Ueber/g, "Über"],
    [/waehr/g, "währ"], [/Waehr/g, "Währ"],
    [/Kaelte/g, "Kälte"], [/kaelte/g, "kälte"],
    [/naechst/g, "nächst"], [/Naechst/g, "Nächst"],
    [/Entwaesser/g, "Entwässer"], [/entwaesser/g, "entwässer"],
    [/Aussen/g, "Außen"], [/aussen/g, "außen"],
    [/flaeche/g, "fläche"], [/Flaeche/g, "Fläche"],
  ];
  for (const [pattern, replacement] of fixes) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripLeadingReference = (title: string, referenceNumber?: string | null): string => {
  const reference = typeof referenceNumber === "string"
    ? decodeHtmlEntities(referenceNumber).replace(/\s+/g, " ").trim()
    : "";
  if (!reference) return title;

  const match = title.match(new RegExp(`^${escapeRegExp(reference)}\\s*[:\\-–—]\\s*(.+)$`, "i"));
  const candidate = match?.[1]?.trim() ?? "";
  return candidate.length >= 5 ? candidate : title;
};

export function cleanTenderTitle(raw: string, referenceNumber?: string | null): string {
  let title = decodeHtmlEntities(raw);
  // Remove external IDs like CXS0YYZYT24PNNN6, CXVHY6NYT2K6KVF0
  title = title.replace(/\bCX[A-Z0-9]{6,}\b/g, "");
  // Remove URLs like www.vergabe.metropoleruhr.de
  title = title.replace(/www\.[a-z0-9.-]+\.[a-z]{2,}/gi, "");
  // Remove protocol URLs
  title = title.replace(/https?:\/\/[^\s|]+/g, "");
  // Remove pipe separators and surrounding whitespace
  title = title.replace(/\s*\|\s*/g, " ");
  // Fix broken umlauts ( mojibake from Latin-1/UTF-8 mismatch)
  title = fixBrokenUmlauts(title);
  // Collapse whitespace
  title = title.replace(/\s+/g, " ").trim();
  // Remove trailing dashes or pipes
  title = title.replace(/[\s|\-]+$/, "").trim();
  return stripLeadingReference(title, referenceNumber);
}

/** NetServer pages put the portal heading before the actual notice heading. */
export function extractNetServerTenderTitle(markdown: string): string | null {
  const headings = Array.from(markdown.matchAll(/^\s*#{1,6}\s+(.+?)\s*$/gm))
    .map((match) => cleanTenderTitle(match[1] ?? ""))
    .filter(Boolean);
  const noticeIndex = headings.findIndex((heading) => /^bekanntmachung$/i.test(heading));
  const candidate = noticeIndex >= 0
    ? headings.slice(noticeIndex + 1).find((heading) => !NON_TENDER_TITLE_PATTERNS.some((pattern) => pattern.test(heading)))
    : null;
  return candidate && isLikelyTender(candidate, "") ? candidate : null;
}

async function fetchWithEncoding(url: string, timeout = 20000): Promise<string> {
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get("content-type") ?? "";
  const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
  let charset = charsetMatch?.[1]?.toLowerCase() ?? "";
  if (!charset) {
    const head = buf.toString("ascii", 0, Math.min(2000, buf.length));
    const metaMatch = head.match(/charset[=:]\\s*"?([a-z0-9_-]+)/i);
    charset = metaMatch?.[1]?.toLowerCase() ?? "";
  }
  if (charset.includes("latin") || charset.includes("iso-8859") || charset.includes("windows-1252")) {
    return buf.toString("latin1");
  }
  return buf.toString("utf-8");
}

function normalizePublicMarkupText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PAGINATION_PARAM_NAMES = [
  "page",
  "seite",
  "start",
  "offset",
  "Start",
  "TablePage",
  "selectedTablePagePROJECT_RESULT",
] as const;

const paginationNumber = (url: URL): number | null => {
  for (const name of PAGINATION_PARAM_NAMES) {
    const value = url.searchParams.get(name);
    if (value === null) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export function parseGenericPaginationUrls(html: string, baseUrl: string, currentUrl = baseUrl): string[] {
  const $ = cheerio.load(html);
  const current = new URL(currentUrl, baseUrl);
  const currentPage = paginationNumber(current);
  const urls = new Map<string, number | null>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;

    const text = $(element).text().replace(/\s+/g, " ").trim();
    const inPagination = $(element).closest("nav, .pagination, .pager, [class*=pagination], [class*=pager]").length > 0;
    const paginationHint = PAGINATION_PARAM_NAMES.some((name) => href.includes(`${name}=`))
      || /^(?:next|weiter|naechste|nächste|more|vor|>)(?:\s|$)/i.test(text);
    if (!inPagination && !paginationHint) return;

    try {
      const url = new URL(href, current);
      const value = paginationNumber(url);
      if (url.href === current.href) return;
      if (value !== null && currentPage !== null && value <= currentPage) return;
      urls.set(url.href, value);
    } catch {
      // Ignore malformed portal links.
    }
  });

  return Array.from(urls.entries())
    .sort((left, right) => {
      if (left[1] === null && right[1] === null) return left[0].localeCompare(right[0]);
      if (left[1] === null) return 1;
      if (right[1] === null) return -1;
      return left[1] - right[1];
    })
    .map(([url]) => url);
}

export function parseDtvpPageInfo(html: string): { page: number; totalPages: number } | null {
  const text = cheerio.load(html).text().replace(/\s+/g, " ");
  const match = text.match(/Seite:\s*(\d+)\s+von\s+(\d+)/i);
  if (!match) return null;
  return { page: Number(match[1]), totalPages: Number(match[2]) };
}

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY ist nicht gesetzt.");
    openaiClient = new OpenAI({ apiKey: openrouterKey, baseURL: "https://openrouter.ai/api/v1" });
  }
  return openaiClient;
}

export const TENDER_CATEGORIES = [
  "Bauarbeiten",
  "Tiefbau",
  "TGA",
  "Gebaeudereinigung",
  "Winterdienst",
  "Gartenarbeiten",
  "Gruenflaechenpflege",
  "Facility Management",
  "Immobilienverwaltung",
  "Planungsleistungen",
  "IT-Dienstleistungen",
  "Lieferung",
  "Sonstiges",
] as const;

export type TenderCategory = (typeof TENDER_CATEGORIES)[number];

export interface ExtractedTender {
  title: string;
  client: string;
  deadline: string | null;
  description: string;
  descriptionMarkdown: string;
  procedure?: string | null;
  estimatedValue?: string | null;
  duration?: string | null;
  requirements?: string[];
  awardCriteria?: string[];
  cpvCodes?: string[];
  scope?: string | null;
  referenceNumber: string | null;
  location: string | null;
  category: TenderCategory;
  sourceUrl: string;
  source: string;
  sourceKey?: string;
  externalId?: string | null;
  pdfUrls: string[];
  resources?: DiscoveredResource[];
  subpageCandidates?: RankedSubpageCandidate[];
  url?: string;
}

interface ExtractionResult {
  tenders: ExtractedTender[];
}

export type PublicScraperResult = PublicSourceScrapeResult<ExtractedTender>;
type PublicScraper = (cursor: PublicSourceCursor | null) => Promise<PublicScraperResult>;

const buildExtractedTenderDescriptionMarkdown = (tender: Pick<ExtractedTender, "client" | "deadline" | "description" | "procedure" | "estimatedValue" | "duration" | "requirements" | "awardCriteria" | "cpvCodes" | "scope" | "referenceNumber" | "location">): string =>
  buildTenderDescriptionMarkdown({
    client: tender.client,
    procedure: tender.procedure,
    deadline: tender.deadline,
    location: tender.location,
    value: tender.estimatedValue,
    duration: tender.duration,
    reference: tender.referenceNumber,
    summary: cleanPublicDescription(tender.description),
    scope: tender.scope,
    requirements: tender.requirements,
    awardCriteria: tender.awardCriteria,
    cpv: tender.cpvCodes,
  });

type ExtractedTenderInput = Omit<ExtractedTender, "descriptionMarkdown"> & Partial<Pick<ExtractedTender, "descriptionMarkdown">>;

const isAccessLimitedSummary = (value: unknown): boolean =>
  typeof value === "string" && (
    /vollständige Leistungsbeschreibung[\s\S]{0,180}nach Teilnahme/i.test(value)
    || isParticipationWallText(value)
  );

const withDescriptionMarkdown = (tender: ExtractedTenderInput): ExtractedTender => {
  const supplied = tender.descriptionMarkdown?.trim() ?? "";
  const generated = buildExtractedTenderDescriptionMarkdown(tender);
  return {
    ...tender,
    descriptionMarkdown: isAccessLimitedSummary(tender.description) && supplied
      ? supplied
      : generated || supplied,
  };
};

const withScrapedResources = (tender: ExtractedTender, page: ScrapedPage): ExtractedTender => ({
  ...withDescriptionMarkdown(tender),
  resources: page.resources,
  subpageCandidates: page.subpageCandidates,
});

const normalizeCursor = (cursor: PublicSourceCursor | null | undefined): PublicSourceCursor | null => cursor ?? null;

interface DetailOutcome {
  tender: ExtractedTender | null;
  retryable?: boolean;
  blocked?: boolean;
}

interface DetailQueueResult {
  tenders: ExtractedTender[];
  pendingDetails: PublicDetailReference[];
  detailAttempted: number;
  detailFailed: number;
}

const retryDelayMs = (attempts: number): number => Math.min(60 * 60 * 1000, 2 ** Math.min(attempts, 10) * 1000);

const MAX_DETAIL_ATTEMPTS = 10;

async function processDetailQueue(
  references: PublicDetailReference[],
  limit: number,
  handler: (reference: PublicDetailReference) => Promise<DetailOutcome>,
): Promise<DetailQueueResult> {
  const tenders: ExtractedTender[] = [];
  const pendingDetails: PublicDetailReference[] = [];
  let detailAttempted = 0;
  let detailFailed = 0;
  const now = Date.now();

  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    if (reference.blocked) {
      pendingDetails.push(reference);
      continue;
    }

    const nextAttemptAt = reference.nextAttemptAt ? Date.parse(reference.nextAttemptAt) : NaN;
    if (Number.isFinite(nextAttemptAt) && nextAttemptAt > now) {
      pendingDetails.push(reference);
      continue;
    }

    if (detailAttempted >= limit) {
      pendingDetails.push(...references.slice(index));
      break;
    }

    if (reference.attempts >= MAX_DETAIL_ATTEMPTS) {
      pendingDetails.push({ ...reference, blocked: true, nextAttemptAt: undefined });
      detailFailed += 1;
      continue;
    }

    const attempt = { ...reference, attempts: reference.attempts + 1 };
    detailAttempted += 1;
    let outcome: DetailOutcome;
    try {
      outcome = await handler(attempt);
    } catch (error) {
      console.warn(`[public-scraper] Detail-Queue Fehler (${reference.key}):`, error);
      outcome = { tender: null, retryable: true };
    }

    if (outcome.tender) {
      if (!outcome.tender.externalId && reference.externalId) outcome.tender.externalId = reference.externalId;
      tenders.push(outcome.tender);
      continue;
    }

    if (outcome.blocked) {
      pendingDetails.push({ ...attempt, blocked: true, nextAttemptAt: undefined });
      detailFailed += 1;
      continue;
    }

    if (outcome.retryable) {
      pendingDetails.push({
        ...attempt,
        blocked: false,
        nextAttemptAt: new Date(Date.now() + retryDelayMs(attempt.attempts)).toISOString(),
      });
      detailFailed += 1;
    }
    // A null, non-retryable result is a terminal non-tender/filter result.
  }

  return { tenders, pendingDetails, detailAttempted, detailFailed };
}

function mergeDetailReferences(...groups: PublicDetailReference[][]): PublicDetailReference[] {
  const merged = new Map<string, PublicDetailReference>();
  for (const group of groups) {
    for (const reference of group) {
      if (!merged.has(reference.key)) merged.set(reference.key, reference);
    }
  }
  return Array.from(merged.values());
}

function shouldPauseBeforeListing(queue: DetailQueueResult, limit: number): boolean {
  return queue.detailAttempted >= limit || queue.pendingDetails.some((reference) => !reference.blocked);
}

interface SourceCursorResultOptions {
  cursor: PublicSourceCursor | null;
  strategy: string;
  position: JsonValue;
  listingExhausted: boolean;
  listingComplete: boolean;
  pendingDetails: PublicDetailReference[];
  pagesFetched: number;
  paginationStrategy: string;
  listedCount: number;
  detailAttempted: number;
  detailFailed: number;
  extra?: Record<string, JsonValue>;
  cursorCommit?: PublicCursorCommit;
}

function sourceCursorResult(
  tenders: ExtractedTender[],
  options: SourceCursorResultOptions,
): PublicScraperResult {
  const pendingCount = options.pendingDetails.length;
  const continuationRequired = !options.listingComplete
    || options.pendingDetails.some((reference) => !reference.blocked);
  const cursorCommit = options.cursorCommit ?? "commit";
  const nextCursor = createPublicSourceCursorV2(
    options.strategy,
    options.position,
    options.listingExhausted && pendingCount === 0,
    options.pendingDetails,
    {
      ...(options.cursor ?? {}),
      ...(options.extra ?? {}),
      listingComplete: options.listingComplete,
    },
  );

  return sourceResult(tenders, {
    nextCursor,
    cursorCommit,
    cursorAdvanced: cursorCommit === "commit",
    pagesFetched: options.pagesFetched,
    exhausted: options.listingExhausted && pendingCount === 0,
    paginationStrategy: options.paginationStrategy,
    listingComplete: options.listingComplete,
    continuationRequired,
    listedCount: options.listedCount,
    detailAttempted: options.detailAttempted,
    detailFailed: options.detailFailed,
    pendingCount,
  });
}

function pendingOnlyResult(
  cursor: PublicSourceCursor | null,
  strategy: string,
  queue: DetailQueueResult,
): PublicScraperResult {
  const listingComplete = cursor?.listingComplete === true;
  return sourceCursorResult(queue.tenders, {
    cursor,
    strategy,
    position: cursorPosition(cursor) ?? {},
    listingExhausted: cursorBoolean(cursor, "exhausted"),
    listingComplete,
    pendingDetails: queue.pendingDetails,
    pagesFetched: 0,
    paginationStrategy: strategy,
    listedCount: 0,
    detailAttempted: queue.detailAttempted,
    detailFailed: queue.detailFailed,
  });
}

function isGermanText(text: string): boolean {
  if (!text || text.trim().length < 10) return false;
  // Reject Cyrillic and Greek scripts
  if (/[\u0400-\u04FF\u0370-\u03FF]/.test(text)) return false;
  // Common German indicator words
  const germanIndicators = [
    "der", "die", "das", "und", "von", "mit", "fuer", "auf", "ist", "ein",
    "Ausschreibung", "Auftrag", "Leistung", "Vergabe", "Dienstleistung",
    "Bau", "Lieferung", "Lieferung", "Kontakt", "Frist", "Angebot",
    "Deutschland", "Berlin", "Muenchen", "Hamburg", "Stadt", "GmbH",
    "oeffenter", "Behoerde", "Ministerium", "Amt",
  ];
  const lower = text.toLowerCase();
  let matches = 0;
  for (const word of germanIndicators) {
    if (lower.includes(word.toLowerCase())) matches++;
  }
  return matches >= 2;
}

const EXTRACTION_PROMPT = `Du bist ein Experte fuer oeffentliche Ausschreibungen in Deutschland.
Analysiere den folgenden Website-Inhalt und extrahiere ALLE Ausschreibungen/Auftraege.

WICHTIG - Suche explizit und gruendlich nach:
- Auftraggeber: Suche nach "Auftraggeber", "Vergabestelle", "oeffentlicher Auftraggeber", "Ausschreibende Stelle", "Bauherr", "Kommune", "Stadt", "Landkreis", "Bundesland", "Amt", "Behoerde". Wenn nichts gefunden wird, versuche die Organisation aus dem Kontext, der URL oder dem Impressum zu ermitteln. Gib NIEMALS "Unbekannt" zurueck - wenn wirklich nichts gefunden wird, gib den Domain-Namen oder eine vernuenftige Bezeichnung zurueck.
- Frist: Suche nach "Bietfrist", "Angebotsfrist", "Abgabefrist", "Deadline", "bis zum", "Ablauf der Frist", "Einreichungsfrist", "Angebotsabgabe", "Bewerbungsschluss". Formatiere als ISO-Datum (YYYY-MM-DD). Wenn nur ein relativer Zeitpunkt angegeben ist (z.B. "in 2 Wochen"), berechne das Datum basierend auf dem aktuellen Datum.
- PDFs: Suche nach Links zu PDF-Dateien (.pdf) die zur Ausschreibung gehoeren. Extrahiere die vollstaendigen URLs.

Ignoriere dabei:
- Werbebanner, Navigation, Fusszeilen
- Ausschreibungen die eindeutig abgelaufen sind (Deadline liegt in der Vergangenheit)
- Nicht-relevante Eintraege (z.B. Stellenanzeigen)
- VHB-Formblätter, GAEB-Anleitungen, Bietercockpit-Handbuch-Text
- PDF-Formular-Vorlagen und deren Feldbeschreibungen

Kategorisiere jede Ausschreibung in genau EINE dieser Kategorien:
- Bauarbeiten (Neubau, Umbau, Instandsetzung, Trockenbau, Dacharbeiten, Malerarbeiten, Fenstereinbau, Fassade)
- Tiefbau (Strassenbau, Asphalt, Kanal, Wasserbau, Erdbewegungen, Bruecken, Rohrleitungen)
- TGA (Technische Gebaeudeausruestung: Heizung, Sanitaer, Elektro, Lueftung, EMSR)
- Gebaeudereinigung (Unterhaltsreinigung, Glasreinigung, Fassadenreinigung)
- Winterdienst (Raeum- und Streuarbeiten, Schneebeseitigung)
- Gartenarbeiten (Pflanzenlieferung, Bepflanzung, Gartenpflege)
- Gruenflaechenpflege (Garten- und Landschaftsbau, Gruenanlagenpflege, Spielplatzpflege)
- Facility Management (Gebaeudebetreuung, Haustechnik, Objektmanagement)
- Immobilienverwaltung (Immobilienmanagement, Hausverwaltung, Flur nutzung)
- Planungsleistungen (Architektur, Ingenieurbuero, Beratung, Gutachten, Planung)
- IT-Dienstleistungen (Software, Hardware, IT-Infrastruktur, Digitalisierung)
- Lieferung (Materiallieferung, Produktpersonal, Ausruestung, Verbrauchsmaterial)
- Sonstiges (NUR wenn wirkliche keine Kategorie passt)

Antworte NUR mit einem validen JSON-Objekt (kein Markdown, kein Text davor/danach).
Format:
{
  "tenders": [
    {
      "title": "Titel der Ausschreibung",
      "client": "Name des Auftraggebers - NIEMALS Unbekannt",
      "deadline": "2026-06-15" oder null,
      "description": "VOLLSTAENDIGE Beschreibung aller Details: Auftragsgegenstand, Anforderungen, Zuschlagskriterien, Eignungskriterien, Fristen, Laufzeit, Umfang, Ort. Mindestens 5 Saetze, mehr ist besser.",
      "procedure": "Verfahrensart" oder null,
      "scope": "Leistungsumfang" oder null,
      "requirements": ["Anforderung"] oder [],
      "awardCriteria": ["Zuschlagskriterium"] oder [],
      "estimatedValue": "Schaetzwert" oder null,
      "duration": "Laufzeit" oder null,
      "cpvCodes": ["CPV-Code"] oder [],
      "referenceNumber": "Aktenzeichen/Referenz" oder null,
      "location": "Stadt/Region" oder null,
      "category": "Winterdienst",
      "pdfUrls": ["https://..."] oder [],
      "url": "https://... Detail-URL der Ausschreibung" oder null
    }
  ]
}

Wenn keine Ausschreibungen gefunden werden: {"tenders": []}`;

const DETAIL_EXTRACTION_PROMPT = `Du bist ein Experte fuer oeffentliche Ausschreibungen in Deutschland.
Extrahiere die Details dieser einzelnen Ausschreibungsseite.

WICHTIG - Suche explizit und gruendlich nach:
- Auftraggeber: Suche nach "Auftraggeber", "Vergabestelle", "oeffentlicher Auftraggeber", "Ausschreibende Stelle", "Bauherr", "Kommune", "Stadt", "Landkreis", "Bundesland", "Amt", "Behoerde". Wenn nichts gefunden wird, versuche die Organisation aus dem Kontext, der URL oder dem Impressum zu ermitteln. Gib NIEMALS "Unbekannt" zurueck.
- Frist: Suche nach "Bietfrist", "Angebotsfrist", "Abgabefrist", "Deadline", "bis zum", "Ablauf der Frist", "Einreichungsfrist", "Angebotsabgabe", "Bewerbungsschluss". Formatiere als ISO-Datum (YYYY-MM-DD).
- Anforderungen: Extrahiere wichtige Anforderungen, Kriterien, Mindestanforderungen, geforderte Zertifikate, Erfahrungen.
- PDFs: Suche nach Links zu PDF-Dateien (.pdf) die zur Ausschreibung gehoeren. Extrahiere die vollstaendigen URLs.

Ignoriere Werbung, Navigation, Footer.

KRITISCH - Ignoriere diese Inhalte VOLLSTAENDIG:
- VHB-Formblätter (Eigenerklärung, Eignungserklärung, Formblatt 124, etc.)
- GAEB-Software-Anleitungen (wingaeb.xml, Kalkulationsprogramm, Bietercockpit)
- Anleitungen zur Angebotsabgabe im Bietercockpit
- PDF-Formular-Vorlagen und deren Feldbeschreibungen
- Nur den TATSaECHLICHEN Auftragsgegenstand beschreiben, NICHT die Formulare

Kategorie (waehle genau EINE):
- Bauarbeiten (Neubau, Umbau, Instandsetzung, Trockenbau, Dacharbeiten, Malerarbeiten, Fenstereinbau, Fassade)
- Tiefbau (Strassenbau, Asphalt, Kanal, Wasserbau, Erdbewegungen, Bruecken, Rohrleitungen)
- TGA (Technische Gebaeudeausruestung: Heizung, Sanitaer, Elektro, Lueftung, EMSR)
- Gebaeudereinigung (Unterhaltsreinigung, Glasreinigung, Fassadenreinigung)
- Winterdienst (Raeum- und Streuarbeiten, Schneebeseitigung)
- Gartenarbeiten (Pflanzenlieferung, Bepflanzung, Gartenpflege)
- Gruenflaechenpflege (Garten- und Landschaftsbau, Gruenanlagenpflege, Spielplatzpflege)
- Facility Management (Gebaeudebetreuung, Haustechnik, Objektmanagement)
- Immobilienverwaltung (Immobilienmanagement, Hausverwaltung)
- Planungsleistungen (Architektur, Ingenieurbuero, Beratung, Gutachten, Planung)
- IT-Dienstleistungen (Software, Hardware, IT-Infrastruktur, Digitalisierung)
- Lieferung (Materiallieferung, Ausruestung, Verbrauchsmaterial)
- Sonstiges (NUR wenn wirklich keine Kategorie passt)

Antworte NUR mit validem JSON:
{
  "title": "Titel",
  "client": "Auftraggeber - NIEMALS Unbekannt",
  "deadline": "2026-06-15" oder null,
  "description": "VOLLSTAENDIGE Beschreibung: Auftragsgegenstand, Umfang, Anforderungen, Zuschlagskriterien, Eignungskriterien, Fristen, Vertragslaufzeit, Erfuellungsort, Besonderheiten. Mindestens 5 Saetze, so detailliert wie moeglich.",
  "procedure": "Verfahrensart" oder null,
  "scope": "Leistungsumfang" oder null,
  "referenceNumber": "Referenz" oder null,
  "location": "Ort/Region" oder null,
  "category": "Kategorie",
  "requirements": ["Anforderung 1", "Anforderung 2"] oder [],
  "awardCriteria": ["Zuschlagskriterium"] oder [],
  "estimatedValue": "Schaetzwert" oder null,
  "duration": "Laufzeit" oder null,
  "cpvCodes": ["CPV-Code"] oder [],
  "pdfUrls": ["https://..."] oder []
}`;

// --- Non-tender filter ---

const NON_TENDER_TITLE_PATTERNS = [
  /^(?:bekanntmachung|uebersicht|übersicht|ausschreibung|detail|vergabe)$/i,
  /statist/i, /dashboard/i, /legal\s*notice/i, /impressum/i, /agb/i,
  /datenschutz/i, /cookie/i, /kontakt/i, /hilfe/i, /faq/i, /newsletter/i,
  /twitter\.com/i, /linkedin\.com/i, /facebook\.com/i, /instagram\.com/i,
  /e?notices?\d/i, /sending\s+electronic/i, /contracts\s+awarded/i,
  /informationen?\s+(zu|fuer)\s+ausschreib/i, /suchtipps/i,
  /stellenangebot/i, /\bjobs?\b/i, /karriere/i, /bewerbung/i,
  /infos?\s+fuer\s+(vergabestellen|unternehmen)/i,
  /nutzungsbedingungen/i, /sitemap/i, /ueber\s+uns/i,
  /vergebener\s+auftrag/i, /result\b/i, /contract\s+modification/i,
  // Verzeichnisse/SEO-Seiten — keine echten Ausschreibungen
  /verzeichnis/i, /firmenverzeichnis/i, /branchenverzeichnis/i,
  /die\s+besten\b.*\bin\s+der\s+naehe/i,
  /nach\s+bundesland/i,
  /waehle\s+(jetzt\s+)?deine\s+stadt/i,
  /firmen?\s+eintragen/i,
  /suche\s+starten/i,
  /kostenlos\s+vergleichen/i,
];

const NON_TENDER_URL_PATTERNS = [
  /\/simap\//i, /\/legal-notice/i, /\/imprint/i, /\/privacy/i,
  /\/cookie/i, /\/terms/i, /\/contact/i, /\/about/i, /\/help/i,
  /\/faq/i, /\/newsletter/i, /\/signup/i, /\/register/i,
  /twitter\.com/i, /linkedin\.com/i, /facebook\.com/i,
  /enotices\d/i, /\/home$/i,
];

// Known tender/procurement domains - only scrape from these
const TENDER_DOMAIN_WHITELIST = [
  /ted\.europa\.eu/i,
  /evergabe/i,
  /vergabekooperation/i,
  /vergabe24/i,
  /dtvp/i,
  /deutsches-ausschreibungsblatt/i,
  /service-bw/i,
  /vergabemarktplatz/i,
  /oeffentliche-vergabe/i,
  /bund\.de/i,
  /bescha/i,
  /dtmnogo/i,
  /vergabe-portal/i,
  /vergabepor/i,
  /e-vergabe/i,
  /vergabe-niedersachsen/i,
  /vergabe-sachsen/i,
  /vergabe-bayern/i,
  /vergabe-berlin/i,
  /meinauftrag\.rib\.de/i,
  /vergabe-hamburg/i,
  /vergabe-nrw/i,
  /vergabe-hessen/i,
  /vergabe-rheinland-pfalz/i,
  /vergabe-saarland/i,
  /vergabe-schleswig-holstein/i,
  /vergabe-thueringen/i,
  /vergabe-brandenburg/i,
  /vergabe-mecklenburg-vorpommern/i,
  /vergabe-sachsen-anhalt/i,
  /vergabe-bremen/i,
  /sachsen-vergabe/i,
  /vergabe\.muenchen/i,
  /vergabe\.rlp\.de/i,
  /auftraege\.bayern/i,
  /hamburg\.de/i,
  /service\.bund\.de/i,
];

// Non-tender domains - blogs, shops, consumer sites
const NON_TENDER_DOMAIN_PATTERNS = [
  /mein-schoener-garten/i,
  /gartenjournal/i,
  /hausjournal/i,
  /plantura/i,
  /balconia/i,
  /gartentipps/i,
  /amazon\.de/i,
  /ebay\.de/i,
  /idealo\.de/i,
  /otto\.de/i,
  /zalando\.de/i,
  /blogspot/i,
  /wordpress\.com/i,
  /medium\.com/i,
  /wikipedia\.org/i,
  /youtube\.com/i,
  /facebook\.com/i,
  /instagram\.com/i,
  /pinterest\.com/i,
  /reddit\.com/i,
  /gutefrage\.net/i,
  /chefkoch\.de/i,
  /chefkoch\.at/i,
  /springer\.de/i,
  /testberichte\.de/i,
];

function isTenderDomain(url: string): boolean {
  return TENDER_DOMAIN_WHITELIST.some((pattern) => pattern.test(url));
}

function isLikelyTender(title: string, url: string): boolean {
  const titleLower = title.toLowerCase().trim();

  // Too short
  if (titleLower.length < 5) return false;

  // Matches non-tender patterns
  for (const pattern of NON_TENDER_TITLE_PATTERNS) {
    if (pattern.test(title)) return false;
  }

  // URL matches non-tender patterns
  for (const pattern of NON_TENDER_URL_PATTERNS) {
    if (pattern.test(url)) return false;
  }

  // Known non-tender domain
  for (const pattern of NON_TENDER_DOMAIN_PATTERNS) {
    if (pattern.test(url)) return false;
  }

  return true;
}

// Remove paywall phrases, marketing junk, navigation, repeated sentences from descriptions
const PAYWALL_PATTERNS = [
  /der\s+gesamte\s+text\s+steht\s+(ihnen\s+)?nach\s+der\s+freischaltung\s+zur\s+verfuegung/gi,
  /der\s+gesamte\s+text\s+steht\s*(?=\S)/gi,
  /der\s+gesamte\s+text\s+s/gi,
  /kostenlos\s+registrieren/gi,
  /nach\s+(der\s+)?registrierung\s+(verfuegbar|einsehbar)/gi,
  /weitere\s+details\s+sind\s+nach\s+freischaltung\s+einsehbar/gi,
  /text\s+nach\s+freischaltung\s+verfuegbar/gi,
];

const JUNK_PATTERNS = [
  // Marketing
  /neu:\s*ki[- ]chat/gi,
  /ki[- ]chat\s*(zu|zum|kennt|beantwortet|zu vergabeunterlagen)/gi,
  /komfort[- ]tarif\s*(schon\s+)?ab\s+[\d,.]+\s*€/gi,
  /hier\s+informieren/gi,
  /ihre\s+vorteile[:.?]?/gi,
  /zugriff\s+auf\s+alle\s+ausschreibungen/gi,
  /laufend\s+neue\s+auftragschancen/gi,
  /persoenlicher\s+kundensupport/gi,
  /fragen\?\s*wir\s+beraten\s+sie\s+gerne/gi,
  /pdf[- ]export\s+der\s+ausschreibungen/gi,
  /teilnahme\s+an\s+evergaben/gi,
  /alle\s+ausschreibungen\s+im\s+komfort/gi,
  /e[- ]mail\s+bei\s+neuen\s+ausschreibungen[:\s]*nicht\s+aktiviert/gi,
  // Navigation / UI elements
  /aktuelle\s+suche[:;]/gi,
  /suchprofil\s+laden/gi,
  /e[- ]mail\s+bei\s+neuen\s+ausschreibungen/gi,
  /filter\s+entfernen/gi,
  /auftraege\s+finden/gi,
  /meine\s+to[- ]do[- ]liste/gi,
  /bekanntmachung\s+gelesen/gi,
  /vergabeunterlagen\s+(angefordert|gesichtet)/gi,
  /bieterfragen\s+gestellt/gi,
  /gespraeche\s+mit\s+lieferanten/gi,
  /nachweise\s+eingeholt/gi,
  /angebot\s+(erstellt|eingereicht)/gi,
  /meine\s+notizen/gi,
  /vergroesserungseffekt\s+an/gi,
  /wie\s+kann\s+ich\s+bei\s+dieser\s+vergabe\s+helfen/gi,
  /unser\s+ki[- ]chat\s+kennt/gi,
  /\d+\s*auftraege\b/gi,
  /ausschreibungen\s+fuer\s+\w+\s+deutschlandweit/gi,
  /leistungen\/gewerke/gi,
  /vergabeunterlagen\s*[–-]\s*ki[- ]chat/gi,
  /zurueck\s*uebersicht/gi,
  /da[- ]nr\.:\s*\d+/gi,
  /kurzbeschreibung:/gi,
  // More junk
  /persoenlicher\s+kundensupport/gi,
  /auftraege\s+finden/gi,
  /speichern\b/gi,
  /aktiviert\b/gi,
  /alle\s+ausschreibungen\s+im/gi,
  /mtl\.\s*\[\]/gi,
  /\[\]\([^)]*\)/gi,
  /#\s*ausschreibungen\s+fuer/gi,
  /\d+\.?\d*\s*auftraege\b/gi,
  /vergabeunterlagen\b/gi,
  /regional\b/gi,
  /deutschlandweit\b/gi,
  // Remaining junk
  /persoenlicher\s+kundensupport/gi,
  /##\s*/g,
  /\(https?:\/\/[^)]*\)/g,
  /-\s*(?=[-])/g,
  /filter\b/gi,
  /auftraege\b/gi,
  // Navigation/Footer-Muster (Stadtlisten, Kategorien, etc.)
  /icon\s+icon/gi,
  /nach\s+bundesland/gi,
  /waehle\s+(jetzt\s+)?deine\s+stadt/gi,
  /firmen?\s+eintragen/gi,
  /einfach\s+die\s+besten\s+finden/gi,
  /die\s+besten\b.*\bin\s+der\s+naehe/gi,
  /ihre\s+ firma\s+eintragen/gi,
  /suche\s+starten/gi,
  /kostenlos\s+vergleichen/gi,
  /stadt\s+icon/gi,
  /icon\s+(hausmeister|fensterreinigung|bueroeinigung)/gi,
  // Stadtlisten (Bundesland + Stadt-Kombinationen)
  /Baden[- ]Wuerttemberg\s+Gebaeudereinigung\s+in\s+\w+/gi,
  /Bayern\s+Gebaeudereinigung\s+in\s+\w+/gi,
  /Berlin\s+Gebaeudereinigung\s+in\s+\w+/gi,
  /Brandenburg\s+Gebaeudereinigung\s+in\s+\w+/gi,
  /Bremen\s+Gebaeudereinigung\s+in\s+\w+/gi,
  /Hamburg\s+Gebaeudereinigung\s+in\s+\w+/gi,
  /Hessen\s+Gebaeudereinigung\s+in\s+\w+/gi,
];

export function cleanDescription(text: string): string {
  if (!text || text.length < 20) return text;
  if (isPublicNavigationSummary(text)) return "";

  const normalize = (s: string) => s
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE")
    .replace(/ß/g, "ss");

  let cleaned = decodeHtmlEntities(text);

  const allPatterns = [...PAYWALL_PATTERNS, ...JUNK_PATTERNS];
  for (const pattern of allPatterns) {
    let prev = "";
    while (prev !== cleaned) {
      prev = cleaned;
      const norm = normalize(cleaned);
      const match = norm.match(pattern);
      if (!match || match.index === undefined) break;
      let origStart = 0;
      let normPos = 0;
      for (let i = 0; i < cleaned.length; i++) {
        if (normPos >= match.index) break;
        normPos += normalize(cleaned[i]).length;
        origStart = i + 1;
      }
      let origEnd = origStart;
      let normEnd = normPos;
      for (let i = origStart; i < cleaned.length; i++) {
        if (normEnd - normPos >= match[0].length) break;
        normEnd += normalize(cleaned[i]).length;
        origEnd = i + 1;
      }
      cleaned = cleaned.slice(0, origStart) + cleaned.slice(origEnd);
    }
  }

  const parts = cleaned.split(/(?<=[.!?])\s+|\n+/).filter(s => s.trim().length > 10);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of parts) {
    const key = normalize(s.trim().toLowerCase()).replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s.trim());
    }
  }

  cleaned = unique.join(" ").replace(/\s{2,}/g, " ").trim();

  if (cleaned.length < 30) return "";

  return cleaned;
}

const PORTAL_FORM_MARKERS = [
  /(?:^|\s)a\)\s*oeffentlicher\s+auftraggeber/i,
  /vergabestelle/i,
  /(?:^|\s)(?:telefon|fax|e-?mail|internet)\s*[A-ZÄÖÜ]/i,
  /(?:^|\s)(?:name|straße|strasse)\s*[A-ZÄÖÜ]/i,
  /angebotsfrist|teilnahmefrist|ausführungsort|erfuellungsort/i,
];

const PDF_FORM_MARKERS = [
  /VHB\s*-\s*Bund\s*-\s*Ausgabe/i,
  /Eigenerklärung\s+(?:zur\s+)?Eignung/i,
  /Eigenerklärung\s+fuer\s+nicht\s+praequalifizierte/i,
  /\d+\s*\(Eigenerklärung\s+zur\s+Eignung\)/i,
  /Angaben?\s+zu\s+Arbeitskraeften/i,
  /Angabe\s+zur\s+Mitgliedschaft\s+bei\s+der\s+Berufsgenossenschaft/i,
  /Seite\s+\d+\s+von\s+\d+\s+Eigenerklärung/i,
  /AI\s+Bietercockpit\s+\d+\s+Registerkarte/i,
  /GAEB\s*-\s*Kalkulationssoftware/i,
  /wingaeb\.xml/i,
  /Bietercockpit\s+\d+\s+Fuer\s+die\s+Bearbeitung/i,
  /Angebotsabgabe\s+abschliessen\s+gelangen\s+Sie/i,
  /Eingangsbestaetigung\s+beinhaltet\s+die\s+Uebermittlung/i,
  /Button\s+Abgeben\s+hat\s+sich\s+geaendert/i,
  /Register\s+Anbotsunterlagen\s+\(zur\s+Bearbeitung\)/i,
  /VHB\s+\d+.*?©\s*VHB/i,
  /Ausgabe\s+\d{4}\s+Stand\s+\d{4}/i,
  /nicht\s+praequalifizierte\s+Unternehmen\s+in\s+folgendem\s+Vergabeverfahren/i,
  /Massnahmennummer\s+Vergabenummer\s+Vergabeart/i,
  /Oeffentliche\s+Ausschreibung\s+Offenes\s+Verfahren/i,
  /Beschraenkte\s+Ausschreibung\s+Nichtoffenes\s+Verfahren/i,
  /Freihaendige\s+Vergabe\s+Verhandlungsverfahren/i,
  /NATO\s*-\s*Ausschreibung\s+Wettbewerblicher\s+Dialog/i,
  /Baumassnahme\s+Leistung\s+Bewerber/i,
  /Mitglied\s+der\s+Bewerber\s*-\s*bzw\.\s+Bietergemeinschaft/i,
];

/** Returns true for portal forms accidentally persisted as tender descriptions. */
export function isRawPortalDescription(text: string): boolean {
  if (!text || text.trim().length < 20) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  const hasNoticeHeader = /bekanntmachung\s+oeffentliche\s+ausschreibung/i.test(normalized);
  const markerHits = PORTAL_FORM_MARKERS.filter((pattern) => pattern.test(normalized)).length;

  return (hasNoticeHeader && markerHits >= 1) || markerHits >= 3 || isParticipationWallText(normalized);
}

/** Returns true if text is primarily PDF form boilerplate (VHB, GAEB, Bietercockpit). */
export function isPdfFormBoilerplate(text: string): boolean {
  if (!text || text.trim().length < 30) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  const hits = PDF_FORM_MARKERS.filter((pattern) => pattern.test(normalized)).length;
  return hits >= 2;
}

/** Identifies portal navigation/footer text that must never be used as tender prose. */
export function isPublicNavigationSummary(text: string): boolean {
  if (!text || text.trim().length < 20) return false;
  const normalized = decodeHtmlEntities(text).replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
  const markers = [
    "service.bund.de - aktuelle ausschreibungen",
    "haupt-navigations-menü",
    "haupt-navigations-menu",
    "meta-navigation",
    "andere ausschreibungen im bereich",
    "ausschreibungen abonnieren",
  ];
  if (markers.some((marker) => normalized.includes(marker))) return true;

  return normalized.includes("service.bund.de")
    && normalized.includes("verantwortung für inhalt und richtigkeit")
    && normalized.includes("ausschreibenden organisation");
}

/** Cleans a public description and refuses to expose raw procurement forms. */
export function cleanPublicDescription(text: string): string {
  if (isRawPortalDescription(text) || isPublicNavigationSummary(text) || isPdfFormBoilerplate(text)) return "";
  const cleaned = cleanDescription(text);
  return isRawPortalDescription(cleaned) || isPublicNavigationSummary(cleaned) || isPdfFormBoilerplate(cleaned) ? "" : cleaned;
}

export interface PublicPortalFacts {
  client: string | null;
  procedure: string | null;
  deadline: string | null;
  location: string | null;
  subject: string | null;
}

export function extractPublicPortalFacts(text: string): PublicPortalFacts {
  const fieldText = decodeHtmlEntities(text).replace(/\r/g, "").trim();
  const normalized = fieldText.replace(/\s+/g, " ").trim();
  const capture = (pattern: RegExp): string | null => normalized.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() || null;
  const captureField = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const value = fieldText.match(pattern)?.[1]?.replace(/\s+/g, " ").trim();
      if (value) return value;
    }
    return null;
  };
  const lines = fieldText.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const lineValue = (labels: RegExp[], maxLines = 1): string | null => {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const label = labels.find((pattern) => pattern.test(line));
      if (!label) continue;

      const inline = line.replace(label, "").replace(/^\s*:?\s*/, "").trim();
      if (inline) return inline;

      const values: string[] = [];
      for (let next = index + 1; next < lines.length && values.length < maxLines; next += 1) {
        const value = lines[next];
        if (/^(?:karte anschauen|haupt-navigations|meta-navigation|andere ausschreibungen|service\.bund\.de)/i.test(value)) break;
        if (labels.some((pattern) => pattern.test(value))) break;
        values.push(value);
      }
      if (values.length > 0) return values.join(" ");
    }
    return null;
  };

  const client = captureField([
    /(?:^|\n|;|:|\b[a-z]\)\s*)(?:Zur Angebotsabgabe\s*\/\s*Teilnahme auffordernde Stelle|Ausschreibende Stelle|Öffentlicher Auftraggeber(?:\s*\(Vergabestelle\))?)\s*(?:Bezeichnung|Name\s+und\s+Anschrift)\s*:?\s*([\s\S]+?)(?=\s*(?:\bVO\b|Vergabeart\b|Vergabeverfahren\b|\b[a-z]\)\s*|Postanschrift|Straße|Ort|Telefon|Fax|E-?Mail|URL|Zuschlag erteilende Stelle|Frist\b|Abgabe(?:frist)?\b|Angebotsfrist\b|Teilnahme(?:frist)?\b|Auftragsgegenstand\b|Leistungsgegenstand\b|$))/i,
    /(?:^|\n|;|:|\b[a-z]\)\s*)(?:Zur Angebotsabgabe\s*\/\s*Teilnahme auffordernde Stelle|Ausschreibende Stelle|Öffentlicher Auftraggeber(?:\s*\(Vergabestelle\))?)\s*(?:Bezeichnung\s*:?)?\s*([\s\S]+?)(?=\s*(?:\bVO\b|Vergabeart\b|Vergabeverfahren\b|\b[a-z]\)\s*|Postanschrift|Straße|Ort|Telefon|Fax|E-?Mail|URL|Zuschlag erteilende Stelle|Frist\b|Abgabe(?:frist)?\b|Angebotsfrist\b|Teilnahme(?:frist)?\b|Auftragsgegenstand\b|Leistungsgegenstand\b|$))/i,
    /(?:^|\n|;|:)\s*Auftraggeber\s*\/\s*Ausschreibende Stelle\s*:?\s*([\s\S]+?)(?=\s*(?:#|;|\bAbgabe(?:frist)?\b|Angebotsfrist\b|Postanschrift|Straße|Ort|Telefon|Fax|E-?Mail|URL|Frist\b|Teilnahme(?:frist)?\b|Vergabeart\b|Veröffentlicht\b|Verfahren\b|Vergabeverfahren\b|Status\b|Auftragsgegenstand\b|Leistungsgegenstand\b|$))/i,
    /(?:^|\n|;|:)\s*Auftraggeber\b\s*:?\s*([\s\S]+?)(?=\s*(?:#|;|\bAbgabe(?:frist)?\b|Angebotsfrist\b|Postanschrift|Straße|Ort|Telefon|Fax|E-?Mail|URL|Frist\b|Teilnahme(?:frist)?\b|Vergabeart\b|Veröffentlicht\b|Verfahren\b|Vergabeverfahren\b|Status\b|Auftragsgegenstand\b|Leistungsgegenstand\b|$))/i,
  ]);
  const location = (lineValue([/^(?:Haupterfüllungsort|Erfüllungsort|Ausführungsort|Hauptleistungsort|Leistungsort)\s*:?/i], 3)
    ?? capture(/(?:\bHaupterfüllungsort\b|\bErfüllungsort\b|\bAusführungsort\b|\bHauptleistungsort\b|\bLeistungsort\b)\s*:?\s*(.+?)(?=\s+(?:Abgabe(?:frist)?|Angebotsfrist|Vergabeart|Auftraggeber|Auftragsgegenstand|Leistungsgegenstand|Zuschlagskriterien|Nebenangebote|Angaben zu den Losen|$))/i)
      ?.replace(/^Ort\s*/i, "").trim()) || null;

  const procedureType = lineValue([/^Vergabeart\s*:?/i]);
  const procedureBasis = lineValue([/^(?:Vergabeverfahren|Verfahren)\s*:?/i]);
  const procedure = procedureType && procedureBasis && !procedureType.includes(procedureBasis)
    ? `${procedureType} (${procedureBasis})`
    : (procedureType || procedureBasis)
      ?? capture(/(?:Vergabeart|Vergabeverfahren|\bVerfahren\b)\s*:?\s*(.+?)(?=\s*(?:#|;|Bekanntmachung|Zur Angebotsabgabe|Die Nachforderung|Veröffentlicht|Teilnahme|Auftraggeber|Abgabefrist|Angebotsfrist|Status|Auftragsgegenstand|Leistungsgegenstand|\b[a-z]\)\s*)|$)/i);

  return {
    client: lineValue([/^Vergabestelle\s*:?/i]) ?? client,
    procedure,
    deadline: lineValue([/^(?:Abgabe(?:frist)?|Angebotsfrist|Teilnahmefrist)\s*:?/i])
      ?? capture(/(?:Abgabe(?:frist)?|Angebotsfrist|Teilnahmefrist)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4}(?:\s+\d{1,2}:\d{2})?)/i),
    location,
    subject: lineValue([/^(?:Auftragsgegenstand|Leistungsgegenstand|Art und Umfang der Leistung)\s*:?/i], 2)
      ?? capture(/(?:Auftragsgegenstand|Leistungsgegenstand)\s*:?\s*(.+?)(?=\s*(?:\.|Die vollständige Leistungsbeschreibung|Für\s+[„"]|Öffentlich sichtbar)|$)/i),
  };
}

const PUBLIC_ACCESS_DOCUMENT_NOTE = "Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.";
const buildPublicAccessNote = (title: string): string =>
  `Für „${title}“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar. ${PUBLIC_ACCESS_DOCUMENT_NOTE}`;

export function buildPublicAccessLimitedDescription(title: string, facts: PublicPortalFacts): string {
  const details = [
    facts.client ? `Auftraggeber: ${facts.client}` : "",
    facts.procedure ? `Verfahren: ${facts.procedure}` : "",
    facts.deadline ? `Angebotsfrist: ${facts.deadline}` : "",
    facts.location ? `Leistungsort: ${facts.location}` : "",
    facts.subject ? `Leistungsgegenstand: ${facts.subject}` : "",
  ].filter(Boolean);
  const detailSentence = details.length > 0 ? ` Öffentlich sichtbar sind: ${details.join("; ")}.` : "";
  return `Für „${title}“ sind aktuell nur die öffentlich sichtbaren Verfahrensdaten verfügbar.${detailSentence} ${PUBLIC_ACCESS_DOCUMENT_NOTE}`;
}

export function buildPublicAccessLimitedDescriptionMarkdown(title: string, facts: PublicPortalFacts): string {
  const summary = buildTenderDescriptionMarkdown({
    client: facts.client,
    procedure: facts.procedure,
    deadline: facts.deadline,
    location: facts.location,
    subject: facts.subject,
  });
  const note = `- **Hinweis:** ${escapeMarkdownText(buildPublicAccessNote(title))}`;
  return [summary, note].filter(Boolean).join("\n");
}

/** Selects the first usable description, preferring structured values over raw fallbacks. */
export function pickPublicDescription(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const cleaned = cleanPublicDescription(value);
    if (cleaned) return cleaned;
  }
  return "";
}

async function extractTendersFromMarkdown(
  markdown: string,
  sourceUrl: string,
  source: string
): Promise<ExtractedTender[]> {
  if (!markdown || markdown.trim().length < 50) {
    return [];
  }
  if (!isLikelyTender(sourceUrl, sourceUrl)) {
    return [];
  }
  const accessPage = detectAccessPage(markdown, { url: sourceUrl });
  if (accessPage.blocked) {
    throw new Error(`Zugriff blockiert (${accessPage.reason}): ${sourceUrl}`);
  }

  const client = getOpenAI();
  const truncated = markdown.substring(0, 15000);

  try {
    const content = await callLLM(client, {
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `URL: ${sourceUrl}\n\nInhalt:\n${truncated}` },
      ],
      temperature: 0.1,
      max_tokens: 3000,
    });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Keine valide JSON-Extraktion fuer ${sourceUrl}`);

    const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult;
    if (!Array.isArray(parsed.tenders)) throw new Error(`Extraktion ohne Tender-Liste fuer ${sourceUrl}`);

    return parsed.tenders
      .filter((t) => {
        if (!t.title || t.title.length < 5) return false;
        if (t.category === "Sonstiges") return false;
        if (!isLikelyTender(t.title, sourceUrl)) return false;
        return true;
      })
      .map((t) => withDescriptionMarkdown({
         title: cleanTenderTitle(String(t.title).slice(0, 300), t.referenceNumber),
         client: (t.client && t.client !== "Unbekannt" && t.client.length > 1) ? t.client : extractClientFromUrl(sourceUrl),
         deadline: t.deadline ?? null,
         description: cleanPublicDescription(t.description ?? ""),
         procedure: typeof t.procedure === "string" ? t.procedure : null,
         scope: typeof t.scope === "string" ? t.scope : null,
         estimatedValue: typeof t.estimatedValue === "string" ? t.estimatedValue : null,
         duration: typeof t.duration === "string" ? t.duration : null,
         requirements: Array.isArray(t.requirements) ? t.requirements.map(String).filter(Boolean) : [],
         awardCriteria: Array.isArray(t.awardCriteria) ? t.awardCriteria.map(String).filter(Boolean) : [],
         cpvCodes: Array.isArray(t.cpvCodes) ? t.cpvCodes.map(String).filter(Boolean) : [],
        referenceNumber: t.referenceNumber ?? null,
        location: t.location ?? null,
        category: TENDER_CATEGORIES.includes(t.category) ? t.category : "Facility Management",
        sourceUrl: (t.url && t.url.startsWith("http")) ? t.url : sourceUrl,
        source,
        pdfUrls: Array.isArray(t.pdfUrls) ? t.pdfUrls.filter((u: string) => u.startsWith("http")) : [],
      }));
  } catch (error) {
    console.error(`[public-scraper] Extraktionsfehler fuer ${sourceUrl}:`, error);
    throw error;
  }
}

async function extractDetailFromMarkdown(
  markdown: string,
  sourceUrl: string,
  source: string,
  acceptAllCategories = false
): Promise<ExtractedTender | null> {
  if (!markdown || markdown.trim().length < 30) return null;
  if (!isLikelyTender(sourceUrl, sourceUrl)) return null;
  const accessPage = detectAccessPage(markdown, { url: sourceUrl });
  if (accessPage.blocked) {
    console.warn(`[public-scraper] Ueberspringe blockierte Detailseite (${accessPage.reason}) ${sourceUrl}`);
    return null;
  }

  const client = getOpenAI();
  const truncated = markdown.substring(0, 10000);

  try {
    const content = await callLLM(client, {
      messages: [
        { role: "system", content: DETAIL_EXTRACTION_PROMPT },
        { role: "user", content: `URL: ${sourceUrl}\n\nInhalt:\n${truncated}` },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Keine valide Detail-Extraktion fuer ${sourceUrl}`);

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.title || parsed.title.length < 5) return null;
    if (!isLikelyTender(parsed.title, sourceUrl)) return null;

    const netServerTitle = /\/NetServer\//i.test(sourceUrl) ? extractNetServerTenderTitle(markdown) : null;

    const category = TENDER_CATEGORIES.includes(parsed.category) ? parsed.category : "Facility Management";
    if (category === "Sonstiges" && !acceptAllCategories) return null;

    const clientName = (parsed.client && parsed.client !== "Unbekannt" && parsed.client.length > 1)
      ? String(parsed.client)
      : extractClientFromUrl(sourceUrl);

    return withDescriptionMarkdown({
       title: netServerTitle ?? cleanTenderTitle(
         String(parsed.title).slice(0, 300),
         typeof parsed.referenceNumber === "string" ? parsed.referenceNumber : null,
       ),
       client: clientName,
       deadline: parsed.deadline ? String(parsed.deadline) : null,
       description: cleanPublicDescription(String(parsed.description ?? "")),
       procedure: typeof parsed.procedure === "string" ? parsed.procedure : null,
       scope: typeof parsed.scope === "string" ? parsed.scope : null,
       estimatedValue: typeof parsed.estimatedValue === "string" ? parsed.estimatedValue : null,
       duration: typeof parsed.duration === "string" ? parsed.duration : null,
       requirements: Array.isArray(parsed.requirements) ? parsed.requirements.map(String).filter(Boolean) : [],
       awardCriteria: Array.isArray(parsed.awardCriteria) ? parsed.awardCriteria.map(String).filter(Boolean) : [],
       cpvCodes: Array.isArray(parsed.cpvCodes) ? parsed.cpvCodes.map(String).filter(Boolean) : [],
      referenceNumber: parsed.referenceNumber ? String(parsed.referenceNumber) : null,
      location: parsed.location ? String(parsed.location) : null,
      category,
      sourceUrl: (parsed.url && typeof parsed.url === "string" && parsed.url.startsWith("http")) ? parsed.url : sourceUrl,
      source,
      pdfUrls: Array.isArray(parsed.pdfUrls) ? parsed.pdfUrls.filter((u: string) => u.startsWith("http")) : [],
    });
  } catch (error) {
    console.error(`[public-scraper] Detail-Extraktionsfehler fuer ${sourceUrl}:`, error);
    throw error;
  }
}

export function extractBasicDetailFromHtml(
  html: string,
  sourceUrl: string,
  source: string,
  pdfUrls: string[],
  allowAccessPage = false,
): ExtractedTender | null {
  const accessPage = detectAccessPage(html, { url: sourceUrl });
  if (accessPage.blocked && !allowAccessPage) return null;
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer").remove();
  const text = htmlToBasicMarkdown($("body").html() ?? "").trim();
  const lines = text.split("\n")
    .map((line) => line.trim().replace(/^#+\s*/, ""))
    .filter(Boolean);

  const valueAfterSection = (sectionPattern: RegExp, fieldPattern: RegExp): string | null => {
    const sectionIndex = lines.findIndex((line) => sectionPattern.test(line));
    if (sectionIndex < 0) return null;
    for (let index = sectionIndex + 1; index < Math.min(lines.length, sectionIndex + 20); index += 1) {
      const fieldMatch = lines[index].match(fieldPattern);
      if (!fieldMatch) continue;
      const inlineValue = fieldMatch[1]?.trim();
      if (inlineValue) return inlineValue;
      return lines[index + 1] ?? null;
    }
    return null;
  };

  const titleFromDescription = valueAfterSection(
    /^Beschreibung der Leistung$/i,
    /^Bezeichnung:\s*(.*)$/i,
  );
  const titleFromPage = $("title").text().split("|")
    .map((part) => cleanTenderTitle(part))
    .find((part) => part.length >= 5 && !NON_TENDER_TITLE_PATTERNS.some((pattern) => pattern.test(part))) ?? "";
  const netServerTitle = /\/NetServer\//i.test(sourceUrl) ? extractNetServerTenderTitle(text) : null;
  const title = [
    titleFromDescription,
    netServerTitle,
    titleFromPage,
    $("h1").first().text().trim(),
    $("h2").first().text().trim(),
  ]
    .map((candidate) => cleanTenderTitle(candidate ?? ""))
    .find((candidate) => candidate.length >= 5 && !NON_TENDER_TITLE_PATTERNS.some((pattern) => pattern.test(candidate))) ?? "";
  if (title.length < 5) return null;

  const portalFacts = extractPublicPortalFacts(text);

  const deadline = text.match(/(?:Angebotsfrist|Abgabefrist|Ablauf der Angebotsfrist|Einreichungsfrist)[\s\S]{0,120}?(\d{1,2}\.\d{1,2}\.\d{4})/i)?.[1]
    ?? text.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/)?.[0]
    ?? null;
  const parsedClient = valueAfterSection(
    /^Ausschreibende Stelle$/i,
    /^Bezeichnung:\s*(.*)$/i,
  )
    || text.match(/(?:Name und Anschrift|Name)\s*:?\s*\n?\s*([^\n|]{3,120})/i)?.[1]?.trim()
    || portalFacts.client
    || text.match(/(?:Auftraggeber|Vergabestelle)\b\s*:?\s*([^\n|;]{3,120}?)(?=\s+(?:Frist|Angebotsfrist|Abgabefrist|Vergabeart|Verfahren|Auftragsgegenstand|Leistungsgegenstand)\b|$)/i)?.[1]?.trim()
    || extractClientFromUrl(sourceUrl);
  const client = accessPage.blocked && portalFacts.client ? portalFacts.client : parsedClient;
  const location = accessPage.blocked && portalFacts.location
    ? portalFacts.location
    : (text.match(/(?:Ort der Ausführung|Ort der Leistungserbringung)\s*:?\s*\n?\s*([^\n|]{3,120})/i)?.[1]?.trim()
      ?? text.match(/\b\d{5}\s+[A-ZÄÖÜ][\wÄÖÜäöüß .-]{2,80}/)?.[0]
      ?? null);
  const referenceNumber = text.match(/(?:Bekanntmachungs-ID|Vergabe-Nr\.|Vergabenummer)\s*:?\s*\n?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i)?.[1] ?? null;
  const description = accessPage.blocked
    ? buildPublicAccessLimitedDescription(title, portalFacts)
    : cleanPublicDescription(text.slice(0, 2000));
  const descriptionMarkdown = accessPage.blocked
    ? buildPublicAccessLimitedDescriptionMarkdown(title, portalFacts)
    : buildTenderDescriptionMarkdown({
      client,
      procedure: portalFacts.procedure,
      deadline,
      location,
      reference: referenceNumber,
      summary: description,
      subject: portalFacts.subject,
    });
  return {
    title: title.slice(0, 300),
    client,
    deadline: accessPage.blocked && portalFacts.deadline ? portalFacts.deadline : deadline,
    description,
    descriptionMarkdown,
    procedure: portalFacts.procedure,
    referenceNumber,
    location,
    category: "Facility Management",
    sourceUrl,
    source,
    pdfUrls,
  };
}

function extractClientFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const domain = parts[parts.length - 2];
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
    return hostname;
  } catch {
    return "Oeffentlicher Auftraggeber";
  }
}

function extractPdfUrlsFromMarkdown(markdown: string, baseUrl: string): string[] {
  const pdfRegex = /\[([^\]]*)\]\(([^)]*\.pdf[^)]*)\)/gi;
  const urlRegex = /(https?:\/\/[^\s\"<>]+\.pdf[^\s\"<>]*)/gi;
  const found = new Set<string>();

  let match;
  while ((match = pdfRegex.exec(markdown)) !== null) {
    const url = match[2].startsWith("http") ? match[2] : new URL(match[2], baseUrl).href;
    found.add(url);
  }
  while ((match = urlRegex.exec(markdown)) !== null) {
    found.add(match[1]);
  }

  return Array.from(found);
}

export interface PublicResourceMetadata {
  resources: DiscoveredResource[];
  pdfUrls: string[];
  subpageCandidates: RankedSubpageCandidate[];
}

export function extractPublicResourceMetadata(html: string, baseUrl: string): PublicResourceMetadata {
  const resources = extractResourcesFromHtml(html, baseUrl);
  const pdfUrls = resources
    .filter((resource) => (resource.type === "document" || resource.type === "download")
      && (/\.pdf(?:[?#]|$)/i.test(resource.url) || /application\/pdf/i.test(resource.contentType ?? "")))
    .map((resource) => resource.url);

  return {
    resources,
    pdfUrls: Array.from(new Set(pdfUrls)),
    subpageCandidates: rankSubpageCandidates(resources, { baseUrl }),
  };
}

function mainTextLines(html: string): string[] {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer").remove();
  return htmlToBasicMarkdown($("main").html() ?? $("body").html() ?? "")
    .split(/\n+/)
    .map((line) => normalizePublicMarkupText(line.replace(/^#+\s*/, "")))
    .filter(Boolean);
}

function readPublicLineValue(lines: string[], pattern: RegExp): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (!match) continue;
    const inlineValue = normalizePublicMarkupText(match[1] ?? "");
    if (inlineValue) return inlineValue;
    for (let next = index + 1; next < lines.length; next += 1) {
      if (lines[next]) return lines[next];
    }
  }
  return null;
}

function readPublicTextSection(lines: string[], heading: RegExp, stop: RegExp): string | null {
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return null;
  const values: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (stop.test(lines[index])) break;
    values.push(lines[index]);
  }
  const result = normalizePublicMarkupText(values.join(" "));
  return result || null;
}

export interface EvergabeOnlineRow {
  id: string;
  title: string;
  referenceNumber: string;
  client: string;
  location: string;
  procedure: string;
  deadline: string;
  detailUrl: string;
}

export function parseEvergabeOnlineRows(
  html: string,
  baseUrl = "https://www.evergabe-online.de/search.html",
): EvergabeOnlineRow[] {
  const $ = cheerio.load(html);
  const rows: EvergabeOnlineRow[] = [];
  const seenIds = new Set<string>();

  $("a[href*='tenderdetails.html']").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    try {
      const detailUrl = new URL(href, baseUrl).href;
      const detailUrlObject = new URL(detailUrl);
      const id = detailUrlObject.searchParams.get("id") ?? detailUrl.match(/[?&]id=([^&#]+)/i)?.[1] ?? "";
      const row = $(element).closest("tr");
      const cells = row.find("td");
      const cell = (selector: string, index: number): string => normalizePublicMarkupText(
        selector ? row.find(selector).first().text() : cells.eq(index).text(),
      );
      const title = normalizePublicMarkupText($(element).text()) || cell("", 0);
      if (!id || title.length < 5 || seenIds.has(id)) return;

      seenIds.add(id);
      rows.push({
        id,
        title: cleanTenderTitle(title),
        referenceNumber: cell("", 1),
        client: cell("", 2),
        location: cell("", 3),
        procedure: cell("", 4),
        deadline: cell(".result_col_deadline", 5),
        detailUrl,
      });
    } catch {
      // Ignore malformed listing links.
    }
  });

  return rows;
}

export function parseEvergabeOnlineNextUrl(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);
  const current = new URL(currentUrl);
  const candidates = $("a[rel='next'], a.next, a[title*='nächste'], a[title*='naechste']");

  for (const element of candidates.toArray()) {
    const $element = $(element);
    const href = $element.attr("href");
    if (!href || $element.attr("aria-disabled") === "true" || $element.hasClass("disabled")) continue;
    try {
      const next = new URL(href, current).href;
      if (next !== current.href) return next;
    } catch {
      // Ignore malformed pagination links.
    }
  }

  return null;
}

export function parseEvergabeOnlineDetail(html: string, sourceUrl: string): ExtractedTender | null {
  if (!html || html.trim().length < 100) return null;
  if (detectAccessPage(html, { url: sourceUrl }).blocked) return null;

  const $ = cheerio.load(html);
  const lines = mainTextLines(html);
  const title = cleanTenderTitle(normalizePublicMarkupText(
    $(".procedure-infos h4").first().text() || $("main h4").first().text() || $("h1").first().text(),
  ));
  if (title.length < 5 || NON_TENDER_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return null;

  const basic = extractBasicDetailFromHtml(html, sourceUrl, "evergabe-online.de", [], true);
  const procedure = readPublicLineValue(lines, /^Verfahrensart\s*:?\s*(.*)$/i);
  const client = readPublicLineValue(lines, /^Name\s*:?\s*(.*)$/i)
    ?? readPublicLineValue(lines, /^Vergabestelle\s*:?\s*(.*)$/i)
    ?? basic?.client
    ?? "Bundesrepublik Deutschland";
  const deadline = readPublicLineValue(lines, /^(?:Abgabefrist Angebot|Ablauf der Angebotsfrist|Angebotsfrist)\s*:?\s*(.*)$/i) ?? basic?.deadline;
  const referenceNumber = readPublicLineValue(lines, /^Geschäftszeichen\s*:?\s*(.*)$/i) ?? basic?.referenceNumber;
  const location = readPublicTextSection(
    lines,
    /^Ort der Leistungserbringung$/i,
    /^(?:Angaben zu Losen|Zulassung von Nebenangeboten|Bestimmungen über die Ausführungsfrist|Wesentliche Zahlungsbedingungen|Unterlagen und Anforderungen|Zuschlagskriterien|Rechtsform|Sonstige Angaben)$/i,
  ) ?? basic?.location;
  const performance = readPublicTextSection(
    lines,
    /^Art und Umfang der Leistung$/i,
    /^(?:CPV-Codes|Ort der Leistungserbringung|Angaben zu Losen|Zulassung von Nebenangeboten|Bestimmungen über die Ausführungsfrist|Wesentliche Zahlungsbedingungen)$/i,
  );
  const description = pickPublicDescription(
    performance,
    basic?.description,
    [procedure ? `Verfahrensart: ${procedure}` : "", referenceNumber ? `Geschäftszeichen: ${referenceNumber}` : ""].filter(Boolean).join(". "),
  );
  const resourceMetadata = extractPublicResourceMetadata(html, sourceUrl);
  const externalId = new URL(sourceUrl).searchParams.get("id");

  return withDescriptionMarkdown({
    title,
    client,
    deadline: deadline ?? null,
    description,
    procedure,
    referenceNumber: referenceNumber ?? null,
    location: location ?? null,
    category: "Sonstiges",
    sourceUrl,
    source: "evergabe-online.de",
    ...(externalId ? { externalId } : {}),
    pdfUrls: resourceMetadata.pdfUrls,
    resources: resourceMetadata.resources,
    subpageCandidates: resourceMetadata.subpageCandidates,
  });
}

export interface SachsenAnhaltListingRow {
  idp: string;
  title: string;
  url: string;
}

export interface SachsenAnhaltDetailPage {
  idp: string | null;
  title: string;
  deadline: string | null;
  client: string | null;
  location: string | null;
  procedure: string | null;
  externalUrl: string | null;
}

export function parseSachsenAnhaltListing(
  html: string,
  baseUrl = "https://evergabe.sachsen-anhalt.de/",
): SachsenAnhaltListingRow[] {
  const $ = cheerio.load(html);
  const rows: SachsenAnhaltListingRow[] = [];
  const seenIds = new Set<string>();

  $("a[href*='recherche-aktueller-vergaben?idp=']").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, baseUrl).href;
      const idp = new URL(url).searchParams.get("idp") ?? "";
      const container = $(element).closest("tr, article, li, td").first();
      const rawContainerText = normalizePublicMarkupText(container.text() || $(element).parent().text());
      const title = cleanTenderTitle(rawContainerText.replace(/\s*mehr\s*>>.*$/i, ""));
      if (!idp || title.length < 5 || seenIds.has(idp)) return;
      seenIds.add(idp);
      rows.push({ idp, title, url });
    } catch {
      // Ignore malformed wrapper links.
    }
  });

  return rows;
}

export function parseSachsenAnhaltDetail(html: string, sourceUrl: string): SachsenAnhaltDetailPage | null {
  if (!html || html.trim().length < 100) return null;
  const $ = cheerio.load(html);
  const value = (className: string): string | null => {
    const text = normalizePublicMarkupText($(`.${className} .tsaid_data`).first().text());
    return text || null;
  };
  const title = cleanTenderTitle(value("tsaid_TOPIC") ?? "");
  if (title.length < 5) return null;

  const externalHref = $(".tsaid_URL a[href]").first().attr("href");
  let externalUrl: string | null = null;
  if (externalHref) {
    try {
      externalUrl = new URL(externalHref, sourceUrl).href;
    } catch {
      externalUrl = null;
    }
  }

  return {
    idp: new URL(sourceUrl).searchParams.get("idp"),
    title,
    deadline: value("tsaid_DEADLINE") ?? value("tsaid_APPLICATIONPERIOD"),
    client: value("tsaid_MANDANT"),
    location: value("tsaid_AREA"),
    procedure: value("tsaid_PROCESSTYPE"),
    externalUrl,
  };
}

// --- Source Scraper ---

async function scrapeDtvp(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] Scraping dtvp.de Detail-Seiten...");
  const searchUrl = "https://www.dtvp.de/Center/common/project/search.do?method=showExtendedSearch&fromExternal=true";
  const startPage = cursorBoolean(cursor, "exhausted") ? 1 : cursorNumber(cursor, "page", 1);
  let pagesFetched = 0;
  let hasMore = false;
  let firstSearchPage: ScrapedPage | null = null;

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const page = await scrapeWebsite(reference.url, { onlyMainContent: false });
      if (!page.markdown || page.markdown.trim().length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(page.markdown, { url: reference.url }).blocked) return { tender: null, blocked: true };

      const pdfUrls: string[] = [];
      const pdfRegex = /href=["']([^"']*\.pdf[^"']*)["']/gi;
      let pdfMatch;
      while ((pdfMatch = pdfRegex.exec(page.html)) !== null) {
        const pdfUrl = pdfMatch[1].replace(/&amp;/g, "&");
        const fullPdfUrl = pdfUrl.startsWith("http") ? pdfUrl : new URL(pdfUrl, reference.url).href;
        if (!pdfUrls.includes(fullPdfUrl)) pdfUrls.push(fullPdfUrl);
      }

      const extracted = await extractDetailFromMarkdown(page.markdown, page.url, "DTVP", true);
      if (!extracted) return { tender: null };
      extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      extracted.pdfUrls = Array.from(new Set([...pdfUrls, ...extracted.pdfUrls]));
      return { tender: withScrapedResources(extracted, page) };
    } catch (error) {
      console.error(`[public-scraper] dtvp Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "dtvp-page", pendingRun);
  }

  try {
    const detailLinks: PublicDetailReference[] = [];
    const seenPids = new Set<string>();

    for (let pageNumber = startPage; pageNumber < startPage + settings.publicPaginationPages; pageNumber++) {
      const pageUrl = `${searchUrl}#${encodeDtvpSearchHash(pageNumber)}`;
      const searchPage = await scrapeWebsite(pageUrl, {
        onlyMainContent: false,
        waitForSelector: "a[href*='projectForwarding']",
        waitMs: 1500,
      });
      if (!searchPage.html && !searchPage.markdown) throw new Error(`dtvp listing page ${pageNumber} returned no content`);
      firstSearchPage ??= searchPage;
      pagesFetched += 1;

      // Extract projectForwarding.do links from RAW HTML (not markdown which strips links).
      const linkRegex = /href=["']([^"']*projectForwarding\.do\?pid=\d+[^"']*)["']/gi;
      let match;
      while ((match = linkRegex.exec(searchPage.html)) !== null) {
        const url = match[1].replace(/&amp;/g, "&");
        const pidMatch = url.match(/pid=(\d+)/);
        if (pidMatch && !seenPids.has(pidMatch[1])) {
          seenPids.add(pidMatch[1]);
          const fullUrl = url.startsWith("http") ? url : `https://www.dtvp.de${url}`;
          const reference = publicDetailReference(`dtvp:pid:${pidMatch[1]}`, fullUrl, pidMatch[1]);
          if (url.includes("/public/")) {
            detailLinks.unshift(reference);
          } else {
            detailLinks.push(reference);
          }
        }
      }

      // Also check markdown as fallback.
      const mdLinkRegex = /https?:\/\/[^\s"'<>]*projectForwarding\.do\?pid=\d+[^\s"'<>]*/gi;
      while ((match = mdLinkRegex.exec(searchPage.markdown)) !== null) {
        const url = match[0];
        const pidMatch = url.match(/pid=(\d+)/);
        if (pidMatch && !seenPids.has(pidMatch[1])) {
          seenPids.add(pidMatch[1]);
          detailLinks.push(publicDetailReference(`dtvp:pid:${pidMatch[1]}`, url, pidMatch[1]));
        }
      }

      const pageInfo = parseDtvpPageInfo(searchPage.html);
      hasMore = pageInfo
        ? pageNumber < pageInfo.totalPages
        : !/id=["']nextPage["'][^>]*browseForwardGhost/i.test(searchPage.html);
      if (!hasMore || detailLinks.length === 0) break;
    }

    console.log(`[public-scraper] dtvp: ${detailLinks.length} Detail-Links gefunden`);

    if (detailLinks.length === 0) {
      const fallback = firstSearchPage
        ? await extractTendersFromMarkdown(firstSearchPage.markdown, searchUrl, "DTVP")
        : [];
      return sourceCursorResult([...pendingRun.tenders, ...fallback], {
        cursor,
        strategy: "dtvp-page",
        position: { page: hasMore ? startPage + pagesFetched : 1 },
        listingExhausted: !hasMore,
        listingComplete: !hasMore,
        pendingDetails: pendingRun.pendingDetails,
        pagesFetched,
        paginationStrategy: "dtvp-page",
        listedCount: 0,
        detailAttempted: pendingRun.detailAttempted,
        detailFailed: pendingRun.detailFailed,
        extra: { page: hasMore ? startPage + pagesFetched : 1 },
      });
    }

    const detailRun = await processDetailQueue(
      detailLinks,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] dtvp: ${tenders.length} Ausschreibungen mit Details`);
    const nextPage = hasMore ? startPage + pagesFetched : 1;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "dtvp-page",
      position: { page: nextPage },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "dtvp-page",
      listedCount: detailLinks.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { page: nextPage },
    });
  } catch (error) {
    console.error("[public-scraper] dtvp Fehler:", error);
    throw error;
  }
}

async function scrapeTed(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] Scraping ted.europa.eu Detail-Seiten...");
  const startPage = cursorBoolean(cursor, "exhausted") ? 1 : cursorNumber(cursor, "page", 1);
  let pagesFetched = 0;
  let hasMore = false;
  let firstSearchPage: ScrapedPage | null = null;

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const page = await scrapeWebsite(reference.url, { waitMs: 2000 });
      if (!page.markdown || page.markdown.trim().length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(page.markdown, { url: reference.url }).blocked) return { tender: null, blocked: true };

      const extracted = await extractDetailFromMarkdown(page.markdown, reference.url, "TED", true);
      if (!extracted) return { tender: null };
      if (!isGermanText(extracted.title + " " + extracted.description)) return { tender: null };
      if (!extracted.pdfUrls.some((url) => url.includes("/pdf"))) {
        extracted.pdfUrls.push(`https://ted.europa.eu/de/notice/${reference.externalId ?? ""}/pdf`);
      }
      extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      return { tender: withScrapedResources(extracted, page) };
    } catch (error) {
      console.error(`[public-scraper] ted Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicNoticeLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicNoticeLimit)) {
    return pendingOnlyResult(cursor, "ted-page", pendingRun);
  }

  try {
    const noticeIds: PublicDetailReference[] = [];
    const seenIds = new Set<string>();
    for (let pageNumber = startPage; pageNumber < startPage + settings.publicPaginationPages; pageNumber++) {
      const searchUrl = `https://ted.europa.eu/en/search/result?country=DE&page=${pageNumber}`;
      // TED is a heavy SPA - wait for result links to appear.
      const searchPage = await scrapeWebsite(searchUrl, {
        onlyMainContent: false,
        waitForSelector: "a[href*='/notice']",
        waitMs: 3000,
      });
      if (!searchPage.html && !searchPage.markdown) throw new Error(`ted listing page ${pageNumber} returned no content`);
      firstSearchPage ??= searchPage;
      pagesFetched += 1;

      // Extract notice detail links from RAW HTML.
      const noticeRegex = /href=["']([^"']*\/notice\/[^"']*?(\d+-\d+)[^"']*)["']/gi;
      let match;
      while ((match = noticeRegex.exec(searchPage.html)) !== null) {
        const noticeId = match[2];
        if (!seenIds.has(noticeId)) {
          seenIds.add(noticeId);
          noticeIds.push(publicDetailReference(`ted:notice:${noticeId}`, `https://ted.europa.eu/en/notice/-/detail/${noticeId}`, noticeId));
        }
      }

      // Fallback: also check markdown.
      const mdRegex = /\/notice\/[^/]*?(\d+-\d+)/gi;
      while ((match = mdRegex.exec(searchPage.markdown)) !== null) {
        if (!seenIds.has(match[1])) {
          seenIds.add(match[1]);
          const noticeId = match[1];
          noticeIds.push(publicDetailReference(`ted:notice:${noticeId}`, `https://ted.europa.eu/en/notice/-/detail/${noticeId}`, noticeId));
        }
      }

      const pageInfo = cheerio.load(searchPage.html).text().match(/Page\s+(\d+)\s+of\s+(\d+)/i);
      hasMore = pageInfo
        ? pageNumber < Number(pageInfo[2])
        : noticeIds.length >= 50;
      if (!hasMore || noticeIds.length === 0) break;
    }

    console.log(`[public-scraper] ted: ${noticeIds.length} Notice-IDs gefunden`);

    if (noticeIds.length === 0) {
      const fallback = firstSearchPage
        ? await extractTendersFromMarkdown(firstSearchPage.markdown, `https://ted.europa.eu/en/search/result?country=DE`, "TED")
        : [];
      return sourceCursorResult([...pendingRun.tenders, ...fallback], {
        cursor,
        strategy: "ted-page",
        position: { page: hasMore ? startPage + pagesFetched : 1 },
        listingExhausted: !hasMore,
        listingComplete: !hasMore,
        pendingDetails: pendingRun.pendingDetails,
        pagesFetched,
        paginationStrategy: "ted-page",
        listedCount: 0,
        detailAttempted: pendingRun.detailAttempted,
        detailFailed: pendingRun.detailFailed,
        extra: { page: hasMore ? startPage + pagesFetched : 1 },
      });
    }

    const detailRun = await processDetailQueue(
      noticeIds,
      settings.publicNoticeLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] ted: ${tenders.length} Ausschreibungen mit Details`);
    const nextPage = hasMore ? startPage + pagesFetched : 1;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "ted-page",
      position: { page: nextPage },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "ted-page",
      listedCount: noticeIds.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { page: nextPage },
    });
  } catch (error) {
    console.error("[public-scraper] ted Fehler:", error);
    throw error;
  }
}

async function scrapeBauportal(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  const baseUrl = "https://www.bauportal-deutschland.de";
  const startPage = cursorBoolean(cursor, "exhausted") ? 1 : cursorNumber(cursor, "page", 1);
  let pagesFetched = 0;
  let hasMore = false;

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const detailPage = await scrapeWebsite(reference.url, { onlyMainContent: false });
      if (!detailPage.markdown || detailPage.markdown.trim().length < 30) return { tender: null, retryable: true };
      if (detectAccessPage(detailPage.markdown, { url: reference.url }).blocked) return { tender: null, blocked: true };
      const extracted = await extractDetailFromMarkdown(detailPage.markdown, detailPage.url, "bauportal-deutschland.de");
      return extracted ? { tender: withScrapedResources(extracted, detailPage) } : { tender: null };
    } catch (error) {
      console.warn(`[public-scraper] bauportal Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "bauportal-page", pendingRun);
  }

  console.log("[public-scraper] Scraping bauportal-deutschland.de...");
  try {
    const detailRefs: PublicDetailReference[] = [];
    const fallbackTenders: ExtractedTender[] = [];
    for (let page = startPage; page < startPage + settings.publicPaginationPages; page++) {
      const listUrl = `${baseUrl}/ausschreibungen_fuer_Facility_Management_Hausverwaltung_gid_1000009_seite_${page}.html`;
      console.log(`[public-scraper] bauportal page ${page}...`);
      // Use onlyMainContent: false to get full HTML for link extraction
      const listPage = await scrapeWebsite(listUrl, { onlyMainContent: false });
      pagesFetched += 1;
      if (!listPage.html && !listPage.markdown) throw new Error(`bauportal page ${page}: listing returned no content`);

      // Use cheerio on the RAW HTML, not markdown
      const $ = cheerio.load(listPage.html);
      const detailUrls: string[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        if (href.includes("_details_") && href.endsWith(".html")) {
          const absolute = href.startsWith("http") ? href : `${baseUrl}${href}`;
          if (!detailUrls.includes(absolute)) {
            detailUrls.push(absolute);
          }
        }
      });

      console.log(`[public-scraper] bauportal page ${page}: ${detailUrls.length} Detail-Links`);

      if (detailUrls.length === 0) {
        const extracted = await extractTendersFromMarkdown(listPage.markdown, listUrl, "bauportal-deutschland.de");
        fallbackTenders.push(...extracted);
        hasMore = false;
        break;
      }

      for (const detailUrl of detailUrls) {
        detailRefs.push(publicDetailReference(`bauportal:url:${detailUrl}`, detailUrl));
      }

      const nextUrls = parseGenericPaginationUrls(listPage.html, baseUrl, listUrl);
      hasMore = nextUrls.length > 0;
      if (!hasMore || detailRefs.length >= settings.publicDetailLimit) break;
    }

    const detailRun = await processDetailQueue(
      detailRefs,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...fallbackTenders, ...detailRun.tenders];
    const nextPage = hasMore ? startPage + pagesFetched : 1;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "bauportal-page",
      position: { page: nextPage },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "bauportal-page",
      listedCount: detailRefs.length + fallbackTenders.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { page: nextPage },
    });
  } catch (error) {
    console.error("[public-scraper] bauportal Fehler:", error);
    throw error;
  }
}

async function fetchEvergabeDocumentUrls(pageHtml: string, detailUrl: string): Promise<string[]> {
  const allPdfUrls: string[] = [];

  // Strategie 1: Vergabe-ID aus der Detailseite extrahieren und Documents-URL konstruieren
  const vergabeIdMatch = pageHtml.match(/Vergabe-?ID[:\s]*(\d{5,})/i);
  if (vergabeIdMatch) {
    const vergabeId = vergabeIdMatch[1];
    const docsUrl = `https://www.evergabe.de/unterlagen/${vergabeId}`;
    console.log(`[public-scraper] evergabe: Vergabe-ID ${vergabeId} gefunden, fetch Documents-Seite ${docsUrl}`);
    try {
      const resp = await fetch(docsUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const docsHtml = await resp.text();
        const $docs = cheerio.load(docsHtml);
        $docs("a[href*='/download/']").each((_, el) => {
          const href = $docs(el).attr("href");
          if (!href) return;
          try {
            const fullUrl = new URL(href, "https://www.evergabe.de").href;
            if (!allPdfUrls.includes(fullUrl)) allPdfUrls.push(fullUrl);
          } catch { /* ignore */ }
        });
        console.log(`[public-scraper] evergabe: ${allPdfUrls.length} PDFs auf Documents-Seite gefunden`);
      }
    } catch (err) {
      console.warn(`[public-scraper] evergabe Documents-Seite Fehler:`, err);
    }
  }

  // Strategie 2: Fallback - /unterlagen/ Links im HTML suchen
  if (allPdfUrls.length === 0) {
    const $ = cheerio.load(pageHtml);
    const unterlagenUrls: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || !href.includes("/unterlagen/")) return;
      try {
        const absolute = new URL(href, detailUrl).href.split("?")[0];
        if (!unterlagenUrls.includes(absolute)) unterlagenUrls.push(absolute);
      } catch { /* ignore */ }
    });

    for (const unterlagenUrl of unterlagenUrls.slice(0, 3)) {
      try {
        const docsUrl = unterlagenUrl.replace(/\/zustellweg-auswaehlen\/?$/, "");
        console.log(`[public-scraper] evergabe: Fallback fetch Documents-Seite ${docsUrl}`);
        const resp = await fetch(docsUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) continue;
        const docsHtml = await resp.text();
        const $docs = cheerio.load(docsHtml);
        $docs("a[href*='/download/']").each((_, el) => {
          const href = $docs(el).attr("href");
          if (!href) return;
          try {
            const fullUrl = new URL(href, "https://www.evergabe.de").href;
            if (!allPdfUrls.includes(fullUrl)) allPdfUrls.push(fullUrl);
          } catch { /* ignore */ }
        });
      } catch (err) {
        console.warn(`[public-scraper] evergabe Fallback Fehler:`, err);
      }
    }
  }

  return allPdfUrls;
}

async function scrapeEvergabe(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] Direktes Scraping: evergabe.de...");
  const startPage = cursorBoolean(cursor, "exhausted") ? 1 : cursorNumber(cursor, "page", 1);
  let pagesFetched = 0;
  let hasMore = false;

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const detailUrl = reference.url;
      const page = await scrapeWebsite(detailUrl, { onlyMainContent: false });
      if (!page.markdown || page.markdown.trim().length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(page.markdown, { url: detailUrl }).blocked) return { tender: null, blocked: true };

      const pdfUrls: string[] = [];
      const pdfRegex = /href=["']([^"']*\.pdf[^"']*)["']/gi;
      let pdfMatch;
      while ((pdfMatch = pdfRegex.exec(page.html)) !== null) {
        const pdfUrl = pdfMatch[1].replace(/&amp;/g, "&");
        const fullPdfUrl = pdfUrl.startsWith("http") ? pdfUrl : new URL(pdfUrl, detailUrl).href;
        if (!pdfUrls.includes(fullPdfUrl)) pdfUrls.push(fullPdfUrl);
      }

      const docPdfUrls = await fetchEvergabeDocumentUrls(page.html, detailUrl);
      const extracted = await extractDetailFromMarkdown(page.markdown, page.url, "evergabe.de", true);
      if (!extracted) return { tender: null };
      extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      extracted.pdfUrls = Array.from(new Set([...pdfUrls, ...docPdfUrls, ...extracted.pdfUrls]));
      return { tender: withScrapedResources(extracted, page) };
    } catch (error) {
      console.error(`[public-scraper] evergabe Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "evergabe-page", pendingRun);
  }

  try {
    const linkRegex = /href=["'](\/ausschreibung\/[^"']+)["']/gi;
    const detailPaths: PublicDetailReference[] = [];
    const seen = new Set<string>();

    for (let page = startPage; page < startPage + settings.publicPaginationPages; page++) {
      const listUrl = `https://www.evergabe.de/bieter/auftrag-suchen?page=${page}`;
      // evergabe.de is server-rendered (Rails) — use fetch instead of Playwright.
      const response = await fetch(listUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`evergabe listing HTTP ${response.status}`);
      const html = await response.text();
      if (!html.trim()) throw new Error(`evergabe listing page ${page} returned no content`);
      pagesFetched += 1;
      console.log(`[public-scraper] evergabe page ${page}: listing HTML ${html.length} bytes`);

      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const path = match[1].split("?")[0];
        if (!seen.has(path)) {
          seen.add(path);
          const detailUrl = `https://www.evergabe.de${path}`;
          detailPaths.push(publicDetailReference(`evergabe:url:${path}`, detailUrl));
        }
      }

      const nextUrls = parseGenericPaginationUrls(html, listUrl, listUrl);
      hasMore = nextUrls.length > 0;
      if (!hasMore || detailPaths.length === 0) break;
    }

    console.log(`[public-scraper] evergabe: ${detailPaths.length} Detail-Links gefunden`);

    if (detailPaths.length === 0) {
      return sourceCursorResult(pendingRun.tenders, {
        cursor,
        strategy: "evergabe-page",
        position: { page: hasMore ? startPage + pagesFetched : 1 },
        listingExhausted: !hasMore,
        listingComplete: !hasMore,
        pendingDetails: pendingRun.pendingDetails,
        pagesFetched,
        paginationStrategy: "evergabe-page",
        listedCount: 0,
        detailAttempted: pendingRun.detailAttempted,
        detailFailed: pendingRun.detailFailed,
        extra: { page: hasMore ? startPage + pagesFetched : 1 },
      });
    }

    const detailRun = await processDetailQueue(
      detailPaths,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] evergabe: ${tenders.length} Ausschreibungen mit Details`);
    const nextPage = hasMore ? startPage + pagesFetched : 1;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "evergabe-page",
      position: { page: nextPage },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "evergabe-page",
      listedCount: detailPaths.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { page: nextPage },
    });
  } catch (error) {
    console.error("[public-scraper] evergabe Fehler:", error);
    throw error;
  }
}

// --- eVergabe Bund (evergabe-online.de) ---

async function scrapeEvergabeOnline(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  const rootUrl = "https://www.evergabe-online.de/search.html";
  let currentUrl = rootUrl;
  let pagesFetched = 0;
  let hasMore = false;

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const detailPage = await scrapeWebsite(reference.url, { onlyMainContent: false });
      const detailUrl = detailPage.url || reference.url;
      const detailHtml = detailPage.html;
      if (!detailHtml.trim() || detailHtml.trim().length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(detailHtml, { url: detailUrl }).blocked) return { tender: null, blocked: true };

      const extracted = parseEvergabeOnlineDetail(detailHtml, detailUrl);
      if (!extracted) return { tender: null };
      extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      extracted.resources = mergeDiscoveredResources(extracted.resources ?? [], detailPage.resources);
      extracted.pdfUrls = Array.from(new Set([
        ...(extracted.pdfUrls ?? []),
        ...detailPage.resources
          .filter((resource) => resource.type === "document" && /\.pdf(?:[?#]|$)/i.test(resource.url))
          .map((resource) => resource.url),
      ]));
      extracted.subpageCandidates = detailPage.subpageCandidates;
      return { tender: extracted };
    } catch (error) {
      console.warn(`[public-scraper] evergabe-online Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "evergabe-online-page", pendingRun);
  }

  try {
    const detailRefs: PublicDetailReference[] = [];
    const seenIds = new Set<string>();

    let startPage = Math.max(1, cursorBoolean(cursor, "exhausted") ? 1 : cursorNumber(cursor, "page", 1));
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      });
      let pageNumber = 1;
      currentUrl = rootUrl;

      while (pageNumber < startPage) {
        const response = await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (response && response.status() >= 400) throw new Error(`evergabe-online listing HTTP ${response.status()}`);
        await page.waitForTimeout(300);
        const html = await page.content();
        const nextUrl = parseEvergabeOnlineNextUrl(html, page.url());
        if (!nextUrl) {
          startPage = 1;
          pageNumber = 1;
          currentUrl = rootUrl;
          break;
        }
        currentUrl = nextUrl;
        pageNumber += 1;
      }

      for (let pageIndex = 0; pageIndex < settings.publicPaginationPages; pageIndex += 1) {
        const response = await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (response && response.status() >= 400) throw new Error(`evergabe-online listing HTTP ${response.status()}`);
        await page.waitForTimeout(300);
        const html = await page.content();
        if (!html.trim()) throw new Error(`evergabe-online listing page ${pageNumber} returned no content`);
        pagesFetched += 1;

        const rows = parseEvergabeOnlineRows(html, page.url());
        if (rows.length === 0 && detectAccessPage(html, { url: page.url() }).blocked) {
          throw new Error("evergabe-online listing access blocked");
        }
        for (const row of rows) {
          if (seenIds.has(row.id)) continue;
          seenIds.add(row.id);
          detailRefs.push(publicDetailReference(`evergabe-online:id:${row.id}`, row.detailUrl, row.id));
        }

        const nextUrl = parseEvergabeOnlineNextUrl(html, page.url());
        hasMore = Boolean(nextUrl);
        if (!nextUrl || detailRefs.length === 0) break;
        currentUrl = nextUrl;
        pageNumber += 1;
      }
    } finally {
      await browser.close().catch(() => {});
    }

    console.log(`[public-scraper] evergabe-online: ${detailRefs.length} Detail-Links gefunden`);
    const detailRun = await processDetailQueue(
      detailRefs,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];
    const nextPage = hasMore ? startPage + pagesFetched : 1;

    return sourceCursorResult(tenders, {
      cursor,
      strategy: "evergabe-online-page",
      position: { page: nextPage },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "evergabe-online-page",
      listedCount: detailRefs.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { page: nextPage },
    });
  } catch (error) {
    console.error("[public-scraper] evergabe-online Fehler:", error);
    throw error;
  }
}

async function scrapeBundesimmobilien(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  const url = "https://www.bundesimmobilien.de/ausschreibungen-cc3b21db72191aeb";
  console.log("[public-scraper] Direktes Scraping: bundesimmobilien.de...");

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    async () => ({ tender: null, blocked: true }),
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "bundesimmobilien-snapshot", pendingRun);
  }

  try {
    const page = await scrapeWebsite(url, { onlyMainContent: false });
    if (!page.markdown || page.markdown.trim().length < 200) {
      throw new Error("bundesimmobilien: listing returned no usable content");
    }
    const extracted = await extractTendersFromMarkdown(page.markdown, url, "bundesimmobilien.de");
    console.log(`[public-scraper] bundesimmobilien: ${extracted.length} Tenders`);
    const snapshot = new Date().toISOString();
    return sourceCursorResult([...pendingRun.tenders, ...extracted], {
      cursor,
      strategy: "bundesimmobilien-snapshot",
      position: { snapshot, url },
      listingExhausted: true,
      listingComplete: true,
      pendingDetails: pendingRun.pendingDetails,
      pagesFetched: 1,
      paginationStrategy: "bundesimmobilien-snapshot",
      listedCount: extracted.length,
      detailAttempted: pendingRun.detailAttempted,
      detailFailed: pendingRun.detailFailed,
      extra: { snapshot },
    });
  } catch (error) {
    console.error("[public-scraper] bundesimmobilien Fehler:", error);
    throw error;
  }
}

// --- New Sources: State Portals ---

async function scrapeVergabeNiedersachsen(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] Direktes Scraping: vergabe.niedersachsen.de...");
  const rootUrl = "https://vergabe.niedersachsen.de/Satellite/company/welcome.do?method=showTable&fromSearch=1";
  let currentUrl = cursorBoolean(cursor, "exhausted") ? rootUrl : cursorString(cursor, "nextUrl") ?? rootUrl;
  let pagesFetched = 0;
  let hasMore = false;

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const page = await scrapeWebsite(reference.url, { onlyMainContent: false });
      if (!page.markdown || page.markdown.trim().length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(page.markdown, { url: reference.url }).blocked) return { tender: null, blocked: true };
      const extracted = await extractDetailFromMarkdown(page.markdown, page.url, "vergabe.niedersachsen.de", true);
      if (!extracted) return { tender: null };
      extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      return { tender: withScrapedResources(extracted, page) };
    } catch (error) {
      console.error(`[public-scraper] niedersachsen Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "niedersachsen-url", pendingRun);
  }

  try {
    const detailLinks: PublicDetailReference[] = [];
    const seenPids = new Set<string>();

    for (let page = 0; page < settings.publicPaginationPages; page++) {
      // Server-rendered page — use fetch instead of Playwright.
      const response = await fetch(currentUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`niedersachsen listing HTTP ${response.status}`);
      const html = await response.text();
      if (!html.trim()) throw new Error("niedersachsen listing returned no content");
      pagesFetched += 1;

      // Extract projectForwarding.do?pid= links.
      const linkRegex = /href=["']([^"'']*projectForwarding\.do\?pid=\d+[^"']*)["']/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1].replace(/&amp;/g, "&");
        const pidMatch = url.match(/pid=(\d+)/);
        if (pidMatch && !seenPids.has(pidMatch[1])) {
          seenPids.add(pidMatch[1]);
          const fullUrl = url.startsWith("http") ? url : `https://vergabe.niedersachsen.de${url.startsWith("/") ? "" : "/Satellite/"}${url}`;
          detailLinks.push(publicDetailReference(`niedersachsen:pid:${pidMatch[1]}`, fullUrl, pidMatch[1]));
        }
      }

      const nextUrls = parseGenericPaginationUrls(html, rootUrl, currentUrl);
      hasMore = nextUrls.length > 0;
      if (!hasMore || detailLinks.length === 0) break;
      currentUrl = nextUrls[0].replace(/;jsessionid=[^?/]*/, "");
    }

    console.log(`[public-scraper] niedersachsen: ${detailLinks.length} Detail-Links gefunden`);

    if (detailLinks.length === 0) {
      return sourceCursorResult(pendingRun.tenders, {
        cursor,
        strategy: "niedersachsen-url",
        position: { nextUrl: hasMore ? currentUrl : rootUrl },
        listingExhausted: !hasMore,
        listingComplete: !hasMore,
        pendingDetails: pendingRun.pendingDetails,
        pagesFetched,
        paginationStrategy: "niedersachsen-url",
        listedCount: 0,
        detailAttempted: pendingRun.detailAttempted,
        detailFailed: pendingRun.detailFailed,
        extra: { nextUrl: hasMore ? currentUrl : rootUrl },
      });
    }

    const detailRun = await processDetailQueue(
      detailLinks,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] niedersachsen: ${tenders.length} Ausschreibungen mit Details`);
    const nextUrl = hasMore ? currentUrl : rootUrl;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "niedersachsen-url",
      position: { nextUrl },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "niedersachsen-url",
      listedCount: detailLinks.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { nextUrl },
    });
  } catch (error) {
    console.error("[public-scraper] niedersachsen Fehler:", error);
    throw error;
  }
}

async function scrapeNrwDetailReference(
  reference: PublicDetailReference,
  source: string,
  portalStartTime: number,
  portalMaxMs: number,
): Promise<DetailOutcome> {
  if (Date.now() - portalStartTime > portalMaxMs) return { tender: null, retryable: true };

  try {
    const detailResp = await fetch(reference.url, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!detailResp.ok) return detailResp.status === 404
      ? { tender: null, blocked: true }
      : { tender: null, retryable: true };

    const detailBuf = Buffer.from(await detailResp.arrayBuffer());
    const detailUrl = detailResp.url;
    const contentType = detailResp.headers.get("content-type") ?? "";
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    let encoding = charsetMatch?.[1]?.toLowerCase() ?? "";
    if (!encoding) {
      const head = detailBuf.toString("ascii", 0, Math.min(2000, detailBuf.length));
      encoding = head.match(/charset[=:]\s*"?([a-z0-9_-]+)/i)?.[1]?.toLowerCase() ?? "";
    }
    const detailHtml = (encoding.includes("latin") || encoding.includes("iso-8859") || encoding.includes("windows-1252"))
      ? detailBuf.toString("latin1")
      : detailBuf.toString("utf-8");
    if (!detailHtml || detailHtml.length < 500) return { tender: null, retryable: true };

    const pdfUrls: string[] = [];
    const pdfRegex = /href=["']([^"']*\.pdf[^"']*)["']/gi;
    let pdfMatch;
    while ((pdfMatch = pdfRegex.exec(detailHtml)) !== null) {
      const href = pdfMatch[1].replace(/&amp;/g, "&").replace(/;jsessionid=[^"']*/, "");
      if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
      try {
        const resolved = new URL(href, detailUrl).href;
        if (!pdfUrls.includes(resolved)) pdfUrls.push(resolved);
      } catch { /* ignore malformed document links */ }
    }

    if (detectAccessPage(detailHtml, { url: detailUrl }).blocked) {
      const fallback = extractBasicDetailFromHtml(detailHtml, detailUrl, source, pdfUrls, true);
      if (!fallback) return { tender: null, blocked: true };
      fallback.externalId = reference.externalId ?? fallback.externalId ?? null;
      fallback.sourceUrl = reference.url;
      fallback.pdfUrls = pdfUrls;
      return { tender: fallback };
    }

    let contentForLLM = "";
    for (const pdfUrl of pdfUrls) {
      try {
        const pdfResp = await fetch(pdfUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(15000),
        });
        if (!pdfResp.ok || !(pdfResp.headers.get("content-type") ?? "").includes("pdf")) continue;
        const buf = await pdfResp.arrayBuffer();
        if (buf.byteLength < 1000) continue;
        const tmpPath = `/tmp/public-nrw-${reference.externalId ?? reference.key.replace(/[^a-z0-9_-]/gi, "_")}.pdf`;
        const { writeFileSync } = await import("fs");
        writeFileSync(tmpPath, Buffer.from(buf));
        const { extractTextFromFile } = await import("@/lib/parser");
        contentForLLM = (await extractTextFromFile(tmpPath, "application/pdf")).text;
        if (contentForLLM && contentForLLM.length > 100) break;
      } catch { /* use the HTML fallback */ }
    }

    if (!contentForLLM || contentForLLM.length < 100) {
      const page = await scrapeWebsite(detailUrl, { onlyMainContent: false });
      contentForLLM = page.markdown ?? "";
    }
    if (!contentForLLM || contentForLLM.trim().length < 100) return { tender: null, retryable: true };
    if (detectAccessPage(contentForLLM, { url: detailUrl }).blocked) return { tender: null, blocked: true };

    const extracted = await extractDetailFromMarkdown(contentForLLM, detailUrl, source, true)
      ?? extractBasicDetailFromHtml(detailHtml, detailUrl, source, pdfUrls);
    if (!extracted) return { tender: null };
    extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
    extracted.sourceUrl = reference.url;
    extracted.pdfUrls = Array.from(new Set([...pdfUrls, ...extracted.pdfUrls]));
    return { tender: extracted };
  } catch (error) {
    console.error(`[public-scraper] ${source} Detail Fehler (${reference.key}):`, error);
    return { tender: null, retryable: true };
  }
}

async function scrapeEvergabeNrw(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] Direktes Scraping: evergabe.nrw.de...");
  const portalStartTime = Date.now();
  const PORTAL_MAX_MS = 5 * 60 * 1000;
  let pagesFetched = 0;
  const detailHandler = (reference: PublicDetailReference): Promise<DetailOutcome> => (
    scrapeNrwDetailReference(reference, "evergabe.nrw.de", portalStartTime, PORTAL_MAX_MS)
  );
  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "evergabe-nrw-cpv", pendingRun);
  }

  try {
    // Step 1: Fetch category overview to get CPV codes
    const overviewUrl = "https://www.evergabe.nrw.de/VMPCenter/company/announcements/categoryOverview.do?method=showCategoryOverview";
    const overviewResp = await fetch(overviewUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!overviewResp.ok) throw new Error(`evergabe-nrw overview HTTP ${overviewResp.status}`);
    const overviewHtml = await overviewResp.text();

    // Extract CPV codes from overview
    const cpvRegex = /cpvCode=(\d{8}-\d)/g;
    const cpvCodes: string[] = [];
    let cpvMatch;
    while ((cpvMatch = cpvRegex.exec(overviewHtml)) !== null) {
      if (!cpvCodes.includes(cpvMatch[1])) cpvCodes.push(cpvMatch[1]);
    }
    console.log(`[public-scraper] evergabe-nrw: ${cpvCodes.length} CPV-Kategorien gefunden`);

    // Append GaLa Bau CPV codes for better landscape/garden tender coverage
    let addedCpv = 0;
    for (const code of GALA_BAU_CPV) {
      if (!cpvCodes.includes(code)) {
        cpvCodes.push(code);
        addedCpv++;
      }
    }
    if (addedCpv > 0) console.log(`[public-scraper] evergabe-nrw: +${addedCpv} GaLa Bau CPV-Codes`);

    if (cpvCodes.length === 0) {
      throw new Error("evergabe-nrw: listing returned no CPV codes");
    }

    const startCpvIndex = cursorBoolean(cursor, "exhausted") ? 0 : cursorNumber(cursor, "cpvIndex", 0);
    const cpvBatch = cpvCodes.slice(startCpvIndex, startCpvIndex + settings.publicCpvCodesPerRun);
    const cpvHasMore = startCpvIndex + cpvBatch.length < cpvCodes.length;

    // Step 2: For each CPV code in this cursor window, get projectForwarding.do links.
    const forwardingLinks: PublicDetailReference[] = [];
    const seenPids = new Set<string>();

    for (const cpvCode of cpvBatch) {
      const tableUrl = `https://www.evergabe.nrw.de/VMPCenter/company/announcements/categoryOverview.do?method=showTable&cpvCode=${cpvCode}`;
      const tableResp = await fetch(tableUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (!tableResp.ok) throw new Error(`evergabe-nrw CPV ${cpvCode} HTTP ${tableResp.status}`);
      const tableHtml = await tableResp.text();
      pagesFetched += 1;

      const pidRegex = /projectForwarding\.do\?pid=(\d+)/g;
      let pidMatch;
      while ((pidMatch = pidRegex.exec(tableHtml)) !== null) {
        if (!seenPids.has(pidMatch[1])) {
          seenPids.add(pidMatch[1]);
          const forwardingUrl = `https://www.evergabe.nrw.de/VMPCenter/public/company/projectForwarding.do?pid=${pidMatch[1]}`;
          forwardingLinks.push(publicDetailReference(`evergabe-nrw:pid:${pidMatch[1]}`, forwardingUrl, pidMatch[1]));
        }
      }
    }

    console.log(`[public-scraper] evergabe-nrw: ${forwardingLinks.length} einzigartige Projekt-Links`);

    const detailRun = await processDetailQueue(
      forwardingLinks,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] evergabe-nrw: ${tenders.length} Ausschreibungen mit Details`);
    const nextCpvIndex = cpvHasMore ? startCpvIndex + cpvBatch.length : 0;
    const listingComplete = !cpvHasMore;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "evergabe-nrw-cpv",
      position: { cpvIndex: nextCpvIndex },
      listingExhausted: listingComplete,
      listingComplete,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "evergabe-nrw-cpv",
      listedCount: forwardingLinks.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { cpvIndex: nextCpvIndex },
    });
  } catch (error) {
    console.error("[public-scraper] evergabe-nrw Fehler:", error);
    throw error;
  }
}

// --- Generic NRW VMPSatellite/Vergabe Portal Scraper ---

interface NrwPortalConfig {
  name: string;
  baseUrl: string;
  overviewPath: string;
  limit: number;
  manualCpvCodes?: string[];
  pathPrefix?: string;
  maxPages?: number;
}

const GALA_BAU_CPV: string[] = [
  "77300000-3", // Garten- und Landschaftsbau
  "77310000-6", // Pflege und Erhaltung von Grünflächen
  "77314000-8", // Grünflächenpflege
  "77340000-0", // Baumfällarbeiten
  "45112700-2", // Landschaftsgärtnerische Arbeiten
  "45112710-5", // Gartenarbeiten
  "45112711-2", // Anlegung von Rasenflächen
  "45112712-9", // Anlegung von Blumenbeeten
  "45112713-6", // Anlegung von Gärten
  "45112714-3", // Pflanzarbeiten
  "45112715-0", // Anpflanzung und Grünflächenpflege
];

// Erweiterte CPV-Codes für Local Businesses (GaLaBau, Winterdienst, Reinigung, Facility Management)
const LOCAL_BIZ_CPV: string[] = [
  ...GALA_BAU_CPV,
  // Winterdienst / Schnee-Räumung / Glättebekämpfung
  "90620000-9",
  // Straßenreinigung
  "90610000-9",
  "90630000-4", // AbfallentSORGUNG (Straßen)
  // Gebäudereinigung
  "90910000-6", // Gebäudereinigung
  "90911200-0", // Fensterreinigung
  "90911300-1", // Fassadenreinigung
  // Facility Management / Grundstücksverwaltung
  "70310000-4", // Grundstücks- und Gebäudeverwaltung
  "71330000-8", // Grundstücksverwaltung (diverse)
  // Instandhaltung / Reparatur
  "50000000-5", // Reparatur und Wartung
  "50700000-3", // Instandhaltung von Gebäuden
  // Baugewerbe (Maler, Hochbau, Abdichtung)
  "45454000-7", // Malerarbeiten
  "45262600-5", // Allgemeine Hochbauarbeiten
  "45262500-6", // Maurerarbeiten
  "45421000-4", // Fliesen- und Plattenarbeiten
  "45320000-6", // Abdichtungsarbeiten
  // Dienstleistungen für Local Businesses
  "98110000-7", // Gebäudebewirtschaftung (Facility Management Total)
];

const NRW_PORTALS: NrwPortalConfig[] = [
  {
    name: "brandenburg",
    baseUrl: "https://vergabemarktplatz.brandenburg.de",
    overviewPath: "/VMPCenter/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 50,
    manualCpvCodes: LOCAL_BIZ_CPV,
  },
  {
    name: "rlp-land",
    baseUrl: "https://landesverwaltung.vergabe.rlp.de",
    overviewPath: "/VMPSatellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 50,
    manualCpvCodes: LOCAL_BIZ_CPV,
  },
  {
    name: "rlp-central",
    baseUrl: "https://vergabe.rlp.de",
    overviewPath: "/VMPCenter/company/announcements/categoryOverview.do?method=showCategoryOverview",
    pathPrefix: "/VMPCenter",
    limit: 100,
    maxPages: 10,
    manualCpvCodes: LOCAL_BIZ_CPV,
  },
  {
    name: "rlp-lbb",
    baseUrl: "https://lbb.vergabe.rlp.de",
    overviewPath: "/VMPSatellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: LOCAL_BIZ_CPV,
  },
  {
    name: "rlp-lbm",
    baseUrl: "https://lbm.vergabe.rlp.de",
    overviewPath: "/VMPSatellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: LOCAL_BIZ_CPV,
  },
  {
    name: "metropoleruhr",
    baseUrl: "https://www.vergabe.metropoleruhr.de",
    overviewPath: "/VMPSatellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: GALA_BAU_CPV,
  },
  {
    name: "vmp-rheinland",
    baseUrl: "https://www.vmp-rheinland.de",
    overviewPath: "/VMPSatellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: GALA_BAU_CPV,
  },
  {
    name: "blb-nrw",
    baseUrl: "https://evergabe.blb.nrw.de",
    overviewPath: "/Vergabe/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: GALA_BAU_CPV,
  },
  {
    name: "westfalen",
    baseUrl: "https://www.vergabe-westfalen.de",
    overviewPath: "/VMPSatellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: GALA_BAU_CPV,
  },
  {
    name: "stadt-koeln",
    baseUrl: "https://vergabe.stadt-koeln.de",
    overviewPath: "/VMPSatellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: GALA_BAU_CPV,
  },
  {
    name: "wirtschaftsregion-aachen",
    baseUrl: "https://www.vergaben-wirtschaftsregion-aachen.de",
    overviewPath: "/VMPSatellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: GALA_BAU_CPV,
  },
  {
    name: "vergabeportal-bw",
    baseUrl: "https://vergabeportal-bw.de",
    overviewPath: "/Satellite/company/announcements/categoryOverview.do?method=showCategoryOverview",
    limit: 30,
    manualCpvCodes: GALA_BAU_CPV,
  },
];

async function scrapeNrwPortal(config: NrwPortalConfig, cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log(`[public-scraper] NRW-Portal: ${config.name} (${config.baseUrl})...`);
  const portalStartTime = Date.now();
  const PORTAL_MAX_MS = 5 * 60 * 1000; // 5 min (etwas weniger als der7-min Per-Portal-Timeout, inkl. CPV-Iteration)
  let pagesFetched = 0;
  const detailHandler = (reference: PublicDetailReference): Promise<DetailOutcome> => (
    scrapeNrwDetailReference(reference, config.name, portalStartTime, PORTAL_MAX_MS)
  );
  const detailLimit = Math.min(config.limit, settings.publicDetailLimit);
  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    detailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, detailLimit)) {
    return pendingOnlyResult(cursor, "nrw-cpv-page", pendingRun);
  }

  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    // Helper: fetch with encoding detection (ISO-8859-1 for RLP/Brandenburg VMP portals)
    const fetchHtml = async (url: string): Promise<string> => {
      const resp = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) throw new Error(`${config.name} listing HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const ct = resp.headers.get("content-type") ?? "";
      const cm = ct.match(/charset=([^\s;]+)/i);
      let enc = cm?.[1]?.toLowerCase() ?? "";
      if (!enc) {
        const head = buf.toString("ascii", 0, Math.min(2000, buf.length));
        const mm = head.match(/charset[=:]\s*"?([a-z0-9_-]+)/i);
        enc = mm?.[1]?.toLowerCase() ?? "";
      }
      const html = (enc.includes("latin") || enc.includes("iso-8859") || enc.includes("windows-1252"))
        ? buf.toString("latin1")
        : buf.toString("utf-8");
      if (!html.trim()) throw new Error(`${config.name} listing returned no content`);
      return html;
    };

    // Step 1: Fetch CPV codes from category overview
    const overviewUrl = `${config.baseUrl}${config.overviewPath}`;
    const overviewHtml = await fetchHtml(overviewUrl);

    const cpvRegex = /cpvCode=(\d{8}-\d)/g;
    const cpvCodes: string[] = [];
    let cpvMatch;
    while ((cpvMatch = cpvRegex.exec(overviewHtml)) !== null) {
      if (!cpvCodes.includes(cpvMatch[1])) cpvCodes.push(cpvMatch[1]);
    }
    console.log(`[public-scraper] ${config.name}: ${cpvCodes.length} CPV-Kategorien`);

    // Append manual CPV codes (e.g. GaLa Bau) if configured
    if (config.manualCpvCodes?.length) {
      let added = 0;
      for (const code of config.manualCpvCodes) {
        if (!cpvCodes.includes(code)) {
          cpvCodes.push(code);
          added++;
        }
      }
      if (added > 0) console.log(`[public-scraper] ${config.name}: +${added} manuelle CPV-Codes`);
    }

    if (cpvCodes.length === 0) {
      // Fallback: Try Playwright for JS-rendered portals (e.g. stadt-koeln)
      try {
        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
        try {
          const page = await browser.newPage();
          await page.goto(overviewUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(5000);
          const html = await page.content();
          let cpvM;
          const cpvRe = /cpvCode=(\d{8}-\d)/g;
          while ((cpvM = cpvRe.exec(html)) !== null) {
            if (!cpvCodes.includes(cpvM[1])) cpvCodes.push(cpvM[1]);
          }
          console.log(`[public-scraper] ${config.name}: ${cpvCodes.length} CPV-Kategorien (Playwright)`);
        } finally {
          await browser.close().catch(() => {});
        }
      } catch (e) {
        console.warn(`[public-scraper] ${config.name} Playwright Fallback fehlgeschlagen:`, e);
      }
      if (cpvCodes.length === 0) {
        throw new Error(`${config.name}: listing returned no CPV codes`);
      }
    }

    // Compute path prefix once for all URLs
    const pathPrefix = config.pathPrefix ?? (config.baseUrl.includes("blb.nrw.de") ? "/Vergabe"
      : config.overviewPath.includes("/Satellite/") ? "/Satellite"
      : config.overviewPath.includes("/VMPCenter/") ? "/VMPCenter"
      : "/VMPSatellite");

    const startCpvIndex = cursorBoolean(cursor, "exhausted") ? 0 : cursorNumber(cursor, "cpvIndex", 0);
    const pageCursor = cursorBoolean(cursor, "exhausted") ? null : cursorString(cursor, "pageUrl");
    const cpvBatch = pageCursor
      ? cpvCodes.slice(startCpvIndex, startCpvIndex + 1)
      : cpvCodes.slice(startCpvIndex, startCpvIndex + settings.publicCpvCodesPerRun);
    let nextCpvIndex = startCpvIndex;
    let nextPageUrl: string | null = pageCursor;
    let listingIncomplete = false;
    const parsePaginationUrls = (html: string, currentUrl: string): string[] => {
      const $ = cheerio.load(html);
      const urls = new Set<string>();
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href || (!href.includes("selectedTablePagePROJECT_RESULT") && !href.includes("TablePage") && !href.includes("page="))) return;
        try {
          const url = new URL(href, currentUrl);
          if (url.href !== currentUrl) urls.add(url.href);
        } catch { /* ignore malformed portal links */ }
      });
      return Array.from(urls);
    };

    // Step 2: Collect PIDs from all CPV codes
    const forwardingLinks: PublicDetailReference[] = [];
    const seenPids = new Set<string>();

    for (const [batchIndex, cpvCode] of cpvBatch.entries()) {
      const tableUrl = `${config.baseUrl}${pathPrefix}/company/announcements/categoryOverview.do?method=showTable&cpvCode=${cpvCode}`;
      const pendingPages = [batchIndex === 0 && pageCursor ? pageCursor : tableUrl];
      const visitedPages = new Set<string>();
      while (pendingPages.length > 0 && visitedPages.size < settings.publicPaginationPages) {
        const currentUrl = pendingPages.shift()!;
        if (visitedPages.has(currentUrl)) continue;
        visitedPages.add(currentUrl);
        const tableHtml = await fetchHtml(currentUrl);
        pagesFetched += 1;

        // PID regex works for both /VMPSatellite/ and /Vergabe/ paths
        const pidRegex = /projectForwarding\.do\?pid=(\d+)/g;
        let pidMatch;
        while ((pidMatch = pidRegex.exec(tableHtml)) !== null) {
          if (!seenPids.has(pidMatch[1])) {
            seenPids.add(pidMatch[1]);
            const forwardingUrl = `${config.baseUrl}${pathPrefix}/public/company/projectForwarding.do?pid=${pidMatch[1]}`;
            forwardingLinks.push(publicDetailReference(`nrw:${config.name}:pid:${pidMatch[1]}`, forwardingUrl, pidMatch[1]));
          }
        }
        for (const nextUrl of parsePaginationUrls(tableHtml, currentUrl)) {
          if (!visitedPages.has(nextUrl) && !pendingPages.includes(nextUrl)) pendingPages.push(nextUrl);
        }
      }

      if (pendingPages.length > 0) {
        nextCpvIndex = startCpvIndex + batchIndex;
        nextPageUrl = pendingPages[0];
        listingIncomplete = true;
        break;
      }
      nextCpvIndex = startCpvIndex + batchIndex + 1;
      nextPageUrl = null;
    }

    // Also try the welcome.do listing page (some portals list PIDs there)
    try {
      const welcomeHtml = await fetchHtml(`${config.baseUrl}${pathPrefix}/company/welcome.do`);
      const pidRegex = /projectForwarding\.do\?pid=(\d+)/g;
      let pidMatch;
      while ((pidMatch = pidRegex.exec(welcomeHtml)) !== null) {
        if (!seenPids.has(pidMatch[1])) {
          seenPids.add(pidMatch[1]);
          const forwardingUrl = `${config.baseUrl}${pathPrefix}/public/company/projectForwarding.do?pid=${pidMatch[1]}`;
          forwardingLinks.push(publicDetailReference(`nrw:${config.name}:pid:${pidMatch[1]}`, forwardingUrl, pidMatch[1]));
        }
      }
    } catch { /* ignore */ }

    console.log(`[public-scraper] ${config.name}: ${forwardingLinks.length} einzigartige Projekt-Links`);

    const detailRun = await processDetailQueue(
      forwardingLinks,
      detailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] ${config.name}: ${tenders.length} Ausschreibungen`);
    const listingComplete = !listingIncomplete && nextCpvIndex >= cpvCodes.length;
    const nextIndex = listingComplete ? 0 : nextCpvIndex;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "nrw-cpv-page",
      position: { cpvIndex: nextIndex, pageUrl: listingIncomplete ? nextPageUrl : null },
      listingExhausted: listingComplete,
      listingComplete,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "nrw-cpv-page",
      listedCount: forwardingLinks.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { cpvIndex: nextIndex, pageUrl: listingIncomplete ? nextPageUrl : null },
    });
  } catch (error) {
    console.error(`[public-scraper] ${config.name} Fehler:`, error);
    throw error;
  }
}

// --- Berlin Vergabeplattform (RSS Feed) ---

export async function scrapeBerlinHtml(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  const BASE_URL = "https://www.berlin.de/vergabeplattform/veroeffentlichungen/bekanntmachungen/";
  const MAX_PAGES = settings.publicPaginationPages;
  const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const startPage = cursorBoolean(cursor, "exhausted") ? 0 : cursorNumber(cursor, "page", 0);
  const berlinDetailContent = new Map<string, { markdown: string; html: string }>();

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const { scrapeWebsite: scrapeWithPlaywright } = await import("@/lib/firecrawl");
      const page = await scrapeWithPlaywright(reference.url, {
        waitUntil: "networkidle",
        waitMs: 5000,
        onlyMainContent: false,
        useBodyText: true,
      });
      const markdown = page.markdown ?? "";
      if (markdown.length < 200) return { tender: null, retryable: true };
      if (detectAccessPage(markdown, { url: reference.url }).blocked) return { tender: null, blocked: true };
      berlinDetailContent.set(reference.key, { markdown, html: page.html ?? "" });
      const extracted = await extractDetailFromMarkdown(markdown, reference.url, "berlin-html", true);
      if (extracted) extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      return extracted ? { tender: withScrapedResources(extracted, page) } : { tender: null };
    } catch (error) {
      console.warn(`[public-scraper] Berlin Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "berlin-offset", pendingRun);
  }

  console.log(`[public-scraper] Berlin HTML: Scrape ab Seite ${startPage + 1}, ${MAX_PAGES} Seiten...`);

  const tenders: ExtractedTender[] = [...pendingRun.tenders];
  const detailRefs: PublicDetailReference[] = [];
  let pagesFetched = 0;
  let listedCount = 0;
  let hasMore = false;
  let pageError = false;

  for (let page = startPage; page < startPage + MAX_PAGES; page++) {
    const offset = page * 10;
    const url = offset === 0 ? BASE_URL : `${BASE_URL}?start=${offset}`;
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) throw new Error(`Berlin listing HTTP ${resp.status}`);
      const html = await resp.text();
      if (!html.trim()) throw new Error(`Berlin listing page ${page + 1} returned no content`);
      const $ = cheerio.load(html);

      const articles = $("article.modul-card");
      if (articles.length === 0) {
        console.log(`[public-scraper] Berlin HTML: Seite ${page + 1} leer, stoppe. (HTML: ${html.length} bytes)`);
        hasMore = false;
        break;
      }
      pagesFetched += 1;
      hasMore = true;

      articles.each((_, el) => {
        try {
          const $card = $(el);
          const dataId = $card.attr("data-id");
          const title = $card.find("h3.title").text().trim();
          if (!title || title.length < 3) return;

          // Extract structured fields from <dl>
          let verfahrensart = "";
          let ausfuehrungsort = "";
          let deadline = "";

          $card.find("dl dt").each((_, dt) => {
            const label = $(dt).text().trim();
            const value = $(dt).next("dd").text().trim();
            if (label === "Verfahrensart") verfahrensart = value;
            if (label === "Ausführungsort") ausfuehrungsort = value;
            if (label.includes("Ablauf") || label.includes("Angebotsfrist")) deadline = value;
          });

          // Extract "Online seit" date
          const onlineSeit = $card.find(".card__footer .left").text().replace("Online seit:", "").trim();

          // Extract detail link
          const detailBtn = $card.find("button[data-href]");
          const detailLink = detailBtn.attr("data-href") ?? "";

          // Build source URL — use detail link if available, otherwise construct from data-id
          const sourceUrl = detailLink || `${BASE_URL}#${dataId}`;

          // Clean deadline: "22.07.2026, 10:00 Uhr" → "22.07.2026, 10:00"
          const cleanDeadline = deadline.replace(/\s*Uhr$/, "").trim();

          // Build rich description from all listing page fields
          const descParts: string[] = [];
          if (verfahrensart) descParts.push(`Verfahrensart: ${verfahrensart}`);
          if (ausfuehrungsort) descParts.push(`Ausführungsort: ${ausfuehrungsort}`);
          if (cleanDeadline) descParts.push(`Ablauf der Angebotsfrist: ${cleanDeadline}`);
          if (onlineSeit) descParts.push(`Online seit: ${onlineSeit}`);

          const listingTender: ExtractedTender = {
            title: cleanTenderTitle(title),
            client: "",
            deadline: cleanDeadline || null,
            description: descParts.join(". ") + ".",
            descriptionMarkdown: buildTenderDescriptionMarkdown({
              procedure: verfahrensart,
              deadline: cleanDeadline || null,
              location: ausfuehrungsort || null,
              reference: dataId ?? null,
              summary: descParts.join(". ") + ".",
            }),
            procedure: verfahrensart || null,
            referenceNumber: dataId ?? null,
            location: ausfuehrungsort || null,
            category: "Sonstiges",
            sourceUrl,
            source: "berlin-html",
            externalId: dataId ?? null,
            pdfUrls: [],
          };
          tenders.push(listingTender);
          listedCount += 1;
          if (detailLink && detailLink.includes("meinauftrag.rib.de")) {
            detailRefs.push(publicDetailReference(
              `berlin:data:${dataId ?? detailLink}`,
              detailLink,
              dataId ?? undefined,
            ));
          }
        } catch (err) {
          console.warn(`[public-scraper] Berlin HTML Artikel Fehler:`, err);
        }
      });

      console.log(`[public-scraper] Berlin HTML: Seite ${page + 1}: ${articles.length} Artikel (gesamt: ${tenders.length})`);

      // Delay between pages to avoid rate limiting
      if (page < startPage + MAX_PAGES - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.warn(`[public-scraper] Berlin HTML Seite ${page + 1} Fehler:`, err);
      pageError = true;
      break;
    }
  }

  const detailRun = await processDetailQueue(
    detailRefs,
    settings.publicDetailLimit - pendingRun.detailAttempted,
    detailHandler,
  );
  const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
  const detailByExternalId = new Map(detailRun.tenders.filter((tender) => tender.externalId).map((tender) => [tender.externalId!, tender]));
  for (const tender of tenders) {
    const detail = tender.externalId ? detailByExternalId.get(tender.externalId) : undefined;
    if (!detail) continue;
    const detailReference = detailRefs.find((reference) => reference.externalId === tender.externalId);
    const rawDetail = detailReference ? berlinDetailContent.get(detailReference.key) : undefined;
    tender.title = detail.title || tender.title;
    tender.client = detail.client || tender.client;
    tender.deadline = detail.deadline || tender.deadline;
    tender.description = rawDetail?.markdown.substring(0, 30000) || detail.description || tender.description;
    tender.referenceNumber = detail.referenceNumber || tender.referenceNumber;
    tender.location = detail.location || tender.location;
    tender.category = detail.category;
    tender.pdfUrls = Array.from(new Set([...tender.pdfUrls, ...detail.pdfUrls]));
    if (rawDetail?.html) {
      for (const match of rawDetail.html.matchAll(/href=["']([^"']*\.pdf[^"']*)["']/gi)) {
        const pdfUrl = match[1].startsWith("http") ? match[1] : new URL(match[1], tender.sourceUrl).href;
        if (!tender.pdfUrls.includes(pdfUrl)) tender.pdfUrls.push(pdfUrl);
      }
    }
  }
  const unmergedDetails = detailRun.tenders.filter((tender) => !tenders.some((listing) => listing.externalId && listing.externalId === tender.externalId));
  tenders.push(...unmergedDetails);

  console.log(`[public-scraper] Berlin HTML: ${tenders.length} Tenders, ${detailRun.tenders.length} mit Detail-Seiten`);
  const nextPage = pageError ? startPage + pagesFetched : hasMore ? startPage + pagesFetched : 0;
  const listingComplete = !pageError && !hasMore;
  return sourceCursorResult(tenders, {
    cursor,
    strategy: "berlin-offset",
    position: { page: nextPage },
    listingExhausted: listingComplete,
    listingComplete,
    pendingDetails,
    pagesFetched,
    paginationStrategy: "berlin-offset",
    listedCount,
    detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
    detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
    cursorCommit: pageError ? "hold" : "commit",
    extra: { page: nextPage },
  });
}

// --- NetServer Portale (landbw.de, hessen.de, berlin) ---

export interface NetServerConfig {
  name: string;
  baseUrl: string;
  searchPath: string;
  limit: number;
  detailMode?: "get-publication" | "data-provider-redirect";
  followPagination?: boolean;
}

export interface NetServerRow {
  oid: string;
  title: string;
  client: string;
  deadline: string;
  procedure: string;
  detailPath?: string;
}

export function parseNetServerRows(html: string): NetServerRow[] {
  const $ = cheerio.load(html, {}, false);
  const rows: NetServerRow[] = [];
  const seenOids = new Set<string>();

  const addRow = (row: NetServerRow) => {
    if (row.title.length > 5 && !seenOids.has(row.oid)) {
      seenOids.add(row.oid);
      rows.push(row);
    }
  };

  // Supports desktop/mobile table layouts used by the NetServer portals.
  $("[data-oid]").each((_, el) => {
    const $row = $(el);
    const oid = $row.attr("data-oid");
    if (!oid) return;

    const cells = $row.find("td");
    if (cells.length > 0) {
      const cellText = (selector: string, index: number): string => normalizePublicMarkupText(
        selector ? $row.find(selector).first().text() : cells.eq(index).text(),
      );
      const tenderTypes = $row.find(".tenderType")
        .toArray()
        .map((cell) => normalizePublicMarkupText($(cell).text()))
        .filter(Boolean);
      addRow({
        oid,
        title: cellText(".tender", 1),
        client: cellText(".tenderAuthority", 2),
        deadline: cellText(".tenderDeadline", 5),
        procedure: tenderTypes[0] ?? cellText("", 3),
      });
      return;
    }

    const text = $row.text().replace(/\s+/g, " ").trim();
    addRow({
      oid,
      title: text.match(/Bezeichnung\s+(.+?)(?:\s+Vergabenummer|\s+Art:)/)?.[1]?.trim() ?? "",
      client: text.match(/(?:Vergabestelle|Auftraggeber):\s+(.+?)(?:\s+Abgabe(?:frist)?|\s+Art:)/)?.[1]?.trim() ?? "",
      deadline: text.match(/(?:Abgabe(?:frist)?|Angebotsfrist):\s+(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/)?.[1]?.trim() ?? "",
      procedure: text.match(/Art:\s+(.+?)(?:\s+Vergabestelle|\s+Abgabefrist)/)?.[1]?.trim() ?? "",
    });
  });

  // Some NetServer variants expose the detail URL through data-href instead.
  $("[data-href]").each((_, el) => {
    const $row = $(el);
    const href = $row.attr("data-href");
    const title = $row.find("strong").first().text().trim();
    if (!href || title.length < 5) return;

    addRow({
      oid: href,
      title,
      client: $row.find("dt:contains('Auftraggeber')").next("dd").text().trim(),
      deadline: $row.find("dt:contains('Abgabefrist')").next("dd").text().trim(),
      procedure: $row.find("dt:contains('Verfahrensart')").next("dd").text().trim(),
      detailPath: href,
    });
  });

  return rows;
}

export function parseNetServerPaginationUrls(html: string, baseUrl: string, currentUrl: string): string[] {
  const $ = cheerio.load(html);
  const currentStart = Number(new URL(currentUrl).searchParams.get("Start") ?? "0");
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const url = new URL(href, currentUrl || baseUrl);
      const start = Number(url.searchParams.get("Start"));
      if (Number.isFinite(start) && start > currentStart) {
        urls.add(url.href);
      }
    } catch { /* ignore malformed pagination links */ }
  });

  return Array.from(urls).sort((left, right) => {
    const leftStart = Number(new URL(left).searchParams.get("Start"));
    const rightStart = Number(new URL(right).searchParams.get("Start"));
    return leftStart - rightStart;
  });
}

async function resolveNetServerDetailUrl(
  config: NetServerConfig,
  row: NetServerRow,
  userAgent: string,
): Promise<string> {
  if (row.detailPath) {
    return new URL(row.detailPath, `${config.baseUrl}/NetServer/`).href;
  }

  if (config.detailMode === "data-provider-redirect") {
    const response = await fetch(`${config.baseUrl}/NetServer/DataProvider`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body: new URLSearchParams({
        param: "Redirect",
        OID: row.oid,
        function: "Detail",
        category: "InvitationToTender",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`DataProvider antwortete mit HTTP ${response.status}`);
    }

    const redirectPath = (await response.text()).trim();
    if (!redirectPath || !redirectPath.includes("PublicationControllerServlet")) {
      throw new Error("DataProvider lieferte keine gültige Detail-URL");
    }

    return new URL(redirectPath, `${config.baseUrl}/NetServer/`).href;
  }

  return `${config.baseUrl}/NetServer/PublicationSearchControllerServlet?function=GetPublication&oid=${encodeURIComponent(row.oid)}&Category=InvitationToTender&thContext=publications`;
}

const NET_SERVER_PORTALS: NetServerConfig[] = [
  {
    name: "sachsen",
    baseUrl: "https://evergabe.sachsen.de",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Category=InvitationToTender&thContext=publications&Max=100",
    limit: 50,
  },
  {
    name: "sachsen-sib",
    baseUrl: "https://sachsen-vergabe.de",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Category=InvitationToTender&thContext=publications&Max=100",
    limit: 50,
  },
  {
    name: "muenchen",
    baseUrl: "https://vergabe.muenchen.de",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Category=InvitationToTender&thContext=publications&Max=100",
    limit: 50,
  },
  {
    name: "landbw",
    baseUrl: "https://vergabe.landbw.de",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Gesetzesgrundlage=All&Category=InvitationToTender&thContext=publications&Max=50",
    limit: 30,
  },
  {
    name: "hessen",
    baseUrl: "https://vergabe.hessen.de",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Category=InvitationToTender&thContext=publications&Order=desc&OrderBy=Publishing&Max=50",
    limit: 30,
  },
  {
    name: "berlin",
    baseUrl: "https://vergabekooperation.berlin",
    searchPath: "/NetServer/PublicationSearchControllerServlet?Max=100&Category=InvitationToTender&function=SearchPublications&thContext=publications",
    limit: 50,
  },
  {
    name: "mecklenburg-vorpommern",
    baseUrl: "https://vergabe.mv-regierung.de",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Gesetzesgrundlage=All&Category=InvitationToTender&thContext=publications&Max=100",
    limit: 100,
    detailMode: "data-provider-redirect",
    followPagination: true,
  },
  {
    name: "rhein-neckar",
    baseUrl: "https://vergabe.vmstart.de",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Gesetzesgrundlage=All&Category=InvitationToTender&thContext=publications&Max=100",
    limit: 100,
    detailMode: "data-provider-redirect",
    followPagination: true,
  },
  {
    name: "bremen",
    baseUrl: "https://vergabe.bremen.de",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Gesetzesgrundlage=All&Category=InvitationToTender&thContext=publications&Max=100",
    limit: 50,
    detailMode: "data-provider-redirect",
    followPagination: true,
  },
  {
    name: "saarland",
    baseUrl: "https://vergabe.saarland",
    searchPath: "/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Gesetzesgrundlage=All&Category=InvitationToTender&thContext=publications&Max=100",
    limit: 50,
    detailMode: "data-provider-redirect",
    followPagination: true,
  },
];

export async function scrapeNetPortal(config: NetServerConfig, cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log(`[public-scraper] NetServer: ${config.name} (${config.baseUrl})...`);
  const portalStartTime = Date.now();
  const PORTAL_MAX_MS = 5 * 60 * 1000;
  let pagesFetched = 0;
  const detailLimit = Math.min(config.limit, settings.publicDetailLimit);
  const rowByKey = new Map<string, NetServerRow>();
  let berlinPlaywrightCount = 0;
  const isBerlin = config.name === "berlin";
  const berlinPlaywrightLimit = 10;

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    const row = rowByKey.get(reference.key) ?? {
      oid: reference.externalId ?? reference.key,
      title: "",
      client: "",
      deadline: "",
      procedure: "",
    };
    if (Date.now() - portalStartTime > PORTAL_MAX_MS) return { tender: null, retryable: true };
    try {
      let detailUrl = reference.url;
      if (rowByKey.has(reference.key)) {
        detailUrl = await resolveNetServerDetailUrl(config, row, "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36");
      } else if (config.detailMode === "data-provider-redirect") {
        detailUrl = await resolveNetServerDetailUrl(config, row, "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36");
      }

      let bodyText = "";
      let detailHtml = "";
      if (isBerlin && berlinPlaywrightCount < berlinPlaywrightLimit) {
        berlinPlaywrightCount += 1;
        const { scrapeWebsite: scrapeWithPlaywright } = await import("@/lib/firecrawl");
        const page = await scrapeWithPlaywright(detailUrl, {
          waitUntil: "networkidle",
          waitMs: 5000,
          onlyMainContent: false,
          useBodyText: true,
        });
        bodyText = page.markdown ?? "";
        detailHtml = page.html ?? "";
        if (bodyText.length < 200 || detectAccessPage(bodyText, { url: detailUrl }).blocked) bodyText = "";
      } else {
        const detailResp = await fetch(detailUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(15000),
        });
        if (detailResp.ok) {
          detailHtml = await detailResp.text();
        } else {
          const { execSync } = await import("child_process");
          detailHtml = execSync(`curl -s -L -H "User-Agent: Mozilla/5.0" "${detailUrl}"`, {
            maxBuffer: 5 * 1024 * 1024,
            timeout: 20000,
          }).toString();
        }
        const $detail = cheerio.load(detailHtml);
        $detail("script, style, nav, header, footer").remove();
        bodyText = htmlToBasicMarkdown($detail("body").html() ?? "");
      }

      const netServerTitle = /\/NetServer\//i.test(detailUrl) ? extractNetServerTenderTitle(bodyText) : null;
      const detailAccessCheck = bodyText ? detectAccessPage(bodyText, { url: detailUrl }) : null;
      if (bodyText && bodyText.length > 200 && !detailAccessCheck?.blocked) {
        let extracted: ExtractedTender | null = null;
        if (openrouterKey && !["bremen", "saarland"].includes(config.name)) {
          try {
            extracted = await extractDetailFromMarkdown(bodyText, detailUrl, config.name, true);
          } catch (error) {
            console.warn(`[public-scraper] ${config.name} LLM-Detail-Fallback (${reference.key}):`, error);
          }
        }
        if (extracted) {
          if (netServerTitle) extracted.title = netServerTitle;
          const isGenericTitle = !extracted.title || extracted.title.length < 5 ||
            /^(Ausschreibung der|Keine Ausschreibung|Keine Details|Zugriff verweigert|Unbekannter Titel|Öffentliche Ausschreibung der)/i.test(extracted.title);
          if (isGenericTitle && row.title.length > 5) extracted.title = cleanTenderTitle(row.title);
          if (!extracted.client || extracted.client.length < 3) extracted.client = row.client;
          if (!extracted.deadline) extracted.deadline = row.deadline;
          if (!extracted.description || extracted.description.length < 30) extracted.description = row.procedure ? `Verfahrensart: ${row.procedure}` : "";
          extracted.externalId = reference.externalId ?? row.oid;
          extracted.sourceUrl = detailUrl;
          return { tender: extracted };
        }

        const basic = detailHtml
          ? extractBasicDetailFromHtml(detailHtml, detailUrl, config.name, [], true)
          : null;
        if (basic) {
          if (netServerTitle) basic.title = netServerTitle;
          const isGenericBasicTitle = !basic.title || basic.title.length < 5 ||
            /^(?:Bekanntmachungsdetails|Ausschreibungsdetails|Vergabedetails|Ausschreibung der|Öffentliche Ausschreibung der)/i.test(basic.title) ||
            /\bVergabeplattform\b/i.test(basic.title);
          if (isGenericBasicTitle && row.title.length > 5) basic.title = cleanTenderTitle(row.title);
          if (!basic.client || basic.client.length < 3 || /^\(Vergabestelle\)$/i.test(basic.client)) {
            basic.client = row.client || config.name;
          }
          if (!basic.deadline) basic.deadline = row.deadline || null;
          if (!basic.description || basic.description.length < 30) basic.description = row.procedure ? `Verfahrensart: ${row.procedure}` : "";
          basic.externalId = reference.externalId ?? row.oid;
          basic.sourceUrl = detailUrl;
          const resourceMetadata = extractPublicResourceMetadata(detailHtml, detailUrl);
          basic.pdfUrls = Array.from(new Set([...resourceMetadata.pdfUrls, ...basic.pdfUrls]));
          basic.resources = resourceMetadata.resources;
          basic.subpageCandidates = resourceMetadata.subpageCandidates;
          return { tender: basic };
        }
      }

      if (row.title.length > 5) {
        const isLoginBlocked = detailAccessCheck?.blocked && detailAccessCheck?.reason === "login_required";
        const hasUsefulRowData = row.client.length > 2 && row.deadline;
        if (isLoginBlocked && !hasUsefulRowData) {
          console.log(`[public-scraper] ${config.name}: Login-Seite ohne verwertbare Suchdaten übersprungen (OID ${row.oid})`);
          return { tender: null };
        }
        const resourceMetadata = detailHtml && !isLoginBlocked ? extractPublicResourceMetadata(detailHtml, detailUrl) : null;
        return {
          tender: {
            title: netServerTitle ?? cleanTenderTitle(row.title),
            client: row.client || "",
            deadline: row.deadline || null,
            description: row.procedure ? `Verfahrensart: ${row.procedure}` : "",
            descriptionMarkdown: buildTenderDescriptionMarkdown({
              client: row.client || "",
              procedure: row.procedure || null,
              deadline: row.deadline || null,
              summary: row.procedure ? `Verfahrensart: ${row.procedure}` : "",
              reference: row.oid,
            }),
            procedure: row.procedure || null,
            referenceNumber: row.oid,
            externalId: reference.externalId ?? row.oid,
            location: null,
            category: "Sonstiges",
            sourceUrl: detailUrl,
            source: config.name,
            pdfUrls: resourceMetadata?.pdfUrls ?? [],
            ...(resourceMetadata ? {
              resources: resourceMetadata.resources,
              subpageCandidates: resourceMetadata.subpageCandidates,
            } : {}),
          },
        };
      }
      return { tender: null, retryable: true };
    } catch (error) {
      console.warn(`[public-scraper] ${config.name} Detail Fehler (OID ${reference.externalId ?? reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    detailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, detailLimit)) {
    return pendingOnlyResult(cursor, "netserver-start", pendingRun);
  }

  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const searchUrl = `${config.baseUrl}${config.searchPath}`;

    const fetchHtml = async (url: string): Promise<string> => {
      const response = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });

      if (response.ok) {
        return await response.text();
      }

      // Fallback for portals with bot protection (F5 BIG-IP etc.).
      console.log(`[public-scraper] ${config.name}: fetch gab ${response.status}, versuche curl...`);
      const { execSync } = await import("child_process");
      const fallbackHtml = execSync(`curl -s -L -H "User-Agent: ${UA}" "${url}"`, {
        maxBuffer: 5 * 1024 * 1024,
        timeout: 25000,
      }).toString();
      if (!fallbackHtml.trim()) throw new Error(`${config.name}: listing returned no content after HTTP ${response.status}`);
      return fallbackHtml;
    };

    const pageHtmls: Array<{ url: string; html: string }> = [];
    const initialPage = cursorBoolean(cursor, "exhausted") ? searchUrl : cursorString(cursor, "nextUrl") ?? searchUrl;
    const pendingPages = [initialPage];
    const visitedPages = new Set<string>();
    while (pendingPages.length > 0 && pagesFetched < settings.publicPaginationPages) {
      const currentUrl = pendingPages.shift()!;
      if (visitedPages.has(currentUrl)) continue;
      visitedPages.add(currentUrl);
      const html = await fetchHtml(currentUrl);
      pageHtmls.push({ url: currentUrl, html });
      pagesFetched += 1;
      if (config.followPagination !== false) {
        for (const pageUrl of parseNetServerPaginationUrls(html, config.baseUrl, currentUrl)) {
          if (!visitedPages.has(pageUrl) && !pendingPages.includes(pageUrl)) pendingPages.push(pageUrl);
        }
      }
    }

    const rowsByOid = new Map<string, NetServerRow>();
    for (const page of pageHtmls) {
      for (const row of parseNetServerRows(page.html)) rowsByOid.set(row.oid, row);
    }
    const rows = Array.from(rowsByOid.values());

    console.log(`[public-scraper] ${config.name}: ${rows.length} Zeilen in Tabelle`);

    const tenders: ExtractedTender[] = [...pendingRun.tenders];
    const detailRefs: PublicDetailReference[] = [];
    for (const row of rows) {
      const key = `net:${config.name}:oid:${row.oid}`;
      rowByKey.set(key, row);
      const detailUrl = row.detailPath
        ? new URL(row.detailPath, `${config.baseUrl}/NetServer/`).href
        : `${config.baseUrl}/NetServer/PublicationSearchControllerServlet?function=GetPublication&oid=${encodeURIComponent(row.oid)}&Category=InvitationToTender&thContext=publications`;
      detailRefs.push(publicDetailReference(key, detailUrl, row.oid));
    }

    const detailRun = await processDetailQueue(
      detailRefs,
      detailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    tenders.push(...detailRun.tenders);
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);

    console.log(`[public-scraper] ${config.name}: ${tenders.length} Ausschreibungen`);
    const nextUrl = pendingPages[0] ?? null;
    const hasMore = Boolean(nextUrl);
    const nextListingUrl = nextUrl ?? searchUrl;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "netserver-start",
      position: { nextUrl: nextListingUrl },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "netserver-start",
      listedCount: rows.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { nextUrl: nextListingUrl },
    });
  } catch (error) {
    console.error(`[public-scraper] ${config.name} Fehler:`, error);
    throw error;
  }
}

// --- e-vergabe-sh.de (Schleswig-Holstein) ---

async function scrapeEVergabeSh(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] e-vergabe-sh.de...");
  const rootUrl = "https://www.e-vergabe-sh.de/vergabeverfahren/aktuelle-vergabeverfahren";
  let currentUrl = cursorBoolean(cursor, "exhausted") ? rootUrl : cursorString(cursor, "nextUrl") ?? rootUrl;
  let pagesFetched = 0;
  let hasMore = false;
  const titleByUrl = new Map<string, string>();

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const detailResp = await fetch(reference.url, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (!detailResp.ok) return detailResp.status === 404
        ? { tender: null, blocked: true }
        : { tender: null, retryable: true };
      const detailHtml = await detailResp.text();
      const $detail = cheerio.load(detailHtml);
      $detail("script, style, nav, header, footer").remove();
      const bodyText = htmlToBasicMarkdown($detail("body").html() ?? "");
      if (!bodyText || bodyText.length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(bodyText, { url: reference.url }).blocked) return { tender: null, blocked: true };
      const extracted = await extractDetailFromMarkdown(bodyText, reference.url, "e-vergabe-sh", true);
      if (!extracted) return { tender: null };
      const listedTitle = titleByUrl.get(reference.url);
      if (listedTitle && (!extracted.title || extracted.title.length < 5)) extracted.title = cleanTenderTitle(listedTitle);
      extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      return { tender: extracted };
    } catch (error) {
      console.warn(`[public-scraper] e-vergabe-sh Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "e-vergabe-sh-url", pendingRun);
  }

  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    // Find tender links — they have aria-label starting with "Bekanntmachung"
    const links: PublicDetailReference[] = [];
    const seenLinks = new Set<string>();
    for (let page = 0; page < settings.publicPaginationPages; page++) {
      const resp = await fetch(currentUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) throw new Error(`e-vergabe-sh listing HTTP ${resp.status}`);
      const html = await resp.text();
      if (!html.trim()) throw new Error("e-vergabe-sh listing returned no content");
      pagesFetched += 1;
      const $ = cheerio.load(html);
      $("a[aria-label^='Bekanntmachung']").each((_, el) => {
        const $el = $(el);
        const ariaLabel = $el.attr("aria-label") ?? "";
        const href = $el.attr("href") ?? "";
        const title = ariaLabel.replace(/^Bekanntmachung\s+/, "").replace(/\s+auf externer Vergabeplattform öffnen$/, "").trim();
        if (href && title.length > 5 && href.startsWith("http") && !seenLinks.has(href)) {
          seenLinks.add(href);
          titleByUrl.set(href, title);
          links.push(publicDetailReference(`e-vergabe-sh:url:${href}`, href));
        }
      });

      const nextUrls = parseGenericPaginationUrls(html, rootUrl, currentUrl);
      hasMore = nextUrls.length > 0;
      if (!hasMore || links.length === 0) break;
      currentUrl = nextUrls[0];
    }

    console.log(`[public-scraper] e-vergabe-sh: ${links.length} Bekanntmachungen gefunden`);

    const detailRun = await processDetailQueue(
      links,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] e-vergabe-sh: ${tenders.length} Ausschreibungen`);
    const nextUrl = hasMore ? currentUrl : rootUrl;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "e-vergabe-sh-url",
      position: { nextUrl },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "e-vergabe-sh-url",
      listedCount: links.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { nextUrl },
    });
  } catch (error) {
    console.error("[public-scraper] e-vergabe-sh Fehler:", error);
    throw error;
  }
}

// --- eVergabe-Portal Sachsen-Anhalt ---

async function scrapeSachsenAnhalt(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  const rootUrl = "https://evergabe.sachsen-anhalt.de/";
  let currentUrl = cursorBoolean(cursor, "exhausted") ? rootUrl : cursorString(cursor, "nextUrl") ?? rootUrl;
  let pagesFetched = 0;
  let hasMore = false;

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const response = await fetch(reference.url, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return response.status === 404
        ? { tender: null, blocked: true }
        : { tender: null, retryable: true };

      const wrapperHtml = await response.text();
      if (!wrapperHtml.trim() || wrapperHtml.trim().length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(wrapperHtml, { url: reference.url }).blocked) return { tender: null, blocked: true };

      const wrapper = parseSachsenAnhaltDetail(wrapperHtml, reference.url);
      if (!wrapper) return { tender: null, retryable: true };

      let resourceMetadata = extractPublicResourceMetadata(wrapperHtml, reference.url);
      const descriptionParts = [
        wrapper.procedure ? `Verfahrensart: ${wrapper.procedure}` : "",
        wrapper.location ? `Leistungsort: ${wrapper.location}` : "",
      ].filter(Boolean);
      const tender: ExtractedTender = {
        title: wrapper.title,
        client: wrapper.client || "Sachsen-Anhalt",
        deadline: wrapper.deadline,
        description: descriptionParts.join(". "),
        descriptionMarkdown: buildTenderDescriptionMarkdown({
          client: wrapper.client || "Sachsen-Anhalt",
          procedure: wrapper.procedure,
          deadline: wrapper.deadline,
          location: wrapper.location,
          summary: descriptionParts.join(". "),
        }),
        procedure: wrapper.procedure,
        referenceNumber: null,
        location: wrapper.location,
        category: "Sonstiges",
        sourceUrl: reference.url,
        source: "sachsen-anhalt",
        externalId: reference.externalId ?? wrapper.idp,
        pdfUrls: resourceMetadata.pdfUrls,
        resources: resourceMetadata.resources,
        subpageCandidates: resourceMetadata.subpageCandidates,
      };

      if (wrapper.externalUrl) {
        try {
          const externalResponse = await fetch(wrapper.externalUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" },
            redirect: "follow",
            signal: AbortSignal.timeout(15000),
          });
          if (externalResponse.ok) {
            const externalUrl = externalResponse.url || wrapper.externalUrl;
            const externalHtml = await externalResponse.text();
            if (externalHtml.trim()) {
              const externalMetadata = extractPublicResourceMetadata(externalHtml, externalUrl);
              resourceMetadata = {
                resources: mergeDiscoveredResources(resourceMetadata.resources, externalMetadata.resources),
                pdfUrls: Array.from(new Set([...resourceMetadata.pdfUrls, ...externalMetadata.pdfUrls])),
                subpageCandidates: [...resourceMetadata.subpageCandidates, ...externalMetadata.subpageCandidates],
              };

              if (!detectAccessPage(externalHtml, { url: externalUrl }).blocked) {
                const externalDetail = extractBasicDetailFromHtml(
                  externalHtml,
                  externalUrl,
                  "sachsen-anhalt",
                  externalMetadata.pdfUrls,
                  true,
                );
                if (externalDetail) {
                  const isGenericExternalTitle = !externalDetail.title ||
                    /^(?:Bekanntmachungsdetails|Ausschreibungsdetails|Vergabedetails|Ausschreibung der|Öffentliche Ausschreibung der)/i.test(externalDetail.title) ||
                    /\bVergabeplattform\b/i.test(externalDetail.title);
                  const isGenericExternalClient = !externalDetail.client || /^\(Vergabestelle\)$/i.test(externalDetail.client);
                  if (!isGenericExternalTitle) tender.title = externalDetail.title;
                  if (!isGenericExternalClient && (!tender.client || tender.client === "Sachsen-Anhalt")) tender.client = externalDetail.client;
                  if (!tender.deadline) tender.deadline = externalDetail.deadline;
                  if (tender.description.length < 30) tender.description = pickPublicDescription(externalDetail.description, tender.description);
                  if (!tender.referenceNumber) tender.referenceNumber = externalDetail.referenceNumber;
                  if (!tender.location) tender.location = externalDetail.location;
                }
              }

              tender.pdfUrls = resourceMetadata.pdfUrls;
              tender.resources = resourceMetadata.resources;
              tender.subpageCandidates = Array.from(new Map(
                resourceMetadata.subpageCandidates.map((candidate) => [candidate.canonicalUrl, candidate]),
              ).values());
            }
          }
        } catch (error) {
          console.warn(`[public-scraper] sachsen-anhalt externe Detailseite nicht verfügbar (${reference.key}):`, error);
        }
      }

      return { tender };
    } catch (error) {
      console.warn(`[public-scraper] sachsen-anhalt Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "sachsen-anhalt-snapshot", pendingRun);
  }
  if (cursor?.snapshotComplete === true && cursorPendingDetails(cursor).length === 0 && pendingRun.detailAttempted > 0) {
    return sourceCursorResult(pendingRun.tenders, {
      cursor,
      strategy: "sachsen-anhalt-snapshot",
      position: cursorPosition(cursor) ?? { highWater: cursorString(cursor, "highWater") ?? "" },
      listingExhausted: true,
      listingComplete: true,
      pendingDetails: pendingRun.pendingDetails,
      pagesFetched: 0,
      paginationStrategy: "sachsen-anhalt-snapshot",
      listedCount: 0,
      detailAttempted: pendingRun.detailAttempted,
      detailFailed: pendingRun.detailFailed,
      extra: { snapshotComplete: true },
    });
  }

  try {
    const rowsById = new Map<string, SachsenAnhaltListingRow>();
    const pageUrls = new Set<string>();
    for (let page = 0; page < settings.publicPaginationPages; page += 1) {
      if (pageUrls.has(currentUrl)) break;
      pageUrls.add(currentUrl);
      const html = await fetchWithEncoding(currentUrl, 20000);
      if (!html.trim()) throw new Error(`sachsen-anhalt listing page ${page + 1} returned no content`);
      pagesFetched += 1;
      for (const row of parseSachsenAnhaltListing(html, currentUrl)) rowsById.set(row.idp, row);

      const nextUrl = parseGenericPaginationUrls(html, rootUrl, currentUrl)[0] ?? null;
      hasMore = Boolean(nextUrl);
      if (!nextUrl || rowsById.size === 0) break;
      currentUrl = nextUrl;
    }

    const rows = Array.from(rowsById.values());
    const highWater = cursorString(cursor, "highWater");
    const markerIndex = highWater ? rows.findIndex((row) => row.idp === highWater) : -1;
    const unseenRows = markerIndex >= 0 ? rows.slice(0, markerIndex) : rows;
    const detailRefs = unseenRows.map((row) => publicDetailReference(
      `sachsen-anhalt:idp:${row.idp}`,
      row.url,
      row.idp,
    ));
    const detailRun = await processDetailQueue(
      detailRefs,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];
    const nextUrl = hasMore ? currentUrl : rootUrl;
    const nextHighWater = rows[0]?.idp ?? highWater ?? "";

    console.log(`[public-scraper] sachsen-anhalt: ${tenders.length} Ausschreibungen`);
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "sachsen-anhalt-snapshot",
      position: { highWater: nextHighWater, nextUrl },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "sachsen-anhalt-snapshot",
      listedCount: unseenRows.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { highWater: nextHighWater, nextUrl, snapshotComplete: !hasMore },
    });
  } catch (error) {
    console.error("[public-scraper] sachsen-anhalt Fehler:", error);
    throw error;
  }
}

// --- verwaltung.thueringen.de (Thüringen) ---

async function scrapeThueringen(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] thueringen.de...");
  const rootUrl = "https://verwaltung.thueringen.de/evergabe";
  let currentUrl = cursorBoolean(cursor, "exhausted") ? rootUrl : cursorString(cursor, "nextUrl") ?? rootUrl;
  let pagesFetched = 0;
  let hasMore = false;
  const rowByUrl = new Map<string, { title: string; deadline: string }>();

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const detailResp = await fetch(reference.url, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (!detailResp.ok) return detailResp.status === 404
        ? { tender: null, blocked: true }
        : { tender: null, retryable: true };
      const detailHtml = await detailResp.text();
      const $detail = cheerio.load(detailHtml);
      $detail("script, style, nav, header, footer").remove();
      const bodyText = htmlToBasicMarkdown($detail("body").html() ?? "");
      if (!bodyText || bodyText.length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(bodyText, { url: reference.url }).blocked) return { tender: null, blocked: true };
      const extracted = await extractDetailFromMarkdown(bodyText, reference.url, "thueringen", true);
      if (!extracted) return { tender: null };
      const row = rowByUrl.get(reference.url);
      if (row) {
        if (!extracted.title || extracted.title.length < 5) extracted.title = cleanTenderTitle(row.title);
        if (!extracted.deadline) extracted.deadline = row.deadline || null;
      }
      extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      return { tender: extracted };
    } catch (error) {
      console.warn(`[public-scraper] thueringen Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "thueringen-url", pendingRun);
  }

  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    const rows: { title: string; url: string; deadline: string }[] = [];
    const seenRows = new Set<string>();

    for (let page = 0; page < settings.publicPaginationPages; page++) {
      const resp = await fetch(currentUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) throw new Error(`thueringen listing HTTP ${resp.status}`);
      const html = await resp.text();
      if (!html.trim()) throw new Error("thueringen listing returned no content");
      pagesFetched += 1;
      const $ = cheerio.load(html);

      $("table tr").each((_, el) => {
        const $row = $(el);
        const cells = $row.find("td");
        if (cells.length < 3) return;

        // Find link in first cell (Veröffentlichung)
        const linkEl = $row.find("a").first();
        const href = linkEl.attr("href") ?? "";
        const title = linkEl.text().trim() || $(cells[0]).text().trim();
        const deadline = $(cells.length >= 3 ? cells[cells.length - 1] : cells[2]).text().trim();

        if (href && title.length > 5) {
          const url = href.startsWith("http") ? href : `https://verwaltung.thueringen.de${href}`;
          if (!seenRows.has(url)) {
            seenRows.add(url);
            rows.push({ title, url, deadline });
          }
        }
      });

      const nextUrls = parseGenericPaginationUrls(html, rootUrl, currentUrl);
      hasMore = nextUrls.length > 0;
      if (!hasMore || rows.length === 0) break;
      currentUrl = nextUrls[0];
    }

    console.log(`[public-scraper] thueringen: ${rows.length} Zeilen in Tabelle`);

    const detailRefs = rows.map((row) => publicDetailReference(`thueringen:url:${row.url}`, row.url));
    for (const row of rows) rowByUrl.set(row.url, row);
    const detailRun = await processDetailQueue(
      detailRefs,
      settings.publicDetailLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] thueringen: ${tenders.length} Ausschreibungen`);
    const nextUrl = hasMore ? currentUrl : rootUrl;
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "thueringen-url",
      position: { nextUrl },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails,
      pagesFetched,
      paginationStrategy: "thueringen-url",
      listedCount: rows.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { nextUrl },
    });
  } catch (error) {
    console.error("[public-scraper] thueringen Fehler:", error);
    throw error;
  }
}

// --- auftraege.bayern.de JSON API (Bayern) ---

interface BayernTender {
  T_ID: number;
  TIDGUID: string;
  Aktenzeichen: string | null;
  Titel: string;
  VSTName: string;
  Public_DateStr: string;
  Bidding_DateStr: string;
  TTLongName: string;
  POVord: string;
  CPVCodes: string | null;
  APLZ: string;
}

async function scrapeBayernApi(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] auftraege.bayern.de API...");
  let startId = cursorBoolean(cursor, "exhausted") ? "" : cursorString(cursor, "startId") ?? "";
  let pagesFetched = 0;
  let hasMore = false;

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    async () => ({ tender: null, blocked: true }),
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "bayern-startid", pendingRun);
  }

  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const dataPages: BayernTender[][] = [];
    for (let page = 0; page < settings.publicPaginationPages; page++) {
      const apiUrl = `https://www.auftraege.bayern.de/dashboards/GetPresentationTenderList?id=V&BL=09&CPV=&startid=${encodeURIComponent(startId)}`;
      const resp = await fetch(apiUrl, {
        headers: { "User-Agent": UA, "Accept": "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: BayernTender[] = await resp.json();
      pagesFetched += 1;
      dataPages.push(data);
      console.log(`[public-scraper] bayern-api: Seite ${page + 1}: ${data.length} Eintraege von API`);
      if (data.length === 0) {
        hasMore = false;
        break;
      }

      const nextStartId = String(data[data.length - 1]?.T_ID ?? "");
      hasMore = data.length >= 100 && nextStartId.length > 0 && nextStartId !== startId;
      if (!hasMore) break;
      startId = nextStartId;
    }
    const data = dataPages.flat();

    const tenders: ExtractedTender[] = [];
    const now = new Date();

    for (const item of data) {
      // Clean title: remove HTML tags like <br/><small>
      let title = (item.Titel || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      title = cleanTenderTitle(title);
      if (!title || title.length < 5) continue;

      // Parse deadline
      let deadline: string | null = null;
      if (item.Bidding_DateStr && !item.Bidding_DateStr.includes("-62135596800000")) {
        try {
          const d = new Date(item.Bidding_DateStr);
          if (!isNaN(d.getTime()) && d > now) {
            deadline = d.toISOString();
          }
        } catch {}
      }

      // Skip if expired
      if (deadline === null && item.Bidding_DateStr && item.Bidding_DateStr.includes("-62135596800000")) {
        // No valid deadline — skip unless very recent publication
      }

      // Build detail URL — use the T_ID for a unique URL
      const detailUrl = `https://www.auftraege.bayern.de/Dashboards/Dashboard_off?BL=09#T_ID=${item.T_ID}`;

      // Description from available fields
      const parts: string[] = [];
      if (item.TTLongName) parts.push(`Verfahrensart: ${item.TTLongName}`);
      if (item.VSTName) parts.push(`Vergabestelle: ${item.VSTName}`);
      if (item.APLZ) parts.push(`PLZ: ${item.APLZ}`);
      if (item.Aktenzeichen) parts.push(`Aktenzeichen: ${item.Aktenzeichen}`);
      const description = parts.join(", ");

      // Determine category from CPV if available
      let category: TenderCategory = "Sonstiges";
      const cpv = (item.CPVCodes || "").toLowerCase();
      if (cpv.includes("45")) category = "Bauarbeiten";
      else if (cpv.includes("71")) category = "Planungsleistungen";
      else if (cpv.includes("90")) category = "Gartenarbeiten";
      else if (cpv.includes("50")) category = "Facility Management";

      tenders.push({
        title,
        client: item.VSTName || "Freistaat Bayern",
        deadline,
        description,
        descriptionMarkdown: buildTenderDescriptionMarkdown({
          client: item.VSTName || "Freistaat Bayern",
          procedure: item.TTLongName,
          deadline,
          location: item.APLZ || "Bayern",
          reference: item.Aktenzeichen || null,
          summary: description,
          cpv: item.CPVCodes ? item.CPVCodes.split(/[,;\s]+/).filter(Boolean) : [],
        }),
        procedure: item.TTLongName || null,
        cpvCodes: item.CPVCodes ? item.CPVCodes.split(/[,;\s]+/).filter(Boolean) : [],
        referenceNumber: item.Aktenzeichen || null,
        location: item.APLZ || "Bayern",
        category,
        sourceUrl: detailUrl,
        source: "auftraege-bayern",
        externalId: String(item.T_ID),
        pdfUrls: [],
      });
    }

    // Filter: only keep tenders with future deadline OR published in last 7 days
    const filtered = tenders.filter((t) => {
      if (t.deadline) return true;
      // Keep if no deadline but might still be active
      return true;
    });

    console.log(`[public-scraper] bayern-api: ${filtered.length} Ausschreibungen`);
    const nextStartId = hasMore ? startId : "";
    return sourceCursorResult([...pendingRun.tenders, ...filtered], {
      cursor,
      strategy: "bayern-startid",
      position: { startId: nextStartId },
      listingExhausted: !hasMore,
      listingComplete: !hasMore,
      pendingDetails: pendingRun.pendingDetails,
      pagesFetched,
      paginationStrategy: "bayern-startid",
      listedCount: data.length,
      detailAttempted: pendingRun.detailAttempted,
      detailFailed: pendingRun.detailFailed,
      extra: { startId: nextStartId },
    });
  } catch (error) {
    console.error("[public-scraper] bayern-api Fehler:", error);
    throw error;
  }
}

// --- hamburg.de HTML (Hamburg) ---

async function scrapeHamburgDe(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] hamburg.de...");

  const detailHandler = async (reference: PublicDetailReference): Promise<DetailOutcome> => {
    try {
      const resp = await fetch(reference.url, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) return resp.status === 404
        ? { tender: null, blocked: true }
        : { tender: null, retryable: true };
      const html = await resp.text();
      const $ = cheerio.load(html);
      $("script, style, nav, header, footer, .navigation, .breadcrumb").remove();
      const bodyText = htmlToBasicMarkdown($("body").html() ?? "");
      if (bodyText.length < 100) return { tender: null, retryable: true };
      if (detectAccessPage(bodyText, { url: reference.url }).blocked) return { tender: null, blocked: true };
      const extracted = await extractDetailFromMarkdown(bodyText, reference.url, "hamburg-de", true);
      if (!extracted) return { tender: null };
      extracted.externalId = reference.externalId ?? extracted.externalId ?? null;
      return { tender: extracted };
    } catch (error) {
      console.warn(`[public-scraper] hamburg-de Detail Fehler (${reference.key}):`, error);
      return { tender: null, retryable: true };
    }
  };

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicSearchLimit,
    detailHandler,
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicSearchLimit)) {
    return pendingOnlyResult(cursor, "hamburg-snapshot", pendingRun);
  }

  if (cursor?.snapshotComplete === true && cursorPendingDetails(cursor).length === 0 && pendingRun.detailAttempted > 0) {
    return sourceCursorResult(pendingRun.tenders, {
      cursor,
      strategy: "hamburg-snapshot",
      position: cursorPosition(cursor) ?? { snapshot: new Date().toISOString() },
      listingExhausted: true,
      listingComplete: true,
      pendingDetails: pendingRun.pendingDetails,
      pagesFetched: 0,
      paginationStrategy: "hamburg-snapshot",
      listedCount: 0,
      detailAttempted: pendingRun.detailAttempted,
      detailFailed: pendingRun.detailFailed,
      extra: { snapshotComplete: true },
    });
  }

  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const pages = [
      { url: "https://www.hamburg.de/politik-und-verwaltung/ausschreibungen/bauleistungen-vob", label: "Bauleistungen" },
      { url: "https://www.hamburg.de/politik-und-verwaltung/ausschreibungen/lieferungen-und-leistungen-vgv-uvgo-", label: "Lieferungen" },
    ];

    const allLinks: { title: string; url: string; source: string }[] = [];

    for (const page of pages) {
      try {
        const resp = await fetch(page.url, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) throw new Error(`hamburg-de ${page.label} HTTP ${resp.status}`);
        const html = await resp.text();
        if (!html.trim()) throw new Error(`hamburg-de ${page.label} returned no content`);
        const $ = cheerio.load(html);

        // Find tender links — hamburg.de uses various link patterns
        $("a").each((_, el) => {
          const $el = $(el);
          const href = ($el.attr("href") || "").trim();
          const text = $el.text().trim();
          if (!href || text.length < 10) return;
          // Look for links that point to tender detail pages
          if (href.includes("/ausschreibung") || href.includes("/vergabe") || href.includes("/bekanntmachung")) {
            const fullUrl = href.startsWith("http") ? href : `https://www.hamburg.de${href}`;
            if (!allLinks.some((l) => l.url === fullUrl)) {
              allLinks.push({ title: text, url: fullUrl, source: page.label });
            }
          }
        });

        // Also look for structured content on the page itself
        $("article, .card, .teaser, .modul-card, .list-item").each((_, el) => {
          const $el = $(el);
          const title = $el.find("h2, h3, h4, .title").first().text().trim();
          const link = $el.find("a").first().attr("href") || "";
          if (title.length > 10 && link) {
            const fullUrl = link.startsWith("http") ? link : `https://www.hamburg.de${link}`;
            if (!allLinks.some((l) => l.url === fullUrl)) {
              allLinks.push({ title, url: fullUrl, source: page.label });
            }
          }
        });
      } catch (err) {
        console.warn(`[public-scraper] hamburg-de ${page.label} Fehler:`, err);
        throw err;
      }
    }

    console.log(`[public-scraper] hamburg-de: ${allLinks.length} Links gefunden`);

    const detailRefs = allLinks.map((link) => publicDetailReference(`hamburg:url:${link.url}`, link.url));
    const detailRun = await processDetailQueue(
      detailRefs,
      settings.publicSearchLimit - pendingRun.detailAttempted,
      detailHandler,
    );
    const pendingDetails = mergeDetailReferences(pendingRun.pendingDetails, detailRun.pendingDetails);
    const tenders = [...pendingRun.tenders, ...detailRun.tenders];

    console.log(`[public-scraper] hamburg-de: ${tenders.length} Ausschreibungen`);
    const snapshot = new Date().toISOString();
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "hamburg-snapshot",
      position: { snapshot, pages: pages.map((page) => page.url) },
      listingExhausted: true,
      listingComplete: true,
      pendingDetails,
      pagesFetched: pages.length,
      paginationStrategy: "hamburg-snapshot",
      listedCount: allLinks.length,
      detailAttempted: pendingRun.detailAttempted + detailRun.detailAttempted,
      detailFailed: pendingRun.detailFailed + detailRun.detailFailed,
      extra: { snapshot, snapshotComplete: true },
    });
  } catch (error) {
    console.error("[public-scraper] hamburg-de Fehler:", error);
    throw error;
  }
}

// --- service.bund.de RSS (Bayern + Hamburg) ---

async function scrapeBundRss(cursor: PublicSourceCursor | null): Promise<PublicScraperResult> {
  console.log("[public-scraper] service.bund.de RSS...");

  const pendingRun = await processDetailQueue(
    cursorPendingDetails(cursor),
    settings.publicDetailLimit,
    async () => ({ tender: null, blocked: true }),
  );
  if (shouldPauseBeforeListing(pendingRun, settings.publicDetailLimit)) {
    return pendingOnlyResult(cursor, "bund-rss-high-water", pendingRun);
  }

  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const rssUrl = "https://www.service.bund.de/Content/DE/Ausschreibungen/Suche/Formular.html?nn=4641482&resultsPerPage=100&sortOrder=dateOfIssue_dt+desc&jobsrss=true";
    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();
      if (!xml.trim()) throw new Error("bund-rss listing returned no content");

    // Simple XML parsing — no fast-xml-parser needed for RSS
    const items: { title: string; link: string; description: string; pubDate: string; guid: string }[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const getTag = (tag: string) => {
        const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : "";
      };
      items.push({
        title: getTag("title"),
        link: getTag("link"),
        description: getTag("description"),
        pubDate: getTag("pubDate"),
        guid: getTag("guid"),
      });
    }

    console.log(`[public-scraper] bund-rss: ${items.length} Items im Feed`);

    const highWater = cursorString(cursor, "highWater");
    const itemKey = (item: { link: string; pubDate: string; guid: string }): string => item.guid || `${item.pubDate}|${item.link}`;
    const markerIndex = highWater ? items.findIndex((item) => itemKey(item) === highWater) : -1;
    const unseenItems = markerIndex >= 0 ? items.slice(0, markerIndex) : items;
    const newestKey = items.length > 0 ? itemKey(items[0]) : highWater;

    // The federal RSS feed contains notices from all regions. Regional
    // filtering here silently discarded most of the official coverage.
    const filtered = unseenItems;

    console.log(`[public-scraper] bund-rss: ${filtered.length} bundesweite Items`);

    const tenders: ExtractedTender[] = [...pendingRun.tenders];
    const now = new Date();

    for (const item of filtered) {
      // Parse title
      let title = item.title.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      title = cleanTenderTitle(title);
      if (!title || title.length < 5) continue;

      // Parse description (contains Vergabestelle, Angebotsfrist, Erfuellungsort)
      const descClean = item.description.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

      // Extract deadline from description
      let deadline: string | null = null;
      const deadlineMatch = descClean.match(/Angebotsfrist:\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
      if (deadlineMatch) {
        const parts = deadlineMatch[1].split(".");
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 23, 59);
        if (!isNaN(d.getTime()) && d > now) deadline = d.toISOString();
      }

      // Extract client from description
      let client = "Bund";
      const clientMatch = descClean.match(/Vergabestelle:\s*([^,]+)/);
      if (clientMatch) client = clientMatch[1].trim();

      // Extract location
      let location: string | null = null;
      const locMatch = descClean.match(/Erfuellungsort:\s*([^,]+)/);
      if (locMatch) location = locMatch[1].trim();

      tenders.push({
        title,
        client,
        deadline,
        description: descClean.slice(0, 500),
        descriptionMarkdown: buildTenderDescriptionMarkdown({
          client,
          deadline,
          location,
          summary: descClean.slice(0, 500),
        }),
        referenceNumber: null,
        location,
        category: "Sonstiges",
        sourceUrl: item.link || `https://www.service.bund.de`,
        source: "bund-rss",
        externalId: item.guid || item.link || null,
        pdfUrls: [],
      });
    }

    console.log(`[public-scraper] bund-rss: ${tenders.length} bundesweite Ausschreibungen`);
    const snapshot = new Date().toISOString();
    return sourceCursorResult(tenders, {
      cursor,
      strategy: "bund-rss-high-water",
      position: { highWater: newestKey ?? "", snapshot },
      listingExhausted: true,
      listingComplete: true,
      pendingDetails: pendingRun.pendingDetails,
      pagesFetched: items.length > 0 ? 1 : 0,
      paginationStrategy: "bund-rss-high-water",
      listedCount: items.length,
      detailAttempted: pendingRun.detailAttempted,
      detailFailed: pendingRun.detailFailed,
      extra: { highWater: newestKey ?? "", snapshot },
    });
  } catch (error) {
    console.error("[public-scraper] bund-rss Fehler:", error);
    throw error;
  }
}

// --- Deduplication ---

export function canonicalPublicSourceKey(sourceKey: string): string {
  return resolvePublicSourceKey(sourceKey) ?? sourceKey.trim();
}

function deduplicateTenders(tenders: ExtractedTender[]): ExtractedTender[] {
  const seen = new Map<string, ExtractedTender>();

  for (const tender of tenders) {
    const sourceKey = tender.sourceKey ?? tender.source;
    const identitySource = canonicalPublicSourceKey(sourceKey);
    const key = tender.externalId
      ? `${identitySource}:id:${tender.externalId}`.toLowerCase().trim()
      : `${identitySource}:url:${canonicalPublicTenderUrl(stripSessionId(tender.sourceUrl))}`.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, tender);
    } else {
      existing.pdfUrls = Array.from(new Set([...(existing.pdfUrls ?? []), ...(tender.pdfUrls ?? [])]));
      if (tender.resources?.length) {
        existing.resources = mergeDiscoveredResources(existing.resources ?? [], tender.resources);
      }
      if (tender.subpageCandidates?.length) {
        const candidates = [...(existing.subpageCandidates ?? []), ...tender.subpageCandidates];
        existing.subpageCandidates = Array.from(new Map(candidates.map((candidate) => [candidate.canonicalUrl, candidate])).values());
      }
    }
  }

  return Array.from(seen.values());
}

// --- Main entry point ---

export interface ScrapeResult {
  totalFound: number;
  afterDedup: number;
  bySource: Record<string, number>;
  tenders: ExtractedTender[];
  sourceRuns: Array<{
    sourceKey: string;
    status: "success" | "empty" | "failed" | "timed_out" | "partial";
    discoveredCount: number;
    acceptedCount: number;
    errorMessage: string | null;
    durationMs: number;
    cursorBefore: PublicSourceCursor | null;
    cursorAfter: PublicSourceCursor | null;
    pagesFetched: number;
    exhausted: boolean;
    cursorAdvanced: boolean;
    cursorCommit: PublicCursorCommit;
    listingComplete: boolean;
    continuationRequired: boolean;
    listedCount: number;
    detailAttempted: number;
    detailFailed: number;
    pendingCount: number;
    cursorVersionBefore?: number;
    cursorVersionAfter?: number;
  }>;
  persistenceError?: string | null;
}

export type OnSourceBatch = (sourceKey: string, tenders: ExtractedTender[]) => Promise<void>;

export async function scrapeAllPublicTenders(
  onBatch?: OnSourceBatch,
  sourceFilter?: string,
  sourceCursors: Record<string, PublicSourceCursor | null> = {},
): Promise<ScrapeResult> {
  console.log("[public-scraper] Starte vollstaendigen Scrape aller Quellen...");

  const scrapers: Array<{ name: string; fn: PublicScraper }> = [
    { name: "berlin-html", fn: scrapeBerlinHtml },
    { name: "bayern-api", fn: scrapeBayernApi },
    { name: "hamburg-de", fn: scrapeHamburgDe },
    { name: "bund-rss", fn: scrapeBundRss },
    { name: "dtvp", fn: scrapeDtvp },
    { name: "ted", fn: scrapeTed },
    { name: "bauportal", fn: scrapeBauportal },
    { name: "evergabe", fn: scrapeEvergabe },
    { name: "evergabe-online", fn: scrapeEvergabeOnline },
    { name: "bundesimmobilien", fn: scrapeBundesimmobilien },
    { name: "niedersachsen", fn: scrapeVergabeNiedersachsen },
    ...NRW_PORTALS.map((p) => ({ name: `nrw-${p.name}`, fn: (cursor: PublicSourceCursor | null) => scrapeNrwPortal(p, cursor) })),
    ...NET_SERVER_PORTALS.map((p) => ({ name: `net-${p.name}`, fn: (cursor: PublicSourceCursor | null) => scrapeNetPortal(p, cursor) })),
    { name: "e-vergabe-sh", fn: scrapeEVergabeSh },
    { name: "sachsen-anhalt", fn: scrapeSachsenAnhalt },
    { name: "thueringen", fn: scrapeThueringen },
    { name: "evergabe-nrw", fn: scrapeEvergabeNrw },
  ];

  const selectedScrapers = sourceFilter
    ? scrapers.filter((scraper) => scraper.name === sourceFilter)
    : scrapers;
  if (sourceFilter && selectedScrapers.length === 0) {
    throw new Error(`Unbekannte Public-Quelle: ${sourceFilter}`);
  }

  const allTenders: ExtractedTender[] = [];
  const bySource: Record<string, number> = {};
  const sourceRuns: ScrapeResult["sourceRuns"] = [];
  let persistenceError: string | null = null;

  const PORTAL_TIMEOUT_MS = 7 * 60 * 1000; // 7 Minuten pro Portal

  for (const scraper of selectedScrapers) {
    const startTime = Date.now();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const cursorBefore = normalizeCursor(sourceCursors[scraper.name]);
    try {
      const result = await Promise.race([
        scraper.fn(cursorBefore),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Portal-Timeout nach ${PORTAL_TIMEOUT_MS / 1000}s`)), PORTAL_TIMEOUT_MS);
        }),
      ]);
      const cursorAdvanced = result.cursorAdvanced ?? result.cursorCommit === "commit";
      const normalized = result.tenders.map((tender) => withDescriptionMarkdown({
        ...tender,
        sourceKey: scraper.name,
        externalId: derivePublicExternalId({
          sourceKey: scraper.name,
          sourceUrl: tender.sourceUrl,
          externalId: tender.externalId,
        }),
      }));
      bySource[scraper.name] = normalized.length;
      allTenders.push(...normalized);
      const duration = Date.now() - startTime;
      const status = result.cursorCommit === "hold" || result.continuationRequired
        ? "partial"
        : normalized.length > 0 ? "success" : "empty";
      sourceRuns.push({
        sourceKey: scraper.name,
        status,
        discoveredCount: normalized.length,
        acceptedCount: normalized.length,
        errorMessage: null,
        durationMs: duration,
        cursorBefore,
      cursorAfter: result.cursorCommit === "commit" ? result.nextCursor ?? cursorBefore : cursorBefore,
        pagesFetched: result.pagesFetched ?? 0,
        exhausted: result.exhausted ?? false,
        cursorAdvanced,
        cursorCommit: result.cursorCommit,
        listingComplete: result.listingComplete,
        continuationRequired: result.continuationRequired,
        listedCount: result.listedCount,
        detailAttempted: result.detailAttempted,
        detailFailed: result.detailFailed,
        pendingCount: result.pendingCount,
      });
      if (normalized.length === 0) {
        console.warn(`[public-scraper] ${scraper.name}: 0 Ausschreibungen nach ${duration}ms (keine Extraktion oder keine Treffer)`);
      } else {
        console.log(`[public-scraper] ${scraper.name}: ${normalized.length} Ausschreibungen in ${duration}ms`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : "Unbekannter Scraperfehler";
      const timedOut = message.includes("Portal-Timeout");
      sourceRuns.push({
        sourceKey: scraper.name,
        status: timedOut ? "timed_out" : "failed",
        discoveredCount: 0,
        acceptedCount: 0,
        errorMessage: message,
        durationMs: duration,
        cursorBefore,
        cursorAfter: cursorBefore,
        pagesFetched: 0,
        exhausted: false,
        cursorAdvanced: false,
        cursorCommit: "hold",
        listingComplete: false,
        continuationRequired: true,
        listedCount: 0,
        detailAttempted: 0,
        detailFailed: 0,
        pendingCount: 0,
      });
      console.error(`[public-scraper] ${scraper.name} fehlgeschlagen nach ${duration}ms:`, error);
      bySource[scraper.name] = 0;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  const deduplicated = deduplicateTenders(allTenders);
  const tendersBySource = new Map<string, ExtractedTender[]>();
  for (const tender of deduplicated) {
    const sourceKey = tender.sourceKey ?? tender.source;
    const sourceTenders = tendersBySource.get(sourceKey) ?? [];
    sourceTenders.push(tender);
    tendersBySource.set(sourceKey, sourceTenders);
  }

  for (const sourceRun of sourceRuns) {
    const sourceTenders = tendersBySource.get(sourceRun.sourceKey) ?? [];
    sourceRun.acceptedCount = sourceTenders.length;
    if (sourceRun.status === "success" && sourceRun.discoveredCount === 0) sourceRun.status = "empty";
    if (onBatch && sourceTenders.length > 0) {
      try {
        await onBatch(sourceRun.sourceKey, sourceTenders);
      } catch (error) {
        sourceRun.status = "partial";
        sourceRun.errorMessage = error instanceof Error ? error.message : "Persistenzfehler";
        persistenceError = sourceRun.errorMessage;
      }
    }
  }

  console.log(
    `[public-scraper] Fertig. Gesamt: ${allTenders.length}, nach Dedup: ${deduplicated.length}`
  );

  return {
    totalFound: allTenders.length,
    afterDedup: deduplicated.length,
    bySource,
    tenders: deduplicated,
    sourceRuns,
    persistenceError,
  };
}

// --- oeffentlichevergabe.de Integration ---

const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://localhost:8080";

export interface OeffentlicheVergabeDetails {
  noticeId: string;
  estimatedValue: string | null;
  procedure: string | null;
  duration: string | null;
  buyer: string | null;
  contact: string | null;
  description: string | null;
  evergabeUrl: string | null;
  evergabeDocumentUrls: string[];
  lotDescription: string | null;
  portalUrl: string | null;
}

export async function searchOeffentlicheVergabeByTitle(title: string): Promise<{ noticeId: string; evergabeUrl: string | null } | null> {
  try {
    const cleanTitle = title.replace(/\s+/g, " ").trim().slice(0, 100);
    console.log(`[oeffvergabe] Suche nach: ${cleanTitle.slice(0, 60)}...`);

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });

    try {
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();

      await page.goto("https://oeffentlichevergabe.de/ui/en/search", { waitUntil: "networkidle", timeout: 30000 });

      const searchInput = await page.waitForSelector("input[type='text'], input[type='search'], input.search-input, input[placeholder*='search'], input[placeholder*='Such']", { timeout: 10000 }).catch(() => null);

      if (!searchInput) {
        console.warn("[oeffvergabe] Suchfeld nicht gefunden");
        return null;
      }

      await searchInput.fill(cleanTitle);
      await page.keyboard.press("Enter");

      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle").catch(() => {});

      let noticeId: string | null = null;
      const content = await page.content();
      const noticeIdRegex = /noticeId=([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
      const matches = content.match(noticeIdRegex);

      if (matches && matches.length > 0) {
        const noticeIdMatch = matches[0].match(/noticeId=([a-f0-9-]+)/i);
        if (noticeIdMatch) noticeId = noticeIdMatch[1];
      }

      if (!noticeId) {
        const links = await page.$$eval("a[href*='noticeId']", (els) =>
          els.map((el) => (el as HTMLAnchorElement).href).slice(0, 5)
        );
        for (const link of links) {
          const m = link.match(/noticeId=([a-f0-9-]+)/i);
          if (m) { noticeId = m[1]; break; }
        }
      }

      if (!noticeId) {
        console.log(`[oeffvergabe] Keine Treffer fuer: ${cleanTitle.slice(0, 50)}...`);
        return null;
      }

      console.log(`[oeffvergabe] noticeId gefunden: ${noticeId.slice(0, 12)}...`);

      // Navigate to detail page to find evergabe/portal link
      let evergabeUrl: string | null = null;
      try {
        const detailUrl = `https://oeffentlichevergabe.de/ui/en/search/details?noticeId=${noticeId}&lotId=LOT-0000`;
        await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 20000 });
        await page.waitForTimeout(2000);

        // Find all external links (not oeffentlichevergabe.de) — these are the portal links
        const portalLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href]"))
            .map((el) => (el as HTMLAnchorElement).href)
            .filter((h) => h.startsWith("http") && !h.includes("oeffentlichevergabe.de") && !h.includes("javascript:"));
        });

        // Look for evergabe/vergabe portal links
        const PORTAL_PATTERN = /evergabe|vergabe\.metropoleruhr|subreport/i;
        for (const link of portalLinks) {
          if (!PORTAL_PATTERN.test(link)) continue;

          if (link.includes("/documents")) {
            // Already a documents URL — use directly
            evergabeUrl = link;
          } else if (link.includes("/VMPSatellite/notice/")) {
            // VMPSatellite notice link — extract project ID and build documents URL
            const noticeMatch = link.match(/\/VMPSatellite\/notice\/([A-Z0-9]+)/);
            if (noticeMatch) {
              const baseUrl = link.split("/VMPSatellite/")[0];
              evergabeUrl = `${baseUrl}/VMPSatellite/public/company/project/${noticeMatch[1]}/de/documents`;
            }
          } else if (link.includes("/Vergabe/notice/")) {
            // BLB-style notice link — extract project ID and build documents URL
            const noticeMatch = link.match(/\/Vergabe\/notice\/([A-Z0-9]+)/);
            if (noticeMatch) {
              const baseUrl = link.split("/Vergabe/")[0];
              evergabeUrl = `${baseUrl}/Vergabe/public/company/project/${noticeMatch[1]}/de/documents`;
            }
          } else if (link.includes("/unterlagen/") || link.includes("/ausschreibung/")) {
            evergabeUrl = link;
          }

          if (evergabeUrl) {
            console.log(`[oeffvergabe] Portal Link: ${evergabeUrl.slice(0, 100)}`);
            break;
          }
        }

        // Fallback: any external link that looks like a procurement portal
        if (!evergabeUrl) {
          for (const link of portalLinks) {
            if (link.includes("/VMPSatellite/") || link.includes("/Vergabe/")) {
              evergabeUrl = link;
              console.log(`[oeffvergabe] Portal Link (fallback): ${evergabeUrl.slice(0, 100)}`);
              break;
            }
          }
        }
      } catch (detailError) {
        console.warn("[oeffvergabe] Detail-Seite Fehler:", detailError);
      }

      return { noticeId, evergabeUrl };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (error) {
    console.warn("[oeffvergabe] Suche fehlgeschlagen:", error);
    return null;
  }
}

export async function fetchOeffentlicheVergabeDetails(noticeId: string): Promise<OeffentlicheVergabeDetails | null> {
  try {
    // Try with noticeVersion=01 first (works for UUID noticeIds)
    let apiUrl = `https://oeffentlichevergabe.de/api/notices/${noticeId}?format=ocds&noticeVersion=01`;
    console.log(`[oeffvergabe] Fetch API: ${apiUrl.slice(0, 80)}...`);

    let response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    // If 404, retry without noticeVersion (works for numeric noticeIds)
    if (response.status === 404) {
      apiUrl = `https://oeffentlichevergabe.de/api/notices/${noticeId}?format=ocds`;
      console.log(`[oeffvergabe] Retry ohne noticeVersion: ${apiUrl.slice(0, 80)}...`);
      response = await fetch(apiUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(15000),
      });
    }

    if (!response.ok) {
      console.warn(`[oeffvergabe] API Fehler: ${response.status}`);
      return null;
    }

    const ocds = (await response.json()) as Record<string, unknown>;
    const releases = ocds.releases as Array<Record<string, unknown>> | undefined;
    if (!releases || releases.length === 0) {
      console.warn(`[oeffvergabe] Keine releases in OCDS Antwort`);
      return null;
    }

    const release = releases[0];
    const tender = release.tender as Record<string, unknown> | undefined;
    const buyer = release.buyer as Record<string, unknown> | undefined;
    const parties = release.parties as Array<Record<string, unknown>> | undefined;

    if (!tender) {
      console.warn(`[oeffvergabe] Keine tender-Daten in OCDS Antwort`);
      return null;
    }

    // Extract estimated value
    const value = tender.value as Record<string, unknown> | undefined;
    let estimatedValue: string | null = null;
    if (value && typeof value.amount === "number") {
      const amount = value.amount;
      const currency = typeof value.currency === "string" ? value.currency : "EUR";
      estimatedValue = `${amount.toLocaleString("de-DE")} ${currency}`;
    }

    // Extract procedure
    const procedure = typeof tender.procurementMethodDetails === "string"
      ? tender.procurementMethodDetails
      : typeof tender.procurementMethod === "string"
        ? tender.procurementMethod
        : null;

    // Extract duration from lots
    let duration: string | null = null;
    const lots = tender.lots as Array<Record<string, unknown>> | undefined;
    if (lots && lots.length > 0) {
      const lot = lots[0];
      const contractPeriod = lot.contractPeriod as Record<string, unknown> | undefined;
      if (contractPeriod) {
        const start = typeof contractPeriod.startDate === "string" ? contractPeriod.startDate : null;
        const end = typeof contractPeriod.endDate === "string" ? contractPeriod.endDate : null;
        if (start || end) {
          duration = `Start: ${start ?? "?"}, Ende: ${end ?? "?"}`;
        }
      }
    }

    // Extract buyer
    let buyerName = typeof buyer?.name === "string" ? buyer.name : null;

    // Extract contact
    let contact: string | null = null;
    if (parties && parties.length > 0) {
      const party = parties[0];
      const contactPoint = party.contactPoint as Record<string, unknown> | undefined;
      if (contactPoint) {
        const parts: string[] = [];
        if (typeof contactPoint.email === "string") parts.push(`E-Mail: ${contactPoint.email}`);
        if (typeof contactPoint.telephone === "string") parts.push(`Tel: ${contactPoint.telephone}`);
        if (typeof contactPoint.url === "string") parts.push(`Web: ${contactPoint.url}`);
        contact = parts.length > 0 ? parts.join(", ") : null;
      }
    }

    // Extract description
    const description = typeof tender.description === "string" ? tender.description : null;

    // Extract lot description
    let lotDescription: string | null = null;
    if (lots && lots.length > 0) {
      const lot = lots[0];
      if (typeof lot.description === "string" && lot.description.length > 10) {
        lotDescription = lot.description;
      }
    }

    // Extract evergabe/portal document URLs
    let evergabeUrl: string | null = null;
    const documents = tender.documents as Array<Record<string, unknown>> | undefined;
    const evergabeUrls: string[] = [];
    const PORTAL_URL_PATTERN = /evergabe|vergabe\.metropoleruhr|subreport/i;
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (typeof doc.url === "string" && PORTAL_URL_PATTERN.test(doc.url)) {
          evergabeUrls.push(doc.url);
          if (!evergabeUrl) evergabeUrl = doc.url;
        }
      }
    }

    // Fetch evergabe.de document download URLs
    let evergabeDocumentUrls: string[] = [];
    for (const eUrl of evergabeUrls) {
      if (evergabeDocumentUrls.length > 0) break;

      if (eUrl.includes("/auftraege/")) {
        // Public detail page — scrape for /unterlagen/ links
        console.log(`[oeffvergabe] /auftraege/ URL erkannt, scrape Detailseite...`);
        const page = await scrapeEvergabeDetailPage(eUrl);
        if (page) {
          for (const unterlagenUrl of page.unterlagenLinks) {
            if (evergabeDocumentUrls.length > 0) break;
            const docUrls = await fetchEvergabeDownloadUrls(unterlagenUrl);
            if (docUrls.length > 0) {
              evergabeDocumentUrls = docUrls;
              evergabeUrl = unterlagenUrl;
            }
          }
          // Merge extra details
          if (!estimatedValue && page.details.estimatedValue) estimatedValue = page.details.estimatedValue;
          if (!buyerName && page.details.buyer) buyerName = page.details.buyer;
        }
      } else {
        // Direct /unterlagen/ URL — try fetching directly
        evergabeDocumentUrls = await fetchEvergabeDownloadUrls(eUrl);
        if (evergabeDocumentUrls.length > 0) evergabeUrl = eUrl;
      }
    }

    console.log(`[oeffvergabe] Details extrahiert: value=${estimatedValue ?? "nein"}, procedure=${procedure ?? "nein"}, evergabe=${evergabeDocumentUrls.length} docs`);

    return {
      noticeId,
      estimatedValue,
      procedure,
      duration,
      buyer: buyerName,
      contact,
      description,
      evergabeUrl,
      evergabeDocumentUrls,
      lotDescription,
      portalUrl: null,
    };
  } catch (error) {
    console.warn(`[oeffvergabe] API-Fetch fehlgeschlagen:`, error);
    return null;
  }
}

async function fetchEvergabeDownloadUrls(evergabeUrl: string): Promise<string[]> {
  try {
    // Normalize: remove /zustellweg-auswaehlen suffix to get the unterlagen page
    const unterlagenUrl = evergabeUrl.replace(/\/zustellweg-auswaehlen.*$/, "");
    console.log(`[oeffvergabe] Fetch evergabe Dokumente: ${unterlagenUrl}`);

    const response = await fetch(unterlagenUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`[oeffvergabe] evergabe Fehler: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const urls: string[] = [];

    // Use the fetched page URL as base for resolving relative links
    const baseUrl = unterlagenUrl;

    // Match download, archive, and ZIP links (various portal patterns)
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      // Skip navigation links
      if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;
      // Match download links, archive/ZIP links, or direct file links
      const isDownload = href.includes("download") || href.includes("archive") || href.endsWith(".zip") || href.endsWith(".pdf") || href.endsWith(".xlsx");
      if (!isDownload) return;
      try {
        const fullUrl = new URL(href, baseUrl).href;
        // Strip jsessionid from URL (session-bound, won't work from fetch)
        const cleanUrl = fullUrl.replace(/;jsessionid=[^?&]+/, "");
        if (!urls.includes(cleanUrl)) urls.push(cleanUrl);
      } catch { /* ignore */ }
    });

    // Also check the overview page for announcement PDFs (Bekanntmachung)
    // These are publicly accessible even when documents require participation
    if (urls.filter(u => u.endsWith(".pdf")).length === 0) {
      const overviewUrl = unterlagenUrl.replace(/\/documents$/, "/overview");
      try {
        console.log(`[oeffvergabe] Pruefe Uebersichtsseite fuer Bekanntmachung: ${overviewUrl.slice(0, 80)}`);
        const overviewResp = await fetch(overviewUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        if (overviewResp.ok) {
          const overviewHtml = await overviewResp.text();
          const $ov = cheerio.load(overviewHtml);
          $ov("a[href*='announcements']").each((_, el) => {
            const href = $ov(el).attr("href");
            if (!href || !href.endsWith(".pdf")) return;
            try {
              const fullUrl = new URL(href, overviewUrl).href;
              const cleanUrl = fullUrl.replace(/;jsessionid=[^?&]+/, "");
              if (!urls.includes(cleanUrl)) urls.push(cleanUrl);
            } catch { /* ignore */ }
          });
        }
      } catch (overviewError) {
        console.warn(`[oeffvergabe] Uebersichtsseite Fehler:`, overviewError);
      }
    }

    console.log(`[oeffvergabe] evergabe: ${urls.length} Download-Links gefunden`);
    return urls;
  } catch (error) {
    console.warn(`[oeffvergabe] evergabe Fetch fehlgeschlagen:`, error);
    return [];
  }
}

async function scrapeEvergabeDetailPage(url: string): Promise<{ details: Partial<OeffentlicheVergabeDetails>; unterlagenLinks: string[] } | null> {
  try {
    console.log(`[oeffvergabe] Scrape evergabe Detailseite: ${url.slice(0, 80)}`);
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.warn(`[oeffvergabe] Detailseite Fehler: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Detect paywall / Zustellweg page
    const bodyText = $.text().toLowerCase();
    if (bodyText.includes("zustellweg") && bodyText.includes("auswählen") && bodyText.includes("login")) {
      console.log(`[oeffvergabe] Detailseite zeigt Paywall/Anmeldung`);
      return null;
    }

    // Extract details from the public /auftraege/ page
    const details: Partial<OeffentlicheVergabeDetails> = {};

    // Buyer: typically in "Auftraggeber:" or "Vergabestelle:" label
    const fullText = $.text();
    const buyerMatch = fullText.match(/(?:Auftraggeber|Vergabestelle|Contracting\s*Authority)[:\s]*([^\n]{3,80})/i);
    if (buyerMatch) details.buyer = buyerMatch[1].trim();

    // Deadline: "Bietfrist:", "Angebotsfrist:", "Deadline:"
    const deadlineMatch = fullText.match(/(?:Bietfrist|Angebotsfrist|Deadline|Frist)[:\s]*(\d{1,2}\.\d{1,2}\.\d{4}(?:\s*\d{1,2}:\d{2})?)/i);
    if (deadlineMatch) {
      const raw = deadlineMatch[1];
      const dm = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (dm) {
        details.duration = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      }
    }

    // Estimated value: "Geschätzter Wert:", "Auftragswert:", "Estimated value:"
    const valueMatch = fullText.match(/(?:Geschätzter\s*(?:Netto-?)?Wert|Auftragswert|Estimated\s*value|Gesamtwert)[:\s]*([\d.,]+\s*(?:EUR|€|EUR))/i);
    if (valueMatch) details.estimatedValue = valueMatch[1].trim();

    // Description: main content area
    const descParts: string[] = [];
    $("p, td, li, h2, h3").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30 && text.length < 2000) descParts.push(text);
    });
    if (descParts.length > 0) {
      details.description = descParts.slice(0, 10).join("\n");
    }

    // Find /unterlagen/ links (public document pages)
    const unterlagenLinks: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || !href.includes("/unterlagen/")) return;
      try {
        const absolute = new URL(href, url).href;
        const clean = absolute.split("?")[0].replace(/\/$/, "");
        if (!unterlagenLinks.includes(clean)) unterlagenLinks.push(clean);
      } catch { /* ignore */ }
    });

    // Also check page text for /unterlagen/ URLs (evergabe.de and portal variants)
    const unterlagenMatches = fullText.match(/https?:\/\/(?:www\.)?(?:evergabe\.de|evergabe\.[a-z]+\.de|vergabe\.[a-z]+\.de)\/unterlagen\/\d+/g);
    if (unterlagenMatches) {
      for (const m of unterlagenMatches) {
        const clean = m.split("?")[0].replace(/\/$/, "");
        if (!unterlagenLinks.includes(clean)) unterlagenLinks.push(clean);
      }
    }

    console.log(`[oeffvergabe] Detailseite: ${unterlagenLinks.length} Unterlagen-Links, value=${details.estimatedValue ?? "nein"}, buyer=${details.buyer ?? "nein"}`);
    return { details, unterlagenLinks };
  } catch (error) {
    console.warn(`[oeffvergabe] Detailseite Scrape fehlgeschlagen:`, error);
    return null;
  }
}

export async function enrichFromOeffentlicheVergabe(
  title: string,
  existingDescription?: string | null
): Promise<OeffentlicheVergabeDetails | null> {
  if (!title || title.length < 10) return null;

  const searchResult = await searchOeffentlicheVergabeByTitle(title);
  if (!searchResult) return null;

  // Try API first
  const details = await fetchOeffentlicheVergabeDetails(searchResult.noticeId);

  // If API found details but no evergabe docs, try the URL from the detail page
  if (details && details.evergabeDocumentUrls.length === 0 && searchResult.evergabeUrl) {
    console.log(`[oeffvergabe] Nutze evergabe.de URL von Detail-Seite: ${searchResult.evergabeUrl.slice(0, 60)}`);
    const docUrls = await fetchEvergabeDownloadUrls(searchResult.evergabeUrl);
    details.evergabeDocumentUrls = docUrls;
    if (!details.evergabeUrl) details.evergabeUrl = searchResult.evergabeUrl;
  }

  // If API returned a /unterlagen/ URL (possibly paywalled), try scraping the detail page
  if (details && details.evergabeUrl && details.evergabeUrl.includes("/unterlagen/") && details.evergabeDocumentUrls.length === 0) {
    console.log(`[oeffvergabe] /unterlagen/ URL liefert 0 Dokumente, versuche Detailseite-Scrape...`);
    const evergabePage = await scrapeEvergabeDetailPage(details.evergabeUrl);
    if (evergabePage) {
      // Merge extra details from the page
      if (!details.buyer && evergabePage.details.buyer) details.buyer = evergabePage.details.buyer;
      if (!details.estimatedValue && evergabePage.details.estimatedValue) details.estimatedValue = evergabePage.details.estimatedValue;
      if (!details.description && evergabePage.details.description) details.description = evergabePage.details.description;

      // Try /unterlagen/{numericId} links from the page
      for (const unterlagenUrl of evergabePage.unterlagenLinks) {
        if (details.evergabeDocumentUrls.length > 0) break;
        console.log(`[oeffvergabe] Versuche Unterlagen-Seite: ${unterlagenUrl.slice(0, 60)}`);
        const docUrls = await fetchEvergabeDownloadUrls(unterlagenUrl);
        if (docUrls.length > 0) {
          details.evergabeDocumentUrls = docUrls;
          details.evergabeUrl = unterlagenUrl;
          console.log(`[oeffvergabe] ${docUrls.length} Dokumente von Unterlagen-Seite gefunden`);
        }
      }
    }
  }

  // If API failed entirely, build minimal details from what we have
  if (!details && searchResult.evergabeUrl) {
    console.log(`[oeffvergabe] API fehlgeschlagen, nutze evergabe.de URL direkt`);
    const docUrls = await fetchEvergabeDownloadUrls(searchResult.evergabeUrl);
    const isPublicPortal = searchResult.evergabeUrl && !searchResult.evergabeUrl.match(/\/\/(?:www\.)?evergabe\.de\//);
    return {
      noticeId: searchResult.noticeId,
      estimatedValue: null,
      procedure: null,
      duration: null,
      buyer: null,
      contact: null,
      description: existingDescription ?? null,
      evergabeUrl: searchResult.evergabeUrl,
      evergabeDocumentUrls: docUrls,
      lotDescription: null,
      portalUrl: isPublicPortal ? searchResult.evergabeUrl : null,
    };
  }

  // Set portalUrl if the evergabe URL is a public portal (not evergabe.de paywall)
  if (details && searchResult.evergabeUrl) {
    const isPublicPortal = !searchResult.evergabeUrl.match(/\/\/(?:www\.)?evergabe\.de\//);
    if (isPublicPortal && !details.portalUrl) {
      details.portalUrl = searchResult.evergabeUrl;
    }
  }

  return details;
}
