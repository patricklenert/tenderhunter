import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PORTALS } from "@/lib/portal-content";
import { CITIES } from "@/lib/cities";
import { searchTenders } from "@/lib/meilisearch";
import { PortalLocationContent } from "@/components/seo/PortalLocationContent";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";
const portal = PORTALS["evergabe"];

export const revalidate = 3600;
export const runtime = "nodejs";

export async function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const city = CITIES.find((c) => c.slug === slug);
  if (!city) return { title: "Stadt nicht gefunden", robots: { index: false, follow: true } };

  try {
    const { estimatedTotalHits } = await searchTenders({ source: portal.sourceValues, city: city.label, query: "", limit: 1 });
    const count = estimatedTotalHits;
    const title = `${portal.label} Ausschreibungen ${city.label} – Aktuelle Vergaben`;
    const description = `${count} aktuelle ${portal.label}-Ausschreibungen in ${city.label} (${city.bundesland}). Elektronische Vergaben — täglich aktualisiert.`;
    const canonicalPath = `/ausschreibungen/${portal.slug}/stadt/${slug}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: count === 0 ? { index: false, follow: true } : undefined,
      openGraph: { title, description, type: "website", locale: "de_DE" },
    };
  } catch {
    const canonicalPath = `/ausschreibungen/${portal.slug}/stadt/${slug}`;
    return {
      title: `${portal.label} Ausschreibungen ${city.label}`,
      description: `Öffentliche ${portal.label}-Ausschreibungen in ${city.label}.`,
      alternates: { canonical: canonicalPath, languages: { "de-DE": canonicalPath } },
      robots: { index: false, follow: true },
    };
  }
}

const PAGE_SIZE = 20;

export default async function EvergabeCityPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const city = CITIES.find((c) => c.slug === slug);
  if (!city) notFound();

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
    const result = await searchTenders({ source: portal.sourceValues, city: city.label, query: "", limit: PAGE_SIZE, page: currentPage });
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

  const siblingLocations = CITIES.filter((c) => c.slug !== slug).slice(0, 20).map((c) => ({ name: c.label, slug: c.slug }));

  return (
    <PortalLocationContent
      portal={portal}
      locationType="stadt"
      locationName={city.label}
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
