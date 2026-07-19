import { NextRequest, NextResponse } from "next/server";

const INDEXNOW_KEY = "4ebe462f0c8f45cbaa9b6bae50dc57dc";
const HOST = "palemaz.com";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;

async function submitUrls(urls: string[]) {
  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList: urls,
    }),
  });
  return res.status;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const singleUrl = body.url;

    // Single URL submission
    if (singleUrl) {
      const status = await submitUrls([singleUrl]);
      return NextResponse.json({ success: status === 200, status });
    }

    // Bulk: fetch sitemap
    const sitemapRes = await fetch(`https://${HOST}/sitemap.xml`);
    if (!sitemapRes.ok) {
      return NextResponse.json({ error: "Failed to fetch sitemap" }, { status: 500 });
    }
    const sitemapXml = await sitemapRes.text();
    const urlRegex = /<loc>(.*?)<\/loc>/g;
    const urls: string[] = [];
    let match;
    while ((match = urlRegex.exec(sitemapXml)) !== null) {
      urls.push(match[1]);
    }

    if (urls.length === 0) {
      return NextResponse.json({ error: "No URLs found" }, { status: 404 });
    }

    // Submit in batches of 10000 (IndexNow limit)
    const results: { status: number; count: number }[] = [];
    for (let i = 0; i < urls.length; i += 10000) {
      const batch = urls.slice(i, i + 10000);
      const status = await submitUrls(batch);
      results.push({ status, count: batch.length });
    }

    return NextResponse.json({ success: true, total: urls.length, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
