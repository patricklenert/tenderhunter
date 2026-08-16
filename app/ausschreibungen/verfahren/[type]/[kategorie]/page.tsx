import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, or, gt, isNull, desc, sql, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PROCEDURE_TYPES, ALL_PROCEDURE_TYPE_SLUGS, getProcedureDatabaseValues } from "@/lib/procedure-types";
import { CATEGORY_LABELS, SLUG_TO_CATEGORY, ALL_CATEGORY_SLUGS } from "@/lib/categories";
import { TaxonomyCategoryContent } from "@/components/seo/TaxonomyCategoryContent";
import { getListingRobots, getPageNumber, type SeoSearchParams } from "@/lib/seo-indexability";

const PAGE_SIZE = 20;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;
export const runtime = "nodejs";

// SEO: Pre-render all Verfahren×Kategorie combinations (5×13 = 65 pages)
export async function generateStaticParams() {
  const params: Array<{ type: string; kategorie: string }> = [];
  for (const type of ALL_PROCEDURE_TYPE_SLUGS) {
    for (const kategorie of ALL_CATEGORY_SLUGS) {
      params.push({ type, kategorie });
    }
  }
  return params;
}

interface PageProps {
  params: Promise<{ type: string; kategorie: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { type, kategorie } = await params;
  const resolvedSearchParams = await searchParams;
  const procType = PROCEDURE_TYPES[type];
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!procType || !categoryKey) return { title: "Seite nicht gefunden", robots: { index: false, follow: true } };

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  const title = `${label} im ${procType.label} – Aktuelle Ausschreibungen`;
  const description = `Aktuelle ${label}-Ausschreibungen im Vergabeverfahren ${procType.label}. Öffentliche Vergaben mit Fristen und Auftraggebern — täglich aktualisiert.`;
  const canonicalPath = `/ausschreibungen/verfahren/${type}/${kategorie}`;
  let count = 0;
  try {
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenders)
      .where(and(
        inArray(tenders.procedureType, getProcedureDatabaseValues(type)),
        eq(tenders.category, categoryKey),
        eq(tenders.qualityStatus, "qualified"),
        or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, new Date())),
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

export default async function ProcedureCategoryPage({ params, searchParams }: PageProps) {
  const { type, kategorie } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const procType = PROCEDURE_TYPES[type];
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!procType || !categoryKey) notFound();

  const now = new Date();
  let procTenders: Array<{
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
      .where(
        and(
          inArray(tenders.procedureType, getProcedureDatabaseValues(type)),
          eq(tenders.category, categoryKey),
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
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
      .where(
        and(
          inArray(tenders.procedureType, getProcedureDatabaseValues(type)),
          eq(tenders.category, categoryKey),
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      )
      .orderBy(desc(tenders.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    procTenders = rows.map((row) => {
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

  const siblingTaxons = ALL_PROCEDURE_TYPE_SLUGS.filter((s) => s !== type).map((s) => ({
    slug: s,
    label: PROCEDURE_TYPES[s].label,
  }));

  return (
    <TaxonomyCategoryContent
      taxonomyType="verfahren"
      taxonSlug={type}
      taxonLabel={procType.label}
      taxonParentPath="/ausschreibungen/verfahren"
      categoryKey={categoryKey}
      tenders={procTenders}
      totalCount={totalCount}
      currentPage={currentPage}
      totalPages={totalPages}
      siteUrl={siteUrl}
      siblingTaxons={siblingTaxons}
    />
  );
}
