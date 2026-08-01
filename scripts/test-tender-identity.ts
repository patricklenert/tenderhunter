import assert from "node:assert/strict";
import { extractPortalProjectId, stripSessionId } from "../lib/tender-identity";

const sessionUrl =
  "https://www.vergabe.metropoleruhr.de/VMPSatellite/public/company/project/CXVDYYDYTVDZNLLT/de/overview;jsessionid=abc123.skrzvmr01?0";

assert.equal(extractPortalProjectId(sessionUrl), "CXVDYYDYTVDZNLLT");
assert.equal(
  stripSessionId(sessionUrl),
  "https://www.vergabe.metropoleruhr.de/VMPSatellite/public/company/project/CXVDYYDYTVDZNLLT/de/overview?0=",
);
assert.equal(extractPortalProjectId("https://example.com/not-a-project"), null);

console.log("Tender identity tests passed.");
