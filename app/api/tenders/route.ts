import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { json } from "@/lib/http";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const limitRaw = new URL(request.url).searchParams.get("limit") ?? "100";
  const limit = Math.max(1, Math.min(Number.parseInt(limitRaw, 10) || 100, 500));

  const items = await db
    .select({
      id: tenders.id,
      source: tenders.source,
      url: tenders.url,
      title: tenders.title,
      externalId: tenders.externalId,
      firstSeenAt: tenders.firstSeenAt,
      lastSeenAt: tenders.lastSeenAt,
      createdAt: tenders.createdAt,
      updatedAt: tenders.updatedAt,
    })
    .from(tenders)
    .where(eq(tenders.qualityStatus, "qualified"))
    .orderBy(desc(tenders.id))
    .limit(limit);

  return json({ items });
}
