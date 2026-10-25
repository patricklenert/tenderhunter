import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page, type Response as PlaywrightResponse } from "playwright";
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

/** CDP endpoint of the Obscura headless browser server (replaces local Chromium). */
const OBSCURA_CDP_URL = process.env.OBSCURA_CDP_URL ?? "ws://127.0.0.1:9222";
const OBSCURA_CDP_TOKEN = process.env.OBSCURA_CDP_TOKEN;
// This process-local cap combines with the other app/worker process caps.
const MAX_ACTIVE_BROWSER_CONTEXTS = 2;
const MAX_CAPTURED_NETWORK_RESPONSES = 200;
const MAX_DISCOVERED_RESOURCES = 500;
const DEFAULT_MAX_BROWSER_RESOURCE_BYTES = 50 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

let browserInstance: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
let activeContexts = 0;
const browserContextWaiters: Array<() => void> = [];
const trackedContexts = new WeakSet<BrowserContext>();

const acquireBrowserContextSlot = async (): Promise<void> => {
  if (activeContexts < MAX_ACTIVE_BROWSER_CONTEXTS) {
    activeContexts += 1;
    return;
  }
  await new Promise<void>((resolve) => browserContextWaiters.push(resolve));
};

const releaseBrowserContextSlot = (): void => {
  const nextWaiter = browserContextWaiters.shift();
  if (nextWaiter) {
    // Transfer the slot directly so a new caller cannot race the queued one.
    nextWaiter();
    return;
  }
  activeContexts = Math.max(0, activeContexts - 1);
};

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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const readStablePageContent = async (
  page: Page,
  navigationResponse?: Pick<PlaywrightResponse, "text"> | null,
): Promise<string> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(250);
      const content: unknown = await page.content();
      if (typeof content === "string") return content;
      lastError = new Error("Browser page.content returned a non-string value");
      break;
    } catch (error) {
      lastError = error;
      if (/expected string, got object/iu.test(String(error))) break;
      if (attempt < 2) await page.waitForTimeout(250).catch(() => {});
    }
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(250).catch(() => {});
    }
    try {
      const fallbackHtml: unknown = await page.evaluate(() => document.documentElement?.outerHTML ?? "");
      if (typeof fallbackHtml === "string" && fallbackHtml.trim()) return fallbackHtml;
      if (typeof fallbackHtml !== "string") {
        lastError ??= new Error("Browser DOM evaluation returned non-string HTML");
      }
    } catch (error) {
      // A navigation can make the first DOM snapshot unavailable; retry once
      // after the next document becomes interactive instead of dropping detail.
      lastError = isRecoverableBrowserError(error) ? error : (lastError ?? error);
      if (attempt === 0 && /page is navigating and changing the content/iu.test(String(error))) continue;
      break;
    }
  }
  if (navigationResponse) {
    try {
      const responseHtml: unknown = await navigationResponse.text();
      if (typeof responseHtml === "string" && responseHtml.trim()) return responseHtml;
    } catch (error) {
      // Preserve the page-content error if the main response is also unavailable.
      if (isRecoverableBrowserError(error)) lastError = error;
    }
  }
  try {
    const bodyText: unknown = await page.locator("body").innerText({ timeout: 2_000 });
    if (typeof bodyText === "string" && bodyText.trim()) {
      const escapedText = bodyText
        .replace(/&/gu, "&amp;")
        .replace(/</gu, "&lt;")
        .replace(/>/gu, "&gt;");
      return `<html><body><pre>${escapedText}</pre></body></html>`;
    }
  } catch (error) {
    // Preserve the original page-content error if visible text is unavailable.
    if (isRecoverableBrowserError(error)) lastError = error;
  }
  throw lastError ?? new Error("Page content unavailable");
};

export const readStablePageTitle = async (page: Page): Promise<string> => {
  try {
    const title: unknown = await page.title();
    if (typeof title === "string") return title;
  } catch {
    // Fall back to the DOM if Obscura cannot serialize page.title().
  }
  try {
    const title: unknown = await page.evaluate(() => document.title ?? "");
    if (typeof title === "string") return title;
  } catch {
    // A missing title must not discard otherwise usable page content.
  }
  return "";
};

/**
 * Errors that indicate the shared Obscura server restarted (e.g. after a Rust
 * panic triggered by a broken portal page). A retry after a short backoff then
 * lands on the freshly restarted server.
 */
export const isRecoverableBrowserError = (error: unknown): boolean => {
  const message = String(error);
  return message.includes("has been closed")
    || message.includes("ECONNREFUSED")
    || message.includes("WebSocket error")
    || message.includes("Connection closed")
    || message.includes("Target closed")
    || message.includes("Browser closed");
};

export async function retryOnceOnRecoverableBrowserError<T>(
  operation: () => Promise<T>,
  onRetry?: (error: unknown) => void,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRecoverableBrowserError(error)) throw error;
    onRetry?.(error);
    return operation();
  }
}

