import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiRateLimitBuckets } from "@/lib/schema";

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number, public readonly code = "RATE_LIMITED") {
    super("Zu viele Anfragen. Bitte später erneut versuchen.");
    this.name = "RateLimitError";
  }
}

export async function consumeRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<{ remaining: number; retryAfterSeconds: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(apiRateLimitBuckets)
      .where(eq(apiRateLimitBuckets.bucketKey, bucketKey))
      .for("update");
    const current = rows[0];
    if (!current || current.expiresAt <= now) {
      await tx.insert(apiRateLimitBuckets).values({
        bucketKey,
        windowStartedAt: now,
        count: 1,
        expiresAt,
      }).onConflictDoUpdate({
        target: apiRateLimitBuckets.bucketKey,
        set: { windowStartedAt: now, count: 1, expiresAt },
      });
      return { remaining: Math.max(0, limit - 1), retryAfterSeconds: Math.ceil(windowMs / 1000) };
    }
    if (current.count >= limit) {
      throw new RateLimitError(Math.max(1, Math.ceil((current.expiresAt.getTime() - now.getTime()) / 1000)));
    }
    const nextCount = current.count + 1;
    await tx.update(apiRateLimitBuckets).set({ count: nextCount }).where(and(
      eq(apiRateLimitBuckets.bucketKey, bucketKey),
      eq(apiRateLimitBuckets.expiresAt, current.expiresAt),
    ));
    return {
      remaining: Math.max(0, limit - nextCount),
      retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt.getTime() - now.getTime()) / 1000)),
    };
  });
}

export const clientIp = (request: Request): string => {
  // The reverse proxy must overwrite x-real-ip; never trust a client-supplied chain of forwarded addresses.
  return request.headers.get("x-real-ip")?.trim() || "unknown";
};
