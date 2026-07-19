import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/*", "/bones/", "/workflow-studio"],
    },
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/feed.xml`],
  };
}
