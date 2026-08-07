import assert from "node:assert/strict";
import {
  canonicalPublicSourceKey,
  extractPublicResourceMetadata,
  parseEvergabeOnlineDetail,
  parseEvergabeOnlineNextUrl,
  parseEvergabeOnlineRows,
  parseNetServerRows,
  parseSachsenAnhaltDetail,
  parseSachsenAnhaltListing,
} from "../lib/public-tender-scraper";
import {
  getPublicSourceDefinition,
  inferPublicSourceKey,
  resolvePublicSourceKey,
} from "../lib/public-source-registry";
import { getTenderSourceDefinition, parseConfiguredTenderSources } from "../lib/tender-sources";

assert.equal(resolvePublicSourceKey("www.evergabe-online.de"), "evergabe-online");
assert.equal(resolvePublicSourceKey("Bremen"), "net-bremen");
assert.equal(resolvePublicSourceKey("vergabe.saarland"), "net-saarland");
assert.equal(resolvePublicSourceKey("evergabe-sachsen-anhalt"), "sachsen-anhalt");
assert.equal(inferPublicSourceKey(null, "https://vergabe.bremen.de/NetServer/PublicationControllerServlet"), "net-bremen");
assert.equal(inferPublicSourceKey(null, "https://evergabe.sachsen-anhalt.de/recherche-aktueller-vergaben"), "sachsen-anhalt");
assert.equal(canonicalPublicSourceKey("Saarland"), "net-saarland");
assert.equal(getPublicSourceDefinition("evergabe-online")?.label, "eVergabe Bund");
assert.equal(getTenderSourceDefinition("evergabe-online.de")?.key, "evergabe-online");
assert.equal(parseConfiguredTenderSources("vergabe.bremen.de")[0]?.key, "net-bremen");

const federalRows = parseEvergabeOnlineRows(`
  <table><tbody><tr>
    <td><a href="/tenderdetails.html?id=881846">Einkauf Leitstellentische</a></td>
    <td>Z25-8-2026-0011</td><td>Bundesnetzagentur</td><td>Berlin</td>
    <td>National Öffentliche Ausschreibung</td><td class="result_col_deadline">31.08.26, 10:00</td>
  </tr></tbody></table>
  <a rel="next" href="/search.html?next=1">Nächste Seite</a>
`, "https://www.evergabe-online.de/search.html");
assert.equal(federalRows.length, 1);
assert.equal(federalRows[0].id, "881846");
assert.equal(federalRows[0].client, "Bundesnetzagentur");
assert.equal(parseEvergabeOnlineNextUrl(
  `<a rel="next" href="/search.html?next=1">Nächste Seite</a>`,
  "https://www.evergabe-online.de/search.html",
), "https://www.evergabe-online.de/search.html?next=1");

const federalDetail = parseEvergabeOnlineDetail(`
  <html><body><main>
    <div class="procedure-infos"><section><h4>Einkauf Leitstellentische</h4></section></div>
    <div class="form-group"><label>Abgabefrist Angebot:</label><p class="form-control-static">31.08.2026 10:00</p></div>
    <div class="form-group"><label>Geschäftszeichen:</label><p class="form-control-static">Z25-8-2026-0011</p></div>
    <h3>Öffentlicher Auftraggeber (Vergabestelle)</h3><p>Name:</p><p>Bundesnetzagentur</p>
    <h3>Art und Umfang der Leistung</h3><p>Einkauf von sechs Leitstellentischen.</p>
    <h3>Ort der Leistungserbringung</h3><p>13405 Berlin</p>
    <a href="/Bekanntmachung.pdf?id=881846">PDF</a>
  </main></body></html>
`, "https://www.evergabe-online.de/tenderdetails.html?id=881846");
assert.ok(federalDetail);
assert.equal(federalDetail.externalId, "881846");
assert.equal(federalDetail.client, "Bundesnetzagentur");
assert.equal(federalDetail.deadline, "31.08.2026 10:00");
assert.deepEqual(federalDetail.pdfUrls, ["https://www.evergabe-online.de/Bekanntmachung.pdf?id=881846"]);

const resourceMetadata = extractPublicResourceMetadata(
  `<a href="/Bekanntmachung.pdf">Bekanntmachung</a><a href="/tenderdocuments.html?id=1">Unterlagen</a>`,
  "https://www.evergabe-online.de/tenderdetails.html?id=1",
);
assert.ok(resourceMetadata.resources.some((resource) => resource.url.endsWith("/Bekanntmachung.pdf")));

const bremenRows = parseNetServerRows(`
  <table><tr data-oid="bremen-1"><td>07.08.2026</td><td class="tender">Modulbau Mensa</td>
    <td class="tenderType">Öffentliche Ausschreibung</td><td class="tenderType">VOB</td>
    <td class="tenderDeadline">25.08.2026 11:30</td></tr></table>
`);
assert.equal(bremenRows.length, 1);
assert.equal(bremenRows[0].title, "Modulbau Mensa");
assert.equal(bremenRows[0].deadline, "25.08.2026 11:30");

const saarlandRows = parseNetServerRows(`
  <table><tr data-oid="saarland-1"><td>07.08.2026</td><td class="tender">Neubau Jugendhaus</td>
    <td class="tenderAuthority">Gemeinde Nonnweiler</td><td class="tenderType">Öffentliche Ausschreibung</td>
    <td class="tenderType">VOB</td><td class="tenderDeadline">03.09.2026 14:30</td></tr></table>
`);
assert.equal(saarlandRows[0].client, "Gemeinde Nonnweiler");
assert.equal(saarlandRows[0].deadline, "03.09.2026 14:30");

const sachsenRows = parseSachsenAnhaltListing(`
  <table><tr><td>Wachschutzleistungen 2026 <a href="/recherche-aktueller-vergaben?idp=abc123">mehr &gt;&gt;</a></td></tr></table>
`, "https://evergabe.sachsen-anhalt.de/");
assert.equal(sachsenRows.length, 1);
assert.equal(sachsenRows[0].title, "Wachschutzleistungen 2026");

const sachsenDetail = parseSachsenAnhaltDetail(`
  <div class="tsaid_TOPIC"><div class="tsaid_data">Wachschutzleistungen 2026</div></div>
  <div class="tsaid_DEADLINE"><div class="tsaid_data">28.08.2026 12:00</div></div>
  <div class="tsaid_MANDANT"><div class="tsaid_data">Stadt Halle (Saale)</div></div>
  <div class="tsaid_AREA"><div class="tsaid_data">Halle (Saale)</div></div>
  <div class="tsaid_PROCESSTYPE"><div class="tsaid_data">Öffentliche Ausschreibung</div></div>
  <div class="tsaid_URL"><div class="tsaid_data"><a href="https://ausschreibung.halle.de/NetServer/PublicationControllerServlet?function=Detail&amp;TWOID=abc123&amp;PublicationType=0">Halle</a></div></div>
`, "https://evergabe.sachsen-anhalt.de/recherche-aktueller-vergaben?idp=abc123");
assert.ok(sachsenDetail);
assert.equal(sachsenDetail.client, "Stadt Halle (Saale)");
assert.equal(sachsenDetail.externalUrl?.includes("PublicationControllerServlet"), true);

console.log("Public source registry/parser tests passed.");
