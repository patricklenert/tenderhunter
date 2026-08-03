import OpenAI from "openai";
import * as cheerio from "cheerio";
import { scrapeWebsite, scrapeMultiple, htmlToBasicMarkdown, type ScrapedPage } from "@/lib/firecrawl";
import { callLLM } from "@/lib/llm";
import { detectAccessPage, isParticipationWallText } from "@/lib/access-page-detector";
import { extractPortalProjectId, stripSessionId } from "@/lib/tender-identity";
import { settings } from "@/lib/config";

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

function cleanTenderTitle(raw: string): string {
  let title = raw;
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
  return title;
}

async function fetchWithEncoding(url: string, timeout = 20000): Promise<string> {
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(timeout),
  });
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
  referenceNumber: string | null;
  location: string | null;
  category: TenderCategory;
  sourceUrl: string;
  source: string;
  sourceKey?: string;
  externalId?: string | null;
  pdfUrls: string[];
  url?: string;
}

interface ExtractionResult {
  tenders: ExtractedTender[];
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
  "referenceNumber": "Referenz" oder null,
  "location": "Ort/Region" oder null,
  "category": "Kategorie",
  "requirements": ["Anforderung 1", "Anforderung 2"] oder [],
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

  const normalize = (s: string) => s
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE")
    .replace(/ß/g, "ss");

  let cleaned = text;

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
  /(?:^|\s)a\)\s*öffentlicher\s+auftraggeber/i,
  /vergabestelle/i,
  /(?:^|\s)(?:telefon|fax|e-?mail|internet)\s*[A-ZÄÖÜ]/i,
  /(?:^|\s)(?:name|straße|strasse)\s*[A-ZÄÖÜ]/i,
  /angebotsfrist|teilnahmefrist|ausführungsort|erfüllungsort/i,
];

/** Returns true for portal forms accidentally persisted as tender descriptions. */
export function isRawPortalDescription(text: string): boolean {
  if (!text || text.trim().length < 20) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  const hasNoticeHeader = /bekanntmachung\s+öffentliche\s+ausschreibung/i.test(normalized);
  const markerHits = PORTAL_FORM_MARKERS.filter((pattern) => pattern.test(normalized)).length;

  return (hasNoticeHeader && markerHits >= 1) || markerHits >= 3 || isParticipationWallText(normalized);
}

/** Cleans a public description and refuses to expose raw procurement forms. */
export function cleanPublicDescription(text: string): string {
  if (isRawPortalDescription(text)) return "";
  const cleaned = cleanDescription(text);
  return isRawPortalDescription(cleaned) ? "" : cleaned;
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
    console.warn(`[public-scraper] Ueberspringe blockierte Seite (${accessPage.reason}) ${sourceUrl}`);
    return [];
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
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult;
    if (!Array.isArray(parsed.tenders)) return [];

    return parsed.tenders
      .filter((t) => {
        if (!t.title || t.title.length < 5) return false;
        if (t.category === "Sonstiges") return false;
        if (!isLikelyTender(t.title, sourceUrl)) return false;
        return true;
      })
      .map((t) => ({
        title: t.title.slice(0, 300),
        client: (t.client && t.client !== "Unbekannt" && t.client.length > 1) ? t.client : extractClientFromUrl(sourceUrl),
        deadline: t.deadline ?? null,
        description: cleanPublicDescription(t.description ?? ""),
        referenceNumber: t.referenceNumber ?? null,
        location: t.location ?? null,
        category: TENDER_CATEGORIES.includes(t.category) ? t.category : "Facility Management",
        sourceUrl: (t.url && t.url.startsWith("http")) ? t.url : sourceUrl,
        source,
        pdfUrls: Array.isArray(t.pdfUrls) ? t.pdfUrls.filter((u: string) => u.startsWith("http")) : [],
      }));
  } catch (error) {
    console.error(`[public-scraper] Extraktionsfehler fuer ${sourceUrl}:`, error);
    return [];
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
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.title || parsed.title.length < 5) return null;
    if (!isLikelyTender(parsed.title, sourceUrl)) return null;

    const category = TENDER_CATEGORIES.includes(parsed.category) ? parsed.category : "Facility Management";
    if (category === "Sonstiges" && !acceptAllCategories) return null;

    const clientName = (parsed.client && parsed.client !== "Unbekannt" && parsed.client.length > 1)
      ? String(parsed.client)
      : extractClientFromUrl(sourceUrl);

    return {
      title: cleanTenderTitle(String(parsed.title).slice(0, 300)),
      client: clientName,
      deadline: parsed.deadline ? String(parsed.deadline) : null,
      description: cleanPublicDescription(String(parsed.description ?? "")),
      referenceNumber: parsed.referenceNumber ? String(parsed.referenceNumber) : null,
      location: parsed.location ? String(parsed.location) : null,
      category,
      sourceUrl: (parsed.url && typeof parsed.url === "string" && parsed.url.startsWith("http")) ? parsed.url : sourceUrl,
      source,
      pdfUrls: Array.isArray(parsed.pdfUrls) ? parsed.pdfUrls.filter((u: string) => u.startsWith("http")) : [],
    };
  } catch (error) {
    console.error(`[public-scraper] Detail-Extraktionsfehler fuer ${sourceUrl}:`, error);
    return null;
  }
}

