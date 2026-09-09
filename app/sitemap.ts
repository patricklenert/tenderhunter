import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { tenders, companyProfiles, scores, structuredData } from "@/lib/schema";
import { eq, and, or, gt, isNull, isNotNull, sql } from "drizzle-orm";
import { CATEGORY_SLUGS } from "@/lib/categories";
import { BUNDESLAND_SLUGS, deriveBundesland, deriveCity } from "@/lib/bundesland";
import { CITY_SLUG_MAP, ALL_CITY_SLUGS } from "@/lib/cities";
import { isIndexableAgencyName, normalizeAgencySlug } from "@/lib/agencies";
import { ALL_PORTAL_SLUGS, PORTALS } from "@/lib/portal-content";
import { ALL_ARTICLE_SLUGS, ARTICLES } from "@/lib/articles";
import { ALL_GLOSSARY_SLUGS, GLOSSARY_MAP } from "@/lib/glossary";
import { ALL_TEMPLATE_SLUGS } from "@/lib/templates";
import { ALL_BRANCHE_SLUGS } from "@/lib/branchen";
import { ALL_CPV_CODES } from "@/lib/cpv-codes";
import { ALL_PROCEDURE_TYPE_SLUGS, getProcedureDatabaseValues } from "@/lib/procedure-types";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { readPublicTenderMeta } from "@/lib/tender-meta";
import { pickValidatedPublicLocationForTender } from "@/lib/public-content-quality";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

