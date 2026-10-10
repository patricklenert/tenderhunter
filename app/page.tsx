import type { Metadata } from "next";
import { HomeSeoContent } from "@/components/seo/HomeSeoContent";
import { InteractiveApp } from "@/components/seo/InteractiveApp";
import { HomeTenderList } from "@/components/seo/HomeTenderList";
import { SeoFooter } from "@/components/seo/SeoFooter";
import { getListingRobots, type SeoSearchParams } from "@/lib/seo-indexability";
import { BRAND_METADATA } from "@/lib/brand-tokens";
import { getSiteUrl } from "@/lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseMetadata: Metadata = {
  title: { absolute: BRAND_METADATA.defaultTitle },
  description: BRAND_METADATA.description,
  alternates: {
    canonical: "/",
    languages: { "de-DE": "/" },
    types: {
      "application/rss+xml": `${getSiteUrl()}/feeds/tender.xml`,
    },
  },
  openGraph: {
    title: BRAND_METADATA.socialTitle,
    description: BRAND_METADATA.socialDescription,
    type: "website",
    locale: "de_DE",
  },
};

interface PageProps {
  searchParams: Promise<SeoSearchParams>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    ...baseMetadata,
    robots: getListingRobots(await searchParams, 1, true),
  };
}

export default function HomePage() {
  return (
    <>
      <HomeTenderList />
      <InteractiveApp />
      <HomeSeoContent />
      <SeoFooter />
    </>
  );
}
