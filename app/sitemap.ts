import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { tenders, companyProfiles, scores } from "@/lib/schema";
import { eq, and, inArray, or, gt, isNull, isNotNull, sql } from "drizzle-orm";
import { CATEGORY_SLUGS } from "@/lib/categories";
import { BUNDESLAND_SLUGS, deriveBundesland, deriveCity } from "@/lib/bundesland";
import { CITY_SLUG_MAP, ALL_CITY_SLUGS } from "@/lib/cities";
import { normalizeAgencySlug } from "@/lib/agencies";
import { ALL_PORTAL_SLUGS } from "@/lib/portal-content";
import { ALL_ARTICLE_SLUGS, ARTICLES } from "@/lib/articles";
import { ALL_GLOSSARY_SLUGS } from "@/lib/glossary";
import { ALL_TEMPLATE_SLUGS } from "@/lib/templates";
import { ALL_BRANCHE_SLUGS } from "@/lib/branchen";
import { ALL_CPV_CODES } from "@/lib/cpv-codes";
import { ALL_PROCEDURE_TYPE_SLUGS } from "@/lib/procedure-types";
import { generateTenderSlug } from "@/lib/tender-slug";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export const revalidate = 3600;
// The DB-backed tender URLs must be generated at request time. A static build
// can run before PostgreSQL is available and would otherwise cache only the
// fallback static entries in the image.
export const dynamic = "force-dynamic";

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

  // SEO: Always emit static URLs first — these never depend on DB/Meilisearch availability
  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteUrl}/funktionen`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/ausschreibungen`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // SEO: Always include all category pages — they have editorial content and generateStaticParams
  for (const [category, catSlug] of Object.entries(CATEGORY_SLUGS)) {
    if (!catSlug) continue;
    entries.push({
      url: `${siteUrl}/ausschreibungen/${catSlug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  // SEO: Always include portal landing pages (DTVP, TED, evergabe, Bauportal)
  for (const portalSlug of ALL_PORTAL_SLUGS) {
    entries.push({
      url: `${siteUrl}/ausschreibungen/${portalSlug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });
    // SEO: Portal×Category cross pages — target "{Portal} {Kategorie}" long-tail keywords
    for (const [, catSlug] of Object.entries(CATEGORY_SLUGS)) {
      if (!catSlug) continue;
      entries.push({
        url: `${siteUrl}/ausschreibungen/${portalSlug}/${catSlug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // SEO: Always include CPV code landing pages — target "{CPV-Code} Ausschreibungen" queries
  for (const cpvCode of ALL_CPV_CODES) {
    entries.push({
      url: `${siteUrl}/ausschreibungen/cpv/${cpvCode}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // SEO: Always include procedure type landing pages — target "{Verfahren} Ausschreibungen" queries
  for (const procSlug of ALL_PROCEDURE_TYPE_SLUGS) {
    entries.push({
      url: `${siteUrl}/ausschreibungen/verfahren/${procSlug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // SEO: Always include Wissen hub + article pages
  entries.push({
    url: `${siteUrl}/wissen`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  });
  for (const articleSlug of ALL_ARTICLE_SLUGS) {
    const article = ARTICLES[articleSlug];
    entries.push({
      url: `${siteUrl}/wissen/${articleSlug}`,
      lastModified: new Date(article.dateModified),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // SEO: Vergabelexikon — hub + glossary entries
  entries.push({
    url: `${siteUrl}/lexikon`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  });
  for (const glossarySlug of ALL_GLOSSARY_SLUGS) {
    entries.push({
      url: `${siteUrl}/lexikon/${glossarySlug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // SEO: Vorlagen Hub — hub + template entries targeting commercial download-intent keywords
  entries.push({
    url: `${siteUrl}/vorlagen`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  });
  for (const templateSlug of ALL_TEMPLATE_SLUGS) {
    entries.push({
      url: `${siteUrl}/vorlagen/${templateSlug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // SEO: Vergabe-Tools — hub + interactive tool pages (high engagement, bookmark-worthy)
  const TOOL_SLUGS = ["schwellenwert-rechner", "fristenrechner", "ruegefrist-rechner"];
  entries.push({
    url: `${siteUrl}/tools`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  });
  for (const toolSlug of TOOL_SLUGS) {
    entries.push({
      url: `${siteUrl}/tools/${toolSlug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  // SEO: Branchen — hub + deep industry profiles (CPV codes, Eignungskriterien, Besonderheiten)
  entries.push({
    url: `${siteUrl}/branchen`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  });
  for (const brancheSlug of ALL_BRANCHE_SLUGS) {
    entries.push({
      url: `${siteUrl}/branchen/${brancheSlug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // SEO: Always include all Bundesland region pages — they have editorial content and generateStaticParams
  for (const [, blSlug] of Object.entries(BUNDESLAND_SLUGS)) {
    entries.push({
      url: `${siteUrl}/ausschreibungen/region/${blSlug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  // SEO: Always include all Region×Category cross pages — they have generateStaticParams
  for (const [, blSlug] of Object.entries(BUNDESLAND_SLUGS)) {
    for (const [, catSlug] of Object.entries(CATEGORY_SLUGS)) {
      if (!catSlug) continue;
      entries.push({
        url: `${siteUrl}/ausschreibungen/region/${blSlug}/${catSlug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // SEO: Always include all city landing pages — they have editorial content and generateStaticParams
  for (const citySlug of ALL_CITY_SLUGS) {
    entries.push({
      url: `${siteUrl}/ausschreibungen/stadt/${citySlug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  // SEO: Always include all City×Category cross pages — they have generateStaticParams
  for (const citySlug of ALL_CITY_SLUGS) {
    for (const [, catSlug] of Object.entries(CATEGORY_SLUGS)) {
      if (!catSlug) continue;
      entries.push({
        url: `${siteUrl}/ausschreibungen/stadt/${citySlug}/${catSlug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // SEO: Portal×Region cross pages (4 portals × 16 Bundesländer = 64 pages)
  for (const portalSlug of ALL_PORTAL_SLUGS) {
    for (const blSlug of Object.values(BUNDESLAND_SLUGS)) {
      entries.push({
        url: `${siteUrl}/ausschreibungen/${portalSlug}/region/${blSlug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // SEO: Portal×City cross pages (4 portals × 56 cities = 224 pages)
  for (const portalSlug of ALL_PORTAL_SLUGS) {
    for (const citySlug of ALL_CITY_SLUGS) {
      entries.push({
        url: `${siteUrl}/ausschreibungen/${portalSlug}/stadt/${citySlug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // SEO: Verfahren×Kategorie cross pages (5 procedure types × 13 categories = 65 pages)
  for (const procSlug of ALL_PROCEDURE_TYPE_SLUGS) {
    for (const [, catSlug] of Object.entries(CATEGORY_SLUGS)) {
      if (!catSlug) continue;
      entries.push({
        url: `${siteUrl}/ausschreibungen/verfahren/${procSlug}/${catSlug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // SEO: CPV×Kategorie cross pages (25 CPV codes × 13 categories = 325 pages)
  for (const cpvCode of ALL_CPV_CODES) {
    for (const [, catSlug] of Object.entries(CATEGORY_SLUGS)) {
      if (!catSlug) continue;
      entries.push({
        url: `${siteUrl}/ausschreibungen/cpv/${cpvCode}/${catSlug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.4,
      });
    }
  }

  // --- Dynamic URLs below: gracefully degrade on DB/Meilisearch errors ---

  let tenderRows: { id: number; title: string | null; updatedAt: Date | null; metadataJson: unknown; slug: string | null }[] = [];
  let categoryRows: { category: string | null; updatedAt: Date | null }[] = [];
  let companyRows: { slug: string | null; updatedAt: Date | null; logoUrl: string | null }[] = [];

  try {
    [tenderRows, categoryRows, companyRows] = await Promise.all([
      db
        .select({ id: tenders.id, slug: tenders.slug, title: tenders.title, updatedAt: tenders.updatedAt, metadataJson: tenders.metadataJson })
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
    // SEO: DB unavailable — static URLs above are still returned. Dynamic tender/company/agency URLs are skipped.
    console.error("[sitemap] DB query failed, returning static URLs only");
    return entries;
  }

  const maxTenderUpdated = tenderRows.reduce<Date>((max, row) => {
    const d = row.updatedAt ?? new Date();
    return d > max ? d : max;
  }, new Date(0));

  // SEO: Enrich homepage and hub page with real lastModified from tenders
  entries[0].lastModified = maxTenderUpdated;
  entries[2].lastModified = maxTenderUpdated;

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

  // SEO: Add tender detail pages
  for (const row of tenderRows) {
    const meta = (typeof row.metadataJson === "object" && row.metadataJson !== null
      ? row.metadataJson as Record<string, unknown>
      : {}) as Record<string, unknown>;
    const location = typeof meta.location === "string" ? meta.location : "";
    // Prefer persisted DB slug (stable), fall back to live computation for legacy rows
    const slug = row.slug ?? generateTenderSlug(row.title ?? "", location);
    entries.push({
      url: `${siteUrl}/ausschreibung/${row.id}/${slug}`,
      lastModified: row.updatedAt ?? new Date(),
      changeFrequency: "daily",
      priority: 0.6,
      images: [`${siteUrl}/ausschreibung/${row.id}/${slug}/opengraph-image`],
    });
  }

  // SEO: Add company profile pages
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

  // SEO: Enrich region pages with real lastModified from tenders
  for (const [bundesland, blSlug] of Object.entries(BUNDESLAND_SLUGS)) {
    const blUpdated = bundeslandMaxUpdated.get(bundesland);
    if (blUpdated) {
      const existing = entries.find((e) => e.url === `${siteUrl}/ausschreibungen/region/${blSlug}`);
      if (existing) existing.lastModified = blUpdated;
    }
  }

  // SEO: Enrich city pages with real lastModified from tenders
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

  for (const citySlug of ALL_CITY_SLUGS) {
    const cityEntry = CITY_SLUG_MAP[citySlug];
    if (!cityEntry) continue;
    const cityUpdated = cityMaxUpdated.get(cityEntry.label);
    if (cityUpdated) {
      const existing = entries.find((e) => e.url === `${siteUrl}/ausschreibungen/stadt/${citySlug}`);
      if (existing) existing.lastModified = cityUpdated;
    }
  }

  // SEO: Include Auftraggeber/agency pages (only those with ≥3 tenders)
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
    // SEO: Agency query failed — skip agency entries, static URLs still returned
    console.error("[sitemap] Agency query failed, skipping agency entries");
  }

  return entries;
}
