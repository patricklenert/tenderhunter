import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PORTALS } from "@/lib/portal-content";
import { SLUG_TO_BUNDESLAND, ALL_BUNDESLAND_SLUGS } from "@/lib/bundesland";
import { searchTenders } from "@/lib/meilisearch";
import { PortalLocationContent } from "@/components/seo/PortalLocationContent";
import { getListingRobots, getPageNumber, type SeoSearchParams } from "@/lib/seo-indexability";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";
const portal = PORTALS["evergabe"];

export const revalidate = 3600;
export const runtime = "nodejs";

export async function generateStaticParams() {
  return ALL_BUNDESLAND_SLUGS.map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const bundesland = SLUG_TO_BUNDESLAND[slug];
  if (!bundesland) return { title: "Region nicht gefunden", robots: { index: false, follow: true } };

  try {
    const { estimatedTotalHits } = await searchTenders({ source: portal.sourceValues, bundesland, query: "", limit: 1 });
    const count = estimatedTotalHits;
    const title = `${portal.label} Ausschreibungen ${bundesland} – Aktuelle Vergaben`;
    const description = `${count} aktuelle ${portal.label}-Ausschreibungen im Bundesland ${bundesland}. Elektronische Vergaben von evergabe.de und evergabe.nrw.de — täglich aktualisiert.`;
    const canonicalPath = `/ausschreibungen/${portal.slug}/region/${slug}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: getListingRobots(resolvedSearchParams, count),
      openGraph: { title, description, type: "website", locale: "de_DE" },
    };
  } catch {
    const canonicalPath = `/ausschreibungen/${portal.slug}/region/${slug}`;
    return {
      title: `${portal.label} Ausschreibungen ${bundesland}`,
      description: `Öffentliche ${portal.label}-Ausschreibungen in ${bundesland}.`,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: { index: false, follow: true },
    };
  }
}

const PAGE_SIZE = 20;

export default async function EvergabeRegionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = getPageNumber(pageParam);
  const bundesland = SLUG_TO_BUNDESLAND[slug];
  if (!bundesland) notFound();

  let tenders: Array<{
    id: number;
    title: string;
    deadline: string | null;
    location: string | null;
    client: string | null;
    source: string;
    slug: string | null;
  }> = [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    const result = await searchTenders({ source: portal.sourceValues, bundesland, query: "", limit: PAGE_SIZE, page: currentPage });
    totalCount = result.estimatedTotalHits;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (currentPage > totalPages && totalCount > 0) notFound();

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

  const siblingLocations = ALL_BUNDESLAND_SLUGS.filter((s) => s !== slug).map((s) => ({ name: SLUG_TO_BUNDESLAND[s], slug: s }));

  return (
    <PortalLocationContent
      portal={portal}
      locationType="region"
      locationName={bundesland}
      locationSlug={slug}
      tenders={tenders}
      totalCount={totalCount}
      currentPage={currentPage}
      totalPages={totalPages}
      siteUrl={siteUrl}
      siblingLocations={siblingLocations}
    />
  );
}
