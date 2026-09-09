/**
 * Verification: real tender scraping through Obscura (CDP) instead of local Chromium.
 * Exercises scrapeWebsite (route guard, networkidle, evaluate, content) and
 * fetchResourceWithBrowserSession (context.request with session cookies).
 */
import { scrapeWebsite, fetchResourceWithBrowserSession } from "@/lib/firecrawl";

const main = async (): Promise<void> => {
  // 1. Static page sanity
  const example = await scrapeWebsite("https://example.com", { onlyMainContent: false });
  if (!example.markdown.includes("Example Domain")) throw new Error("example.com markdown missing");
  console.log("[obscura-check] example.com OK:", JSON.stringify(example.title));

  // 2. Real SPA tender portal (TED) with useBodyText — the former OOM path
  const ted = await scrapeWebsite("https://ted.europa.eu/en/search/result", {
    onlyMainContent: false,
    useBodyText: true,
    waitMs: 2000,
  });
  if (ted.markdown.trim().length < 200) throw new Error(`TED body text too short: ${ted.markdown.length}`);
  console.log(`[obscura-check] TED OK: markdown=${ted.markdown.length} chars, resources=${ted.resources.length}, subpages=${ted.subpageCandidates.length}, title=${JSON.stringify(ted.title)}`);

  // 3. German portal with resource discovery (exercises Readability + HTML path)
  const bund = await scrapeWebsite("https://www.bund.de/DE/Ausschreibungen/ausschreibungen-node.html", {
    onlyMainContent: false,
  });
  console.log(`[obscura-check] bund.de OK: markdown=${bund.markdown.length} chars, links=${bund.links.length}, network=${bund.networkResponses.length}`);

  // 4. Request-guard (route interception) — used by preview.ts
  let blocked = 0;
  const guarded = await scrapeWebsite("https://example.com", {
    onlyMainContent: false,
    requestUrlGuard: (url) => {
      if (url.includes("example.com")) return true;
      blocked += 1;
      return false;
    },
  });
  if (!guarded.markdown) throw new Error("guarded scrape empty");
  console.log(`[obscura-check] requestUrlGuard OK (blocked ${blocked} foreign requests)`);

  // 5. Session download — fetchResourceWithBrowserSession uses context.request over CDP
  const download = await fetchResourceWithBrowserSession(
    "https://example.com/",
    "https://example.com/",
    { accept: "text/html,*/*", timeoutMs: 20000 },
  );
  if (download.status !== 200 || download.body.length === 0) throw new Error(`session fetch failed: ${download.status}`);
  console.log(`[obscura-check] fetchResourceWithBrowserSession OK: status=${download.status}, body=${download.body.length} bytes, type=${download.contentType}`);

  console.log("ALL OBSCURA CHECKS PASSED");
  process.exit(0);
};

main().catch((error) => {
  console.error("[obscura-check] FAILED:", error);
  process.exit(1);
});
