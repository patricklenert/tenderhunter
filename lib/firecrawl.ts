import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { decodeHtmlEntities } from "@/lib/text-normalization";
import {
  extractResourcesFromHtml,
  extractResourcesFromNetworkMetadata,
  isCapturableNetworkResponse,
  isSameOriginUrl,
  mergeDiscoveredResources,
  normalizeNetworkResponseMetadata,
  type DiscoveredResource,
  type NetworkResponseMetadata,
  rankSubpageCandidates,
  type RankedSubpageCandidate,
} from "@/lib/resource-discovery";

const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://localhost:8080";

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];
const BROWSER_IDLE_TIMEOUT_MS = 60_000;
const MAX_CAPTURED_NETWORK_RESPONSES = 200;
const MAX_DISCOVERED_RESOURCES = 500;

let browserInstance: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
let browserIdleTimer: NodeJS.Timeout | null = null;
let activeContexts = 0;

function clearBrowserIdleTimer(): void {
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }
}

function scheduleBrowserShutdown(): void {
  clearBrowserIdleTimer();
  if (activeContexts > 0 || !browserInstance) return;

  browserIdleTimer = setTimeout(() => {
    browserIdleTimer = null;
    if (activeContexts > 0 || !browserInstance) return;

    const browser = browserInstance;
    browserInstance = null;
    void browser.close().catch(() => {});
  }, BROWSER_IDLE_TIMEOUT_MS);
  browserIdleTimer.unref();
}

const closeWithTimeout = async (close: () => Promise<void>, timeoutMs = 5_000): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      close().catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

async function getBrowser(): Promise<Browser> {
  clearBrowserIdleTimer();
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
        clearBrowserIdleTimer();
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
  /** Safe, normalized resources found in the rendered DOM. */
  links: DiscoveredResource[];
  /** Deduplicated DOM and same-origin network resources. */
  resources: DiscoveredResource[];
  /** Bounded same-origin page links ranked by tender-related keywords. */
  subpageCandidates: RankedSubpageCandidate[];
  /** Metadata only; response bodies and sensitive headers are never retained. */
  networkResponses: NetworkResponseMetadata[];
}

export interface BrowserResourceFetch {
  body: Buffer;
  status: number;
  url: string;
  contentType: string | null;
  contentDisposition: string | null;
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
  const stripped = html
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
    .replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(stripped)
    // Collapse runs of spaces/tabs (but preserve newlines) so wrapped lines stay readable
    .replace(/[^\S\n]+/g, " ")
    // Collapse 3+ newlines into one blank line
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetch a public resource after opening its source page in the same browser
 * context. Several procurement portals set a short-lived session cookie before
 * serving otherwise-public downloads.
 */
export async function fetchResourceWithBrowserSession(
  sourcePageUrl: string,
  resourceUrl: string,
  options?: { accept?: string; userAgent?: string; timeoutMs?: number },
): Promise<BrowserResourceFetch> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: options?.userAgent
      ?? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  activeContexts += 1;

  try {
    const page = await context.newPage();
    await page.goto(sourcePageUrl, {
      waitUntil: "domcontentloaded",
      timeout: options?.timeoutMs ?? 30_000,
    });

    const response = await context.request.get(resourceUrl, {
      headers: {
        Accept: options?.accept ?? "application/pdf,application/octet-stream,*/*;q=0.5",
        Referer: sourcePageUrl,
        "User-Agent": options?.userAgent
          ?? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      },
      maxRedirects: 5,
      timeout: options?.timeoutMs ?? 30_000,
    });
    if (!response.ok()) {
      throw new Error(`Browser-Download fehlgeschlagen: HTTP ${response.status()}`);
    }

    const headers = response.headers();
    return {
      body: await response.body(),
      status: response.status(),
      url: response.url(),
      contentType: headers["content-type"] ?? null,
      contentDisposition: headers["content-disposition"] ?? null,
    };
  } finally {
    await closeWithTimeout(() => context.close());
    activeContexts = Math.max(0, activeContexts - 1);
    scheduleBrowserShutdown();
  }
}

