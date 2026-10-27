import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { llmSpendDays } from "@/lib/schema";

// Paid-model price table in EUR per 1M tokens (prompt/completion).
// Source: OpenRouter /api/v1/models (USD) × 0.92 FX, verified 2026-09-25;
// ling-3.1-flash verified 2026-10-27 (the model became paid but was missing
// here, so its spend went untracked — see MODEL_CASCADE in lib/llm.ts).
export const PAID_MODEL_PRICING_EUR_PER_1M: Record<string, { prompt: number; completion: number }> = {
  "inclusionai/ling-3.0-flash": { prompt: 0.0193, completion: 0.058 },
  "inclusionai/ling-3.1-flash": { prompt: 0.069, completion: 0.207 },
  "meta/muse-spark-1.3-contributor": { prompt: 0.092, completion: 0.184 },
  "z-ai/glm-5.3-flash": { prompt: 0.0414, completion: 0.1288 },
};

const DEFAULT_BUDGET_EUR = 0.1;

// 1 EUR = 1_000_000 micro EUR; integer micro EUR avoid float drift in Postgres.
export const paidDailyBudgetMicroEur = (): number => {
  const parsed = Number(process.env.LLM_PAID_DAILY_BUDGET_EUR ?? DEFAULT_BUDGET_EUR);
  const eur = Number.isFinite(parsed) ? Math.max(0, parsed) : DEFAULT_BUDGET_EUR;
  return Math.round(eur * 1_000_000);
};

export const todayUtcKey = (now = new Date()): string => now.toISOString().slice(0, 10);

export const isPaidModel = (model: string): boolean => model in PAID_MODEL_PRICING_EUR_PER_1M;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

// Prices are EUR per 1M tokens and 1 EUR = 1e6 micro EUR, so tokens × price is
// already micro EUR.
export const estimateCostMicroEur = (model: string, usage: TokenUsage): number => {
  const price = PAID_MODEL_PRICING_EUR_PER_1M[model];
  if (!price) return 0;
  return Math.round(usage.promptTokens * price.prompt + usage.completionTokens * price.completion);
};

export const isWithinBudget = (spendMicroEur: number, budgetMicroEur: number): boolean =>
  spendMicroEur < budgetMicroEur;

export const getPaidSpendToday = async (now = new Date()): Promise<number> => {
  const rows = await db
    .select({ microEur: llmSpendDays.microEur })
    .from(llmSpendDays)
    .where(eq(llmSpendDays.day, todayUtcKey(now)))
    .limit(1);
  return rows[0]?.microEur ?? 0;
};

export const addPaidSpend = async (model: string, usage: TokenUsage, now = new Date()): Promise<number> => {
  const costMicroEur = estimateCostMicroEur(model, usage);
  const day = todayUtcKey(now);
  const rows = await db
    .insert(llmSpendDays)
    .values({ day, microEur: costMicroEur, paidCalls: 1 })
    .onConflictDoUpdate({
      target: llmSpendDays.day,
      set: {
        microEur: sql`${llmSpendDays.microEur} + ${costMicroEur}`,
        paidCalls: sql`${llmSpendDays.paidCalls} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ microEur: llmSpendDays.microEur });
  const total = rows[0]?.microEur ?? costMicroEur;
  spendCache = { day, microEur: total, checkedAt: Date.now() };
  return total;
};

interface SpendCache {
  day: string;
  microEur: number;
  checkedAt: number;
}

const SPEND_CACHE_TTL_MS = 15_000;
let spendCache: SpendCache | null = null;

// The budget gate runs before every paid model attempt; a tiny TTL cache keeps
// that at one small primary-key read per 15s instead of per call.
export const getPaidSpendCached = async (): Promise<number> => {
  const day = todayUtcKey();
  if (spendCache && spendCache.day === day && Date.now() - spendCache.checkedAt < SPEND_CACHE_TTL_MS) {
    return spendCache.microEur;
  }
  try {
    const microEur = await getPaidSpendToday();
    spendCache = { day, microEur, checkedAt: Date.now() };
    return microEur;
  } catch (error) {
    console.warn("[llm-spend] Konnte Tagesbudget nicht lesen; Gate bleibt offen.", error);
    return 0;
  }
};
