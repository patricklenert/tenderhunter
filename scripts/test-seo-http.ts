import assert from "node:assert/strict";

const baseUrl = process.env.SEO_HTTP_TEST_URL ?? "http://127.0.0.1:3040";
const base = new URL(baseUrl);
const preferredOrigin = new URL(process.env.SEO_PREFERRED_ORIGIN ?? "https://palemaz.com").origin;

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ?? null;
}

function tags(source: string, name: string): string[] {
  return source.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function canonicalFromHtml(source: string): string | null {
  const link = tags(source, "link").find((tag) => {
    const rel = attribute(tag, "rel");
    return rel?.split(/\s+/).some((value) => value.toLowerCase() === "canonical") ?? false;
  });
  return link ? attribute(link, "href") : null;
}

function robotsFromHtml(source: string): string | null {
  const meta = tags(source, "meta").find((tag) => attribute(tag, "name")?.toLowerCase() === "robots");
  return meta ? attribute(meta, "content") : null;
}

async function fetchPage(path: string, redirect: RequestRedirect = "manual"): Promise<{ response: Response; body: string }> {
  const response = await fetch(new URL(path, base), { redirect });
  return { response, body: await response.text() };
}

function pathFromUrl(value: string): string {
  return new URL(value, base).pathname;
}

async function assertIndexable(path: string, label: string): Promise<string> {
  const { response, body } = await fetchPage(path);
  assert.equal(response.status, 200, `${label} must return direct 200`);
  assert.equal(response.headers.get("x-robots-tag"), null, `${label} must not send X-Robots-Tag`);
  assert.doesNotMatch(robotsFromHtml(body) ?? "", /noindex/i, `${label} must not contain noindex`);
  assert.match(body, /<h1\b/i, `${label} must contain server-rendered h1 content`);

  const canonical = canonicalFromHtml(body);
  assert.ok(canonical, `${label} must contain a canonical link`);
  const canonicalUrl = new URL(canonical!, base);
  assert.equal(canonicalUrl.origin, preferredOrigin, `${label} canonical must use the preferred host`);
  assert.equal(canonicalUrl.pathname, pathFromUrl(path), `${label} must use a self-canonical`);
  assert.equal(canonicalUrl.search, "", `${label} canonical must not contain query parameters`);

  const target = await fetchPage(canonicalUrl.pathname);
  assert.equal(target.response.status, 200, `${label} canonical target must return direct 200`);
  return body;
}

async function assertNoindex(path: string, label: string): Promise<void> {
  const { response, body } = await fetchPage(path);
  assert.equal(response.status, 200, `${label} must render successfully`);
  assert.match(robotsFromHtml(body) ?? "", /noindex/i, `${label} must remain noindex`);
}

async function main(): Promise<void> {
  const sitemap = await fetchPage("/sitemap.xml");
  assert.equal(sitemap.response.status, 200, "sitemap.xml must return 200");
  assert.match(sitemap.body, /<urlset\b/i, "sitemap.xml must be XML urlset output");

  const sitemapUrls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1]);
  assert.ok(sitemapUrls.length > 0, "sitemap.xml must contain URLs");
  assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "sitemap.xml must not contain duplicate URLs");
  for (const value of sitemapUrls) {
    const url = new URL(value);
    assert.equal(url.origin, preferredOrigin, "sitemap URLs must use the preferred host");
    assert.equal(url.search, "", `sitemap URL must not contain query parameters: ${value}`);
    assert.equal(url.hash, "", `sitemap URL must not contain fragments: ${value}`);
    assert.doesNotMatch(url.pathname, /(?:^|\/)(?:opengraph-image|api|preview|search|filter)(?:\/|$)/i, `private/preview URL in sitemap: ${value}`);
  }

  const cpvCategory = sitemapUrls.find((value) => /\/ausschreibungen\/cpv\/\d{8}\/[^/]+$/.test(new URL(value).pathname));
  const regionOrCity = sitemapUrls.find((value) => /\/ausschreibungen\/(?:region|stadt)\/[^/]+(?:\/[^/]+)?$/.test(new URL(value).pathname));
  const detail = sitemapUrls.find((value) => /\/ausschreibung\/\d+\/[^/]+$/.test(new URL(value).pathname));
  const profile = sitemapUrls.find((value) => /\/p\/[^/]+$/.test(new URL(value).pathname));
  assert.ok(cpvCategory, "sitemap must contain a data-backed CPV category sample");
  assert.ok(regionOrCity, "sitemap must contain a data-backed region/city sample");
  assert.ok(detail, "sitemap must contain a tender detail sample");
  assert.ok(profile, "sitemap must contain a public profile sample");

  const indexablePages = [
    "/",
    "/ausschreibungen/bauarbeiten",
    "/ausschreibungen/cpv/45300000",
    pathFromUrl(cpvCategory!),
    pathFromUrl(regionOrCity!),
    pathFromUrl(detail!),
    pathFromUrl(profile!),
  ];
  const renderedBodies = await Promise.all(indexablePages.map((path) => assertIndexable(path, path)));

  const pageOne = await fetchPage("/ausschreibungen/bauarbeiten?page=1");
  assert.equal(pageOne.response.status, 301, "page=1 duplicate must redirect directly to the clean category URL");
  assert.equal(pathFromUrl(pageOne.response.headers.get("location") ?? ""), "/ausschreibungen/bauarbeiten");
  assert.equal(new URL(pageOne.response.headers.get("location") ?? baseUrl, base).search, "");

  const searchPlaceholder = await fetchPage("/?q=%7Bsearch_term_string%7D");
  assert.equal(searchPlaceholder.response.status, 301, "the obsolete WebSite search placeholder must redirect to the homepage");
  assert.equal(pathFromUrl(searchPlaceholder.response.headers.get("location") ?? ""), "/");
  assert.equal(new URL(searchPlaceholder.response.headers.get("location") ?? baseUrl, base).search, "");

  await assertNoindex("/ausschreibungen/bauarbeiten?page=2", "pagination URL");
  await assertNoindex("/impressum", "impressum");

  const trailingSlash = await fetchPage("/ausschreibungen/bauarbeiten/");
  assert.equal(trailingSlash.response.status, 301, "trailing slash must use one permanent redirect");
  assert.equal(pathFromUrl(trailingSlash.response.headers.get("location") ?? ""), "/ausschreibungen/bauarbeiten");

  const detailPath = pathFromUrl(detail!);
  const detailId = detailPath.match(/^\/ausschreibung\/(\d+)\//)?.[1];
  assert.ok(detailId, "detail sample must contain a numeric id");
  const numericDetail = await fetchPage(`/ausschreibung/${detailId}`);
  assert.equal(numericDetail.response.status, 301, "numeric tender URL must redirect directly to its canonical detail URL");
  assert.equal(pathFromUrl(numericDetail.response.headers.get("location") ?? ""), detailPath);

  const internalLinks = new Set<string>();
  for (const body of renderedBodies) {
    for (const match of body.matchAll(/href=["'](\/ausschreibung\/[^"'?#]+)["']/gi)) {
      internalLinks.add(match[1]);
    }
  }
  assert.ok(internalLinks.size > 0, "representative SSR pages must expose internal tender links");
  for (const path of [...internalLinks].slice(0, 5)) {
    const linked = await fetchPage(path);
    assert.equal(linked.response.status, 200, `internal tender link must be direct 200: ${path}`);
  }

  const robots = await fetchPage("/robots.txt");
  assert.equal(robots.response.status, 200, "robots.txt must return 200");
  assert.match(robots.body, /Sitemap:\s*https?:\/\//i, "robots.txt must advertise the sitemap");

  for (const missingPath of ["/wissen/not-a-real-article", "/&"]) {
    const missing = await fetchPage(missingPath);
    assert.equal(missing.response.status, 404, `unknown public content must return 404: ${missingPath}`);
  }

  console.log(`SEO HTTP regression tests passed (${sitemapUrls.length} sitemap URLs structurally checked).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
