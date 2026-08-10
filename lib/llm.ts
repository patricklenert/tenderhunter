import OpenAI from "openai";

// Try free models first and use paid Laguna only as the final fallback.
export const MODEL_CASCADE = [
  "inclusionai/ling-3.0-tiny:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "inclusionai/ling-2.6-flash",
] as const;

let rateLimitUntil = 0;
let providerUnavailableUntil = 0;

export function resetLLMCooldownsForTests(): void {
  rateLimitUntil = 0;
  providerUnavailableUntil = 0;
}

const rateLimitCooldownUntil = (error: unknown): number => {
  if (!error || typeof error !== "object") return Date.now() + 15 * 60 * 1000;
  const headers = (error as { headers?: Headers }).headers;
  const resetValue = headers?.get("x-ratelimit-reset");
  const reset = resetValue ? Number(resetValue) : NaN;
  if (Number.isFinite(reset)) {
    const resetMs = reset > 10_000_000_000 ? reset : reset * 1000;
    if (resetMs > Date.now()) return resetMs;
  }
  return Date.now() + 15 * 60 * 1000;
};

const isRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return candidate.status === 429 || candidate.code === 429;
};

const isProviderAuthError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return candidate.status === 401 || candidate.status === 403 || candidate.code === 401 || candidate.code === 403;
};

export async function callLLM(
  client: OpenAI,
  options: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: "json_object" };
  }
): Promise<string> {
  if (Date.now() < rateLimitUntil) {
    throw Object.assign(new Error("LLM-Rate-Limit-Cooldown aktiv"), { status: 429, code: 429 });
  }
  if (Date.now() < providerUnavailableUntil) {
    throw Object.assign(new Error("LLM-Provider-Cooldown aktiv"), { status: 401, code: 401 });
  }
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
      if (isRateLimitError(error)) {
        rateLimitUntil = Math.max(rateLimitUntil, rateLimitCooldownUntil(error));
        console.warn(`[llm] ${model} rate-limited; stopping model cascade.`);
        throw error;
      }
      if (isProviderAuthError(error)) {
        providerUnavailableUntil = Math.max(providerUnavailableUntil, Date.now() + 60 * 60 * 1000);
        console.warn(`[llm] ${model} authentication failed; stopping model cascade.`);
        throw error;
      }
      console.warn(`[llm] ${model} fehlgeschlagen:`, error);
      lastError = error;
    }
  }

  throw lastError ?? new Error("[llm] Alle Modelle in der Kaskade fehlgeschlagen");
}