export function extractBasicDetailFromHtml(
  html: string,
  sourceUrl: string,
  source: string,
  pdfUrls: string[],
): ExtractedTender | null {
  const accessPage = detectAccessPage(html, { url: sourceUrl });
  if (accessPage.blocked) return null;
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
  const title = [
    titleFromDescription,
    titleFromPage,
    $("h1").first().text().trim(),
    $("h2").first().text().trim(),
  ]
    .map((candidate) => cleanTenderTitle(candidate ?? ""))
    .find((candidate) => candidate.length >= 5 && !NON_TENDER_TITLE_PATTERNS.some((pattern) => pattern.test(candidate))) ?? "";
  if (title.length < 5) return null;

  const deadline = text.match(/(?:Angebotsfrist|Abgabefrist|Ablauf der Angebotsfrist|Einreichungsfrist)[^\n]*\n?[^\n]*?(\d{1,2}\.\d{1,2}\.\d{4})/i)?.[1]
    ?? text.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/)?.[0]
    ?? null;
  const client = valueAfterSection(
    /^Ausschreibende Stelle$/i,
    /^Bezeichnung:\s*(.*)$/i,
  )
    || text.match(/(?:Auftraggeber|Vergabestelle)\s*:?\s*([^\n|]{3,120})/i)?.[1]?.trim()
    || extractClientFromUrl(sourceUrl);
  const location = text.match(/\b\d{5}\s+[A-ZÄÖÜ][\wÄÖÜäöüß .-]{2,80}/)?.[0] ?? null;
  const referenceNumber = text.match(/(?:Bekanntmachungs-ID|Vergabe-Nr\.)\s*:?\s*\n?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i)?.[1] ?? null;
  return {
    title: title.slice(0, 300),
    client,
    deadline,
    description: cleanPublicDescription(text.slice(0, 2000)),
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

// --- Source Scraper ---

async function scrapeDtvp(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] Scraping dtvp.de Detail-Seiten...");
  try {
    const searchUrl = "https://www.dtvp.de/Center/common/project/search.do?method=showExtendedSearch&fromExternal=true";
    const searchPage = await scrapeWebsite(searchUrl, { onlyMainContent: false, waitForSelector: "a[href*='projectForwarding']" });

    // Extract projectForwarding.do links from RAW HTML (not markdown which strips links)
    const linkRegex = /href=["']([^"']*projectForwarding\.do\?pid=\d+[^"']*)["']/gi;
    const detailLinks: string[] = [];
    const seenPids = new Set<string>();

    let match;
    while ((match = linkRegex.exec(searchPage.html)) !== null) {
      const url = match[1].replace(/&amp;/g, "&");
      const pidMatch = url.match(/pid=(\d+)/);
      if (pidMatch && !seenPids.has(pidMatch[1])) {
        seenPids.add(pidMatch[1]);
        const fullUrl = url.startsWith("http") ? url : `https://www.dtvp.de${url}`;
        if (url.includes("/public/")) {
          detailLinks.unshift(fullUrl);
        } else {
          detailLinks.push(fullUrl);
        }
      }
    }

    // Also check markdown as fallback
    if (detailLinks.length === 0) {
      const mdLinkRegex = /https?:\/\/[^\s"'<>]*projectForwarding\.do\?pid=\d+[^\s"'<>]*/gi;
      while ((match = mdLinkRegex.exec(searchPage.markdown)) !== null) {
        const url = match[0];
        const pidMatch = url.match(/pid=(\d+)/);
        if (pidMatch && !seenPids.has(pidMatch[1])) {
          seenPids.add(pidMatch[1]);
          detailLinks.push(url);
        }
      }
    }

    console.log(`[public-scraper] dtvp: ${detailLinks.length} Detail-Links gefunden`);

    if (detailLinks.length === 0) {
      return await extractTendersFromMarkdown(searchPage.markdown, searchUrl, "DTVP");
    }

    const tenders: ExtractedTender[] = [];

    for (const detailUrl of detailLinks.slice(0, settings.publicDetailLimit)) {
      try {
        const page = await scrapeWebsite(detailUrl, { onlyMainContent: false });
        if (!page.markdown || page.markdown.trim().length < 100) continue;

        // Extract PDF links from HTML
        const pdfUrls: string[] = [];
        const pdfRegex = /href=["']([^"']*\.pdf[^"']*)["']/gi;
        let pdfMatch;
        while ((pdfMatch = pdfRegex.exec(page.html)) !== null) {
          const pdfUrl = pdfMatch[1].replace(/&amp;/g, "&");
          const fullPdfUrl = pdfUrl.startsWith("http") ? pdfUrl : new URL(pdfUrl, detailUrl).href;
          if (!pdfUrls.includes(fullPdfUrl)) {
            pdfUrls.push(fullPdfUrl);
          }
        }

        const extracted = await extractDetailFromMarkdown(page.markdown, page.url, "DTVP", true);
        if (extracted) {
          const allPdfs = new Set([...pdfUrls, ...extracted.pdfUrls]);
          extracted.pdfUrls = Array.from(allPdfs);
          tenders.push(extracted);
        }
      } catch (err) {
        console.error(`[public-scraper] dtvp Detail Fehler:`, err);
      }
    }

    console.log(`[public-scraper] dtvp: ${tenders.length} Ausschreibungen mit Details`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] dtvp Fehler:", error);
    return [];
  }
}

async function scrapeTed(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] Scraping ted.europa.eu Detail-Seiten...");
  try {
    const searchUrl = "https://ted.europa.eu/en/search/result?country=DE";
    // TED is a heavy SPA - wait for result links to appear
    const searchPage = await scrapeWebsite(searchUrl, {
      onlyMainContent: false,
      waitForSelector: "a[href*='/notice']",
      waitMs: 3000,
    });

    // Extract notice detail links from RAW HTML
    const noticeRegex = /href=["']([^"']*\/notice\/[^"']*?(\d+-\d+)[^"']*)["']/gi;
    const noticeIds: string[] = [];
    const seenIds = new Set<string>();

    let match;
    while ((match = noticeRegex.exec(searchPage.html)) !== null) {
      const noticeId = match[2];
      if (!seenIds.has(noticeId)) {
        seenIds.add(noticeId);
        noticeIds.push(noticeId);
      }
    }

    // Fallback: also check markdown
    if (noticeIds.length === 0) {
      const mdRegex = /\/notice\/[^/]*?(\d+-\d+)/gi;
      while ((match = mdRegex.exec(searchPage.markdown)) !== null) {
        if (!seenIds.has(match[1])) {
          seenIds.add(match[1]);
          noticeIds.push(match[1]);
        }
      }
    }

    console.log(`[public-scraper] ted: ${noticeIds.length} Notice-IDs gefunden`);

    if (noticeIds.length === 0) {
      return await extractTendersFromMarkdown(searchPage.markdown, searchUrl, "TED");
    }

    const tenders: ExtractedTender[] = [];

    for (const noticeId of noticeIds.slice(0, settings.publicNoticeLimit)) {
      const detailUrl = `https://ted.europa.eu/en/notice/-/detail/${noticeId}`;
      const pdfUrl = `https://ted.europa.eu/de/notice/${noticeId}/pdf`;

      try {
        const page = await scrapeWebsite(detailUrl, { waitMs: 2000 });
        if (!page.markdown || page.markdown.trim().length < 100) continue;

        const extracted = await extractDetailFromMarkdown(page.markdown, detailUrl, "TED", true);
        if (extracted) {
          if (!isGermanText(extracted.title + " " + extracted.description)) {
            console.log(`[public-scraper] ted: Überspringe nicht-deutsche Ausschreibung: ${extracted.title?.slice(0, 60)}`);
            continue;
          }
          if (!extracted.pdfUrls.some(u => u.includes("/pdf"))) {
            extracted.pdfUrls.push(pdfUrl);
          }
          tenders.push(extracted);
        }
      } catch (err) {
        console.error(`[public-scraper] ted Detail ${noticeId} Fehler:`, err);
      }
    }

    console.log(`[public-scraper] ted: ${tenders.length} Ausschreibungen mit Details`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] ted Fehler:", error);
    return [];
  }
}

async function scrapeBauportal(): Promise<ExtractedTender[]> {
  const baseUrl = "https://www.bauportal-deutschland.de";
  const allTenders: ExtractedTender[] = [];

  console.log("[public-scraper] Scraping bauportal-deutschland.de...");
  try {
    // Scrape multiple list pages
    for (let page = 1; page <= 3; page++) {
      const listUrl = `${baseUrl}/ausschreibungen_fuer_Facility_Management_Hausverwaltung_gid_1000009_seite_${page}.html`;
      console.log(`[public-scraper] bauportal page ${page}...`);
      // Use onlyMainContent: false to get full HTML for link extraction
      const listPage = await scrapeWebsite(listUrl, { onlyMainContent: false });
      if (!listPage.html && !listPage.markdown) continue;

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
        allTenders.push(...extracted);
        continue;
      }

      const detailPages = await scrapeMultiple(detailUrls.slice(0, settings.publicDetailLimit));
      for (const detailPage of detailPages) {
        const extracted = await extractDetailFromMarkdown(detailPage.markdown, detailPage.url, "bauportal-deutschland.de");
        if (extracted) allTenders.push(extracted);
      }
    }

    return allTenders;
  } catch (error) {
    console.error("[public-scraper] bauportal Fehler:", error);
    return allTenders;
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

async function scrapeEvergabe(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] Direktes Scraping: evergabe.de...");
  try {
    const listUrl = "https://www.evergabe.de/auftraege/auftrag-suchen";

    // evergabe.de is server-rendered (Rails) — use fetch instead of Playwright
    const response = await fetch(listUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    console.log(`[public-scraper] evergabe: listing HTML ${html.length} bytes`);

    // Extract /ausschreibung/<slug>-<id> links from raw HTML
    const linkRegex = /href=["'](\/ausschreibung\/[^"']+)["']/gi;
    const detailPaths: string[] = [];
    const seen = new Set<string>();
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const path = match[1].split("?")[0];
      if (!seen.has(path)) {
        seen.add(path);
        detailPaths.push(path);
      }
    }

    console.log(`[public-scraper] evergabe: ${detailPaths.length} Detail-Links gefunden`);

    if (detailPaths.length === 0) {
      return [];
    }

    const tenders: ExtractedTender[] = [];
    for (const path of detailPaths.slice(0, settings.publicDetailLimit)) {
      try {
        const detailUrl = `https://www.evergabe.de${path}`;
        const page = await scrapeWebsite(detailUrl, { onlyMainContent: false });
        if (!page.markdown || page.markdown.trim().length < 100) continue;

        // Extract PDF links from HTML
        const pdfUrls: string[] = [];
        const pdfRegex = /href=["']([^"']*\.pdf[^"']*)["']/gi;
        let pdfMatch;
        while ((pdfMatch = pdfRegex.exec(page.html)) !== null) {
          const pdfUrl = pdfMatch[1].replace(/&amp;/g, "&");
          const fullPdfUrl = pdfUrl.startsWith("http") ? pdfUrl : new URL(pdfUrl, detailUrl).href;
          if (!pdfUrls.includes(fullPdfUrl)) pdfUrls.push(fullPdfUrl);
        }

        // Evergabe: Vergabeunterlagen von Documents-Seite holen
        const docPdfUrls = await fetchEvergabeDocumentUrls(page.html, detailUrl);

        const extracted = await extractDetailFromMarkdown(page.markdown, page.url, "evergabe.de", true);
        if (extracted) {
          const allPdfs = new Set([...pdfUrls, ...docPdfUrls, ...extracted.pdfUrls]);
          extracted.pdfUrls = Array.from(allPdfs);
          tenders.push(extracted);
        }
      } catch (err) {
        console.error(`[public-scraper] evergabe Detail Fehler:`, err);
      }
    }

    console.log(`[public-scraper] evergabe: ${tenders.length} Ausschreibungen mit Details`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] evergabe Fehler:", error);
    return [];
  }
}

async function scrapeBundesimmobilien(): Promise<ExtractedTender[]> {
  const url = "https://www.bundesimmobilien.de/ausschreibungen-cc3b21db72191aeb";
  console.log("[public-scraper] Direktes Scraping: bundesimmobilien.de...");
  try {
    const page = await scrapeWebsite(url, { onlyMainContent: false });
    if (!page.markdown || page.markdown.trim().length < 200) {
      console.log("[public-scraper] bundesimmobilien: Kein Content");
      return [];
    }
    const extracted = await extractTendersFromMarkdown(page.markdown, url, "bundesimmobilien.de");
    console.log(`[public-scraper] bundesimmobilien: ${extracted.length} Tenders`);
    return extracted;
  } catch (error) {
    console.error("[public-scraper] bundesimmobilien Fehler:", error);
    return [];
  }
}

// --- New Sources: State Portals ---

async function scrapeVergabeNiedersachsen(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] Direktes Scraping: vergabe.niedersachsen.de...");
  try {
    const listUrl = "https://vergabe.niedersachsen.de/Satellite/company/welcome.do?method=showTable&fromSearch=1";

    // Server-rendered page — use fetch instead of Playwright
    const response = await fetch(listUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();

    // Extract projectForwarding.do?pid= links
    const linkRegex = /href=["']([^"'']*projectForwarding\.do\?pid=\d+[^"']*)["']/gi;
    const detailLinks: string[] = [];
    const seenPids = new Set<string>();
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1].replace(/&amp;/g, "&");
      const pidMatch = url.match(/pid=(\d+)/);
      if (pidMatch && !seenPids.has(pidMatch[1])) {
        seenPids.add(pidMatch[1]);
        const fullUrl = url.startsWith("http") ? url : `https://vergabe.niedersachsen.de${url.startsWith("/") ? "" : "/Satellite/"}${url}`;
        detailLinks.push(fullUrl);
      }
    }

    console.log(`[public-scraper] niedersachsen: ${detailLinks.length} Detail-Links gefunden`);

    if (detailLinks.length === 0) {
      return [];
    }

    const tenders: ExtractedTender[] = [];
    for (const detailUrl of detailLinks.slice(0, settings.publicDetailLimit)) {
      try {
        const page = await scrapeWebsite(detailUrl, { onlyMainContent: false });
        if (!page.markdown || page.markdown.trim().length < 100) continue;

        const extracted = await extractDetailFromMarkdown(page.markdown, page.url, "vergabe.niedersachsen.de", true);
        if (extracted) tenders.push(extracted);
      } catch (err) {
        console.error(`[public-scraper] niedersachsen Detail Fehler:`, err);
      }
    }

    console.log(`[public-scraper] niedersachsen: ${tenders.length} Ausschreibungen mit Details`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] niedersachsen Fehler:", error);
    return [];
  }
}

