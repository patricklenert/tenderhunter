import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, or, gt, isNull, desc } from "drizzle-orm";
import { generateTenderSlug } from "@/lib/tender-slug";
import { readPublicTenderMeta } from "@/lib/tender-meta";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

import { getSiteUrl } from "@/lib/site-config";

const SITE_URL = getSiteUrl();

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

  const rows = await db
    .select({
      id: tenders.id,
      title: tenders.title,
      source: tenders.source,
      url: tenders.url,
      metadataJson: tenders.metadataJson,
      category: tenders.category,
      deadlineAt: tenders.deadlineAt,
      updatedAt: tenders.updatedAt,
      createdAt: tenders.createdAt,
      slug: tenders.slug,
    })
    .from(tenders)
    .where(
      and(
        eq(tenders.qualityStatus, "qualified"),
        or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
      ),
    )
    .orderBy(desc(tenders.createdAt))
    .limit(50);

  const items = rows.map((row) => {
    const meta = readPublicTenderMeta(row.metadataJson, {
      title: row.title,
      source: row.source,
      sourceUrl: row.url,
    });
    const location = meta.location;
    const client = meta.client;
    const description = meta.description;
    const slug = row.slug ?? generateTenderSlug(row.title ?? "", location);
    const link = `${SITE_URL}/ausschreibung/${row.id}/${slug}`;
    const pubDate = (row.createdAt ?? row.updatedAt ?? now).toUTCString();

    const titleParts = [row.title, client].filter(Boolean).join(" — ");

    return `    <item>
      <title>${escapeXml(titleParts)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      ${row.category ? `<category>${escapeXml(row.category)}</category>` : ""}
      <description>${escapeXml(description.slice(0, 300))}</description>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tenderhunter — Aktuelle Ausschreibungen</title>
    <link>${SITE_URL}</link>
    <description>Öffentliche Ausschreibungen aus Deutschland — Bau, IT, Dienstleistungen und mehr.</description>
    <language>de-DE</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
