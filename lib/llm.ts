import OpenAI from "openai";
import {
  addPaidSpend,
  estimateCostMicroEur,
  getPaidSpendCached,
  isPaidModel,
  isWithinBudget,
  paidDailyBudgetMicroEur,
} from "@/lib/llm-spend";

// Prefer free OpenRouter models; paid fallbacks are disabled for now.
// If re-enabled, paid OpenRouter models are gated by the daily budget (see lib/llm-spend).
export const MODEL_CASCADE = [
  "inclusionai/ling-3.1-flash",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-26b-a4b-it:free",
  // Paid OpenRouter models, kept disabled:
  // "inclusionai/ling-3.0-flash",
  // "meta/muse-spark-1.3-contributor",
] as const;

// Small-Vendor-Tiefenanalyse: free Z.AI flash models first, then the shared
// OpenRouter cascade. Paid Z.AI package models and OpenRouter fallbacks stay disabled.
export const SMALL_VENDOR_ZAI_MODELS = [
  // Paid Z.AI package models, kept disabled:
  // "glm-5.3-flash",
  // "glm-5.3-flashx",
  "glm-4.7-flash",
  "glm-4.5-flash",
] as const;

export const SMALL_VENDOR_OPENROUTER_MODELS = [
  ...MODEL_CASCADE,
  // Paid OpenRouter fallback, kept disabled:
  // "z-ai/glm-5.3-flash",
] as const;

const ZAI_BASE_URL = "https://api.z.ai/api/paas/v4";

const zaiKey = process.env.ZAI_API_KEY ?? "";

let openaiClient: OpenAI | null = null;
let zaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY ist nicht gesetzt.");
    openaiClient = new OpenAI({ apiKey: openrouterKey, baseURL: "https://openrouter.ai/api/v1", timeout: 120_000, maxRetries: 0 });
  }
  return openaiClient;
}

export function getZaiClient(): OpenAI | null {
  if (!zaiKey) return null;
  if (!zaiClient) {
    zaiClient = new OpenAI({ apiKey: zaiKey, baseURL: ZAI_BASE_URL, timeout: 180_000, maxRetries: 0 });
  }
  return zaiClient;
}

// Rate limits on OpenRouter are per model (free models share an account-wide
// daily quota), so cooldowns must be tracked per model. A global cooldown
// would let exhausted free-model quotas (reset header points to midnight UTC)
// block the paid fallbacks for hours even though they still work.
const rateLimitUntilByModel = new Map<string, number>();
const unavailableModels = new Set<string>();
const structuredOutputUnavailableModels = new Set<string>();
let providerUnavailableUntil = 0;

export function resetLLMCooldownsForTests(): void {
  rateLimitUntilByModel.clear();
  unavailableModels.clear();
  structuredOutputUnavailableModels.clear();
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
    && /(?:no longer available as a free model|unavailable for free|not available as a free model|no endpoints found)/iu.test(candidate.message);
};

const isStructuredOutputUnsupportedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    error?: { message?: unknown; metadata?: { raw?: unknown } };
  };
  if (candidate.status !== 400 && candidate.code !== 400) return false;
  const message = [candidate.message, candidate.error?.message, candidate.error?.metadata?.raw]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return /does not support feature:\s*structured-outputs|structured[- ]outputs? (?:are )?not supported/iu.test(message);
};

const isPolicyBlockedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  if ((candidate.status !== 404 && candidate.code !== 404) || typeof candidate.message !== "string") return false;
  return /guardrail|data policy|training violation/iu.test(candidate.message);
};