async function scrapeEvergabeNrw(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] Direktes Scraping: evergabe.nrw.de...");
  const portalStartTime = Date.now();
  const PORTAL_MAX_MS = 5 * 60 * 1000;
  try {
    // Step 1: Fetch category overview to get CPV codes
    const overviewUrl = "https://www.evergabe.nrw.de/VMPCenter/company/announcements/categoryOverview.do?method=showCategoryOverview";
    const overviewResp = await fetch(overviewUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
    });
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

    if (cpvCodes.length === 0) return [];

    // Step 2: For each CPV code, get projectForwarding.do links from first page
    const forwardingLinks: { pid: string; cpvCode: string }[] = [];
    const seenPids = new Set<string>();

    for (const cpvCode of cpvCodes) {
      try {
        const tableUrl = `https://www.evergabe.nrw.de/VMPCenter/company/announcements/categoryOverview.do?method=showTable&cpvCode=${cpvCode}`;
        const tableResp = await fetch(tableUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(15000),
        });
        const tableHtml = await tableResp.text();

        const pidRegex = /projectForwarding\.do\?pid=(\d+)/g;
        let pidMatch;
        while ((pidMatch = pidRegex.exec(tableHtml)) !== null) {
          if (!seenPids.has(pidMatch[1])) {
            seenPids.add(pidMatch[1]);
            forwardingLinks.push({ pid: pidMatch[1], cpvCode });
          }
        }
      } catch (err) {
        console.warn(`[public-scraper] evergabe-nrw CPV ${cpvCode} Fehler:`, err);
      }
    }

    console.log(`[public-scraper] evergabe-nrw: ${forwardingLinks.length} einzigartige Projekt-Links`);

    if (forwardingLinks.length === 0) return [];

    // Step 3: Follow redirects and scrape detail pages
    const tenders: ExtractedTender[] = [];

    for (const { pid, cpvCode } of forwardingLinks.slice(0, 100)) {
      // Check per-portal timeout — return partial results
      if (Date.now() - portalStartTime > PORTAL_MAX_MS) {
        console.warn(`[public-scraper] evergabe-nrw: Portal-Timeout nach ${((Date.now() - portalStartTime) / 1000).toFixed(0)}s, breche ab mit ${tenders.length} Tenders`);
        break;
      }
      try {
        const forwardingUrl = `https://www.evergabe.nrw.de/VMPCenter/public/company/projectForwarding.do?pid=${pid}`;

        // Follow redirect to get actual portal URL
        const detailResp = await fetch(forwardingUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        const detailBuf = Buffer.from(await detailResp.arrayBuffer());
        const detailUrl = detailResp.url;
        // Detect encoding: check Content-Type header, then HTML meta tag
        const ct = detailResp.headers.get("content-type") ?? "";
        const cm = ct.match(/charset=([^\s;]+)/i);
        let enc = cm?.[1]?.toLowerCase() ?? "";
        if (!enc) {
          const head = detailBuf.toString("ascii", 0, Math.min(2000, detailBuf.length));
          const mm = head.match(/charset[=:]\\s*"?([a-z0-9_-]+)/i);
          enc = mm?.[1]?.toLowerCase() ?? "";
        }
        const detailHtml = (enc.includes("latin") || enc.includes("iso-8859") || enc.includes("windows-1252"))
          ? detailBuf.toString("latin1")
          : detailBuf.toString("utf-8");

        if (!detailHtml || detailHtml.length < 500) continue;

        // Extract Bekanntmachung.pdf link
        const pdfUrls: string[] = [];
        const pdfRegex = /href=["']([^"']*\.pdf[^"']*)["']/gi;
        let pdfMatch;
        while ((pdfMatch = pdfRegex.exec(detailHtml)) !== null) {
          let href = pdfMatch[1].replace(/&amp;/g, "&").replace(/;jsessionid=[^"']*/, "");
          if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
          try {
            const resolved = new URL(href, detailUrl).href;
            if (!pdfUrls.includes(resolved)) pdfUrls.push(resolved);
          } catch { /* ignore */ }
        }

        // Try to get content from Bekanntmachung.pdf first (faster than Playwright)
        let contentForLLM = "";
        for (const pdfUrl of pdfUrls) {
          try {
            const pdfResp = await fetch(pdfUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
              signal: AbortSignal.timeout(15000),
            });
            if (!pdfResp.ok) continue;
            const contentType = pdfResp.headers.get("content-type") ?? "";
            if (!contentType.includes("pdf")) continue;
            const buf = await pdfResp.arrayBuffer();
            if (buf.byteLength < 1000) continue;

            // Save to temp file and parse
            const tmpPath = `/tmp/evergabe-nrw-${pid}.pdf`;
            const { writeFileSync } = await import("fs");
            writeFileSync(tmpPath, Buffer.from(buf));
            const { extractTextFromFile } = await import("@/lib/parser");
            contentForLLM = (await extractTextFromFile(tmpPath, "application/pdf")).text;
            if (contentForLLM && contentForLLM.length > 100) break;
          } catch { /* try next PDF */ }
        }

        // Fallback: use Playwright to scrape the detail page
        if (!contentForLLM || contentForLLM.length < 100) {
          const page = await scrapeWebsite(detailUrl, { onlyMainContent: false });
          contentForLLM = page.markdown ?? "";
        }

        if (!contentForLLM || contentForLLM.trim().length < 100) continue;

        const extracted = await extractDetailFromMarkdown(contentForLLM, detailUrl, "evergabe.nrw.de", true);
        if (extracted) {
          const allPdfs = new Set([...pdfUrls, ...extracted.pdfUrls]);
          extracted.pdfUrls = Array.from(allPdfs);
          if (!extracted.sourceUrl || extracted.sourceUrl.includes("projectForwarding")) {
            extracted.sourceUrl = detailUrl;
          }
          tenders.push(extracted);
        }
      } catch (err) {
        console.error(`[public-scraper] evergabe-nrw Detail Fehler (PID ${pid}):`, err);
      }
    }

    console.log(`[public-scraper] evergabe-nrw: ${tenders.length} Ausschreibungen mit Details`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] evergabe-nrw Fehler:", error);
    return [];
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

async function scrapeNrwPortal(config: NrwPortalConfig): Promise<ExtractedTender[]> {
  console.log(`[public-scraper] NRW-Portal: ${config.name} (${config.baseUrl})...`);
  const portalStartTime = Date.now();
  const PORTAL_MAX_MS = 5 * 60 * 1000; // 5 min (etwas weniger als der7-min Per-Portal-Timeout, inkl. CPV-Iteration)
  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    // Helper: fetch with encoding detection (ISO-8859-1 for RLP/Brandenburg VMP portals)
    const fetchHtml = async (url: string): Promise<string> => {
      const resp = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      const buf = Buffer.from(await resp.arrayBuffer());
      const ct = resp.headers.get("content-type") ?? "";
      const cm = ct.match(/charset=([^\s;]+)/i);
      let enc = cm?.[1]?.toLowerCase() ?? "";
      if (!enc) {
        const head = buf.toString("ascii", 0, Math.min(2000, buf.length));
        const mm = head.match(/charset[=:]\s*"?([a-z0-9_-]+)/i);
        enc = mm?.[1]?.toLowerCase() ?? "";
      }
      return (enc.includes("latin") || enc.includes("iso-8859") || enc.includes("windows-1252"))
        ? buf.toString("latin1")
        : buf.toString("utf-8");
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
      if (cpvCodes.length === 0) return [];
    }

    // Compute path prefix once for all URLs
    const pathPrefix = config.pathPrefix ?? (config.baseUrl.includes("blb.nrw.de") ? "/Vergabe"
      : config.overviewPath.includes("/Satellite/") ? "/Satellite"
      : config.overviewPath.includes("/VMPCenter/") ? "/VMPCenter"
      : "/VMPSatellite");

    const maxPages = config.maxPages ?? 10;
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
    const forwardingLinks: { pid: string; cpvCode: string }[] = [];
    const seenPids = new Set<string>();

    for (const cpvCode of cpvCodes) {
      try {
        const tableUrl = `${config.baseUrl}${pathPrefix}/company/announcements/categoryOverview.do?method=showTable&cpvCode=${cpvCode}`;
        const pendingPages = [tableUrl];
        const visitedPages = new Set<string>();
        while (pendingPages.length > 0 && visitedPages.size < maxPages) {
          const currentUrl = pendingPages.shift()!;
          if (visitedPages.has(currentUrl)) continue;
          visitedPages.add(currentUrl);
          const tableHtml = await fetchHtml(currentUrl);

          // PID regex works for both /VMPSatellite/ and /Vergabe/ paths
          const pidRegex = /projectForwarding\.do\?pid=(\d+)/g;
          let pidMatch;
          while ((pidMatch = pidRegex.exec(tableHtml)) !== null) {
            if (!seenPids.has(pidMatch[1])) {
              seenPids.add(pidMatch[1]);
              forwardingLinks.push({ pid: pidMatch[1], cpvCode });
            }
          }
          for (const nextUrl of parsePaginationUrls(tableHtml, currentUrl)) {
            if (!visitedPages.has(nextUrl) && !pendingPages.includes(nextUrl)) pendingPages.push(nextUrl);
          }
        }
      } catch (err) {
        console.warn(`[public-scraper] ${config.name} CPV ${cpvCode} Fehler:`, err);
      }
    }

    // Also try the welcome.do listing page (some portals list PIDs there)
    try {
      const welcomeHtml = await fetchHtml(`${config.baseUrl}${pathPrefix}/company/welcome.do`);
      const pidRegex = /projectForwarding\.do\?pid=(\d+)/g;
      let pidMatch;
      while ((pidMatch = pidRegex.exec(welcomeHtml)) !== null) {
        if (!seenPids.has(pidMatch[1])) {
          seenPids.add(pidMatch[1]);
          forwardingLinks.push({ pid: pidMatch[1], cpvCode: "welcome" });
        }
      }
    } catch { /* ignore */ }

    console.log(`[public-scraper] ${config.name}: ${forwardingLinks.length} einzigartige Projekt-Links`);

    if (forwardingLinks.length === 0) return [];

    // Step 3: Scrape detail pages
    const tenders: ExtractedTender[] = [];

    for (const { pid } of forwardingLinks.slice(0, config.limit)) {
      // Check per-portal timeout — return partial results instead of losing everything
      if (Date.now() - portalStartTime > PORTAL_MAX_MS) {
        console.warn(`[public-scraper] ${config.name}: Portal-Timeout nach ${((Date.now() - portalStartTime) / 1000).toFixed(0)}s, breche ab mit ${tenders.length} Tenders`);
        break;
      }
      try {
        const forwardingUrl = `${config.baseUrl}${pathPrefix}/public/company/projectForwarding.do?pid=${pid}`;

        const detailResp = await fetch(forwardingUrl, {
          headers: { "User-Agent": UA },
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
        });
        const detailBuf = Buffer.from(await detailResp.arrayBuffer());
        const detailUrl = detailResp.url;
        const ct2 = detailResp.headers.get("content-type") ?? "";
        const cm2 = ct2.match(/charset=([^\s;]+)/i);
        let enc2 = cm2?.[1]?.toLowerCase() ?? "";
        if (!enc2) {
          const head2 = detailBuf.toString("ascii", 0, Math.min(2000, detailBuf.length));
          const mm2 = head2.match(/charset[=:]\\s*"?([a-z0-9_-]+)/i);
          enc2 = mm2?.[1]?.toLowerCase() ?? "";
        }
        const detailHtml = (enc2.includes("latin") || enc2.includes("iso-8859") || enc2.includes("windows-1252"))
          ? detailBuf.toString("latin1")
          : detailBuf.toString("utf-8");

        if (!detailHtml || detailHtml.length < 500) continue;

        // Extract PDF links
        const pdfUrls: string[] = [];
        const $ = cheerio.load(detailHtml);
        $("a[href$='.pdf'], a[href*='.pdf?']").each((_, el) => {
          const href = $(el).attr("href");
          if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;
          try {
            const resolved = new URL(href, detailUrl).href.replace(/;jsessionid=[^"']*/, "");
            if (!pdfUrls.includes(resolved)) pdfUrls.push(resolved);
          } catch { /* ignore */ }
        });

        // Try PDF first (faster than Playwright)
        let contentForLLM = "";
        for (const pdfUrl of pdfUrls.slice(0, 3)) {
          try {
            const pdfResp = await fetch(pdfUrl, {
              headers: { "User-Agent": UA },
              signal: AbortSignal.timeout(15000),
            });
            if (!pdfResp.ok) continue;
            const contentType = pdfResp.headers.get("content-type") ?? "";
            if (!contentType.includes("pdf")) continue;
            const buf = await pdfResp.arrayBuffer();
            if (buf.byteLength < 1000) continue;

            const tmpPath = `/tmp/nrw-${config.name}-${pid}.pdf`;
            const { writeFileSync } = await import("fs");
            writeFileSync(tmpPath, Buffer.from(buf));
            const { extractTextFromFile } = await import("@/lib/parser");
            contentForLLM = (await extractTextFromFile(tmpPath, "application/pdf")).text;
            if (contentForLLM && contentForLLM.length > 100) break;
          } catch { /* try next PDF */ }
        }

        // Fallback: use Cheerio to extract text from detail page (faster than Playwright)
        if (!contentForLLM || contentForLLM.length < 100) {
          const $page = cheerio.load(detailHtml);
          $page("script, style, nav, header, footer").remove();
          contentForLLM = htmlToBasicMarkdown($page("body").html() ?? "");
        }

        if (!contentForLLM || contentForLLM.trim().length < 100) continue;

        const extracted = await extractDetailFromMarkdown(contentForLLM, detailUrl, config.name, true)
          ?? extractBasicDetailFromHtml(detailHtml, detailUrl, config.name, pdfUrls);
        if (extracted) {
          const allPdfs = new Set([...pdfUrls, ...extracted.pdfUrls]);
          extracted.pdfUrls = Array.from(allPdfs);
          // The redirect target contains a transient JSESSIONID. Keep the
          // stable forwarding URL for users and use the portal project ID as
          // the identity across scrape sessions.
          extracted.sourceUrl = forwardingUrl;
          extracted.externalId = extractPortalProjectId(detailUrl) ?? `pid:${pid}`;
          tenders.push(extracted);
        }
      } catch (err) {
        console.error(`[public-scraper] ${config.name} Detail Fehler (PID ${pid}):`, err);
      }
    }

    console.log(`[public-scraper] ${config.name}: ${tenders.length} Ausschreibungen`);
    return tenders;
  } catch (error) {
    console.error(`[public-scraper] ${config.name} Fehler:`, error);
    return [];
  }
}

// --- Berlin Vergabeplattform (RSS Feed) ---

export async function scrapeBerlinHtml(): Promise<ExtractedTender[]> {
  const BASE_URL = "https://www.berlin.de/vergabeplattform/veroeffentlichungen/bekanntmachungen/";
  const MAX_PAGES = 20;
  const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  console.log(`[public-scraper] Berlin HTML: Scrape ${MAX_PAGES} Seiten...`);

  const tenders: ExtractedTender[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * 10;
    const url = offset === 0 ? BASE_URL : `${BASE_URL}?start=${offset}`;
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      const html = await resp.text();
      const $ = cheerio.load(html);

      const articles = $("article.modul-card");
      if (articles.length === 0) {
        console.log(`[public-scraper] Berlin HTML: Seite ${page + 1} leer, stoppe. (HTML: ${html.length} bytes)`);
        break;
      }

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

          tenders.push({
            title: cleanTenderTitle(title),
            client: "",
            deadline: cleanDeadline || null,
            description: descParts.join(". ") + ".",
            referenceNumber: dataId ?? null,
            location: ausfuehrungsort || null,
            category: "Sonstiges",
            sourceUrl,
            source: "berlin-html",
            pdfUrls: [],
          });
        } catch (err) {
          console.warn(`[public-scraper] Berlin HTML Artikel Fehler:`, err);
        }
      });

      console.log(`[public-scraper] Berlin HTML: Seite ${page + 1}: ${articles.length} Artikel (gesamt: ${tenders.length})`);

      // Delay between pages to avoid rate limiting
      if (page < MAX_PAGES - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.warn(`[public-scraper] Berlin HTML Seite ${page + 1} Fehler:`, err);
      break;
    }
  }

  // Enrich FIRST 15 tenders with detail page content via Playwright (for meinauftrag.rib.de links)
  const { scrapeWebsite: scrapeWithPlaywright } = await import("@/lib/firecrawl");
  let enriched = 0;
  const MAX_ENRICH = 15;
  for (const tender of tenders) {
    if (enriched >= MAX_ENRICH) break;
    if (!tender.sourceUrl.includes("meinauftrag.rib.de")) continue;
    try {
      const page = await scrapeWithPlaywright(tender.sourceUrl, {
        waitUntil: "networkidle",
        waitMs: 5000,
        onlyMainContent: false,
        useBodyText: true,
      });
      const md = page.markdown ?? "";
      const berlinEnrichAccess = detectAccessPage(md, { url: tender.sourceUrl });
      if (md.length > 200 && !berlinEnrichAccess.blocked) {
        // Use detail page content as description
        tender.description = md.substring(0, 30000);
        enriched++;
        // Try to extract PDF links
        if (page.html) {
          const pdfMatches = page.html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi);
          for (const m of pdfMatches) {
            const href = m[1];
            if (href && !href.includes("favicon")) {
              const fullUrl = href.startsWith("http") ? href : `https://meinauftrag.rib.de${href}`;
              if (!tender.pdfUrls.includes(fullUrl)) tender.pdfUrls.push(fullUrl);
            }
          }
        }
      }
    } catch (e) {
      // Silent fail — we still have the listing page data
    }
  }

  console.log(`[public-scraper] Berlin HTML: ${tenders.length} Tenders, ${enriched} mit Detail-Seiten`);
  return tenders;
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
  const $ = cheerio.load(html);
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
      addRow({
        oid,
        title: $(cells[1]).text().trim(),
        client: $(cells[2]).text().trim(),
        deadline: $(cells[5]).text().trim(),
        procedure: $(cells[3]).text().trim(),
      });
      return;
    }

    const text = $row.text().replace(/\s+/g, " ").trim();
    addRow({
      oid,
      title: text.match(/Bezeichnung\s+(.+?)(?:\s+Vergabenummer|\s+Art:)/)?.[1]?.trim() ?? "",
      client: text.match(/Vergabestelle:\s+(.+?)(?:\s+Abgabefrist|\s+Art:)/)?.[1]?.trim() ?? "",
      deadline: text.match(/Abgabefrist:\s+(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/)?.[1]?.trim() ?? "",
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
];

export async function scrapeNetPortal(config: NetServerConfig): Promise<ExtractedTender[]> {
  console.log(`[public-scraper] NetServer: ${config.name} (${config.baseUrl})...`);
  const portalStartTime = Date.now();
  const PORTAL_MAX_MS = 5 * 60 * 1000;
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
      return execSync(`curl -s -L -H "User-Agent: ${UA}" "${url}"`, {
        maxBuffer: 5 * 1024 * 1024,
        timeout: 25000,
      }).toString();
    };

    const pageHtmls: Array<{ url: string; html: string }> = [];
    const pendingPages = [searchUrl];
    const visitedPages = new Set<string>();
    while (pendingPages.length > 0 && visitedPages.size < 10) {
      const currentUrl = pendingPages.shift()!;
      if (visitedPages.has(currentUrl)) continue;
      visitedPages.add(currentUrl);
      const html = await fetchHtml(currentUrl);
      pageHtmls.push({ url: currentUrl, html });
      if (config.followPagination) {
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

    const isBerlin = config.name === "berlin";
    const berlinPlaywrightLimit = 10;
    let berlinPlaywrightCount = 0;
    const tenders: ExtractedTender[] = [];
    for (const row of rows.slice(0, config.limit)) {
      // Check per-portal timeout — return partial results
      if (Date.now() - portalStartTime > PORTAL_MAX_MS) {
        console.warn(`[public-scraper] ${config.name}: Portal-Timeout nach ${((Date.now() - portalStartTime) / 1000).toFixed(0)}s, breche ab mit ${tenders.length} Tenders`);
        break;
      }
      try {
        const detailUrl = await resolveNetServerDetailUrl(config, row, UA);

        let bodyText = "";
        if (isBerlin && berlinPlaywrightCount < berlinPlaywrightLimit) {
          // Berlin NetServer is a SPA — use Playwright to render detail pages (limited)
          berlinPlaywrightCount++;
          try {
            const { scrapeWebsite: scrapeWithPlaywright } = await import("@/lib/firecrawl");
            const page = await scrapeWithPlaywright(detailUrl, {
              waitUntil: "networkidle",
              waitMs: 5000,
              onlyMainContent: false,
              useBodyText: true,
            });
            bodyText = page.markdown ?? "";
            const berlinAccess = detectAccessPage(bodyText, { url: detailUrl });
            if (bodyText.length < 200 || berlinAccess.blocked) {
              bodyText = ""; // SPA returned T&C/access wall, fall back to table data
            }
          } catch (e) {
            console.warn(`[public-scraper] ${config.name} Playwright Fehler (OID ${row.oid}):`, e);
          }
        } else {
          // landbw/hessen/muenchen: fetch with curl fallback for bot protection
          const detailResp = await fetch(detailUrl, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(15000),
          });
          let detailHtml: string;
          if (detailResp.ok) {
            detailHtml = await detailResp.text();
          } else {
            const { execSync: execSyncDetail } = await import("child_process");
            detailHtml = execSyncDetail(`curl -s -L -H "User-Agent: ${UA}" "${detailUrl}"`, {
              maxBuffer: 5 * 1024 * 1024,
              timeout: 20000,
            }).toString();
          }
          const $detail = cheerio.load(detailHtml);
          $detail("script, style, nav, header, footer").remove();
          bodyText = htmlToBasicMarkdown($detail("body").html() ?? "");
        }

        // If we have rich detail content, use LLM extraction
        if (bodyText && bodyText.length > 200) {
          const extracted = await extractDetailFromMarkdown(bodyText, detailUrl, config.name, true);
          if (extracted) {
            // Check if LLM returned generic/useless title — fall back to table data
            const isGenericTitle = !extracted.title || extracted.title.length < 5 ||
              /^(Ausschreibung der|Keine Ausschreibung|Keine Details|Zugriff verweigert|Unbekannter Titel|Öffentliche Ausschreibung der)/i.test(extracted.title);
            if (isGenericTitle && row.title.length > 5) {
              extracted.title = cleanTenderTitle(row.title);
            }
            if (!extracted.client || extracted.client.length < 3) extracted.client = row.client;
            if (!extracted.deadline) extracted.deadline = row.deadline;
            if (!extracted.sourceUrl) extracted.sourceUrl = detailUrl;
            extracted.externalId = row.oid;
            // If description is too short, use table procedure info
            if (!extracted.description || extracted.description.length < 30) {
              extracted.description = row.procedure ? `Verfahrensart: ${row.procedure}` : "";
            }
            tenders.push(extracted);
            continue;
          }
        }

        // Fallback: create tender from table data only (no LLM call)
        if (row.title.length > 5) {
          tenders.push({
            title: cleanTenderTitle(row.title),
            client: row.client || "",
            deadline: row.deadline || null,
            description: row.procedure ? `Verfahrensart: ${row.procedure}` : "",
            referenceNumber: row.oid,
            externalId: row.oid,
            location: null,
            category: "Sonstiges",
            sourceUrl: detailUrl,
            source: config.name,
            pdfUrls: [],
          });
        }
      } catch (err) {
        console.warn(`[public-scraper] ${config.name} Detail Fehler (OID ${row.oid}):`, err);
      }
    }

    console.log(`[public-scraper] ${config.name}: ${tenders.length} Ausschreibungen`);
    return tenders;
  } catch (error) {
    console.error(`[public-scraper] ${config.name} Fehler:`, error);
    return [];
  }
}

// --- e-vergabe-sh.de (Schleswig-Holstein) ---

async function scrapeEVergabeSh(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] e-vergabe-sh.de...");
  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const listUrl = "https://www.e-vergabe-sh.de/vergabeverfahren/aktuelle-vergabeverfahren";
    const resp = await fetch(listUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    const html = await resp.text();
    const $ = cheerio.load(html);

    const tenders: ExtractedTender[] = [];
    // Find tender links — they have aria-label starting with "Bekanntmachung"
    const links: { title: string; url: string }[] = [];
    $("a[aria-label^='Bekanntmachung']").each((_, el) => {
      const $el = $(el);
      const ariaLabel = $el.attr("aria-label") ?? "";
      const href = $el.attr("href") ?? "";
      const title = ariaLabel.replace(/^Bekanntmachung\s+/, "").replace(/\s+auf externer Vergabeplattform öffnen$/, "").trim();
      if (href && title.length > 5 && href.startsWith("http")) {
        links.push({ title, url: href });
      }
    });

    console.log(`[public-scraper] e-vergabe-sh: ${links.length} Bekanntmachungen gefunden`);

    for (const link of links.slice(0, settings.publicDetailLimit)) {
      try {
        // The links point to external platforms — try to scrape them
        const detailResp = await fetch(link.url, {
          headers: { "User-Agent": UA },
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        const detailHtml = await detailResp.text();
        const $detail = cheerio.load(detailHtml);
        $detail("script, style, nav, header, footer").remove();
        const bodyText = htmlToBasicMarkdown($detail("body").html() ?? "");

        if (!bodyText || bodyText.length < 100) continue;

        const extracted = await extractDetailFromMarkdown(bodyText, link.url, "e-vergabe-sh", true);
        if (extracted) {
          if (!extracted.title || extracted.title.length < 5) extracted.title = cleanTenderTitle(link.title);
          if (!extracted.sourceUrl) extracted.sourceUrl = link.url;
          tenders.push(extracted);
        }
      } catch (err) {
        console.warn(`[public-scraper] e-vergabe-sh Detail Fehler:`, err);
      }
    }

    console.log(`[public-scraper] e-vergabe-sh: ${tenders.length} Ausschreibungen`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] e-vergabe-sh Fehler:", error);
    return [];
  }
}

// --- verwaltung.thueringen.de (Thüringen) ---

async function scrapeThueringen(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] thueringen.de...");
  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const listUrl = "https://verwaltung.thueringen.de/evergabe";
    const resp = await fetch(listUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    const html = await resp.text();
    const $ = cheerio.load(html);

    const tenders: ExtractedTender[] = [];
    const rows: { title: string; url: string; deadline: string }[] = [];

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
        rows.push({ title, url, deadline });
      }
    });

    console.log(`[public-scraper] thueringen: ${rows.length} Zeilen in Tabelle`);

    for (const row of rows.slice(0, settings.publicDetailLimit)) {
      try {
        const detailResp = await fetch(row.url, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(15000),
        });
        const detailHtml = await detailResp.text();
        const $detail = cheerio.load(detailHtml);
        $detail("script, style, nav, header, footer").remove();
        const bodyText = htmlToBasicMarkdown($detail("body").html() ?? "");

        if (!bodyText || bodyText.length < 100) continue;

        const extracted = await extractDetailFromMarkdown(bodyText, row.url, "thueringen", true);
        if (extracted) {
          if (!extracted.title || extracted.title.length < 5) extracted.title = cleanTenderTitle(row.title);
          if (!extracted.deadline && row.deadline) extracted.deadline = row.deadline;
          if (!extracted.sourceUrl) extracted.sourceUrl = row.url;
          tenders.push(extracted);
        }
      } catch (err) {
        console.warn(`[public-scraper] thueringen Detail Fehler:`, err);
      }
    }

    console.log(`[public-scraper] thueringen: ${tenders.length} Ausschreibungen`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] thueringen Fehler:", error);
    return [];
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

async function scrapeBayernApi(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] auftraege.bayern.de API...");
  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const apiUrl = "https://www.auftraege.bayern.de/dashboards/GetPresentationTenderList?id=V&BL=09&CPV=&startid=";
    const resp = await fetch(apiUrl, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data: BayernTender[] = await resp.json();
    console.log(`[public-scraper] bayern-api: ${data.length} Eintraege von API`);

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
        referenceNumber: item.Aktenzeichen || null,
        location: item.APLZ || "Bayern",
        category,
        sourceUrl: detailUrl,
        source: "auftraege-bayern",
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
    return filtered;
  } catch (error) {
    console.error("[public-scraper] bayern-api Fehler:", error);
    return [];
  }
}

