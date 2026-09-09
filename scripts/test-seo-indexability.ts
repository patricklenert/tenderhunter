import assert from "node:assert/strict";
import { getListingRobots, NOINDEX_FOLLOW } from "../lib/seo-indexability";
import { dependencyUnavailableResponse } from "../lib/public-route-resilience";

assert.equal(getListingRobots({}, 1, true), undefined);
assert.deepEqual(getListingRobots({ q: "bau" }, 1, true), { index: false, follow: true });
assert.deepEqual(getListingRobots({ page: "2" }, 1, true), { index: false, follow: true });
assert.deepEqual(getListingRobots({ filter: "bau" }, 1, true), { index: false, follow: true });
assert.deepEqual(NOINDEX_FOLLOW, { index: false, follow: true });

const unavailable = dependencyUnavailableResponse();
assert.equal(unavailable.status, 503);
assert.equal(unavailable.headers.get("retry-after"), "60");
assert.equal(unavailable.headers.get("x-robots-tag"), "noindex, follow");

console.log("SEO indexability tests passed.");
