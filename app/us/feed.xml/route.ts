import { searchUsTenders, getUsTenderMetadata } from "@/lib/us/repository";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenderhunter.palemadigital.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDeadline(date: Date | null): string {
  if (!date) return "No deadline";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(date);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const source = url.searchParams.get("source") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const subcontracting = url.searchParams.get("subcontracting");

  try {
    const { items } = await searchUsTenders({
      state,
      source,
      category,
      subcontracting: subcontracting === "true" ? true : subcontracting === "false" ? false : undefined,
      limit: 50,
      page: 1,
    });

    const filterParts = [state && `State: ${state}`, category && `Category: ${category}`, source && `Source: ${source}`, subcontracting === "true" && "Subcontracting only", subcontracting === "false" && "Direct bid only"].filter(Boolean);
    const channelTitle = filterParts.length > 0 ? `Tenderhunter US — Opportunities (${filterParts.join(", ")})` : "Tenderhunter US — Procurement Opportunities";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(siteUrl)}/us</link>
    <description>Active U.S. federal, state, and subcontracting procurement opportunities.</description>
    <language>en-US</language>
    <atom:link href="${escapeXml(siteUrl)}/us/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.map((tender) => {
  const meta = getUsTenderMetadata(tender);
  const buyer = typeof meta.subcontracting === "boolean" && meta.subcontracting ? "Subcontracting" : "Direct bid";
  const description = [
    tender.category ?? "",
    buyer,
    tender.buyer ?? "",
    `Due: ${formatDeadline(tender.deadlineAt)}`,
    tender.state ? `Location: ${tender.state}` : "",
  ].filter(Boolean).join(" · ");
  return `    <item>
      <title>${escapeXml(tender.title)}</title>
      <link>${escapeXml(siteUrl)}/us/tender/${tender.id}</link>
      <guid isPermaLink="true">${escapeXml(siteUrl)}/us/tender/${tender.id}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${tender.firstSeenAt.toUTCString()}</pubDate>
      ${tender.category ? `<category>${escapeXml(tender.category)}</category>` : ""}
    </item>`;
}).join("\n")}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Tenderhunter US</title><link>${escapeXml(siteUrl)}/us</link><description>Feed temporarily unavailable.</description></channel></rss>`,
      { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } }
    );
  }
}