// --- hamburg.de HTML (Hamburg) ---

async function scrapeHamburgDe(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] hamburg.de...");
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
        if (!resp.ok) { console.warn(`[public-scraper] hamburg-de ${page.label}: HTTP ${resp.status}`); continue; }
        const html = await resp.text();
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
      }
    }

    console.log(`[public-scraper] hamburg-de: ${allLinks.length} Links gefunden`);

    const tenders: ExtractedTender[] = [];
    for (const link of allLinks.slice(0, settings.publicSearchLimit)) {
      try {
        const resp = await fetch(link.url, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) continue;
        const html = await resp.text();
        const $ = cheerio.load(html);
        $("script, style, nav, header, footer, .navigation, .breadcrumb").remove();
        const bodyText = htmlToBasicMarkdown($("body").html() ?? "");
        if (bodyText.length < 100) continue;

        const extracted = await extractDetailFromMarkdown(bodyText, link.url, "hamburg-de", true);
        if (extracted) {
          if (!extracted.title || extracted.title.length < 5) extracted.title = cleanTenderTitle(link.title);
          if (!extracted.sourceUrl) extracted.sourceUrl = link.url;
          tenders.push(extracted);
        }
      } catch (err) {
        console.warn(`[public-scraper] hamburg-de Detail Fehler:`, err);
      }
    }

    console.log(`[public-scraper] hamburg-de: ${tenders.length} Ausschreibungen`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] hamburg-de Fehler:", error);
    return [];
  }
}

