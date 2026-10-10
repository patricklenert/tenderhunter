import assert from "node:assert/strict";
import { buildUsTenderIdentityKey, US_TENDER_SOURCE_ADAPTERS } from "../lib/us-tender-scraper";
import { parseFloridaMfmpDetailAttachments, parseFloridaMfmpListingHtml } from "../lib/us/florida-mfmp";
import { parseGeorgiaGprDetailAttachments } from "../lib/us/georgia-gpr";
import { parseNewYorkContractReporterHtml } from "../lib/us/new-york-contract-reporter";
import { parseNorthCarolinaEvpDetailAttachments, parseNorthCarolinaEvpListingHtml } from "../lib/us/north-carolina-evp";
import { parseRenderedPortalAttachments } from "../lib/us/rendered-portals";
import { dedupeUsAttachments } from "../lib/us/types";

const sourceKeys = US_TENDER_SOURCE_ADAPTERS.map(([source]) => source);
assert.ok(sourceKeys.includes("sba_subnet"));
assert.ok(sourceKeys.includes("north_carolina_evp"));
assert.ok(sourceKeys.includes("florida_mfmp"));
assert.ok(sourceKeys.includes("new_york_contract_reporter"));
assert.notEqual(
  buildUsTenderIdentityKey({ source: "sam_gov", externalId: undefined, url: "https://example.test/opportunity/1" }),
  buildUsTenderIdentityKey({ source: "sam_gov", externalId: undefined, url: "https://example.test/opportunity/2" }),
  "US opportunities without an external ID must remain distinct by URL",
);
assert.equal(
  buildUsTenderIdentityKey({ source: "sam_gov", externalId: undefined, url: "https://EXAMPLE.test/opportunity/1#details" }),
  buildUsTenderIdentityKey({ source: "sam_gov", externalId: undefined, url: "https://example.test/opportunity/1#documents" }),
  "URL fragments must not create duplicate US opportunities",
);

assert.deepEqual(
  dedupeUsAttachments([
    { name: "First", url: "https://EXAMPLE.test/files/a.pdf#top" },
    { name: "Duplicate", url: "https://example.test/files/a.pdf#other" },
    { name: "Relative", url: "/files/b.pdf" },
    { name: "Unsafe", url: "javascript:alert(1)" },
  ], "https://example.test/opportunity/1"),
  [
    { name: "First", url: "https://example.test/files/a.pdf" },
    { name: "Relative", url: "https://example.test/files/b.pdf" },
  ],
);

const renderedAttachments = parseRenderedPortalAttachments(
  `<a href="/download?id=1">Bid package</a><a href="https://example.test/download?id=1#copy">Copy</a><a href="javascript:bad()">Document</a>`,
  "https://example.test/list",
);
assert.deepEqual(renderedAttachments, [{ name: "Bid package", url: "https://example.test/download?id=1" }]);

const georgiaAttachments = parseGeorgiaGprDetailAttachments(
  `<a href="/gpr/downloadAttachment?attachmentId=12">Solicitation.pdf</a><a href="/gpr/downloadAttachment?attachmentId=12#duplicate">Duplicate</a>`,
  "https://ssl.doas.state.ga.us/gpr/eventDetails?id=1",
);
assert.equal(georgiaAttachments.length, 1);
assert.equal(georgiaAttachments[0].url, "https://ssl.doas.state.ga.us/gpr/downloadAttachment?attachmentId=12");

const ncListings = parseNorthCarolinaEvpListingHtml(`
  <table><tbody>
    <tr data-entity="evp_solicitation" data-id="nc-guid" data-name="NC Software Services">
      <td data-attribute="evp_solicitationnbr" aria-label="NC-123">NC-123</td>
      <td data-attribute="evp_description" aria-label="Public software services"></td>
      <td data-attribute="owningbusinessunit" aria-label="NC Department"></td>
      <td data-attribute="statuscode" aria-label="Open"></td>
      <td data-attribute="evp_opendate"><time datetime="2030-08-20T14:00:00"></time></td>
      <td><a href="/solicitations/details/?id=nc-guid">View details</a></td>
    </tr>
  </tbody></table>
`, "https://evp.nc.gov/solicitations/");
assert.equal(ncListings.length, 1);
assert.equal(ncListings[0].externalId, "nc-guid");
assert.equal(ncListings[0].buyer, "NC Department");
assert.equal(parseNorthCarolinaEvpDetailAttachments(
  `<a href="/_entity/annotation/file-1/portal?t=1">Advertisement.pdf</a>`,
  "https://evp.nc.gov/solicitations/details/?id=nc-guid",
)[0].url, "https://evp.nc.gov/_entity/annotation/file-1/portal?t=1");

const floridaListings = parseFloridaMfmpListingHtml(`
  <table><tbody><tr class="mat-row">
    <td>Open IT Services</td><td>ITB-123</td><td>AGENCY-123</td><td>1</td><td>Florida Agency</td><td>Invitation to Bid</td><td>08/01/2030</td><td>08/31/2030</td><td>OPEN</td>
  </tr></tbody></table>
`);
assert.equal(floridaListings.length, 1);
assert.equal(floridaListings[0].url, "https://vendor.myfloridamarketplace.com/search/bids/detail/123");
assert.deepEqual(parseFloridaMfmpDetailAttachments(
  `<a href="/files/one.pdf">Download one</a><a href="/files/one.pdf#copy">Download duplicate</a>`,
  floridaListings[0].url,
), [{ name: "Download one", url: "https://vendor.myfloridamarketplace.com/files/one.pdf" }]);

const nyListings = parseNewYorkContractReporterHtml(`
  <div class="opp-list-item" data-ad-id="2136501">
    <div title="Full Title: Public IT Services">Public IT Services</div>
    <div class="d-flex"><div class="fw-bold">CR#:</div><div class="px-2">2136501</div></div>
    <div class="d-flex"><div class="fw-bold">Agency:</div><div class="px-2">New York Agency</div></div>
    <div class="d-flex"><div class="fw-bold">Due date:</div><div class="px-2">8/31/2030</div></div>
    <div class="d-flex"><div class="fw-bold">Category:</div><div class="px-2">Information Technology</div></div>
    <div class="d-flex"><div class="fw-bold">Ad type:</div><div class="px-2">General</div></div>
  </div>
`);
assert.equal(nyListings.length, 1);
assert.equal(nyListings[0].externalId, "2136501");
assert.equal(nyListings[0].agency, "New York Agency");
assert.equal(nyListings[0].category, "Information Technology");

console.log("US source parser tests passed");
