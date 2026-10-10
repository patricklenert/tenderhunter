import type { Metadata } from "next";
import { PORTALS, getPortalMetadata } from "@/lib/portal-content";
import { searchTenders } from "@/lib/meilisearch";
import { CATEGORY_LABELS } from "@/lib/categories";
import { PortalPageContent } from "@/components/seo/PortalPageContent";
import { getListingRobots, type SeoSearchParams } from "@/lib/seo-indexability";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();
const portal = PORTALS["evergabe"];

export const revalidate = 3600;
export const runtime = "nodejs";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SeoSearchParams> }): Promise<Metadata> {
  return { ...getPortalMetadata("evergabe")!, robots: getListingRobots(await searchParams, 1, true) };
}

export default async function EvergabePage() {
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
    // SEO: evergabe portal aggregates both evergabe.de and evergabe.nrw.de
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
