import OpenAI from "openai";

// Try free models first and use paid Laguna only as the final fallback.
export const MODEL_CASCADE = [
  "inclusionai/ling-3.0-flash:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "poolside/laguna-xs-2.1",
] as const;

export async function callLLM(
  client: OpenAI,
  options: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: "json_object" };
  }
): Promise<string> {
  const temperature = options.temperature ?? 0.1;
  let lastError: unknown = null;

  for (const model of MODEL_CASCADE) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: options.messages,
        temperature,
        max_tokens: options.max_tokens,
        response_format: options.response_format,
      });
      const content = response.choices[0]?.message?.content?.trim() ?? "";
      if (!content) throw new Error("Leere LLM-Antwort");
      return content;
    } catch (error) {
      console.warn(`[llm] ${model} fehlgeschlagen:`, error);
      lastError = error;
    }
  }

  throw lastError ?? new Error("[llm] Alle Modelle in der Kaskade fehlgeschlagen");
}
