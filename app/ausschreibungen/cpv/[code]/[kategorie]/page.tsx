import { db } from "@/lib/db";
import { tenders, structuredData } from "@/lib/schema";
import { eq, and, or, gt, isNull, desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CPV_CODES, ALL_CPV_CODES } from "@/lib/cpv-codes";
import { CATEGORY_LABELS, SLUG_TO_CATEGORY, ALL_CATEGORY_SLUGS } from "@/lib/categories";
import { TaxonomyCategoryContent } from "@/components/seo/TaxonomyCategoryContent";
import { getListingRobots, getPageNumber, type SeoSearchParams } from "@/lib/seo-indexability";

const PAGE_SIZE = 20;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;
export const runtime = "nodejs";

// SEO: Pre-render all CPV×Kategorie combinations (25×13 = 325 pages)
export async function generateStaticParams() {
  const params: Array<{ code: string; kategorie: string }> = [];
  for (const code of ALL_CPV_CODES) {
    for (const kategorie of ALL_CATEGORY_SLUGS) {
      params.push({ code, kategorie });
    }
  }
  return params;
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
  const divisionPrefix = code.slice(0, 2);
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
        sql`(${structuredData.jsonBlob}->'procurement'->'cpv_codes')::jsonb ?| array[${code}, ${divisionPrefix + "000000"}]`,
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
  const divisionPrefix = code.slice(0, 2);

  let cpvTenders: Array<{
    id: number;
    title: string;
    deadline: string | null;
    location: string | null;
    client: string | null;
    source: string;
    slug?: string | null;
  }> = [];
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
          sql`(${structuredData.jsonBlob}->'procurement'->'cpv_codes')::jsonb ?| array[${code}, ${divisionPrefix + "000000"}]`,
        ),
      );
    totalCount = countRow[0]?.count ?? 0;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (currentPage > totalPages && totalCount > 0) notFound();

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
          sql`(${structuredData.jsonBlob}->'procurement'->'cpv_codes')::jsonb ?| array[${code}, ${divisionPrefix + "000000"}]`,
        ),
      )
      .orderBy(desc(tenders.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    cpvTenders = rows.map((row) => {
      const meta =
        typeof row.metadataJson === "object" && row.metadataJson !== null
          ? (row.metadataJson as Record<string, unknown>)
          : {};
      return {
        id: row.id,
        title: row.title ?? `Ausschreibung #${row.id}`,
        source: row.source,
        deadline: row.deadlineAt
          ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
          : null,
        location: typeof meta.location === "string" ? meta.location.split(",")[0].trim().slice(0, 60) : null,
        client: typeof meta.client === "string" ? meta.client.slice(0, 80) : null,
        slug: row.slug,
      };
    });
  } catch {
    // DB unavailable
  }

  const siblingTaxons = ALL_CPV_CODES.filter((c) => c !== code).slice(0, 12).map((c) => ({
    slug: c,
    label: `CPV ${c} ${CPV_CODES[c].label}`,
  }));

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
      siblingTaxons={siblingTaxons}
    />
  );
}
