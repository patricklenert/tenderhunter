import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, inArray, or, gt, isNull, desc } from "drizzle-orm";
import { CATEGORY_LABELS } from "@/lib/categories";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const now = new Date();

  let items: Array<{
    id: number;
    title: string | null;
    category: string | null;
    source: string;
    deadlineAt: Date | null;
    createdAt: Date | null;
    metadataJson: unknown;
  }> = [];

  try {
    items = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        category: tenders.category,
        source: tenders.source,
        deadlineAt: tenders.deadlineAt,
        createdAt: tenders.createdAt,
        metadataJson: tenders.metadataJson,
      })
      .from(tenders)
      .where(
        and(
          inArray(tenders.qualityStatus, ["qualified", "candidate"]),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      )
      .orderBy(desc(tenders.createdAt))
      .limit(20);
  } catch {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Tenderhunter</title></channel></rss>`,
      { headers: { "Content-Type": "application/xml" } },
    );
  }

  const itemsXml = items
    .map((item) => {
      const meta =
        typeof item.metadataJson === "object" && item.metadataJson !== null
          ? (item.metadataJson as Record<string, unknown>)
          : {};
      const client =
        typeof meta.client === "string" ? escapeXml(meta.client) : "";
      const location =
        typeof meta.location === "string"
          ? escapeXml(meta.location.split(",")[0].trim())
          : "";
      const categoryLabel = item.category
        ? CATEGORY_LABELS[item.category] ?? item.category
        : "";
      const deadline = item.deadlineAt
        ? new Date(item.deadlineAt).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "Keine Frist";
      const description = escapeXml(
        `${categoryLabel} — ${client ? client + ", " : ""}${location ? location + ", " : ""}Frist: ${deadline}. Quelle: ${item.source}`,
      );
      const pubDate = item.createdAt
        ? new Date(item.createdAt).toUTCString()
        : now.toUTCString();

      return `    <item>
      <title>${escapeXml(item.title ?? `Ausschreibung #${item.id}`)}</title>
      <link>${siteUrl}/ausschreibung/${item.id}</link>
      <guid>${siteUrl}/ausschreibung/${item.id}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(categoryLabel)}</category>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tenderhunter – Aktuelle Ausschreibungen</title>
    <link>${siteUrl}</link>
    <description>Die neuesten öffentlichen Ausschreibungen aus deutschen Vergabeportalen – automatisch erfasst und kategorisiert.</description>
    <language>de-DE</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feeds/tender.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
