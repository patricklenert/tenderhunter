import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getIndexableCpvCategoryKeys, getTenderContext, hasCpvCode, hasIndexableCpvContent, type TenderSitemapRow } from "../app/sitemap";
import { getCanonicalTenderSlug } from "../lib/tender-canonical";

const row: TenderSitemapRow = {
  id: 1,
  title: "Fahrzeugbeschaffung",
  rawText: "Öffentliche Fahrzeugbeschaffung",
  updatedAt: null,
  metadataJson: {},
  structuredJson: {
    procurement: { cpv_codes: ["34144510-3"] },
  },
  url: "https://vergabemarktplatz.brandenburg.de/tender/1",
  slug: null,
  source: "unknown",
  sourceKey: "nrw-brandenburg",
  category: "Bauarbeiten",
  procedureType: null,
};

const context = getTenderContext(row);
assert.equal(context.bundesland, "Brandenburg");
assert.equal(hasCpvCode(context, "34000000"), true);
assert.equal(hasCpvCode(context, "34100000"), true);
assert.equal(hasCpvCode(context, "90911000"), false);
assert.equal(hasIndexableCpvContent(context), true);
assert.equal(hasIndexableCpvContent(getTenderContext({ ...row, rawText: "   " })), false);

const cpvCategoryKeys = getIndexableCpvCategoryKeys([
  context,
  getTenderContext({ ...row, id: 2, category: "Lieferung" }),
  getTenderContext({ ...row, id: 3, category: "Sonstiges", rawText: "   " }),
]);
assert.equal(cpvCategoryKeys.has("34000000\0Bauarbeiten"), true);
assert.equal(cpvCategoryKeys.has("34000000\0Lieferung"), true);
assert.equal(cpvCategoryKeys.has("34000000\0Sonstiges"), false);

const legacyStructured = { hard_facts: { location: "10115 Berlin" } };
const legacyRawText = "   ";
const routeSlug = getCanonicalTenderSlug(null, row.title, { client: "Stadt Beispiel", location: "" }, null);
const unguardedRouteSlug = getCanonicalTenderSlug(
  null,
  row.title,
  { client: "Stadt Beispiel", location: "" },
  legacyStructured,
);
const sitemapSlug = getCanonicalTenderSlug(
  null,
  row.title,
  { client: "Stadt Beispiel", location: "" },
  legacyRawText.trim() ? legacyStructured : null,
);
assert.notEqual(unguardedRouteSlug, routeSlug, "structured-only locations can produce a conflicting canonical slug");
assert.equal(sitemapSlug, routeSlug, "sitemap and detail route must discard structured location without raw text");

assert.match(
  readFileSync("app/sitemap.ts", "utf8"),
  /if \(!row\.category \|\| !hasIndexableCpvContent\(row\)\) continue;[\s\S]*if \(hasCpvCode\(row, cpvCode\)\) keys\.add/,
  "CPV category pairs must retain the route's public-content guard while pre-indexing",
);
assert.doesNotMatch(
  readFileSync("app/sitemap.ts", "utf8"),
  /global(?:Region|City)Categories/,
  "location/category sitemap URLs must not be cross-joined from unrelated database rows",
);
assert.match(
  readFileSync("app/sitemap.ts", "utf8"),
  /getIndexableCpvCategoryKeys\(contexts\)/,
  "CPV category combinations must be indexed once rather than rescanning every tender per sitemap entry",
);
assert.match(
  readFileSync("app/sitemap.ts", "utf8"),
  /getCanonicalTenderSlug\(\s*row\.slug,\s*row\.title,\s*row\.metadataJson,\s*row\.rawText\?\.trim\(\) \? row\.structuredJson : null,\s*\)/,
  "sitemap tender URLs must use the detail route's rawText-aware canonical slug",
);
const proxySource = readFileSync("proxy.ts", "utf8");
assert.ok(proxySource.includes("rawText: tenders.rawText"), "proxy canonical checks must load rawText");
assert.match(
  proxySource,
  /getCanonicalTenderSlug\(\s*row\.slug,\s*row\.title,\s*row\.metadataJson,\s*row\.rawText\?\.trim\(\) \? row\.structuredJson : null,\s*\)/,
  "proxy canonical redirects must match the detail route's rawText-aware slug",
);
const detailSource = readFileSync("app/ausschreibung/[...params]/page.tsx", "utf8");
assert.match(
  detailSource,
  /getCanonicalTenderSlug\(\s*row\.slug,\s*row\.title,\s*row\.metadataJson,\s*row\.rawText\?\.trim\(\) \? row\.structuredJson : null,\s*\)/,
  "detail metadata canonical must match sitemap and proxy when rawText is missing",
);
assert.match(
  detailSource,
  /getCanonicalTenderSlug\(\s*tender\.slug,\s*tender\.title,\s*tender\.metadataJson,\s*tender\.rawText\?\.trim\(\) \? sd\?\.jsonBlob : null,\s*\)/,
  "detail route redirects must use the same rawText-aware canonical slug as its metadata",
);

assert.match(
  readFileSync("app/sitemap.ts", "utf8"),
  /const tenderIndex = getMeiliClient\(\)\.index\("tenders"\);[\s\S]*const meiliStats = await tenderIndex\.getStats\(\)/,
  "the sitemap must not advertise catalog URLs while Meilisearch is unavailable",
);
assert.match(
  readFileSync("app/sitemap.ts", "utf8"),
  /deadlineAt IS NULL OR deadlineAt > \$\{nowUnix\}/,
  "the sitemap must not advertise catalog URLs when the search index has no live documents",
);

console.log("Sitemap taxonomy tests passed.");
