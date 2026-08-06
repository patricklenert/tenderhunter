import assert from "node:assert/strict";
import { isLikelyTenderDetailUrl } from "../lib/crawler";

const sourceUrl = "https://portal.example.test/";

assert.equal(isLikelyTenderDetailUrl("https://portal.example.test/notice/123", "Detailseite", sourceUrl), true);
assert.equal(isLikelyTenderDetailUrl("https://portal.example.test/detail?id=123", "Vergabe", sourceUrl), true);
assert.equal(isLikelyTenderDetailUrl("https://portal.example.test/ausschreibungen", "Ausschreibungen", sourceUrl), false);
assert.equal(isLikelyTenderDetailUrl("https://portal.example.test/search?q=ausschreibung", "Ausschreibung suchen", sourceUrl), false);
assert.equal(isLikelyTenderDetailUrl("https://portal.example.test/detail", "Ausschreibung", sourceUrl), false);
assert.equal(isLikelyTenderDetailUrl("https://other.example.test/notice/123", "Ausschreibung", sourceUrl), false);
assert.equal(isLikelyTenderDetailUrl(sourceUrl, "Portal", sourceUrl), false);

console.log("Crawler tests passed.");
