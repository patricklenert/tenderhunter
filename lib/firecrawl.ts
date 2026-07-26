import { chromium, type Browser, type Page } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://localhost:8080";

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

let browserInstance: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  // If a launch is already in flight, wait for it
  if (browserPromise) return browserPromise;
  // If we have a connected instance, use it
  if (browserInstance?.isConnected()) return browserInstance;

  // Clear any stale reference
  browserInstance = null;

  // Launch with a single-flight pattern: only one launch at a time
  browserPromise = chromium
    .launch({ headless: true, args: BROWSER_ARGS })
    .then((b) => {
      browserInstance = b;
      browserPromise = null;
      b.on("disconnected", () => {
        // Only clear if this is still the active instance
        if (browserInstance === b) {
          browserInstance = null;
        }
      });
      return b;
    })
    .catch((e) => {
      browserPromise = null;
      browserInstance = null;
      throw e;
    });

  return browserPromise;
}

export interface ScrapedPage {
  url: string;
  markdown: string;
  title: string | null;
  html: string;
}

function extractWithReadability(html: string, url: string): string {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article?.textContent) {
      return article.textContent.replace(/\n{3,}/g, "\n\n").trim();
    }
  } catch {
    // Readability failed
  }
  return "";
}

export function htmlToBasicMarkdown(html: string): string {
  return html
    // Strip script, style, svg, and noscript tags with their content first
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    // Headings: emit markdown-style prefix so labels and values do not glue together
    .replace(/<h[1-6][^>]*>/gi, "\n## ")
    .replace(/<\/h[1-6]>/gi, "\n")
    // Paragraphs and breaks
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // List items
    .replace(/<li[^>]*>/gi, "\n- ")
    // Block-level structural tags: ensure a newline at every open/close boundary
    // (div, tr, dt, dd, ul, ol, table, section, article, header, footer, main, aside, etc.)
    // Without this, cheerio's .text() glues labels and values together (Bug: mangled captions).
    .replace(/<\/?(?:div|span|tr|td|th|dt|dd|ul|ol|tbody|thead|table|section|article|header|footer|main|aside|figure|figcaption|blockquote|address|fieldset|form|details|summary|dl|figure)[^>]*>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/&nbsp;/g, " ")
    // Collapse runs of spaces/tabs (but preserve newlines) so wrapped lines stay readable
    .replace(/[^\S\n]+/g, " ")
    // Collapse 3+ newlines into one blank line
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function scrapeWebsite(
  url: string,
  options?: { onlyMainContent?: boolean; waitForSelector?: string; waitMs?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; useBodyText?: boolean }
): Promise<ScrapedPage> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const browser = await getBrowser();
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
      });
      const page: Page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: options?.waitUntil ?? "domcontentloaded", timeout: 30000 });

        if (options?.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, { timeout: 15000 }).catch(() => {});
        }
        if (options?.waitMs) {
          await page.waitForTimeout(options.waitMs);
        }

        const title = await page.title();
        const html = await page.content();

        let markdown: string;

        if (options?.useBodyText) {
          // For SPA pages: use visible text to avoid JS/CSS/filter noise
          const visibleText = await page.evaluate(() => document.body?.innerText ?? "");
          markdown = visibleText.length > 200 ? visibleText : htmlToBasicMarkdown(html);
        } else if (options?.onlyMainContent !== false) {
          const cleanContent = extractWithReadability(html, url);
          if (cleanContent.length > 500) {
            markdown = cleanContent;
          } else {
            markdown = htmlToBasicMarkdown(html);
          }
        } else {
          markdown = htmlToBasicMarkdown(html);
        }

        const finalUrl = page.url();

        return { url: finalUrl, markdown, title, html };
      } finally {
        await context.close().catch(() => {});
      }
    } catch (e) {
      if (attempt === 0 && String(e).includes("has been closed")) {
        browserInstance = null;
        browserPromise = null;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Failed to scrape ${url} after retries`);
}

export interface SearchResult {
  url: string;
  title: string | null;
  description: string | null;
  markdown: string | null;
}

export async function searchTenders(
  query: string,
  limit = 10,
  options?: { includeDomains?: string[]; tbs?: string }
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    pageno: "1",
  });

  if (options?.includeDomains && options.includeDomains.length > 0) {
    const siteQuery = options.includeDomains
      .map((d) => `site:${d}`)
      .join(" OR ");
    params.set("q", `${query} ${siteQuery}`);
  }

  const searchUrl = `${SEARXNG_URL}/search?${params.toString()}`;

  const response = await fetch(searchUrl, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    console.error(
      `[searxng] Search failed: ${response.status} ${response.statusText}`
    );
    return [];
  }

  const data = (await response.json()) as {
    results?: Array<{
      url?: string;
      title?: string;
      content?: string;
    }>;
  };

  const results = (data.results ?? []).slice(0, limit);

  const searchResults: SearchResult[] = results.map((r) => ({
    url: r.url ?? "",
    title: r.title ?? null,
    description: r.content ?? null,
    markdown: null,
  }));

  return searchResults;
}

export async function scrapeMultiple(urls: string[]): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  const batchSize = 3;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const scraped = await Promise.allSettled(
      batch.map(async (url) => {
        return scrapeWebsite(url);
      })
    );

    for (let j = 0; j < scraped.length; j++) {
      const result = scraped[j];
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}
