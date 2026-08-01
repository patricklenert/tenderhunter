import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorResponse, json } from "@/lib/http";
import { requireSession } from "@/lib/api-auth";
import { companyMatchPreviews, companyUrlCache, companyUrlMatchCache } from "@/lib/schema";
import { consumeRateLimit, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    try {
      await consumeRateLimit(`preview-poll:user:${sessionOrResponse.session.user.id}`, 120, 60 * 1000);
    } catch (error) {
      if (error instanceof RateLimitError) return json({ error: error.message, code: error.code }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds), "Cache-Control": "private, no-store" } });
      throw error;
    }
    const id = (await params).id;
    if (!/^[a-f0-9-]{20,80}$/i.test(id)) return json({ error: "ungueltige Vorschau-ID" }, { status: 400 });
    const rows = await db.select({ preview: companyMatchPreviews, cache: companyUrlCache }).from(companyMatchPreviews)
      .leftJoin(companyUrlCache, eq(companyUrlCache.id, companyMatchPreviews.cacheId))
      .where(and(eq(companyMatchPreviews.id, id), eq(companyMatchPreviews.userId, sessionOrResponse.session.user.id))).limit(1);
    if (!rows[0]) return json({ error: "Vorschau nicht gefunden." }, { status: 404 });
    const row = rows[0];
    const matches = row.cache ? await db.select().from(companyUrlMatchCache).where(eq(companyUrlMatchCache.cacheId, row.cache.id)).orderBy(asc(companyUrlMatchCache.rank)).limit(3) : [];
    const expired = row.preview.expiresAt ? row.preview.expiresAt <= new Date() : false;
    const status = expired && row.preview.status === "completed" ? "expired" : row.preview.status;
    const profile = row.cache?.profileJson && typeof row.cache.profileJson === "object" ? row.cache.profileJson as Record<string, unknown> : null;
    return json({
      preview: {
        id: row.preview.id,
        status,
        company: profile,
        matches: status === "completed" ? matches.slice(0, 3).map((match) => ({
          rank: match.rank,
          tenderId: match.tenderId,
          title: match.titleSnapshot,
          source: match.sourceSnapshot,
          url: match.urlSnapshot,
          deadlineAt: match.deadlineAtSnapshot?.toISOString() ?? null,
          fit: Math.round(match.fit),
          reason: match.reason,
        })) : [],
        errorCode: row.preview.errorCode,
        expiresAt: row.preview.expiresAt?.toISOString() ?? null,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
