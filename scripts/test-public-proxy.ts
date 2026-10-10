import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Force the proxy's dependency failure path without touching the live database.
process.env.DATABASE_URL = "postgresql://127.0.0.1:1/tenderhunter";

async function main(): Promise<void> {
  const { isKnownPublicUsPath, proxy } = await import("../proxy");

  assert.equal(isKnownPublicUsPath(["us", "profile"]), true, "known US profile path remains public");
  assert.equal(isKnownPublicUsPath(["us", "tender", "1178"]), true, "US tender paths reach ID validation");
  assert.equal(isKnownPublicUsPath(["us", "feed.xml"]), true, "US feed remains public");
  assert.equal(isKnownPublicUsPath(["us", "unknown"]), false, "unknown US paths are rejected before slash redirects");
  assert.equal(isKnownPublicUsPath(["us", "profile", "unknown"]), false, "unknown US profile paths are rejected");

  for (const path of ["/p/example", "/auftraggeber/example", "/ausschreibung/42/example"]) {
    const response = await proxy(new NextRequest(`https://example.test${path}`));
    assert.equal(response.status, 503, `${path} returns a dependency status`);
    assert.equal(response.headers.get("retry-after"), "60", `${path} includes retry guidance`);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, follow", `${path} is not indexable while unavailable`);
  }

  const malformedUsTender = await proxy(new NextRequest("https://example.test/us/tender/not-a-number"));
  assert.equal(malformedUsTender.status, 404, "malformed US tender IDs must be real 404s before database access");

  console.log("Public proxy resilience tests passed.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
