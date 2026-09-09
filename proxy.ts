import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { companyProfiles, structuredData, tenders } from "@/lib/schema";
import { isIndexableAgencyName, normalizeAgencySlug } from "@/lib/agencies";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { dependencyUnavailableResponse } from "@/lib/public-route-resilience";

export const config = {
  matcher: ["/ausschreibung/:path*", "/p/:path*", "/auftraggeber/:path*"],
};

export async function proxy(request: NextRequest): Promise<NextResponse | Response> {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const resource = segments[0] ?? "";

  if (resource === "p") {
    if (segments.length !== 2) return new Response(null, { status: 404 });
    try {
      const rows = await db
        .select({ id: companyProfiles.id })
        .from(companyProfiles)
        .where(eq(companyProfiles.slug, segments[1]))
        .limit(1);
      return rows.length === 0 ? new Response(null, { status: 404 }) : NextResponse.next();
    } catch {
      return NextResponse.next();
    }
  }

  if (resource === "auftraggeber") {
    if (segments.length !== 2) return new Response(null, { status: 404 });
    try {
      const now = new Date();
      const rows = await db
        .select({ client: sql<string>`(${tenders.metadataJson}::jsonb->>'client')`.as("client") })
        .from(tenders)
        .where(and(
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${tenders.metadataJson}::jsonb->>'client') IS NOT NULL`,
        ))
        .groupBy(sql`(${tenders.metadataJson}::jsonb->>'client')`);
      const exists = rows.some((row) => isIndexableAgencyName(row.client) && normalizeAgencySlug(row.client) === segments[1]);
      return exists ? NextResponse.next() : new Response(null, { status: 404 });
    } catch {
      return NextResponse.next();
    }
  }

  const id = segments[1] ?? "";
  const requestedSlug = segments[2] ?? null;
  const numericId = /^\d+$/.test(id) ? Number(id) : Number.NaN;

  if (!Number.isSafeInteger(numericId) || numericId > 2_147_483_647 || segments.length > 3) {
    return new Response(null, { status: 404 });
  }

  try {
    const rows = await db
      .select({
        slug: tenders.slug,
        title: tenders.title,
        metadataJson: tenders.metadataJson,
        structuredJson: structuredData.jsonBlob,
      })
      .from(tenders)
      .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(and(eq(tenders.id, numericId), eq(tenders.qualityStatus, "qualified")))
      .limit(1);

    if (rows.length === 0) return new Response(null, { status: 404 });

    const row = rows[0];
    const canonicalSlug = getCanonicalTenderSlug(row.slug, row.title, row.metadataJson, row.structuredJson);
    if (requestedSlug !== canonicalSlug) {
      const destination = request.nextUrl.clone();
      destination.pathname = `/ausschreibung/${numericId}/${canonicalSlug}`;
      destination.search = "";
      return NextResponse.redirect(destination, 308);
    }
  } catch {
    return dependencyUnavailableResponse();
  }

  return NextResponse.next();
}
