import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import sitemap from "../app/sitemap";
import { proxy } from "../proxy";

async function main(): Promise<void> {
  const entries = await sitemap();
  assert.ok(entries.length > 0, "sitemap must contain entries");

  const failures: Array<{ url: string; status: number; location: string | null }> = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= entries.length) return;

      const url = entries[index].url;
      const response = await proxy(new NextRequest(url, { method: "GET" }));
      if (response.status !== 200) {
        failures.push({
          url,
          status: response.status,
          location: response.headers.get("location"),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: 8 }, () => worker()));
  assert.deepEqual(failures, [], `sitemap entries must pass the public route proxy: ${JSON.stringify(failures.slice(0, 20))}`);
  console.log(`Sitemap proxy integration test passed (${entries.length} direct route validations).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
