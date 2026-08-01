import crypto from "node:crypto";
import { and, eq, gt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { requireSession } from "@/lib/api-auth";
import { enqueueJob } from "@/lib/queue";
import { JOB_PREVIEW_COMPANY_URL } from "@/lib/types";
import { companyMatchPreviews, companyUrlCache, companyUrlMatchCache } from "@/lib/schema";
import { canonicalizePreviewUrl, PREVIEW_EXPIRY_MS, PREVIEW_MATCH_TTL_MS, PreviewUrlError } from "@/lib/preview";
import { clientIp, consumeRateLimit, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handleError = (error: unknown): Response => {
  if (error instanceof RateLimitError) return json({ error: error.message, code: error.code }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
  if (error instanceof PreviewUrlError) return json({ error: error.message, code: error.code }, { status: 422 });
  return errorResponse(error);
};

export async function POST(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const userId = sessionOrResponse.session.user.id;
    await consumeRateLimit(`preview-user:${userId}`, 5, 60 * 60 * 1000);
    await consumeRateLimit(`preview-ip:${clientIp(request)}`, 20, 60 * 60 * 1000);
    const body = await parseJsonBody<unknown>(request);
    const value = body && typeof body === "object" && typeof (body as { url?: unknown }).url === "string" ? (body as { url: string }).url.trim() : "";
    if (!value) return json({ error: "URL ist erforderlich.", code: "URL_REQUIRED" }, { status: 422 });
    const { canonicalUrl, urlHash } = await canonicalizePreviewUrl(value);
    const active = await db.select({ id: companyMatchPreviews.id }).from(companyMatchPreviews).where(and(eq(companyMatchPreviews.userId, userId), or(eq(companyMatchPreviews.status, "queued"), eq(companyMatchPreviews.status, "processing")))).limit(1);
    if (active[0]) return json({ error: "Eine Vorschau wird bereits berechnet.", code: "PREVIEW_ALREADY_ACTIVE", previewId: active[0].id }, { status: 429, headers: { "Retry-After": "60" } });

    let cache = (await db.select().from(companyUrlCache).where(eq(companyUrlCache.urlHash, urlHash)).limit(1))[0];
    if (!cache) {
      const inserted = await db.insert(companyUrlCache).values({ canonicalUrl, urlHash, status: "pending" }).onConflictDoNothing().returning();
      cache = inserted[0] ?? (await db.select().from(companyUrlCache).where(eq(companyUrlCache.urlHash, urlHash)).limit(1))[0];
    }
    if (!cache) return json({ error: "Vorschau konnte nicht angelegt werden.", code: "PREVIEW_CREATE_FAILED" }, { status: 500 });

    const fresh = cache.status === "ready" && cache.expiresAt && cache.expiresAt > new Date();
    const freshMatches = fresh ? await db.select().from(companyUrlMatchCache).where(and(eq(companyUrlMatchCache.cacheId, cache.id), gt(companyUrlMatchCache.expiresAt, new Date()))).limit(3) : [];
    const previewId = crypto.randomUUID();
    if (fresh && freshMatches.length > 0) {
      await db.insert(companyMatchPreviews).values({ id: previewId, userId, cacheId: cache.id, status: "completed", completedAt: new Date(), expiresAt: new Date(Date.now() + PREVIEW_EXPIRY_MS), idempotencyKey: urlHash });
      return json({ previewId, status: "completed", cached: true }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    }
    await db.update(companyUrlCache).set({ canonicalUrl, status: "pending", updatedAt: new Date() }).where(eq(companyUrlCache.id, cache.id));
    await db.insert(companyMatchPreviews).values({ id: previewId, userId, cacheId: cache.id, status: "queued", idempotencyKey: urlHash, expiresAt: new Date(Date.now() + PREVIEW_EXPIRY_MS) });
    const jobId = await enqueueJob(JOB_PREVIEW_COMPANY_URL, { cache_id: cache.id }, { jobKey: `${JOB_PREVIEW_COMPANY_URL}:${urlHash}`, priority: 200 });
    await db.update(companyMatchPreviews).set({ jobId, updatedAt: new Date() }).where(eq(companyMatchPreviews.id, previewId));
    return json({ previewId, status: "queued", cached: false }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleError(error); }
}
