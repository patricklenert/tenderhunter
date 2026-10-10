import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { companyProfiles, structuredData, tenders, usTenders } from "@/lib/schema";
import { getIndexableAgency } from "@/lib/agencies";
import { SLUG_TO_BUNDESLAND } from "@/lib/bundesland";
import { CITY_SLUG_MAP } from "@/lib/cities";
import { SLUG_TO_CATEGORY } from "@/lib/categories";
import { CPV_CODES } from "@/lib/cpv-codes";
import { PORTALS } from "@/lib/portal-content";
import { PROCEDURE_TYPES } from "@/lib/procedure-types";
import { ALL_ARTICLE_SLUGS } from "@/lib/articles";
import { ALL_GLOSSARY_SLUGS } from "@/lib/glossary";
import { ALL_BRANCHE_SLUGS } from "@/lib/branchen";
import { ALL_TEMPLATE_SLUGS } from "@/lib/templates";
import { decodeRouteParam } from "@/lib/route-params";
import { getCanonicalTenderSlug, isCanonicalTenderId } from "@/lib/tender-canonical";
import { dependencyUnavailableResponse } from "@/lib/public-route-resilience";

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)"],
};

const hasKey = (record: Record<string, unknown>, value: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, value);

const PUBLIC_STATIC_SLUGS: Record<string, ReadonlySet<string>> = {
  wissen: new Set(ALL_ARTICLE_SLUGS),
  lexikon: new Set(ALL_GLOSSARY_SLUGS),
  branchen: new Set(ALL_BRANCHE_SLUGS),
  vorlagen: new Set(ALL_TEMPLATE_SLUGS),
  tools: new Set(["schwellenwert-rechner", "fristenrechner", "ruegefrist-rechner"]),
};

/** Reject unknown static content slugs before slash normalization can redirect to a 404. */
export function isKnownPublicStaticPath(segments: string[]): boolean {
  const slugs = PUBLIC_STATIC_SLUGS[segments[0] ?? ""];
  if (!slugs) return true;
  if (segments.length === 1) return true;
  return segments.length === 2
    && (slugs.has(decodeRouteParam(segments[1]))
      || (segments[0] === "wissen" && segments[1] === "schwellenwerte-vergabe-2025"));
}

/**
 * Keep unknown public listing paths from falling through to a 200/noindex
 * dynamic page. This validates route vocabulary without pre-generating the
 * data-dependent combinations that caused the August URL expansion.
 */
export function isKnownPublicAusschreibungenPath(segments: string[]): boolean {
  if (segments[0] !== "ausschreibungen") return true;
  if (segments.at(-1) === "opengraph-image") return true;
  if (segments.length === 1) return true;

  const [family, slug, variant] = segments.slice(1);
  if (segments.length === 2) {
    return hasKey(SLUG_TO_CATEGORY, family) || hasKey(PORTALS, family);
  }

  if (family === "stadt") {
    return hasKey(CITY_SLUG_MAP, slug)
      && (segments.length === 3 || (segments.length === 4 && hasKey(SLUG_TO_CATEGORY, variant)));
  }
  if (family === "region") {
    return hasKey(SLUG_TO_BUNDESLAND, slug)
      && (segments.length === 3 || (segments.length === 4 && hasKey(SLUG_TO_CATEGORY, variant)));
  }
  if (family === "cpv") {
    return hasKey(CPV_CODES, slug)
      && (segments.length === 3 || (segments.length === 4 && hasKey(SLUG_TO_CATEGORY, variant)));
  }
  if (family === "verfahren") {
    return hasKey(PROCEDURE_TYPES, slug)
      && (segments.length === 3 || (segments.length === 4 && hasKey(SLUG_TO_CATEGORY, variant)));
  }
  if (hasKey(PORTALS, family)) {
    return segments.length === 3
      ? hasKey(SLUG_TO_CATEGORY, slug)
      : segments.length === 4
        && (slug === "stadt" ? hasKey(CITY_SLUG_MAP, variant) : slug === "region" && hasKey(SLUG_TO_BUNDESLAND, variant));
  }

  return false;
}

/** Reject unknown US pages before slash normalization can redirect to a 404. */
export function isKnownPublicUsPath(segments: string[]): boolean {
  if (segments[0] !== "us") return true;
  if (segments.length === 1) return true;
  if (segments[1] === "tender") return true;
  return segments.length === 2 && (segments[1] === "profile" || segments[1] === "feed.xml");
}

