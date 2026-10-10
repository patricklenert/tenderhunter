import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getIndexableAgency } from "../lib/agencies";
import { matchesCpvCode } from "../lib/cpv-codes";
import { getListingRobots, getPaginationHref, NOINDEX_FOLLOW } from "../lib/seo-indexability";
import { dependencyUnavailableResponse, optionalPublicRows } from "../lib/public-route-resilience";
import { isCanonicalTenderId } from "../lib/tender-canonical";
import { getSiteUrl } from "../lib/site-config";
import { decodeRouteParam } from "../lib/route-params";
import { isKnownPublicAusschreibungenPath, isKnownPublicStaticPath } from "../proxy";

assert.equal(getListingRobots({}, 1, true), undefined);
assert.deepEqual(getListingRobots({ q: "bau" }, 1, true), { index: false, follow: true });
assert.deepEqual(getListingRobots({ page: "2" }, 1, true), { index: false, follow: true });
assert.deepEqual(getListingRobots({ filter: "bau" }, 1, true), { index: false, follow: true });
assert.deepEqual(NOINDEX_FOLLOW, { index: false, follow: true });
assert.equal(getPaginationHref("/ausschreibungen/bauarbeiten", 1), "/ausschreibungen/bauarbeiten");
assert.equal(getPaginationHref("/ausschreibungen/bauarbeiten", 2), "/ausschreibungen/bauarbeiten?page=2");
assert.equal(isCanonicalTenderId("3859", 3859), true);
assert.equal(isCanonicalTenderId("0003859", 3859), false);
assert.equal(isKnownPublicAusschreibungenPath(["ausschreibungen", "stadt", "berlin"]), true);
assert.equal(isKnownPublicAusschreibungenPath(["ausschreibungen", "stadt", "not-a-city"]), false);
assert.equal(isKnownPublicAusschreibungenPath(["ausschreibungen", "stadt", "berlin", "not-a-category"]), false);
assert.equal(isKnownPublicAusschreibungenPath(["ausschreibungen", "dtvp", "region", "bayern"]), true);
assert.equal(isKnownPublicAusschreibungenPath(["ausschreibungen", "dtvp", "region", "not-a-region"]), false);
assert.equal(isKnownPublicAusschreibungenPath(["ausschreibungen", "cpv", "99999999"]), false);
assert.equal(isKnownPublicStaticPath(["lexikon", "freihändige-vergabe"]), true);
assert.equal(isKnownPublicStaticPath(["lexikon", "freih%C3%A4ndige-vergabe"]), true);
assert.equal(isKnownPublicStaticPath(["lexikon", "not-a-real-term"]), false);
assert.equal(isKnownPublicStaticPath(["wissen", "schwellenwerte-vergabe-2025"]), true);
assert.equal(isKnownPublicStaticPath(["wissen", "not-a-real-article"]), false);
assert.equal(matchesCpvCode("34144510", "34000000"), true);
assert.equal(matchesCpvCode("90911200-4", "90911000"), true);
assert.equal(matchesCpvCode("72000000", "71000000"), false);
assert.equal(decodeRouteParam("freih%C3%A4ndige-vergabe"), "freihändige-vergabe");
assert.equal(decodeRouteParam("malformed%"), "malformed%");
assert.match(
  readFileSync("app/lexikon/[slug]/page.tsx", "utf8"),
  /decodeRouteParam/,
  "Unicode glossary route params must be decoded before lookup",
);

// Sitemap, proxy and the Auftraggeber page must reject the same scraped placeholders.
assert.equal(getIndexableAgency("vergessen"), null);
assert.equal(getIndexableAgency("vergessen?"), null);
assert.equal(
  getIndexableAgency("n und beruflichen Qualifikationen des zur Auftragsausführung eingesetzten Personals sind anzugeben: Erforderlich für das"),
  null,
);
assert.equal(getIndexableAgency("Anmelden erforderlich, um Zugriff zu erhalten"), null);
assert.deepEqual(getIndexableAgency("Auftraggeber: Stadt München"), {
  name: "Stadt München",
  slug: "stadt-muenchen",
});

for (const value of [
  "Nicht ermittelbar",
  "Nicht ermittelbar – Seite erfordert Cookies",
  "Auftraggeber: Nicht ermittelbar",
  "eVergabe",
  "eVergabe-Dokument",
  "Nicht verfügbar",
  "Nicht einsehbar – Zugriff erforderlich",
  "Auftraggeber: Jetzt freischalten und Zugriff erhalten – nicht einsehbar",
  "Nicht explizit genannt – Auftraggeber hinter Paywall",
  "Postanschrift: Europaplatz 1",
]) {
  assert.equal(getIndexableAgency(value), null, `${value} must not become an agency page`);
}

for (const route of [
  "app/wissen/[slug]/page.tsx",
  "app/lexikon/[slug]/page.tsx",
  "app/branchen/[slug]/page.tsx",
  "app/vorlagen/[slug]/page.tsx",
]) {
  assert.match(readFileSync(route, "utf8"), /export const dynamicParams = false;/, `${route} must return real 404s for unknown slugs`);
  assert.match(readFileSync(route, "utf8"), /decodeRouteParam/, `${route} must decode percent-encoded route params before map lookup`);
}

