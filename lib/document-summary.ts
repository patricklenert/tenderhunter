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

const DOCUMENT_SUMMARY_PROMPT = `Du bist ein sachlicher Assistent fuer oeffentliche Vergabedokumente.
Erstelle aus dem Dokument eine kurze Zusammenfassung auf Deutsch mit genau 2 oder 3 vollstaendigen Saetzen.
Erwaehne den Dokumentzweck und die wichtigsten Inhalte fuer einen potenziellen Bieter.
Nenne nur Informationen, die im Dokument stehen. Erfinde keine Fristen, Mengen, Preise oder Anforderungen.
Gib nur die Zusammenfassung als Fliesstext aus, ohne Ueberschrift, Aufzaehlung oder Markdown.`;

const cleanSummary = (value: string): string => value
  .replace(/^```(?:text|markdown)?\s*/i, "")
  .replace(/\s*```$/i, "")
  .replace(/^(?:zusammenfassung|summary)\s*:\s*/i, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 800)
  .trim();

export async function generateDocumentSummary(input: {
  filename: string | null;
  role: string | null;
  extractedText: string;
}): Promise<string> {
  const content = await callLLM(getOpenAI(), {
    messages: [
      { role: "system", content: DOCUMENT_SUMMARY_PROMPT },
      {
        role: "user",
        content: `Dateiname: ${input.filename || "Unbekannt"}
Dokumenttyp: ${input.role || "Unbekannt"}

Dokumenttext:
${input.extractedText.slice(0, 12_000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 240,
  });

  const summary = cleanSummary(content);
  if (!summary) throw new Error("Keine Dokumentzusammenfassung erhalten");
  return summary;
}
