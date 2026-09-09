import type { Metadata } from "next";
import { PORTALS, getPortalMetadata } from "@/lib/portal-content";
import { searchTenders } from "@/lib/meilisearch";
import { CATEGORY_LABELS } from "@/lib/categories";
import { PortalPageContent } from "@/components/seo/PortalPageContent";
import { getListingRobots, type SeoSearchParams } from "@/lib/seo-indexability";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";
const portal = PORTALS["dtvp"];

export const revalidate = 3600;
export const runtime = "nodejs";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SeoSearchParams> }): Promise<Metadata> {
  return { ...getPortalMetadata("dtvp")!, robots: getListingRobots(await searchParams, 1, true) };
}

export default async function DtvpPage() {
  let tenders: Array<{
    id: number;
    title: string;
    category: string;
    deadline: string | null;
    location: string | null;
    client: string | null;
    source: string;
    slug: string | null;
  }> = [];
  let estimatedTotal = 0;

  try {
    const result = await searchTenders({
      query: "",
      source: portal.sourceValues,
      limit: 20,
    });
    estimatedTotal = result.estimatedTotalHits;
    tenders = result.hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      category: CATEGORY_LABELS[hit.category] ?? hit.category,
      deadline: hit.deadlineAt
        ? new Date(hit.deadlineAt * 1000).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
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
    <PortalPageContent
      portal={portal}
      tenders={tenders}
      estimatedTotal={estimatedTotal}
      siteUrl={siteUrl}
    />
  );
}
