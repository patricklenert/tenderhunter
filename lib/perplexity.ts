import OpenAI from "openai";
import { callLLM } from "@/lib/llm";

const apiKey = process.env.OPENROUTER_API_KEY ?? "";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!apiKey) throw new Error("OPENROUTER_API_KEY ist nicht gesetzt.");
    client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      timeout: 15_000,
    });
  }
  return client;
}

export interface CompanyProfile {
  name: string;
  description: string;
  capabilities: string[];
  certifications: string[];
  regions: string[];
  team_size: number | null;
  industry: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  logo_url: string | null;
}

function extractLogoUrl(html: string, baseUrl: string): string | null {
  const patterns = [
    /<link[^>]*rel=["'](?:apple-touch-icon|icon)["'][^>]*href=["']([^"']+)["']/gi,
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi,
    /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      try {
        return new URL(match[1], baseUrl).href;
      } catch {
        return match[1];
      }
    }
  }

  try {
    const hostname = new URL(baseUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch {
    return null;
  }
}

const metaContent = (html: string, key: string): string => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const keyMatch = tag.match(/(?:name|property)=["']([^"']+)["']/i);
    if (keyMatch?.[1].toLowerCase() !== key.toLowerCase()) continue;
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (contentMatch?.[1]) return contentMatch[1];
  }
  return "";
};

export const fallbackCompanyProfile = (websiteContent: string, url: string): CompanyProfile => {
  const title = websiteContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const description = metaContent(websiteContent, "description");
  const keywords = metaContent(websiteContent, "keywords");
  const plainText = `${title} ${description} ${keywords} ${websiteContent.replace(/<[^>]+>/g, " ")}`.toLowerCase();
  const realEstatePattern = /immobilien(?:verwaltung|management|makler|vermittlung)|hausverwaltung|liegenschaftsverwaltung|objektverwaltung|mietverwaltung|wohnungsverwaltung/;
  const cleaningPattern = /(?:gebäude|gebaeude|unterhalts|glas|fassaden)reinigung|reinigungs(?:dienst|unternehmen|service|arbeiten)/;
  const capabilityRules: Array<[RegExp, string]> = [
    [/garten|galabau|landschaftsbau/, "Garten- und Landschaftsbau"],
    [/pflaster/, "Pflasterarbeiten"],
    [/zaun/, "Zaunbau"],
    [/mutterboden|sandstein|mauer|teich/, "Außenanlagen und Naturstein"],
    [/brennholz|mischholz/, "Brennholz und Holzhandel"],
    [/transport|lkw|logistik/, "Transporte"],
    [realEstatePattern, "Immobilienverwaltung"],
    [cleaningPattern, "Gebäudereinigung"],
    [/software|it-dienst|programmierung|webentwicklung/, "IT-Dienstleistungen"],
    [/bauunternehmen|hochbau|tiefbau|bauarbeiten/, "Bauleistungen"],
  ];
  const capabilities = capabilityRules
    .filter(([pattern]) => pattern.test(plainText))
    .map(([, label]) => label);

  let industry: string | null = null;
  if (/garten|galabau|landschaftsbau/.test(plainText)) industry = "Garten- und Landschaftsbau";
  else if (realEstatePattern.test(plainText)) industry = "Immobilienverwaltung";
  else if (cleaningPattern.test(plainText)) industry = "Gebäudereinigung";
  else if (/software|it-dienst|programmierung|webentwicklung/.test(plainText)) industry = "IT-Dienstleistungen";
  else if (/bauunternehmen|hochbau|tiefbau|bauarbeiten/.test(plainText)) industry = "Bauleistungen";

  const regions = ["Deutschland"];
  const stateRules: Array<[RegExp, string]> = [
    [/rheinland[- ]?pfalz|pirmasens|kaiserslautern/, "Rheinland-Pfalz"],
    [/bayern|münchen|muenchen|regensburg/, "Bayern"],
    [/baden[- ]?württemberg|stuttgart|karlsruhe/, "Baden-Württemberg"],
    [/nordrhein[- ]?westfalen|köln|koeln|düsseldorf|duesseldorf/, "Nordrhein-Westfalen"],
    [/berlin/, "Berlin"],
    [/hamburg/, "Hamburg"],
  ];
  for (const [pattern, region] of stateRules) {
    if (pattern.test(plainText)) regions.push(region);
  }

  let name = title.replace(/\s+/g, " ").trim();
  if (!name) {
    try {
      name = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    } catch {
      name = "Unternehmen";
    }
  }

  return {
    name,
    description: description || title,
    capabilities,
    certifications: [],
    regions: [...new Set(regions)],
    team_size: null,
    industry,
    contact_email: null,
    contact_phone: null,
    address: null,
    logo_url: extractLogoUrl(websiteContent, url),
  };
};

export async function extractCompanyProfile(
  websiteContent: string,
  url: string
): Promise<CompanyProfile> {
  const fallback = fallbackCompanyProfile(websiteContent, url);

  const systemPrompt = `Du bist ein Experte fuer die Analyse von Unternehmenswebsites.
Extrahiere aus dem folgenden Website-Inhalt ein strukturiertes Firmenprofil.

Antworte NUR mit einem validen JSON-Objekt (kein Markdown, kein Text davor/danach).

Feldbeschreibungen:
- name: Firmenname
- description: 1-2 Saetze Beschreibung was das Unternehmen macht
- capabilities: Array von Leistungen/Dienstleistungen (moeglichst spezifisch, z.B. "Gebaeudereinigung", "IT-Beratung", "Solaranlagen-Installation")
- certifications: Array von Zertifizierungen (z.B. "ISO 27001", "ISO 9001", "BSI")
- regions: Array von Regionen in denen das Unternehmen taetig ist (z.B. "Bayern", "Deutschland", "DACH-Region")
- team_size: Geschaetzte Mitarbeiterzahl als Zahl oder null wenn nicht erkennbar
- industry: Hauptbranche (z.B. "IT-Dienstleistungen", "Gebaeudereinigung", "Solarenergie")
- contact_email: Kontakt-Email oder null
- contact_phone: Telefonnummer oder null
- address: Adresse oder null
- logo_url: URL zum Firmenlogo oder null wenn nicht gefunden`;

  const userPrompt = `Website-URL: ${url}

Website-Inhalt:
${websiteContent.substring(0, 12000)}

Extrahiere das Firmenprofil als JSON.`;

  let parsed: Record<string, unknown> = {};
  try {
    const content = await callLLM(getClient(), {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch (error) {
    console.warn(`[company-profile] LLM fehlgeschlagen, verwende Website-Fallback:`, error);
  }

  let logoUrl: string | null = null;
  if (typeof parsed.logo_url === "string" && parsed.logo_url.startsWith("http")) {
    logoUrl = parsed.logo_url;
  } else {
    logoUrl = extractLogoUrl(websiteContent, url);
  }

  return {
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : fallback.name,
    description: typeof parsed.description === "string" && parsed.description.trim() ? parsed.description : fallback.description,
    capabilities: Array.isArray(parsed.capabilities) && parsed.capabilities.length > 0
      ? parsed.capabilities.filter((c: unknown) => typeof c === "string")
      : fallback.capabilities,
    certifications: Array.isArray(parsed.certifications) && parsed.certifications.length > 0
      ? parsed.certifications.filter((c: unknown) => typeof c === "string")
      : fallback.certifications,
    regions: Array.isArray(parsed.regions) && parsed.regions.length > 0
      ? parsed.regions.filter((r: unknown) => typeof r === "string")
      : fallback.regions,
    team_size: typeof parsed.team_size === "number" ? parsed.team_size : fallback.team_size,
    industry: typeof parsed.industry === "string" && parsed.industry.trim() ? parsed.industry : fallback.industry,
    contact_email: typeof parsed.contact_email === "string" ? parsed.contact_email : null,
    contact_phone: typeof parsed.contact_phone === "string" ? parsed.contact_phone : null,
    address: typeof parsed.address === "string" ? parsed.address : null,
    logo_url: logoUrl,
  };
}