// Z.AI signals an exhausted balance/resource package with code "1113"
// ("Insufficient balance or no resource package"). Treat it like a daily
// quota: skip the model for a long while instead of hammering the API.
const isInsufficientBalanceError = (error: unknown): boolean => {
  const message = (error as { message?: unknown; error?: { message?: unknown } }) ?? {};
  const text = [message.message, message.error?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return /insufficient balance|resource package|\b1113\b/iu.test(text);
};

type LlmCallOptions = {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
};

const formatEur = (microEur: number): string => (microEur / 1_000_000).toFixed(4);

const recordPaidSpend = async (model: string, usage: OpenAI.CompletionUsage | undefined): Promise<void> => {
  if (!usage) return;
  const tokenUsage = { promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0 };
  try {
    const total = await addPaidSpend(model, tokenUsage);
    console.info(
      `[llm] Bezahltes Modell ${model}: ~${formatEur(estimateCostMicroEur(model, tokenUsage))} € dieser Call, `
      + `Tagesstand ~${formatEur(total)} € (Budget ${formatEur(paidDailyBudgetMicroEur())} €).`,
    );
  } catch (error) {
    console.warn(`[llm] Konnte Paid-Spend für ${model} nicht verbuchen.`, error);
  }
};

let paidBudgetSkipLoggedAt = 0;
const throttledPaidBudgetLog = (model: string, spend: number): void => {
  if (Date.now() - paidBudgetSkipLoggedAt < 5 * 60 * 1000) return;
  paidBudgetSkipLoggedAt = Date.now();
  console.warn(`[llm] Tagesbudget für bezahlte Modelle erschöpft (${(spend / 1_000_000).toFixed(2)} €); überspringe ${model} bis morgen (UTC).`);
};

const runModelCascade = async (
  client: OpenAI,
  models: readonly string[],
  options: LlmCallOptions,
): Promise<string> => {
  const temperature = options.temperature ?? 0.1;
  let lastError: unknown = null;
  let lastRateLimitError: unknown = null;

  for (const model of models) {
    if (unavailableModels.has(model)) continue;
    if (options.response_format && structuredOutputUnavailableModels.has(model)) continue;
    if (Date.now() < (rateLimitUntilByModel.get(model) ?? 0)) {
      // This model is cooling down (e.g. free-model daily quota until midnight);
      // skip it without a network call — later models stay available.
      lastRateLimitError ??= Object.assign(new Error("Rate-Limit-Cooldown aktiv"), { status: 429, code: 429 });
      continue;
    }
    if (isPaidModel(model)) {
      const spend = await getPaidSpendCached();
      if (!isWithinBudget(spend, paidDailyBudgetMicroEur())) {
        throttledPaidBudgetLog(model, spend);
        lastError ??= Object.assign(new Error("Tagesbudget für bezahlte LLM-Modelle erschöpft"), { status: 429, code: 429 });
        continue;
      }
    }
    try {
      const response = await client.chat.completions.create({
        model,
        messages: options.messages,
        temperature,
        max_tokens: options.max_tokens,
        response_format: options.response_format,
      });
      if (!Array.isArray(response.choices)) {
        unavailableModels.add(model);
        throw new Error("LLM-Antwort enthält kein choices-Array");
      }
      const content = response.choices[0]?.message?.content?.trim() ?? "";
      if (!content) throw new Error("Leere LLM-Antwort");
      if (isPaidModel(model)) await recordPaidSpend(model, response.usage);
      return content;
    } catch (error) {
      if (options.response_format && isStructuredOutputUnsupportedError(error)) {
        structuredOutputUnavailableModels.add(model);
        console.warn(`[llm] ${model} unterstützt structured outputs nicht; überspringe es für JSON-Aufrufe.`);
        lastError = error;
        continue;
      }
      if (isRateLimitError(error)) {
        lastRateLimitError = error;
        rateLimitUntilByModel.set(model, rateLimitCooldownUntil(error));
        console.warn(`[llm] ${model} rate-limited; continuing model cascade.`);
        continue;
      }
      if (isInsufficientBalanceError(error)) {
        rateLimitUntilByModel.set(model, Date.now() + 24 * 60 * 60 * 1000);
        console.warn(`[llm] ${model} hat kein Guthaben/Paket; überspringe Modell für 24h.`);
        lastError = error;
        continue;
      }
      if (isProviderAuthError(error)) {
        providerUnavailableUntil = Math.max(providerUnavailableUntil, Date.now() + 60 * 60 * 1000);
        console.warn(`[llm] ${model} authentication failed; stopping model cascade.`);
        throw error;
      }
      if (isNoLongerFreeError(error)) {
        unavailableModels.add(model);
        console.warn(`[llm] ${model} ist nicht (mehr) verfügbar; überspringe Modell dauerhaft.`);
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
};

export async function callLLM(
  client: OpenAI,
  options: LlmCallOptions
): Promise<string> {
  if (Date.now() < providerUnavailableUntil) {
    throw Object.assign(new Error("LLM-Provider-Cooldown aktiv"), { status: 401, code: 401 });
  }
  try {
    return await runModelCascade(client, MODEL_CASCADE, options);
  } catch (error) {
    // OpenRouter-Free-Quoten sind tagesbudgetiert (Reset gegen Mitternacht UTC).
    // Solange ein Z.AI-Key existiert, überbrückt die Flash-Kaskade dort die
    // strukturierten Pipeline-Läufe, statt tagelang nur Deterministik zu nutzen.
    const zai = getZaiClient();
    if (!zai) throw error;
    console.warn("[llm] OpenRouter-Kaskade ausgeschöpft; weiche auf Z.AI GLM-Flash aus.");
    return runModelCascade(zai, SMALL_VENDOR_ZAI_MODELS, options);
  }
}

/**
 * Small-Vendor-Tiefenanalyse: Z.AI GLM-Kaskade zuerst, bei Limit/Guthaben-Ende
 * automatisch OpenRouter (GLM, danach die freie Kaskade).
 */
export async function callSmallVendorLLM(
  options: LlmCallOptions
): Promise<{ content: string; model: string }> {
  const zai = getZaiClient();
  if (zai && Date.now() >= providerUnavailableUntil) {
    try {
      const content = await runModelCascade(zai, SMALL_VENDOR_ZAI_MODELS, options);
      return { content, model: "zai" };
    } catch (error) {
      console.warn("[llm] Z.AI-Kaskade fehlgeschlagen; falle auf OpenRouter zurück.", error);
    }
  }
  const openrouter = getOpenAI();
  if (Date.now() < providerUnavailableUntil) {
    throw Object.assign(new Error("LLM-Provider-Cooldown aktiv"), { status: 401, code: 401 });
  }
  const content = await runModelCascade(openrouter, SMALL_VENDOR_OPENROUTER_MODELS, options);
  return { content, model: "openrouter" };
}
