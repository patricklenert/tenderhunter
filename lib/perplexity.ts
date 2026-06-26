import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY ?? "";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!apiKey) throw new Error("OPENROUTER_API_KEY ist nicht gesetzt.");
    client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
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

export async function extractCompanyProfile(
  websiteContent: string,
  url: string
): Promise<CompanyProfile> {
  const perplexity = getClient();

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

  const response = await perplexity.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content ?? "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Perplexity-Antwort enthaelt kein valides JSON.");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  let logoUrl: string | null = null;
  if (typeof parsed.logo_url === "string" && parsed.logo_url.startsWith("http")) {
    logoUrl = parsed.logo_url;
  } else {
    logoUrl = extractLogoUrl(websiteContent, url);
  }

  return {
    name: typeof parsed.name === "string" ? parsed.name : "",
    description: typeof parsed.description === "string" ? parsed.description : "",
    capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities.filter((c: unknown) => typeof c === "string") : [],
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications.filter((c: unknown) => typeof c === "string") : [],
    regions: Array.isArray(parsed.regions) ? parsed.regions.filter((r: unknown) => typeof r === "string") : ["Deutschland"],
    team_size: typeof parsed.team_size === "number" ? parsed.team_size : null,
    industry: typeof parsed.industry === "string" ? parsed.industry : null,
    contact_email: typeof parsed.contact_email === "string" ? parsed.contact_email : null,
    contact_phone: typeof parsed.contact_phone === "string" ? parsed.contact_phone : null,
    address: typeof parsed.address === "string" ? parsed.address : null,
    logo_url: logoUrl,
  };
}
