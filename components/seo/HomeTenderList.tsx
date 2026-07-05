import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, or, isNull, gt, asc } from "drizzle-orm";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categories";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

export async function getLatestTenders() {
  const now = new Date();
  const rows = await db
    .select({
      id: tenders.id,
      title: tenders.title,
      category: tenders.category,
      deadlineAt: tenders.deadlineAt,
      metadataJson: tenders.metadataJson,
    })
    .from(tenders)
    .where(
      and(
        or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
        or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
      ),
    )
    .orderBy(asc(tenders.deadlineAt))
    .limit(12);

  return rows.map((row) => {
    const meta =
      typeof row.metadataJson === "object" && row.metadataJson !== null
        ? (row.metadataJson as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      title: row.title ?? `Ausschreibung #${row.id}`,
      category: row.category,
      categoryLabel: CATEGORY_LABELS[row.category ?? "Sonstiges"] ?? row.category ?? "Diverse",
      categorySlug: CATEGORY_SLUGS[row.category ?? "Sonstiges"] ?? "diverse",
      deadline: row.deadlineAt
        ? new Date(row.deadlineAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
        : null,
      location: typeof meta.location === "string" ? meta.location.split(",")[0].trim().slice(0, 60) : null,
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
      url: `${siteUrl}/ausschreibung/${t.id}`,
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