/** Shared Obscura CDP endpoint; do not close the remote browser from a process-local idle timer. */
export async function getBrowser(): Promise<Browser> {
  if (browserInstance && !browserInstance.isConnected()) {
    browserInstance = null;
    browserPromise = null;
  }
  // If a connection is already in flight, wait for it
  if (browserPromise) return browserPromise;
  // If we have a connected instance, use it
  if (browserInstance?.isConnected()) return browserInstance;

  // Clear any stale reference
  browserInstance = null;

  // Connect to the shared Obscura CDP server with a single-flight pattern.
  // Retry a few times so a server restart (systemd restarts within ~3s) is
  // bridged instead of failing the whole scrape.
  browserPromise = (async (): Promise<Browser> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const b = await chromium.connectOverCDP(OBSCURA_CDP_URL, {
          timeout: 15_000,
          headers: OBSCURA_CDP_TOKEN ? { Authorization: `Bearer ${OBSCURA_CDP_TOKEN}` } : undefined,
        });
        b.on("disconnected", () => {
          // Only clear if this is still the active instance
          if (browserInstance === b) {
            browserInstance = null;
          }
        });
        browserInstance = b;
        return b;
      } catch (e) {
        lastError = e;
        browserInstance = null;
        if (attempt < 2) await sleep(1_500 * (attempt + 1));
      }
    }
    throw lastError;
  })().catch((e) => {
    throw e;
  }).finally(() => {
    browserPromise = null;
  });

  return browserPromise;
}

export async function createTrackedBrowserContext(options?: BrowserContextOptions): Promise<BrowserContext> {
  await acquireBrowserContextSlot();

  try {
    const browser = await getBrowser();
    const context = await browser.newContext(options);
    trackedContexts.add(context);
    return context;
  } catch (error) {
    releaseBrowserContextSlot();
    throw error;
  }
}

export async function closeTrackedBrowserContext(context: BrowserContext): Promise<void> {
  const wasTracked = trackedContexts.delete(context);
  try {
    await closeWithTimeout(() => context.close());
  } finally {
    if (wasTracked) releaseBrowserContextSlot();
  }
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

export async function readResponseBodyBounded(response: Response, maxBytes: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Dokument zu groß: ${declaredLength} Bytes (Limit: ${maxBytes})`);
  }

  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`Dokument zu groß: ${size} Bytes (Limit: ${maxBytes})`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
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
 * Fetch a public resource with cookies from its source page's browser context.
 * Stream the response in the worker so the size limit is enforced before an
 * oversized download is fully buffered.
 */
export async function fetchResourceWithBrowserSession(
  sourcePageUrl: string,
  resourceUrl: string,
  options?: { accept?: string; userAgent?: string; timeoutMs?: number; maxBodyBytes?: number },
): Promise<BrowserResourceFetch> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const maxBodyBytes = options?.maxBodyBytes ?? DEFAULT_MAX_BROWSER_RESOURCE_BYTES;
  const context = await createTrackedBrowserContext({
    userAgent: options?.userAgent
      ?? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto(sourcePageUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    const requestStartedAt = Date.now();
    let currentUrl = new URL(resourceUrl).toString();
    for (let redirectCount = 0; ; redirectCount += 1) {
      const remainingTimeoutMs = timeoutMs - (Date.now() - requestStartedAt);
      if (remainingTimeoutMs <= 0) throw new Error("Browser-Download timeout");

      const cookies = await context.cookies(currentUrl);
      const cookieHeader = cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(remainingTimeoutMs),
        headers: {
          Accept: options?.accept ?? "application/pdf,application/octet-stream,*/*;q=0.5",
          Referer: sourcePageUrl,
          "User-Agent": options?.userAgent
            ?? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location || redirectCount >= 5) {
          throw new Error("Browser-Download fehlgeschlagen: zu viele oder ungültige Weiterleitungen");
        }
        const nextUrl = new URL(location, currentUrl);
        if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
          throw new Error("Browser-Download fehlgeschlagen: ungültiges Weiterleitungsziel");
        }
        currentUrl = nextUrl.toString();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`Browser-Download fehlgeschlagen: HTTP ${response.status}`);
      }

      return {
        body: await readResponseBodyBounded(response, maxBodyBytes),
        status: response.status,
        url: response.url || currentUrl,
        contentType: response.headers.get("content-type"),
        contentDisposition: response.headers.get("content-disposition"),
      };
    }
  } finally {
    await closeTrackedBrowserContext(context);
  }
}

export async function scrapeWebsite(
  url: string,
  options?: { onlyMainContent?: boolean; waitForSelector?: string; waitMs?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; useBodyText?: boolean; requestUrlGuard?: (url: string) => boolean | Promise<boolean>; signal?: AbortSignal }
): Promise<ScrapedPage> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let context: BrowserContext | null = null;
      let onAbort: (() => void) | undefined;
      try {
        context = await createTrackedBrowserContext({
          userAgent:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          viewport: { width: 1280, height: 800 },
        });
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
        const captureNetworkResponse = (response: PlaywrightResponse): void => {
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

        const navigationResponse = await page.goto(url, { waitUntil: options?.waitUntil ?? "domcontentloaded", timeout: 30000 });

        if (options?.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, { timeout: 15000 }).catch(() => {});
        }
        if (options?.waitMs) {
          await page.waitForTimeout(options.waitMs);
        }

        const title = await readStablePageTitle(page);
        let html = "";
        let markdown: string;

        if (options?.useBodyText) {
          // SPA detail pages can contain several megabytes of markup. Keep only
          // visible text when the caller does not need DOM/resource discovery.
          let visibleText = "";
          try {
            const result: unknown = await page.evaluate(() => document.body?.innerText ?? "");
            if (typeof result === "string") visibleText = result;
          } catch {
            // Fall back to the main document response below.
          }
          if (visibleText.length > 200) {
            markdown = visibleText;
          } else {
            html = await readStablePageContent(page, navigationResponse);
            markdown = htmlToBasicMarkdown(html);
          }
        } else {
          html = await readStablePageContent(page, navigationResponse);
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
          await closeTrackedBrowserContext(context);
        }
      }
    } catch (e) {
      if (attempt === 0 && isRecoverableBrowserError(e)) {
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
