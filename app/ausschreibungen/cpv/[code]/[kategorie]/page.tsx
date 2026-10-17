import { db } from "@/lib/db";
import { tenders, structuredData } from "@/lib/schema";
import { eq, and, or, gt, isNull, desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CPV_CODES, getCpvCodePrefix } from "@/lib/cpv-codes";
import { CATEGORY_LABELS, CATEGORY_SLUGS, SLUG_TO_CATEGORY } from "@/lib/categories";
import { TaxonomyCategoryContent } from "@/components/seo/TaxonomyCategoryContent";
import { getListingRobots, getPageNumber, type SeoSearchParams } from "@/lib/seo-indexability";
import { rethrowNavigationError } from "@/lib/public-route-resilience";
import { pickValidatedPublicCandidate } from "@/lib/public-content-quality";
import { readPublicTenderMeta } from "@/lib/tender-meta";

const PAGE_SIZE = 20;
import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const revalidate = 3600;
export const runtime = "nodejs";

function cpvMatchSql(prefix: string) {
  return sql`EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(COALESCE(
          ${structuredData.jsonBlob}->'procurement'->'cpv_codes',
          ${structuredData.jsonBlob}->'procurement'->'cpvCodes',
          '[]'::jsonb
        )) = 'array'
        THEN COALESCE(
          ${structuredData.jsonBlob}->'procurement'->'cpv_codes',
          ${structuredData.jsonBlob}->'procurement'->'cpvCodes',
          '[]'::jsonb
        )
        ELSE '[]'::jsonb
      END
    ) AS cpv(value)
    WHERE left(regexp_replace(cpv.value, '[^0-9]', '', 'g'), 8) LIKE ${`${prefix}%`}
  )`;
}

interface PageProps {
  params: Promise<{ code: string; kategorie: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { code, kategorie } = await params;
  const resolvedSearchParams = await searchParams;
  const cpvEntry = CPV_CODES[code];
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!cpvEntry || !categoryKey) return { title: "Seite nicht gefunden", robots: { index: false, follow: true } };

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  const title = `${label} – CPV ${code} ${cpvEntry.label} Ausschreibungen`;
  const description = `Aktuelle ${label}-Ausschreibungen nach CPV ${code} (${cpvEntry.label}). Öffentliche Vergaben — täglich aktualisiert.`;
  const canonicalPath = `/ausschreibungen/cpv/${code}/${kategorie}`;
  const cpvPrefix = getCpvCodePrefix(code);
  let count = 0;
  try {
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .innerJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(and(
        eq(tenders.category, categoryKey),
         eq(tenders.qualityStatus, "qualified"),
         or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, new Date())),
         sql`${tenders.rawText} IS NOT NULL AND BTRIM(${tenders.rawText}) <> ''`,
         cpvMatchSql(cpvPrefix),
      ));
    count = countRow[0]?.count ?? 0;
  } catch {
    return {
      title,
      description,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: { index: false, follow: true },
    };
  }

  return {
    title,
    description,
    alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
    robots: getListingRobots(resolvedSearchParams, count),
    openGraph: { title, description, type: "website", locale: "de_DE" },
  };
}

export default async function CpvCategoryPage({ params, searchParams }: PageProps) {
  const { code, kategorie } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const cpvEntry = CPV_CODES[code];
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!cpvEntry || !categoryKey) notFound();

  const now = new Date();
  const cpvPrefix = getCpvCodePrefix(code);

  let cpvTenders: Array<{
    id: number;
    title: string;
    deadline: string | null;
    location: string | null;
    client: string | null;
    source: string;
    slug?: string | null;
  }> = [];
  let availableCategorySlugs: string[] = [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .innerJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(
        and(
          eq(tenders.category, categoryKey),
           eq(tenders.qualityStatus, "qualified"),
           or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
           sql`${tenders.rawText} IS NOT NULL AND BTRIM(${tenders.rawText}) <> ''`,
           cpvMatchSql(cpvPrefix),
        ),
      );
    totalCount = countRow[0]?.count ?? 0;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (currentPage > totalPages) notFound();

    const offset = (currentPage - 1) * PAGE_SIZE;

    const rows = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        source: tenders.source,
        deadlineAt: tenders.deadlineAt,
        metadataJson: tenders.metadataJson,
        slug: tenders.slug,
      })
      .from(tenders)
      .innerJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(
        and(
          eq(tenders.category, categoryKey),
           eq(tenders.qualityStatus, "qualified"),
           or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
           sql`${tenders.rawText} IS NOT NULL AND BTRIM(${tenders.rawText}) <> ''`,
           cpvMatchSql(cpvPrefix),
        ),
      )
      .orderBy(desc(tenders.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    cpvTenders = rows.map((row) => {
      const meta = readPublicTenderMeta(row.metadataJson, {
        title: row.title,
        source: row.source,
      });
      const location = meta.location ? meta.location.split(",")[0].trim().slice(0, 60) : null;
      return {
        id: row.id,
        title: pickValidatedPublicCandidate(row.title) || `Ausschreibung #${row.id}`,
        source: row.source,
        deadline: row.deadlineAt
          ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
          : null,
        location,
        client: meta.client ? meta.client.slice(0, 80) : null,
        slug: row.slug,
      };
    });

    const categoryRows = await db
      .select({ category: tenders.category })
      .from(tenders)
      .innerJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(
        and(
           eq(tenders.qualityStatus, "qualified"),
           or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
           sql`${tenders.category} IS NOT NULL`,
           sql`${tenders.rawText} IS NOT NULL AND BTRIM(${tenders.rawText}) <> ''`,
           cpvMatchSql(cpvPrefix),
        ),
      )
      .groupBy(tenders.category);
    availableCategorySlugs = categoryRows
      .map((row) => row.category ? CATEGORY_SLUGS[row.category] : null)
      .filter((slug): slug is string => Boolean(slug));
  } catch (error) {
    rethrowNavigationError(error);
    // DB unavailable
  }

  return (
    <TaxonomyCategoryContent
      taxonomyType="cpv"
      taxonSlug={code}
      taxonLabel={`CPV ${code} ${cpvEntry.label}`}
      taxonParentPath="/ausschreibungen/cpv"
      categoryKey={categoryKey}
      tenders={cpvTenders}
      totalCount={totalCount}
      currentPage={currentPage}
      totalPages={totalPages}
      siteUrl={siteUrl}
      availableCategorySlugs={availableCategorySlugs}
    />
  );
}
