import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiRateLimitBuckets } from "@/lib/schema";

export const MCP_DAILY_TENDER_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1_000;

export interface McpQuotaState {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

export class McpQuotaExceededError extends Error {
  constructor(
    public readonly remaining: number,
    public readonly resetAt: Date,
  ) {
    super("Das tägliche MCP-Limit von 50 Ausschreibungen ist erreicht.");
    this.name = "McpQuotaExceededError";
  }
}

export function getUtcQuotaWindow(now: Date = new Date()): {
  bucketKey: string;
  windowStartedAt: Date;
  resetAt: Date;
} {
  const windowStartedAt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));

  return {
    bucketKey: `mcp:tenders:${windowStartedAt.toISOString().slice(0, 10)}`,
    windowStartedAt,
    resetAt: new Date(windowStartedAt.getTime() + DAY_MS),
  };
}

function toQuotaState(count: number, resetAt: Date): McpQuotaState {
  return {
    limit: MCP_DAILY_TENDER_LIMIT,
    used: count,
    remaining: Math.max(0, MCP_DAILY_TENDER_LIMIT - count),
    resetAt,
  };
}

export async function getMcpDailyQuota(now: Date = new Date()): Promise<McpQuotaState> {
  const window = getUtcQuotaWindow(now);
  const rows = await db
    .select({ count: apiRateLimitBuckets.count })
    .from(apiRateLimitBuckets)
    .where(eq(apiRateLimitBuckets.bucketKey, window.bucketKey));

  return toQuotaState(rows[0]?.count ?? 0, window.resetAt);
}

/** Reserve delivered tender records, rather than counting tool calls. */
export async function reserveMcpTenderQuota(
  amount: number,
  now: Date = new Date(),
): Promise<McpQuotaState> {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Die MCP-Quota-Reservierung muss eine nichtnegative Ganzzahl sein.");
  }
  if (amount === 0) return getMcpDailyQuota(now);

  const window = getUtcQuotaWindow(now);
  return db.transaction(async (tx) => {
    let current = (await tx
      .select()
      .from(apiRateLimitBuckets)
      .where(eq(apiRateLimitBuckets.bucketKey, window.bucketKey))
      .for("update"))[0];

    if (!current) {
      await tx
        .insert(apiRateLimitBuckets)
        .values({
          bucketKey: window.bucketKey,
          windowStartedAt: window.windowStartedAt,
          count: 0,
          expiresAt: window.resetAt,
        })
        .onConflictDoNothing({ target: apiRateLimitBuckets.bucketKey });

      current = (await tx
        .select()
        .from(apiRateLimitBuckets)
        .where(eq(apiRateLimitBuckets.bucketKey, window.bucketKey))
        .for("update"))[0];
    }

    const used = current?.count ?? 0;
    const remaining = Math.max(0, MCP_DAILY_TENDER_LIMIT - used);
    if (amount > remaining) {
      throw new McpQuotaExceededError(remaining, window.resetAt);
    }

    const nextCount = used + amount;
    await tx
      .update(apiRateLimitBuckets)
      .set({ count: nextCount })
      .where(eq(apiRateLimitBuckets.bucketKey, window.bucketKey));

    return toQuotaState(nextCount, window.resetAt);
  });
}