export async function proxy(request: NextRequest): Promise<NextResponse | Response> {
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const resource = segments[0] ?? "";
  const hasTrailingSlash = pathname.length > 1 && pathname.endsWith("/");

  if (
    (resource === "ausschreibungen" || resource === "auftraggeber")
    &&
    request.nextUrl.searchParams.size === 1
    && request.nextUrl.searchParams.get("page") === "1"
  ) {
    const destination = new URL(request.url);
    destination.pathname = pathname.length > 1 && hasTrailingSlash ? pathname.slice(0, -1) : pathname;
    destination.search = "";
    return NextResponse.redirect(destination, 301);
  }

  if (resource === "ausschreibungen" && !isKnownPublicAusschreibungenPath(segments)) {
    return new Response(null, { status: 404 });
  }

  if (!isKnownPublicStaticPath(segments)) {
    return new Response(null, { status: 404 });
  }

  if (resource === "us" && !isKnownPublicUsPath(segments)) {
    return new Response(null, { status: 404 });
  }

  if (resource === "us" && segments[1] === "tender") {
    const id = segments[2] ?? "";
    const numericId = /^\d+$/.test(id) ? Number(id) : Number.NaN;
    if (segments.length !== 3 || !Number.isSafeInteger(numericId) || numericId > 2_147_483_647) {
      return new Response(null, { status: 404 });
    }

    try {
      const rows = await db
        .select({ id: usTenders.id })
        .from(usTenders)
        .where(and(
          eq(usTenders.id, numericId),
          eq(usTenders.qualityStatus, "qualified"),
          or(isNull(usTenders.deadlineAt), gt(usTenders.deadlineAt, new Date())),
        ))
        .limit(1);

      if (rows.length === 0) return new Response(null, { status: 404 });
      if (hasTrailingSlash) {
        const destination = new URL(request.url);
        destination.pathname = `/us/tender/${numericId}`;
        return NextResponse.redirect(destination, 301);
      }
      return NextResponse.next();
    } catch {
      return dependencyUnavailableResponse();
    }
  }

  if (hasTrailingSlash && resource !== "ausschreibung" && resource !== "p" && resource !== "auftraggeber") {
    const destination = new URL(request.url);

    if (pathname === "/us/") {
      destination.pathname = "/";
      destination.search = "";
      destination.hash = "#us";
    } else if (pathname === "/wissen/schwellenwerte-vergabe-2025/") {
      destination.pathname = "/wissen/schwellenwerte-vergabe";
      destination.search = "";
      destination.hash = "";
    } else {
      destination.pathname = pathname.slice(0, -1);
    }

    return NextResponse.redirect(destination, 301);
  }

  if (resource !== "ausschreibung" && resource !== "p" && resource !== "auftraggeber") {
    return NextResponse.next();
  }

  if (resource === "p") {
    if (segments.length !== 2) return new Response(null, { status: 404 });
    try {
      const rows = await db
        .select({ id: companyProfiles.id })
        .from(companyProfiles)
        .where(eq(companyProfiles.slug, segments[1]))
        .limit(1);
      if (rows.length === 0) return new Response(null, { status: 404 });
      if (hasTrailingSlash) {
        const destination = new URL(request.url);
        destination.pathname = `/p/${segments[1]}`;
        return NextResponse.redirect(destination, 301);
      }
      return NextResponse.next();
    } catch {
      return dependencyUnavailableResponse();
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
      const exists = rows.some((row) => getIndexableAgency(row.client)?.slug === segments[1]);
      if (!exists) return new Response(null, { status: 404 });
      if (hasTrailingSlash) {
        const destination = new URL(request.url);
        destination.pathname = `/auftraggeber/${segments[1]}`;
        return NextResponse.redirect(destination, 301);
      }
      return NextResponse.next();
    } catch {
      return dependencyUnavailableResponse();
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
        rawText: tenders.rawText,
        metadataJson: tenders.metadataJson,
        structuredJson: structuredData.jsonBlob,
      })
      .from(tenders)
      .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(and(eq(tenders.id, numericId), eq(tenders.qualityStatus, "qualified")))
      .limit(1);

    if (rows.length === 0) return new Response(null, { status: 404 });

    const row = rows[0];
    const canonicalSlug = getCanonicalTenderSlug(
      row.slug,
      row.title,
      row.metadataJson,
      row.rawText?.trim() ? row.structuredJson : null,
    );
    if (hasTrailingSlash || !isCanonicalTenderId(id, numericId) || requestedSlug !== canonicalSlug) {
      const destination = new URL(request.url);
      destination.pathname = `/ausschreibung/${numericId}/${canonicalSlug}`;
      if (!hasTrailingSlash || !isCanonicalTenderId(id, numericId) || requestedSlug !== canonicalSlug) {
        destination.search = "";
        destination.hash = "";
      }
      return NextResponse.redirect(destination, 301);
    }
  } catch {
    return dependencyUnavailableResponse();
  }

  return NextResponse.next();
}
