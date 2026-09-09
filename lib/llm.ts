import OpenAI from "openai";

// Try free models first; use paid models only as the final fallbacks.
// inclusionai/ling-2.6-flash is no longer available as a free endpoint.
export const MODEL_CASCADE = [
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "inclusionai/ling-3.0-flash",
  "meta/muse-spark-1.3-contributor",
] as const;

// Rate limits on OpenRouter are per model (free models share an account-wide
// daily quota), so cooldowns must be tracked per model. A global cooldown
// would let exhausted free-model quotas (reset header points to midnight UTC)
// block the paid fallbacks for hours even though they still work.
const rateLimitUntilByModel = new Map<string, number>();
const unavailableModels = new Set<string>();
let providerUnavailableUntil = 0;

export function resetLLMCooldownsForTests(): void {
  rateLimitUntilByModel.clear();
  unavailableModels.clear();
  providerUnavailableUntil = 0;
}

const rateLimitCooldownUntil = (error: unknown): number => {
  if (!error || typeof error !== "object") return 0;
  const headers = (error as { headers?: Headers }).headers;
  const resetValue = headers?.get("x-ratelimit-reset");
  const reset = resetValue ? Number(resetValue) : NaN;
  if (Number.isFinite(reset)) {
    const resetMs = reset > 10_000_000_000 ? reset : reset * 1000;
    if (resetMs > Date.now()) return resetMs;
  }
  // No reset header: transient burst (e.g. per-minute limit), not a quota —
  // retrying on the next call is safe and keeps the cascade responsive.
  return 0;
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

const isNoLongerFreeError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  return (candidate.status === 404 || candidate.code === 404)
    && typeof candidate.message === "string"
    && candidate.message.includes("no longer available as a free model");
};

const isPolicyBlockedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  if ((candidate.status !== 404 && candidate.code !== 404) || typeof candidate.message !== "string") return false;
  return /guardrail|data policy|training violation/iu.test(candidate.message);
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
  if (Date.now() < providerUnavailableUntil) {
    throw Object.assign(new Error("LLM-Provider-Cooldown aktiv"), { status: 401, code: 401 });
  }
  const temperature = options.temperature ?? 0.1;
  let lastError: unknown = null;
  let lastRateLimitError: unknown = null;

  for (const model of MODEL_CASCADE) {
    if (unavailableModels.has(model)) continue;
    if (Date.now() < (rateLimitUntilByModel.get(model) ?? 0)) {
      // This model is cooling down (e.g. free-model daily quota until midnight);
      // skip it without a network call — later models stay available.
      lastRateLimitError ??= Object.assign(new Error("Rate-Limit-Cooldown aktiv"), { status: 429, code: 429 });
      continue;
    }
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
        lastRateLimitError = error;
        rateLimitUntilByModel.set(model, rateLimitCooldownUntil(error));
        console.warn(`[llm] ${model} rate-limited; continuing model cascade.`);
        continue;
      }
      if (isProviderAuthError(error)) {
        providerUnavailableUntil = Math.max(providerUnavailableUntil, Date.now() + 60 * 60 * 1000);
        console.warn(`[llm] ${model} authentication failed; stopping model cascade.`);
        throw error;
      }
      if (isNoLongerFreeError(error)) {
        unavailableModels.add(model);
        console.warn(`[llm] ${model} ist nicht mehr kostenlos verfügbar; überspringe Modell.`);
      }
      if (isPolicyBlockedError(error)) {
        unavailableModels.add(model);
        console.warn(`[llm] ${model} wird durch Provider-Guardrails blockiert; überspringe Modell.`);
      }
      console.warn(`[llm] ${model} fehlgeschlagen:`, error);
      lastError = error;
    }
  }

  throw lastError ?? lastRateLimitError ?? new Error("[llm] Alle Modelle in der Kaskade fehlgeschlagen");
}
