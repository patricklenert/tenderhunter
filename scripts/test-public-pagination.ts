import assert from "node:assert/strict";
import {
  createPublicSourceCursorV2,
  encodeDtvpSearchHash,
  cursorBoolean,
  cursorNumber,
  cursorPendingDetails,
  cursorString,
  publicDetailReference,
  sourceResult,
} from "../lib/public-pagination";
import { parseDtvpPageInfo, parseGenericPaginationUrls } from "../lib/public-tender-scraper";
import { canonicalPublicTenderUrl, derivePublicExternalId, inferPublicSourceKey, resolvePublicSourceKey } from "../lib/public-source-registry";
import { decodeHtmlEntities } from "../lib/text-normalization";

const decodedDtvp = JSON.parse(Buffer.from(encodeDtvpSearchHash(3), "base64url").toString("utf8")) as { pageNumber: number };
assert.equal(decodedDtvp.pageNumber, 3);

const paginationUrls = parseGenericPaginationUrls(`
  <nav class="pagination">
    <a href="/results?page=1">1</a>
    <a href="/results?page=2">2</a>
    <a href="/results?page=3">Weiter</a>
    <a href="/results?page=4">4</a>
  </nav>
`, "https://example.test/results?page=2", "https://example.test/results?page=2");
assert.deepEqual(paginationUrls, [
  "https://example.test/results?page=3",
  "https://example.test/results?page=4",
]);

assert.deepEqual(parseDtvpPageInfo("<main>Seite: 4 von 12</main>"), { page: 4, totalPages: 12 });
assert.equal(cursorNumber({ page: 4 }, "page", 1), 4);
assert.equal(cursorNumber({}, "page", 1), 1);
assert.equal(cursorString({ nextUrl: "https://example.test/next" }, "nextUrl"), "https://example.test/next");
assert.equal(cursorString({ nextUrl: "" }, "nextUrl"), null);
assert.equal(cursorBoolean({ exhausted: true }, "exhausted"), true);

const pending = publicDetailReference("pid:123", "https://example.test/detail?utm_source=test", "123");
const cursor = createPublicSourceCursorV2("test-page", { page: 2 }, false, [pending]);
assert.equal(cursorPendingDetails(cursor).length, 1);
const partial = sourceResult([], {
  nextCursor: cursor,
  cursorCommit: "commit",
  listingComplete: true,
  pendingCount: 1,
});
assert.equal(partial.continuationRequired, true);
assert.equal(partial.exhausted, undefined);
assert.equal(resolvePublicSourceKey("DTVP"), "dtvp");
assert.equal(resolvePublicSourceKey("rlp"), null);
assert.equal(resolvePublicSourceKey("Berlin / RIB"), "berlin-html");
assert.equal(resolvePublicSourceKey("Schleswig-Holstein"), "e-vergabe-sh");
assert.equal(resolvePublicSourceKey("netserver sachsen"), "net-sachsen");
assert.equal(resolvePublicSourceKey("evergabe nrw"), "evergabe-nrw");
assert.equal(resolvePublicSourceKey("vergabe.rlp.de"), "nrw-rlp-central");
assert.equal(resolvePublicSourceKey("https://lbb.vergabe.rlp.de/VMPSatellite/notice/42"), "nrw-rlp-lbb");
assert.equal(inferPublicSourceKey(null, "https://meinauftrag.rib.de/angebote/123"), "berlin-html");
assert.equal(inferPublicSourceKey(null, "https://www.e-vergabe-sh.de/vergabeverfahren/42"), "e-vergabe-sh");
assert.equal(inferPublicSourceKey(null, "https://verwaltung.thueringen.de/evergabe/detail/42"), "thueringen");
assert.equal(inferPublicSourceKey(null, "https://vergabekooperation.berlin/NetServer/PublicationControllerServlet"), "net-berlin");
assert.equal(inferPublicSourceKey(null, "https://evergabe.blb.nrw.de/Vergabe/notice/42"), "nrw-blb-nrw");
assert.equal(inferPublicSourceKey(null, "https://notdtvp.example.test/ausschreibung/42"), null);
assert.equal(canonicalPublicTenderUrl("https://example.test/a;jsessionid=abc?id=1&utm_source=x"), "https://example.test/a?id=1");
assert.equal(derivePublicExternalId({ sourceKey: "dtvp", sourceUrl: "https://dtvp.test/projectForwarding.do?pid=123" }), "123");
assert.equal(decodeHtmlEntities("Materialpr&#252;fmaschine f&#252;r"), "Materialprüfmaschine für");
assert.equal(decodeHtmlEntities("&amp;#228;"), "ä");
assert.equal(
  decodeHtmlEntities("Bayreuth, Casselmannstra&#223;e 6, 330-Sonnenschutz"),
  "Bayreuth, Casselmannstraße 6, 330-Sonnenschutz",
);

console.log("Public pagination tests passed.");