// --- service.bund.de RSS (Bayern + Hamburg) ---

async function scrapeBundRss(): Promise<ExtractedTender[]> {
  console.log("[public-scraper] service.bund.de RSS...");
  try {
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const rssUrl = "https://www.service.bund.de/Content/DE/Ausschreibungen/Suche/Formular.html?nn=4641482&resultsPerPage=100&sortOrder=dateOfIssue_dt+desc&jobsrss=true";
    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();

    // Simple XML parsing — no fast-xml-parser needed for RSS
    const items: { title: string; link: string; description: string; pubDate: string }[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const getTag = (tag: string) => {
        const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : "";
      };
      items.push({
        title: getTag("title"),
        link: getTag("link"),
        description: getTag("description"),
        pubDate: getTag("pubDate"),
      });
    }

    console.log(`[public-scraper] bund-rss: ${items.length} Items im Feed`);

    // Filter for Bayern and Hamburg
    const bundeslaender = ["bayern", "hamburg", "münchen", "muenchen", "nürnberg", "nuernberg", "augsburg", "regensburg", "würzburg", "wuerzburg", "ingolstadt", "fürth", "fuert", "erlangen", "bamberg", "landshut", "bayreuth", "kempten", "passau", "coburg", "schweinfurt", "hof"];
    const filtered = items.filter((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return bundeslaender.some((bl) => text.includes(bl));
    });

    console.log(`[public-scraper] bund-rss: ${filtered.length} Bayern/Hamburg Items`);

    const tenders: ExtractedTender[] = [];
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
        referenceNumber: null,
        location,
        category: "Sonstiges",
        sourceUrl: item.link || `https://www.service.bund.de`,
        source: "bund-rss",
        pdfUrls: [],
      });
    }

    console.log(`[public-scraper] bund-rss: ${tenders.length} Ausschreibungen (Bayern/Hamburg)`);
    return tenders;
  } catch (error) {
    console.error("[public-scraper] bund-rss Fehler:", error);
    return [];
  }
}