export async function scrapeWebsite(
  url: string,
  options?: { onlyMainContent?: boolean; waitForSelector?: string; waitMs?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; useBodyText?: boolean; requestUrlGuard?: (url: string) => boolean | Promise<boolean>; signal?: AbortSignal }
): Promise<ScrapedPage> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const browser = await getBrowser();
      let context: BrowserContext | null = null;
      let onAbort: (() => void) | undefined;
      try {
        context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          viewport: { width: 1280, height: 800 },
        });
        activeContexts += 1;

        if (options?.signal) {
          if (options.signal.aborted) {
            throw new Error("Scraping aborted");
          }
          onAbort = () => {
            void context?.close().catch(() => {});
          };
          options.signal.addEventListener("abort", onAbort, { once: true });
        }

        const page: Page = await context.newPage();

        if (options?.requestUrlGuard) {
          await page.route("**/*", async (route) => {
            const allowed = await options.requestUrlGuard?.(route.request().url());
            if (allowed === false) {
              await route.abort();
            } else {
              await route.continue();
            }
          });
        }
        const capturedNetworkResponses = new Map<string, NetworkResponseMetadata>();
        const captureNetworkResponse = (response: Response): void => {
          if (capturedNetworkResponses.size >= MAX_CAPTURED_NETWORK_RESPONSES) return;

          const headers = response.headers();
          const metadata = normalizeNetworkResponseMetadata({
            url: response.url(),
            method: response.request().method(),
            status: response.status(),
            contentType: headers["content-type"] ?? null,
            contentDisposition: headers["content-disposition"] ?? null,
            resourceType: response.request().resourceType(),
          });
          if (!metadata || !isCapturableNetworkResponse(metadata)) return;

          const key = [metadata.url, metadata.method, metadata.status, metadata.contentType, metadata.contentDisposition, metadata.resourceType].join("\u001f");
          if (!capturedNetworkResponses.has(key)) capturedNetworkResponses.set(key, metadata);
        };
        page.on("response", captureNetworkResponse);

        await page.goto(url, { waitUntil: options?.waitUntil ?? "domcontentloaded", timeout: 30000 });

        if (options?.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, { timeout: 15000 }).catch(() => {});
        }
        if (options?.waitMs) {
          await page.waitForTimeout(options.waitMs);
        }

        const title = await page.title();
        let html = "";
        let markdown: string;

        if (options?.useBodyText) {
          // SPA detail pages can contain several megabytes of markup. Keep only
          // visible text when the caller does not need DOM/resource discovery.
          const visibleText = await page.evaluate(() => document.body?.innerText ?? "");
          if (visibleText.length > 200) {
            markdown = visibleText;
          } else {
            html = await page.content();
            markdown = htmlToBasicMarkdown(html);
          }
        } else {
          html = await page.content();
          if (options?.onlyMainContent !== false) {
            const cleanContent = extractWithReadability(html, url);
            if (cleanContent.length > 500) {
              markdown = cleanContent;
            } else {
              markdown = htmlToBasicMarkdown(html);
            }
          } else {
            markdown = htmlToBasicMarkdown(html);
          }
        }

        const finalUrl = page.url();
        const networkResponses = [...capturedNetworkResponses.values()].filter((response) => isSameOriginUrl(response.url, finalUrl));
        const links = extractResourcesFromHtml(html, finalUrl, { maxResources: MAX_DISCOVERED_RESOURCES });
        const networkResources = extractResourcesFromNetworkMetadata(networkResponses, finalUrl, {
          sameOriginOnly: true,
          maxResources: MAX_DISCOVERED_RESOURCES,
        });
        const resources = mergeDiscoveredResources(links, networkResources).slice(0, MAX_DISCOVERED_RESOURCES);
        const subpageCandidates = rankSubpageCandidates(links, { baseUrl: finalUrl });

        return { url: finalUrl, markdown, title, html, links, resources, subpageCandidates, networkResponses };
      } finally {
        if (onAbort && options?.signal) {
          options.signal.removeEventListener("abort", onAbort);
        }
        if (context) {
          await closeWithTimeout(() => context!.close());
          activeContexts = Math.max(0, activeContexts - 1);
        }
        scheduleBrowserShutdown();
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
