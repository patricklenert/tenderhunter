import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PORTALS } from "@/lib/portal-content";
import { CATEGORY_LABELS, SLUG_TO_CATEGORY } from "@/lib/categories";
import { searchTenders } from "@/lib/meilisearch";
import { PortalCategoryContent } from "@/components/seo/PortalCategoryContent";
import { getListingRobots, type SeoSearchParams } from "@/lib/seo-indexability";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();
const portal = PORTALS["dtvp"];

export const revalidate = 3600;
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ kategorie: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { kategorie } = await params;
  const resolvedSearchParams = await searchParams;
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!categoryKey) return { title: "Kategorie nicht gefunden", robots: { index: false, follow: true } };

  const label = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  const title = `${label} auf ${portal.label} – Aktuelle Ausschreibungen`;
  const description = `Aktuelle ${label}-Ausschreibungen aus dem ${portal.label}. Öffentliche Vergabeverfahren mit Fristen und Auftraggebern — täglich aktualisiert auf Tenderhunter.`;
  const canonicalPath = `/ausschreibungen/dtvp/${kategorie}`;
  let count = 0;
  try {
    count = (await searchTenders({ query: "", source: portal.sourceValues, category: categoryKey, limit: 1 })).estimatedTotalHits;
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

export default async function DtvpCategoryPage({ params }: PageProps) {
  const { kategorie } = await params;
  const categoryKey = SLUG_TO_CATEGORY[kategorie];
  if (!categoryKey) notFound();

  let tenders: Array<{
    id: number;
    title: string;
    deadline: string | null;
    location: string | null;
    client: string | null;
    source: string;
    slug?: string | null;
  }> = [];
  let totalCount = 0;

  try {
    const result = await searchTenders({
      query: "",
      source: portal.sourceValues,
      category: categoryKey,
      limit: 20,
    });
    totalCount = result.estimatedTotalHits;
    tenders = result.hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      deadline: hit.deadlineAt
        ? new Date(hit.deadlineAt * 1000).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      location: hit.location ? hit.location.split(",")[0].trim().slice(0, 60) : null,
      client: hit.client ? hit.client.slice(0, 80) : null,
      source: hit.source,
      slug: hit.slug ?? null,
    }));
  } catch {
    // Meilisearch unavailable
  }

  return (
    <PortalCategoryContent
      portal={portal}
      categoryKey={categoryKey}
      tenders={tenders}
      totalCount={totalCount}
      currentPage={1}
      totalPages={1}
      siteUrl={siteUrl}
    />
  );
}