for (const route of [
  "app/ausschreibungen/stadt/[slug]/page.tsx",
  "app/ausschreibungen/region/[slug]/page.tsx",
  "app/ausschreibungen/stadt/[slug]/[kategorie]/page.tsx",
  "app/ausschreibungen/region/[slug]/[kategorie]/page.tsx",
  "app/ausschreibungen/cpv/[code]/[kategorie]/page.tsx",
  "app/ausschreibungen/verfahren/[type]/[kategorie]/page.tsx",
  "app/ausschreibungen/dtvp/[kategorie]/page.tsx",
  "app/ausschreibungen/dtvp/region/[slug]/page.tsx",
  "app/ausschreibungen/dtvp/stadt/[slug]/page.tsx",
  "app/ausschreibungen/ted/[kategorie]/page.tsx",
  "app/ausschreibungen/ted/region/[slug]/page.tsx",
  "app/ausschreibungen/ted/stadt/[slug]/page.tsx",
  "app/ausschreibungen/evergabe/[kategorie]/page.tsx",
  "app/ausschreibungen/evergabe/region/[slug]/page.tsx",
  "app/ausschreibungen/evergabe/stadt/[slug]/page.tsx",
  "app/ausschreibungen/bauportal-deutschland/[kategorie]/page.tsx",
  "app/ausschreibungen/bauportal-deutschland/region/[slug]/page.tsx",
  "app/ausschreibungen/bauportal-deutschland/stadt/[slug]/page.tsx",
]) {
  assert.doesNotMatch(readFileSync(route, "utf8"), /generateStaticParams/, `${route} must not pre-generate empty data-backed URL combinations`);
}

const layoutSource = readFileSync("app/layout.tsx", "utf8");
assert.doesNotMatch(layoutSource, /SearchAction|search_term_string|potentialAction/, "WebSite JSON-LD must not advertise the noindex homepage search URL");

const proxySource = readFileSync("proxy.ts", "utf8");
assert.match(proxySource, /searchParams\.size === 1[\s\S]*searchParams\.get\("page"\) === "1"[\s\S]*NextResponse\.redirect\(destination, 301\)/, "standalone page=1 URLs must directly redirect to the clean listing URL");
assert.match(proxySource, /NextResponse\.redirect\(destination,\s*301\)/, "canonical tender redirects must use a direct permanent 301");
assert.match(proxySource, /pathname\.endsWith\("\/"\)/, "trailing-slash URLs must be normalized in the proxy");
assert.match(proxySource, /hasTrailingSlash\s*\|\|/, "canonical tender URLs with a trailing slash must redirect in one hop");
assert.match(proxySource, /pathname === "\/us\/"/, "the legacy US slash URL must redirect directly to its final anchor");
assert.match(proxySource, /resource === "us" && segments\[1\] === "tender"/, "US tender routes must be validated before rendering");
assert.match(proxySource, /eq\(usTenders\.qualityStatus, "qualified"\)/, "US tender routes must reject inactive tenders");
assert.match(proxySource, /isKnownPublicStaticPath/, "unknown static content slugs must not redirect to a later 404");
assert.match(proxySource, /destination\.pathname = `\/p\/\$\{segments\[1\]\}`/, "known profile slashes must normalize in one hop");
assert.match(proxySource, /destination\.pathname = `\/auftraggeber\/\$\{segments\[1\]\}`/, "known agency slashes must normalize in one hop");
assert.match(proxySource, /resource !== "p" && resource !== "auftraggeber"/, "profile and agency existence checks must run before slash normalization");

const nextConfigSource = readFileSync("next.config.ts", "utf8");
assert.match(nextConfigSource, /statusCode:\s*301/, "static legacy redirects must use a direct permanent 301");
assert.match(nextConfigSource, /skipTrailingSlashRedirect:\s*true/, "the proxy must own trailing-slash normalization to avoid redirect chains");

const loadingSource = readFileSync("app/loading.tsx", "utf8");
assert.doesNotMatch(loadingSource, /Hidden text for crawlers|Tenderhunter – Öffentliche Ausschreibungen in Deutschland/, "loading UI must not inject hidden generic SEO content instead of route SSR content");

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
try {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(getSiteUrl(), "https://palemaz.com", "SEO URL fallback must use the preferred HTTPS host");
  process.env.NEXT_PUBLIC_SITE_URL = "http://palemaz.com///?tracking=1";
  assert.equal(getSiteUrl(), "https://palemaz.com", "SEO URL configuration must normalize scheme, path and query parameters");
} finally {
  if (configuredSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = configuredSiteUrl;
}

for (const route of [
  "app/api/us/alerts/confirm/route.ts",
  "components/profile/PageFooter.tsx",
  "lib/auth.ts",
  "lib/billing.ts",
  "lib/pipeline.ts",
  "lib/us/alerts.ts",
]) {
  assert.doesNotMatch(
    readFileSync(route, "utf8"),
    /https:\/\/palemaz\.com/,
    `${route} must use the centralized preferred site URL`,
  );
}

const unavailable = dependencyUnavailableResponse();
assert.equal(unavailable.status, 503);
assert.equal(unavailable.headers.get("retry-after"), "60");
assert.equal(unavailable.headers.get("x-robots-tag"), "noindex, follow");

void (async () => {
  assert.deepEqual(await optionalPublicRows(() => Promise.resolve([{ id: 1 }])), [{ id: 1 }]);
  assert.deepEqual(await optionalPublicRows(() => Promise.reject(new Error("optional query failed"))), []);
  console.log("SEO indexability tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
