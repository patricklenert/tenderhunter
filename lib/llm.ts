import OpenAI from "openai";

// Model cascade: try each model in order until one succeeds.
// Prefer :free models first to keep costs down; fall back to paid poolside/laguna-xs-2.1 last.
const MODEL_CASCADE = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "poolside/laguna-xs-2.1:free",
  "google/gemma-4-31b-it:free",
  "poolside/laguna-xs-2.1",
];

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
      return response.choices[0]?.message?.content ?? "";
    } catch (error) {
      console.warn(`[llm] ${model} fehlgeschlagen:`, error);
      lastError = error;
    }
  }

  throw lastError ?? new Error("[llm] Alle Modelle in der Kaskade fehlgeschlagen");
}
