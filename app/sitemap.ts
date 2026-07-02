import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { tenders, companyProfiles, scores } from "@/lib/schema";
import { eq, and, inArray, or, gt, isNull, isNotNull, sql } from "drizzle-orm";
import { CATEGORY_SLUGS, SLUG_TO_CATEGORY } from "@/lib/categories";
import { BUNDESLAND_SLUGS, SLUG_TO_BUNDESLAND, deriveBundesland, deriveCity } from "@/lib/bundesland";
import { CITY_SLUG_MAP, ALL_CITY_SLUGS, CITY_LABEL_MAP } from "@/lib/cities";
import { normalizeAgencySlug } from "@/lib/agencies";
import { getMeiliClient } from "@/lib/meilisearch";

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

  let tenderRows: { id: number; updatedAt: Date | null; metadataJson: unknown }[] = [];
  let categoryRows: { category: string | null; updatedAt: Date | null }[] = [];
  let companyRows: { slug: string | null; updatedAt: Date | null; logoUrl: string | null }[] = [];

  try {
    [tenderRows, categoryRows, companyRows] = await Promise.all([
      db
        .select({ id: tenders.id, updatedAt: tenders.updatedAt, metadataJson: tenders.metadataJson })
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

  // SEO: Compute real lastModified per Bundesland for region sitemap entries
  const bundeslandMaxUpdated = new Map<string, Date>();
  for (const row of tenderRows) {
    const meta = (typeof row.metadataJson === "object" && row.metadataJson !== null
      ? row.metadataJson as Record<string, unknown>
      : {}) as Record<string, unknown>;
    const location = typeof meta.location === "string" ? meta.location : "";
    const bl = deriveBundesland(location);
    if (bl && row.updatedAt) {
      const prev = bundeslandMaxUpdated.get(bl) ?? new Date(0);
      if (row.updatedAt > prev) bundeslandMaxUpdated.set(bl, row.updatedAt);
    }
  }

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
      priority: 0.6,
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
        priority: 0.8,
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

  // SEO: Include Bundesland region pages in sitemap (only those with tenders)
  try {
    const meili = getMeiliClient();
    const index = meili.index("tenders");
    for (const [bundesland, blSlug] of Object.entries(BUNDESLAND_SLUGS)) {
      try {
        const result = await index.search("", {
          filter: `bundesland = "${bundesland}"`,
          limit: 1,
        });
        if ((result.estimatedTotalHits ?? 0) > 0) {
          entries.push({
            url: `${siteUrl}/ausschreibungen/region/${blSlug}`,
            lastModified: bundeslandMaxUpdated.get(bundesland) ?? maxTenderUpdated,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }
      } catch {
        // skip this Bundesland if Meilisearch query fails
      }
    }
  } catch {
    // Meilisearch unavailable — skip region entries
  }

  // SEO: Include Region×Category cross pages in sitemap (only those with tenders)
  try {
    const meili = getMeiliClient();
    const index = meili.index("tenders");
    const categoryKeys = Object.keys(CATEGORY_SLUGS);
    for (const [bundesland, blSlug] of Object.entries(BUNDESLAND_SLUGS)) {
      for (const categoryKey of categoryKeys) {
        const catSlug = CATEGORY_SLUGS[categoryKey];
        if (!catSlug) continue;
        try {
          const result = await index.search("", {
            filter: `bundesland = "${bundesland}" AND category = "${categoryKey}"`,
            limit: 1,
          });
          if ((result.estimatedTotalHits ?? 0) > 0) {
            entries.push({
              url: `${siteUrl}/ausschreibungen/region/${blSlug}/${catSlug}`,
              lastModified: bundeslandMaxUpdated.get(bundesland) ?? maxTenderUpdated,
              changeFrequency: "weekly",
              priority: 0.6,
            });
          }
        } catch {
          // skip this combination if Meilisearch query fails
        }
      }
    }
  } catch {
    // Meilisearch unavailable — skip region×category entries
  }

  // SEO: Compute real lastModified per city for city sitemap entries
  const cityMaxUpdated = new Map<string, Date>();
  for (const row of tenderRows) {
    const meta = (typeof row.metadataJson === "object" && row.metadataJson !== null
      ? row.metadataJson as Record<string, unknown>
      : {}) as Record<string, unknown>;
    const location = typeof meta.location === "string" ? meta.location : "";
    const cityName = deriveCity(location);
    if (cityName && row.updatedAt) {
      const prev = cityMaxUpdated.get(cityName) ?? new Date(0);
      if (row.updatedAt > prev) cityMaxUpdated.set(cityName, row.updatedAt);
    }
  }

  // SEO: Include city landing pages in sitemap (only those with tenders)
  try {
    const meili = getMeiliClient();
    const index = meili.index("tenders");
    for (const citySlug of ALL_CITY_SLUGS) {
      const cityEntry = CITY_SLUG_MAP[citySlug];
      if (!cityEntry) continue;
      try {
        const result = await index.search("", {
          filter: `city = "${cityEntry.label}"`,
          limit: 1,
        });
        if ((result.estimatedTotalHits ?? 0) > 0) {
          entries.push({
            url: `${siteUrl}/ausschreibungen/stadt/${citySlug}`,
            lastModified: cityMaxUpdated.get(cityEntry.label) ?? maxTenderUpdated,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }
      } catch {
        // skip this city if Meilisearch query fails
      }
    }
  } catch {
    // Meilisearch unavailable — skip city entries
  }

  // SEO: Include City×Category cross pages in sitemap (only those with tenders)
  try {
    const meili = getMeiliClient();
    const index = meili.index("tenders");
    const categoryKeys = Object.keys(CATEGORY_SLUGS);
    for (const citySlug of ALL_CITY_SLUGS) {
      const cityEntry = CITY_SLUG_MAP[citySlug];
      if (!cityEntry) continue;
      for (const categoryKey of categoryKeys) {
        const catSlug = CATEGORY_SLUGS[categoryKey];
        if (!catSlug) continue;
        try {
          const result = await index.search("", {
            filter: `city = "${cityEntry.label}" AND category = "${categoryKey}"`,
            limit: 1,
          });
          if ((result.estimatedTotalHits ?? 0) > 0) {
            entries.push({
              url: `${siteUrl}/ausschreibungen/stadt/${citySlug}/${catSlug}`,
              lastModified: cityMaxUpdated.get(cityEntry.label) ?? maxTenderUpdated,
              changeFrequency: "weekly",
              priority: 0.6,
            });
          }
        } catch {
          // skip this combination if Meilisearch query fails
        }
      }
    }
  } catch {
    // Meilisearch unavailable — skip city×category entries
  }

  // SEO: Include Auftraggeber/agency pages in sitemap (only those with ≥3 tenders)
  try {
    const clientRows = await db
      .select({
        client: sql<string>`(${tenders.metadataJson}::jsonb->>'client')`.as("client"),
        count: sql<number>`count(*)::int`.as("count"),
        maxUpdated: sql<Date>`max(${tenders.updatedAt})`.as("max_updated"),
      })
      .from(tenders)
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${tenders.metadataJson}::jsonb->>'client') IS NOT NULL`,
        ),
      )
      .groupBy(sql`(${tenders.metadataJson}::jsonb->>'client')`)
      .having(sql`count(*) >= 3`)
      .limit(500);

    for (const row of clientRows) {
      if (!row.client) continue;
      const agencySlug = normalizeAgencySlug(row.client);
      if (agencySlug.length < 3) continue;
      entries.push({
        url: `${siteUrl}/auftraggeber/${agencySlug}`,
        lastModified: row.maxUpdated ?? new Date(),
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  } catch {
    // DB error — skip agency entries
  }

  return entries;
}