function normalizeDate(value: unknown, fallback: Date): Date {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : fallback;

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function toIsoDate(value: unknown, fallback: Date): string {
  return normalizeDate(value, fallback).toISOString();
}

function escapeSitemapValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

type TenderSitemapRow = {
  id: number;
  title: string | null;
  updatedAt: Date | null;
  metadataJson: unknown;
  structuredJson: unknown;
  url: string | null;
  slug: string | null;
  source: string;
  category: string | null;
  procedureType: string | null;
};

type TenderContext = TenderSitemapRow & {
  location: string;
  bundesland: string | null;
  city: string | null;
  cpvCodes: string[];
};

function getTenderContext(row: TenderSitemapRow): TenderContext {
  const metadata = readPublicTenderMeta(row.metadataJson, {
    title: row.title,
    source: row.source,
    sourceUrl: row.url ?? undefined,
  });
  const structured = asRecord(row.structuredJson);
  const hardFacts = asRecord(structured.hard_facts);
  const procurement = asRecord(structured.procurement);
  const metadataLocation = metadata.location;
  const structuredLocation = typeof hardFacts.location === "string" ? hardFacts.location.trim() : "";
  const location = pickValidatedPublicLocationForTender(row.title, metadata.client, metadataLocation, structuredLocation);
  const rawCpvCodes = procurement.cpv_codes ?? procurement.cpvCodes;
  const cpvCodes = Array.isArray(rawCpvCodes)
    ? rawCpvCodes.filter((value): value is string => typeof value === "string")
    : [];

  return {
    ...row,
    location,
    bundesland: deriveBundesland(location),
    city: deriveCity(location),
    cpvCodes,
  };
}

function hasCpvCode(row: TenderContext, code: string): boolean {
  const divisionCode = `${code.slice(0, 2)}000000`;
  return row.cpvCodes.some((candidate) => candidate === code || candidate === divisionCode);
}

export const revalidate = 3600;
// The DB-backed tender URLs must be generated at request time. A static build
// can run before PostgreSQL is available and would otherwise cache only the
// editorial fallback entries.
export const dynamic = "force-dynamic";

/**
 * Emit only clean canonical URLs. Editorial hubs are always present; result
 * landing pages are added only when the same qualified/open catalog contains
 * at least one matching tender.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  const urls = new Set<string>();

  const addEntry = (entry: MetadataRoute.Sitemap[number]): void => {
    if (urls.has(entry.url)) return;
    urls.add(entry.url);
    entries.push(entry);
  };

  // Editorial pages remain indexable even when the live catalog has no result
  // for one taxonomy; they contain substantive copy, FAQs, and links.
  addEntry({ url: siteUrl, lastModified: now, changeFrequency: "hourly", priority: 1 });
  addEntry({ url: `${siteUrl}/funktionen`, lastModified: now, changeFrequency: "monthly", priority: 0.9 });
  addEntry({ url: `${siteUrl}/ausschreibungen`, lastModified: now, changeFrequency: "weekly", priority: 0.9 });

  for (const catSlug of Object.values(CATEGORY_SLUGS)) {
    if (!catSlug) continue;
    addEntry({
      url: `${siteUrl}/ausschreibungen/${catSlug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  for (const portalSlug of ALL_PORTAL_SLUGS) {
    addEntry({
      url: `${siteUrl}/ausschreibungen/${portalSlug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  addEntry({ url: `${siteUrl}/wissen`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
  for (const articleSlug of ALL_ARTICLE_SLUGS) {
    const article = ARTICLES[articleSlug];
    addEntry({
      url: `${siteUrl}/wissen/${articleSlug}`,
      lastModified: new Date(article.dateModified),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  addEntry({ url: `${siteUrl}/lexikon`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
  for (const glossarySlug of ALL_GLOSSARY_SLUGS) {
    const glossaryEntry = GLOSSARY_MAP[glossarySlug];
    addEntry({
      url: `${siteUrl}/lexikon/${glossarySlug}`,
      ...(glossaryEntry.lastReviewed ? { lastModified: new Date(glossaryEntry.lastReviewed) } : {}),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  addEntry({ url: `${siteUrl}/vorlagen`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
  for (const templateSlug of ALL_TEMPLATE_SLUGS) {
    addEntry({
      url: `${siteUrl}/vorlagen/${templateSlug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  const toolSlugs = ["schwellenwert-rechner", "fristenrechner", "ruegefrist-rechner"];
  addEntry({ url: `${siteUrl}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.8 });
  for (const toolSlug of toolSlugs) {
    addEntry({ url: `${siteUrl}/tools/${toolSlug}`, lastModified: now, changeFrequency: "monthly", priority: 0.8 });
  }

  addEntry({ url: `${siteUrl}/branchen`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
  for (const brancheSlug of ALL_BRANCHE_SLUGS) {
    addEntry({ url: `${siteUrl}/branchen/${brancheSlug}`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
  }

  let tenderRows: TenderSitemapRow[] = [];
  let companyRows: { slug: string | null; updatedAt: Date | null; logoUrl: string | null }[] = [];

  try {
    [tenderRows, companyRows] = await Promise.all([
      db
        .select({
          id: tenders.id,
          slug: tenders.slug,
          title: tenders.title,
          updatedAt: tenders.updatedAt,
          metadataJson: tenders.metadataJson,
          structuredJson: structuredData.jsonBlob,
          url: tenders.url,
          source: tenders.source,
          category: tenders.category,
          procedureType: tenders.procedureType,
        })
        .from(tenders)
        .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
        .where(
          and(
            eq(tenders.qualityStatus, "qualified"),
            or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          ),
        ),
      db
        .select({ slug: companyProfiles.slug, updatedAt: companyProfiles.updatedAt, logoUrl: companyProfiles.logoUrl })
        .from(companyProfiles)
        .innerJoin(scores, eq(scores.companyId, companyProfiles.id))
        .innerJoin(tenders, and(
          eq(scores.tenderId, tenders.id),
          eq(tenders.qualityStatus, "qualified"),
        ))
        .where(isNotNull(companyProfiles.slug))
        .groupBy(companyProfiles.id, companyProfiles.slug, companyProfiles.updatedAt, companyProfiles.logoUrl),
    ]) as [TenderSitemapRow[], typeof companyRows];
  } catch {
    // DB unavailable: keep only editorial URLs whose response is independent of the catalog.
    console.error("[sitemap] DB query failed, returning editorial URLs only");
    return entries.map((entry) => ({
      ...entry,
      lastModified: toIsoDate(entry.lastModified, now),
    }));
  }

  const contexts = tenderRows.map(getTenderContext);
  const maxTenderUpdated = contexts.reduce<Date>((max, row) => {
    const updatedAt = normalizeDate(row.updatedAt, now);
    return updatedAt > max ? updatedAt : max;
  }, new Date(0));
  const lastModified = maxTenderUpdated.getTime() > 0 ? maxTenderUpdated : now;

  entries[0].lastModified = toIsoDate(lastModified, now);
  entries[2].lastModified = toIsoDate(lastModified, now);

  const regionUpdated = new Map<string, Date>();
  const cityUpdated = new Map<string, Date>();
  const globalRegionCategories = new Set<string>();
  const globalCityCategories = new Set<string>();
  const categoryRows = new Set<string>();

  for (const row of contexts) {
    const updatedAt = normalizeDate(row.updatedAt, now);
    if (row.category) categoryRows.add(row.category);
    if (row.bundesland) {
      const previous = regionUpdated.get(row.bundesland);
      if (!previous || updatedAt > previous) regionUpdated.set(row.bundesland, updatedAt);
      if (row.category) globalRegionCategories.add(`${row.bundesland}\0${row.category}`);
    }
    if (row.city) {
      const previous = cityUpdated.get(row.city);
      if (!previous || updatedAt > previous) cityUpdated.set(row.city, updatedAt);
      if (row.category) globalCityCategories.add(`${row.city}\0${row.category}`);
    }
  }

  // Region/city pages are current-result landings, so only publish combinations
  // that can render at least one qualified/open tender.
  for (const [bundesland, blSlug] of Object.entries(BUNDESLAND_SLUGS)) {
    const updatedAt = regionUpdated.get(bundesland);
    if (!updatedAt) continue;
    addEntry({
      url: `${siteUrl}/ausschreibungen/region/${blSlug}`,
      lastModified: updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }
  for (const citySlug of ALL_CITY_SLUGS) {
    const city = CITY_SLUG_MAP[citySlug];
    const updatedAt = city ? cityUpdated.get(city.label) : undefined;
    if (!updatedAt) continue;
    addEntry({
      url: `${siteUrl}/ausschreibungen/stadt/${citySlug}`,
      lastModified: updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }
  for (const key of globalRegionCategories) {
    const [bundesland, category] = key.split("\0");
    const blSlug = BUNDESLAND_SLUGS[bundesland];
    const catSlug = CATEGORY_SLUGS[category];
    if (!blSlug || !catSlug) continue;
    addEntry({
      url: `${siteUrl}/ausschreibungen/region/${blSlug}/${catSlug}`,
      lastModified: regionUpdated.get(bundesland) ?? now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }
  for (const key of globalCityCategories) {
    const [cityName, category] = key.split("\0");
    const citySlug = ALL_CITY_SLUGS.find((slug) => CITY_SLUG_MAP[slug]?.label === cityName);
    const catSlug = CATEGORY_SLUGS[category];
    if (!citySlug || !catSlug) continue;
    addEntry({
      url: `${siteUrl}/ausschreibungen/stadt/${citySlug}/${catSlug}`,
      lastModified: cityUpdated.get(cityName) ?? now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Procedure roots and CPV roots are editorial landing pages. Their category
  // variants are only useful when the catalog contains a matching result.
  for (const procedureSlug of ALL_PROCEDURE_TYPE_SLUGS) {
    addEntry({
      url: `${siteUrl}/ausschreibungen/verfahren/${procedureSlug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }
  for (const cpvCode of ALL_CPV_CODES) {
    addEntry({
      url: `${siteUrl}/ausschreibungen/cpv/${cpvCode}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const portalSlug of ALL_PORTAL_SLUGS) {
    const portal = PORTALS[portalSlug];
    const portalRows = contexts.filter((row) => portal.sourceValues.includes(row.source));
    const portalCategories = new Set(portalRows.map((row) => row.category).filter((category): category is string => Boolean(category)));
    const portalRegions = new Set(portalRows.map((row) => row.bundesland).filter((region): region is string => Boolean(region)));
    const portalCities = new Set(portalRows.map((row) => row.city).filter((city): city is string => Boolean(city)));

    for (const category of portalCategories) {
      const catSlug = CATEGORY_SLUGS[category];
      if (!catSlug) continue;
      addEntry({
        url: `${siteUrl}/ausschreibungen/${portalSlug}/${catSlug}`,
        lastModified: lastModified,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const bundesland of portalRegions) {
      const blSlug = BUNDESLAND_SLUGS[bundesland];
      if (!blSlug) continue;
      addEntry({
        url: `${siteUrl}/ausschreibungen/${portalSlug}/region/${blSlug}`,
        lastModified: lastModified,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
    for (const cityName of portalCities) {
      const citySlug = ALL_CITY_SLUGS.find((slug) => CITY_SLUG_MAP[slug]?.label === cityName);
      if (!citySlug) continue;
      addEntry({
        url: `${siteUrl}/ausschreibungen/${portalSlug}/stadt/${citySlug}`,
        lastModified: lastModified,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  for (const procedureSlug of ALL_PROCEDURE_TYPE_SLUGS) {
    const databaseValues = getProcedureDatabaseValues(procedureSlug);
    for (const category of categoryRows) {
      if (!contexts.some((row) => databaseValues.includes(row.procedureType ?? "") && row.category === category)) continue;
      const catSlug = CATEGORY_SLUGS[category];
      if (!catSlug) continue;
      addEntry({
        url: `${siteUrl}/ausschreibungen/verfahren/${procedureSlug}/${catSlug}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  for (const cpvCode of ALL_CPV_CODES) {
    for (const category of categoryRows) {
      if (!contexts.some((row) => row.category === category && hasCpvCode(row, cpvCode))) continue;
      const catSlug = CATEGORY_SLUGS[category];
      if (!catSlug) continue;
      addEntry({
        url: `${siteUrl}/ausschreibungen/cpv/${cpvCode}/${catSlug}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.4,
      });
    }
  }

  for (const row of contexts) {
    const slug = getCanonicalTenderSlug(row.slug, row.title, row.metadataJson, row.structuredJson);
    addEntry({
      url: `${siteUrl}/ausschreibung/${row.id}/${slug}`,
      lastModified: row.updatedAt ?? now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  for (const row of companyRows) {
    if (!row.slug) continue;
    addEntry({
      url: `${siteUrl}/p/${row.slug}`,
      lastModified: row.updatedAt ?? now,
      changeFrequency: "weekly",
      priority: 0.5,
      ...(row.logoUrl ? { images: [escapeSitemapValue(row.logoUrl)] } : {}),
    });
  }

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
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
          sql`(${tenders.metadataJson}::jsonb->>'client') IS NOT NULL`,
        ),
      )
      .groupBy(sql`(${tenders.metadataJson}::jsonb->>'client')`)
      .having(sql`count(*) >= 3`);

    for (const row of clientRows) {
      if (!isIndexableAgencyName(row.client)) continue;
      const agencySlug = normalizeAgencySlug(row.client);
      if (agencySlug.length < 3) continue;
      addEntry({
        url: `${siteUrl}/auftraggeber/${agencySlug}`,
        lastModified: row.maxUpdated ?? now,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  } catch {
    console.error("[sitemap] Agency query failed, skipping agency entries");
  }

  return entries.map((entry) => ({
    ...entry,
    lastModified: toIsoDate(entry.lastModified, now),
  }));
}
