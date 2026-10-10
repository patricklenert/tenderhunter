import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, or, isNull, gt, asc } from "drizzle-orm";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { readPublicTenderMeta } from "@/lib/tender-meta";
import { projectPublicDisplayFields } from "@/lib/public-content-quality";

import { getSiteUrl } from "@/lib/site-config";

const siteUrl = getSiteUrl();

export const projectHomeTenderTitle = (title: string | null, id: number): string =>
  projectPublicDisplayFields({ title }).title || `Ausschreibung #${id}`;

export async function getLatestTenders() {
  const now = new Date();
  let rows: Array<{
    id: number;
    title: string | null;
    category: string | null;
    source: string;
    url: string | null;
    deadlineAt: Date | null;
    metadataJson: unknown;
    slug: string | null;
  }> = [];

  try {
    rows = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        category: tenders.category,
        source: tenders.source,
        url: tenders.url,
        deadlineAt: tenders.deadlineAt,
        metadataJson: tenders.metadataJson,
        slug: tenders.slug,
      })
      .from(tenders)
      .where(
        and(
          eq(tenders.qualityStatus, "qualified"),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      )
      .orderBy(asc(tenders.deadlineAt))
      .limit(12);
  } catch {
    // The editorial page remains crawlable when the optional live list is unavailable.
  }

  return rows.map((row) => {
    const title = projectHomeTenderTitle(row.title, row.id);
    const meta = readPublicTenderMeta(row.metadataJson, {
      title: row.title,
      source: row.source,
      sourceUrl: row.url,
    });
    const location = meta.location ? meta.location.split(",")[0].trim().slice(0, 60) : null;
    return {
      id: row.id,
      title,
      category: row.category,
      categoryLabel: CATEGORY_LABELS[row.category ?? "Sonstiges"] ?? row.category ?? "Diverse",
      categorySlug: CATEGORY_SLUGS[row.category ?? "Sonstiges"] ?? "diverse",
      deadline: row.deadlineAt
        ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      location,
      slug: getCanonicalTenderSlug(row.slug, title, {
        client: meta.client,
        location: meta.location,
      }),
    };
  });
}

export async function HomeTenderList() {
  const items = await getLatestTenders();

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Aktuelle Ausschreibungen",
    numberOfItems: items.length,
    itemListElement: items.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/ausschreibung/${t.id}/${t.slug}`,
      name: t.title,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
    />
  );
}
