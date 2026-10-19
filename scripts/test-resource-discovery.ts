import assert from "node:assert/strict";
import {
  assignRoleHints,
  classifyResourceType,
  extractResourcesFromHtml,
  extractResourcesFromLinks,
  extractResourcesFromNetworkMetadata,
  isPortalActionUrl,
  normalizeResourceUrl,
  rankSubpageCandidates,
} from "../lib/resource-discovery";

const baseUrl = "https://example.test/portal/start";
const resources = extractResourcesFromHtml(
  `
    <a href="/duplicate#first">First duplicate</a>
    <a href="https://example.test/duplicate#second">Second duplicate</a>
    <a data-href="/notice/42">Bekanntmachung</a>
    <button data-url="/download?id=42">Leistungsbeschreibung</button>
    <a data-download="/files/annex">Anlage</a>
    <form action="/search"><button formaction="/submit">Submit</button></form>
    <iframe src="/embedded/details"></iframe>
    <video><source src="/media/preview.mp4" type="video/mp4"></video>
    <a href="javascript:alert(1)">unsafe</a>
    <a data-url="mailto:test@example.test">unsafe mail</a>
    <a href="#section">fragment</a>
    <a href="/redirect?next=https%3A%2F%2Fevil.test%2Fsecret#fragment">redirect-like</a>
  `,
  baseUrl,
);

assert.equal(resources.filter((resource) => resource.url.endsWith("/duplicate")).length, 1);
assert.equal(resources.find((resource) => resource.url.endsWith("/duplicate"))?.text, "First duplicate");
assert.equal(resources.some((resource) => resource.url.includes("javascript:")), false);
assert.equal(resources.some((resource) => resource.url.startsWith("mailto:")), false);
assert.equal(resources.some((resource) => resource.url.endsWith("#fragment")), false);

const notice = resources.find((resource) => resource.url.endsWith("/notice/42"));
assert.ok(notice);
assert.equal(notice.type, "page");
assert.ok(notice.roleHints.includes("bekanntmachung"));

const pageVariants = extractResourcesFromLinks(
  [
    { href: "/eforms", text: "Verfahrensangaben" },
    { href: "/eforms?-1.-form", text: "Anlage" },
  ],
  baseUrl,
);
assert.equal(new Set(pageVariants.map((resource) => resource.canonicalUrl)).size, 1, "page state variants share one canonical resource");

const download = resources.find((resource) => resource.url.includes("/download?id=42"));
assert.ok(download);
assert.equal(download.type, "download");
assert.ok(download.roleHints.includes("leistungsbeschreibung"));
assert.ok(resources.some((resource) => resource.url.endsWith("/files/annex") && resource.type === "download"));

assert.ok(resources.some((resource) => resource.source === "button" && resource.url.endsWith("/submit")));
assert.ok(resources.some((resource) => resource.source === "form" && resource.url.endsWith("/search")));
assert.ok(resources.some((resource) => resource.source === "iframe" && resource.url.endsWith("/embedded/details")));
assert.ok(resources.some((resource) => resource.source === "source" && resource.type === "media"));

const redirectLike = resources.find((resource) => resource.url.includes("/redirect?next="));
assert.equal(redirectLike?.url, "https://example.test/redirect?next=https%3A%2F%2Fevil.test%2Fsecret");
assert.equal(normalizeResourceUrl("https://user:secret@example.test/path#part"), "https://example.test/path");
assert.equal(normalizeResourceUrl("javascript:location.href='https://evil.test'", baseUrl), null);
assert.equal(normalizeResourceUrl("data:text/html,unsafe", baseUrl), null);
assert.equal(normalizeResourceUrl("mailto:test@example.test", baseUrl), null);

assert.deepEqual(assignRoleHints("Unterlagen: Bekanntmachung und Leistungsbeschreibung"), [
  "leistungsbeschreibung",
  "bekanntmachung",
]);
assert.equal(classifyResourceType("https://example.test/download?id=1"), "download");
assert.equal(isPortalActionUrl("https://example.test/VMPCenter/public/company/projectForwarding.do?pid=42"), true);
assert.equal(isPortalActionUrl("https://example.test/VMPSatellite/mandator/sf_security_check"), true);
assert.equal(isPortalActionUrl("/VMPSatellite/mandator/sf_security_check?continue=documents"), true);
assert.equal(isPortalActionUrl("https://example.test/files/notice.pdf"), false);
assert.equal(classifyResourceType({ url: "https://example.test/api/notices", resourceType: "fetch" }), "api");
assert.equal(
  classifyResourceType({ url: "https://example.test/file", contentType: "application/pdf", contentDisposition: null }),
  "document",
);

const networkResources = extractResourcesFromNetworkMetadata(
  [
    {
      url: "/api/notices",
      method: "GET",
      status: 200,
      contentType: "application/json; charset=utf-8",
      contentDisposition: null,
      resourceType: "fetch",
      cookie: "must not be retained",
      authorization: "must not be retained",
    },
    {
      url: "/download/notice",
      method: "GET",
      status: 200,
      contentType: "application/octet-stream",
      contentDisposition: "attachment; filename=notice.pdf",
      resourceType: "xhr",
    },
    {
      url: "https://external.test/api/other",
      method: "GET",
      status: 200,
      contentType: "application/json",
      contentDisposition: null,
      resourceType: "fetch",
    },
  ],
  baseUrl,
);
assert.equal(networkResources.length, 2);
assert.ok(networkResources.some((resource) => resource.type === "api"));
assert.ok(networkResources.some((resource) => resource.type === "download"));
assert.equal("headers" in networkResources[0], false);
assert.equal("cookie" in networkResources[0], false);
assert.equal("authorization" in networkResources[0], false);

const candidates = extractResourcesFromLinks(
  [
    { href: "/about", text: "Über uns" },
    { href: "/notice/42", text: "Bekanntmachung" },
    { href: "https://external.test/ausschreibung", text: "Ausschreibung" },
  ],
  baseUrl,
);
const ranked = rankSubpageCandidates(candidates, { baseUrl, limit: 2 });
assert.equal(ranked.length, 1);
assert.equal(ranked[0].url, "https://example.test/notice/42");
assert.ok(ranked[0].score > 0);

console.log("Resource discovery tests passed.");
