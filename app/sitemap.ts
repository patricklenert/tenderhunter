import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, inArray, or, gt, isNull } from "drizzle-orm";
import { CATEGORY_SLUGS } from "@/lib/categories";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  let tenderRows: { id: number; updatedAt: Date | null }[] = [];
  let categoryRows: { category: string | null }[] = [];

  try {
    [tenderRows, categoryRows] = await Promise.all([
      db
        .select({ id: tenders.id, updatedAt: tenders.updatedAt })
        .from(tenders)
        .where(
          and(
            inArray(tenders.qualityStatus, ["qualified", "candidate"]),
            or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          ),
        ),
      db
        .select({ category: tenders.category })
        .from(tenders)
        .where(
          and(
            inArray(tenders.qualityStatus, ["qualified", "candidate"]),
            or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          ),
        ),
    ]);
  } catch {
    return [
      {
        url: siteUrl,
        lastModified: new Date(),
        changeFrequency: "hourly",
        priority: 1,
      },
    ];
  }

  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteUrl}/funktionen`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];

  for (const row of tenderRows) {
    entries.push({
      url: `${siteUrl}/ausschreibung/${row.id}`,
      lastModified: row.updatedAt ?? new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  const categoryCounts = new Map<string, number>();
  for (const row of categoryRows) {
    const cat = row.category ?? "Sonstiges";
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  for (const [category, count] of categoryCounts) {
    if (count >= 1) {
      const slug = CATEGORY_SLUGS[category] ?? category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      entries.push({
        url: `${siteUrl}/ausschreibungen/${slug}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  return entries;
}