// --- Deduplication ---

export function canonicalPublicSourceKey(sourceKey: string): string {
  return /(?:^|[-:])rlp-(?:land|lbb|lbm|central)$/.test(sourceKey) ? "rlp" : sourceKey;
}

function deduplicateTenders(tenders: ExtractedTender[]): ExtractedTender[] {
  const seen = new Map<string, ExtractedTender>();

  for (const tender of tenders) {
    const sourceKey = tender.sourceKey ?? tender.source;
    const identitySource = canonicalPublicSourceKey(sourceKey);
    const key = tender.externalId
      ? `${identitySource}:id:${tender.externalId}`.toLowerCase().trim()
      : `${identitySource}:url:${stripSessionId(tender.sourceUrl)}:${tender.title}`.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, tender);
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
  }>;
  persistenceError?: string | null;
}

export type OnSourceBatch = (sourceKey: string, tenders: ExtractedTender[]) => Promise<void>;

export async function scrapeAllPublicTenders(onBatch?: OnSourceBatch, sourceFilter?: string): Promise<ScrapeResult> {
  console.log("[public-scraper] Starte vollstaendigen Scrape aller Quellen...");

  const scrapers = [
    { name: "berlin-html", fn: scrapeBerlinHtml },
    { name: "bayern-api", fn: scrapeBayernApi },
    { name: "hamburg-de", fn: scrapeHamburgDe },
    { name: "bund-rss", fn: scrapeBundRss },
    { name: "dtvp", fn: scrapeDtvp },
    { name: "ted", fn: scrapeTed },
    { name: "bauportal", fn: scrapeBauportal },
    { name: "evergabe", fn: scrapeEvergabe },
    { name: "bundesimmobilien", fn: scrapeBundesimmobilien },
    { name: "niedersachsen", fn: scrapeVergabeNiedersachsen },
    ...NRW_PORTALS.map((p) => ({ name: `nrw-${p.name}`, fn: () => scrapeNrwPortal(p) })),
    ...NET_SERVER_PORTALS.map((p) => ({ name: `net-${p.name}`, fn: () => scrapeNetPortal(p) })),
    { name: "e-vergabe-sh", fn: scrapeEVergabeSh },
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
    try {
      const result = await Promise.race([
        scraper.fn(),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Portal-Timeout nach ${PORTAL_TIMEOUT_MS / 1000}s`)), PORTAL_TIMEOUT_MS);
        }),
      ]);
      const normalized = result.map((tender) => ({ ...tender, sourceKey: tender.sourceKey ?? scraper.name }));
      bySource[scraper.name] = normalized.length;
      allTenders.push(...normalized);
      const duration = Date.now() - startTime;
      sourceRuns.push({
        sourceKey: scraper.name,
        status: normalized.length > 0 ? "success" : "empty",
        discoveredCount: normalized.length,
        acceptedCount: normalized.length,
        errorMessage: null,
        durationMs: duration,
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
