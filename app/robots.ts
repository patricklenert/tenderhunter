import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/*", "/bones/", "/workflow-studio"],
    },
    sitemap: [`${siteUrl}/sitemap.xml`],
  };
}
