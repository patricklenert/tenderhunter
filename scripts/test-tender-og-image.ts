import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sitemap = readFileSync("app/sitemap.ts", "utf8");
const detailPage = readFileSync("app/ausschreibung/[...params]/page.tsx", "utf8");

assert.equal(sitemap.includes("images: [`${siteUrl}/ausschreibung/"), false);
assert.equal(detailPage.includes("image: `${siteUrl}${tenderUrl}/opengraph-image`"), false);

console.log("Tender OG image reference regression test passed.");
