import { db } from "@/lib/db";
import { tenders, structuredData } from "@/lib/schema";
import { json, errorResponse } from "@/lib/http";
import { eq } from "drizzle-orm";
import { scrapeWebsite } from "@/lib/firecrawl";
import { cleanPublicDescription, pickPublicDescription } from "@/lib/public-tender-scraper";
import { formatDeadlineDE } from "@/lib/date-utils";
import { requirePremiumSession } from "@/lib/entitlements";
import OpenAI from "openai";
import { callLLM } from "@/lib/llm";

const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY ist nicht gesetzt.");
    openaiClient = new OpenAI({ apiKey: openrouterKey, baseURL: "https://openrouter.ai/api/v1" });
  }
  return openaiClient;
}

const MATCH_PROMPT = `Du bist ein Experte fuer oeffentliche Ausschreibungen in Deutschland.
Bewerte, wie gut die folgende Ausschreibung zu dem Unternehmen passt.

Antworte NUR mit validem JSON:
{
  "score": 85,
  "reasons": ["Das Unternehmen hat Erfahrung in X", "Die Anforderungen passen zu Y"],
  "warnings": ["Frist ist in 3 Tagen", "Spezialzertifikat noetig"],
  "recommendations": ["Bieten Sie X an", "Heben Sie Y hervor"],
  "fitSummary": "Kurze Zusammenfassung (1-2 Saetze) warum es passt oder nicht"
}

Score-Richtlinien:
- 90-100: Perfekte Uebereinstimmung, alle Anforderungen erfuellt
- 70-89: Gute Passung, kleine Abweichungen
- 50-69: Mittlere Passung, einige Herausforderungen
- 30-49: Schlechte Passung, wichtige Anforderungen nicht erfuellt
- 0-29: Keine Passung

Warnings sollten konkrete, handlungsrelevante Hinweise sein.
Reasons sollten auf konkreten Staerken des Unternehmens basieren.`;

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const body = (await request.json()) as {
      tenderId?: number;
      companyProfile?: {
        companyName: string;
        industry: string;
        services: string[];
        experience: string;
        certifications: string[];
        strengths: string[];
      };
    };
    const tenderId = body?.tenderId;
    let companyProfile = body?.companyProfile;

    if (!tenderId || typeof tenderId !== "number") {
      return json({ error: "tenderId ist erforderlich" }, { status: 400 });
    }

    // 1. Load tender from DB
    const rows = await db
      .select()
      .from(tenders)
      .where(eq(tenders.id, tenderId))
      .limit(1);

    if (rows.length === 0) {
      return json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
    }

    const tender = rows[0];

    // 2. If no companyProfile provided, try to load from localStorage via client
    // (Client should send it; this is a fallback)
    if (!companyProfile) {
      return json({ error: "companyProfile ist erforderlich" }, { status: 400 });
    }

    // 3. Load tender details (from metadataJson + structured_data cache if available)
    const metadata = (tender.metadataJson ?? {}) as Record<string, unknown>;
    let tenderDetails: Record<string, unknown> = {
      title: tender.title,
      client: metadata.client ?? metadata.auftraggeber ?? "Unbekannt",
      deadline: tender.deadlineAt ? formatDeadlineDE(tender.deadlineAt) : null,
      description: pickPublicDescription(metadata.description, tender.rawText),
      category: tender.category,
      location: metadata.location ?? metadata.ort ?? "",
      referenceNumber: metadata.referenceNumber ?? metadata.referenz ?? "",
    };

    const cached = await db
      .select()
      .from(structuredData)
      .where(eq(structuredData.tenderId, tenderId))
      .limit(1);

    if (cached.length > 0) {
      const blob = cached[0].jsonBlob as Record<string, unknown>;
      const publicDescription = pickPublicDescription(blob.description, blob.summary);
      if (publicDescription) blob.description = publicDescription;
      else delete blob.description;
      const publicSummary = pickPublicDescription(blob.summary);
      if (publicSummary) blob.summary = publicSummary;
      else delete blob.summary;
      tenderDetails = { ...tenderDetails, ...blob };
    } else if (tender.url) {
      // Fallback: quick scrape
      try {
        const page = await scrapeWebsite(tender.url);
        const scrapedDescription = cleanPublicDescription(page.markdown?.substring(0, 5000) ?? "");
        if (scrapedDescription) tenderDetails.description = scrapedDescription;
      } catch {
        // ignore
      }
    }

    // 4. Call GPT for matching
    const client = getOpenAI();
    const content = await callLLM(client, {
      messages: [
        { role: "system", content: MATCH_PROMPT },
        {
          role: "user",
          content: `UNTERNEHMEN:
Name: ${companyProfile.companyName}
Branche: ${companyProfile.industry}
Dienstleistungen: ${companyProfile.services.join(", ")}
Erfahrung: ${companyProfile.experience}
Zertifikate: ${companyProfile.certifications.join(", ")}
Staerken: ${companyProfile.strengths.join(", ")}

AUSSCHREIBUNG:
Titel: ${tenderDetails.title}
Auftraggeber: ${tenderDetails.client}
Kategorie: ${tenderDetails.category}
Beschreibung: ${tenderDetails.description}
Anforderungen: ${Array.isArray(tenderDetails.requirements) ? tenderDetails.requirements.join("; ") : "Keine spezifischen Anforderungen bekannt"}
Leistungsumfang: ${tenderDetails.scope ?? "Nicht angegeben"}
Zuschlagskriterien: ${Array.isArray(tenderDetails.awardCriteria) ? tenderDetails.awardCriteria.join("; ") : "Nicht angegeben"}
Standort: ${tenderDetails.location ?? "Nicht angegeben"}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return json({ error: "Konnte Matching nicht berechnen" }, { status: 500 });
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      return json({ error: "Ungueltiges JSON vom Matching" }, { status: 500 });
    }

    return json({
      score: typeof result.score === "number" ? result.score : 0,
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      fitSummary: String(result.fitSummary ?? ""),
      tenderId,
      cached: false,
    });
  } catch (error) {
    console.error("[tender-match] Fehler:", error);
    return errorResponse(error);
  }
}
