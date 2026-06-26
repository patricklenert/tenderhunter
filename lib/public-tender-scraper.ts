import OpenAI from "openai";
import * as cheerio from "cheerio";
import { scrapeWebsite, scrapeMultiple, type ScrapedPage } from "@/lib/firecrawl";

const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";

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

  const client = getOpenAI();
  const truncated = markdown.substring(0, 15000);

  try {
    const response = await client.chat.completions.create({
      model: "deepseek/deepseek-v4-pro",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `URL: ${sourceUrl}\n\nInhalt:\n${truncated}` },
      ],
      temperature: 0.1,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content ?? "";
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
        description: cleanDescription(t.description ?? ""),
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

  const client = getOpenAI();
  const truncated = markdown.substring(0, 10000);

  try {
    const response = await client.chat.completions.create({
      model: "deepseek/deepseek-v4-pro",
      messages: [
        { role: "system", content: DETAIL_EXTRACTION_PROMPT },
        { role: "user", content: `URL: ${sourceUrl}\n\nInhalt:\n${truncated}` },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content ?? "";
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
      title: String(parsed.title).slice(0, 300),
      client: clientName,
      deadline: parsed.deadline ? String(parsed.deadline) : null,
      description: cleanDescription(String(parsed.description ?? "")),
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

    for (const detailUrl of detailLinks.slice(0, 10)) {
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

    for (const noticeId of noticeIds.slice(0, 10)) {
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

      const detailPages = await scrapeMultiple(detailUrls.slice(0, 15));
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
    for (const path of detailPaths.slice(0, 10)) {
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
    for (const detailUrl of detailLinks.slice(0, 10)) {
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

// --- Deduplication ---

function deduplicateTenders(tenders: ExtractedTender[]): ExtractedTender[] {
  const seen = new Map<string, ExtractedTender>();

  for (const tender of tenders) {
    const key = `${tender.sourceUrl}:${tender.title}`.toLowerCase().trim();
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
}

export async function scrapeAllPublicTenders(): Promise<ScrapeResult> {
  console.log("[public-scraper] Starte vollstaendigen Scrape aller Quellen...");

  const scrapers = [
    { name: "dtvp", fn: scrapeDtvp },
    { name: "ted", fn: scrapeTed },
    { name: "bauportal", fn: scrapeBauportal },
    { name: "evergabe", fn: scrapeEvergabe },
    { name: "bundesimmobilien", fn: scrapeBundesimmobilien },
    { name: "niedersachsen", fn: scrapeVergabeNiedersachsen },
  ];

  const allTenders: ExtractedTender[] = [];
  const bySource: Record<string, number> = {};

  for (const scraper of scrapers) {
    const startTime = Date.now();
    try {
      const result = await scraper.fn();
      bySource[scraper.name] = result.length;
      allTenders.push(...result);
      const duration = Date.now() - startTime;
      if (result.length === 0) {
        console.warn(`[public-scraper] ${scraper.name}: 0 Ausschreibungen nach ${duration}ms (keine Extraktion oder keine Treffer)`);
      } else {
        console.log(`[public-scraper] ${scraper.name}: ${result.length} Ausschreibungen in ${duration}ms`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[public-scraper] ${scraper.name} fehlgeschlagen nach ${duration}ms:`, error);
      bySource[scraper.name] = 0;
    }
  }

  const deduplicated = deduplicateTenders(allTenders);

  console.log(
    `[public-scraper] Fertig. Gesamt: ${allTenders.length}, nach Dedup: ${deduplicated.length}`
  );

  return {
    totalFound: allTenders.length,
    afterDedup: deduplicated.length,
    bySource,
    tenders: deduplicated,
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

      // Navigate to detail page to find evergabe.de link
      let evergabeUrl: string | null = null;
      try {
        const detailUrl = `https://oeffentlichevergabe.de/ui/en/search?noticeId=${noticeId}`;
        await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 20000 });
        await page.waitForTimeout(2000);

        const evergabeLinks = await page.$$eval("a[href*='evergabe.de']", (els) =>
          els.map((el) => (el as HTMLAnchorElement).href)
        );

        for (const link of evergabeLinks) {
          if (link.includes("/unterlagen/") || link.includes("/ausschreibung/")) {
            evergabeUrl = link;
            console.log(`[oeffvergabe] evergabe.de Link: ${evergabeUrl.slice(0, 80)}`);
            break;
          }
        }

        if (!evergabeUrl) {
          const pageText = await page.content();
          const evergabeMatch = pageText.match(/https?:\/\/(?:www\.)?evergabe\.de\/unterlagen\/[a-f0-9-]+/i);
          if (evergabeMatch) {
            evergabeUrl = evergabeMatch[0];
            console.log(`[oeffvergabe] evergabe.de URL im Text: ${evergabeUrl.slice(0, 80)}`);
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
    const apiUrl = `https://oeffentlichevergabe.de/api/notices/${noticeId}?format=ocds&noticeVersion=01`;
    console.log(`[oeffvergabe] Fetch API: ${apiUrl.slice(0, 80)}...`);

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

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
    const buyerName = typeof buyer?.name === "string" ? buyer.name : null;

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

    // Extract evergabe.de document URL
    let evergabeUrl: string | null = null;
    const documents = tender.documents as Array<Record<string, unknown>> | undefined;
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (typeof doc.url === "string" && doc.url.includes("evergabe.de")) {
          evergabeUrl = doc.url;
          break;
        }
      }
    }

    // Fetch evergabe.de document download URLs if we have the link
    let evergabeDocumentUrls: string[] = [];
    if (evergabeUrl) {
      evergabeDocumentUrls = await fetchEvergabeDownloadUrls(evergabeUrl);
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

    // Match both /download/ and /download-url/ patterns (evergabe uses both)
    $("a[href*='download']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      // Skip navigation links like #header, javascript:, mailto:
      if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;
      try {
        const fullUrl = new URL(href, "https://www.evergabe.de").href;
        if (!urls.includes(fullUrl)) urls.push(fullUrl);
      } catch { /* ignore */ }
    });

    console.log(`[oeffvergabe] evergabe: ${urls.length} Download-Links gefunden`);
    return urls;
  } catch (error) {
    console.warn(`[oeffvergabe] evergabe Fetch fehlgeschlagen:`, error);
    return [];
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

  // If API found details but no evergabe docs, use the URL from the detail page
  if (details && details.evergabeDocumentUrls.length === 0 && searchResult.evergabeUrl) {
    console.log(`[oeffvergabe] Nutze evergabe.de URL von Detail-Seite: ${searchResult.evergabeUrl.slice(0, 60)}`);
    const docUrls = await fetchEvergabeDownloadUrls(searchResult.evergabeUrl);
    details.evergabeDocumentUrls = docUrls;
    if (!details.evergabeUrl) details.evergabeUrl = searchResult.evergabeUrl;
  }

  // If API failed entirely, build minimal details from what we have
  if (!details && searchResult.evergabeUrl) {
    console.log(`[oeffvergabe] API fehlgeschlagen, nutze evergabe.de URL direkt`);
    const docUrls = await fetchEvergabeDownloadUrls(searchResult.evergabeUrl);
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
    };
  }

  return details;
}
