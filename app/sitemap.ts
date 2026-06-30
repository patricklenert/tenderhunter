import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { tenders, companyProfiles, scores } from "@/lib/schema";
import { eq, and, inArray, or, gt, isNull, isNotNull } from "drizzle-orm";
import { CATEGORY_SLUGS } from "@/lib/categories";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;

/**
 * Single sitemap covering all indexable URLs.
 *
 * Partition strategy (when approaching 50k URLs / 50MB):
 * 1. Split into: sitemap-static.ts, sitemap-tenders.ts, sitemap-categories.ts, sitemap-companies.ts
 * 2. Use Next.js generateSitemaps() to return MetadataRoute.Sitemap[] per partition.
 * 3. Each partition at /sitemap-[id].xml is auto-discovered via /sitemap.xml index.
 * 4. Migrate companyRows query to batch paginated fetches if >50k entries.
 */

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  let tenderRows: { id: number; updatedAt: Date | null }[] = [];
  let categoryRows: { category: string | null; updatedAt: Date | null }[] = [];
  let companyRows: { slug: string | null; updatedAt: Date | null; logoUrl: string | null }[] = [];

  try {
    [tenderRows, categoryRows, companyRows] = await Promise.all([
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
        .select({ category: tenders.category, updatedAt: tenders.updatedAt })
        .from(tenders)
        .where(
          and(
            inArray(tenders.qualityStatus, ["qualified", "candidate"]),
            or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          ),
        ),
      db
        .select({ slug: companyProfiles.slug, updatedAt: companyProfiles.updatedAt, logoUrl: companyProfiles.logoUrl })
        .from(companyProfiles)
        .innerJoin(scores, eq(scores.companyId, companyProfiles.id))
        .innerJoin(tenders, and(
          eq(scores.tenderId, tenders.id),
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
        ))
        .where(isNotNull(companyProfiles.slug))
        .groupBy(companyProfiles.id, companyProfiles.slug, companyProfiles.updatedAt, companyProfiles.logoUrl),
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

  const maxTenderUpdated = tenderRows.reduce<Date>((max, row) => {
    const d = row.updatedAt ?? new Date();
    return d > max ? d : max;
  }, new Date(0));

  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: maxTenderUpdated,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteUrl}/funktionen`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/ausschreibungen`,
      lastModified: maxTenderUpdated,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  for (const row of tenderRows) {
    entries.push({
      url: `${siteUrl}/ausschreibung/${row.id}`,
      lastModified: row.updatedAt ?? new Date(),
      changeFrequency: "daily",
      priority: 0.8,
      images: [`${siteUrl}/ausschreibung/${row.id}/opengraph-image`],
    });
  }

  const categoryCounts = new Map<string, number>();
  const categoryMaxUpdated = new Map<string, Date>();
  for (const row of categoryRows) {
    const cat = row.category ?? "Sonstiges";
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    const d = row.updatedAt ?? new Date();
    const prev = categoryMaxUpdated.get(cat) ?? new Date(0);
    if (d > prev) categoryMaxUpdated.set(cat, d);
  }

  for (const [category, count] of categoryCounts) {
    if (count >= 1) {
      const slug = CATEGORY_SLUGS[category] ?? category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      entries.push({
        url: `${siteUrl}/ausschreibungen/${slug}`,
        lastModified: categoryMaxUpdated.get(category) ?? new Date(),
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  for (const row of companyRows) {
    if (row.slug) {
      entries.push({
        url: `${siteUrl}/p/${row.slug}`,
        lastModified: row.updatedAt ?? new Date(),
        changeFrequency: "weekly",
        priority: 0.5,
        ...(row.logoUrl ? { images: [row.logoUrl] } : {}),
      });
    }
  }

  return entries;
}
