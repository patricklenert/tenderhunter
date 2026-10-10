import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.HOME_SEO_TEST_URL ?? "http://127.0.0.1:3025/";
const headingText = "Öffentliche Ausschreibungen in Deutschland finden";

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const seoSection = page.locator('[data-layout-slot="homepage-seo"]');
  const seoHeading = page.getByRole("heading", { name: headingText, exact: true });

  await seoSection.waitFor();
  assert.equal(await seoHeading.count(), 1, "homepage must render exactly one SEO heading");

  const assertSeoIsBelowViewport = async (label: string) => {
    const state = await seoSection.evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
      connected: element.isConnected,
    }));

    assert.equal(state.connected, true, `${label}: SEO section must stay mounted`);
    assert.ok(
      state.top >= state.viewportHeight - 1,
      `${label}: SEO section must remain below the initial app viewport (top=${state.top}, viewport=${state.viewportHeight})`,
    );
  };

  await assertSeoIsBelowViewport("initial load");

  for (const [label, hash] of [
    ["Analyse", "analyse"],
    ["Ausschreibungen", "ausschreibungen"],
    ["U.S. Opportunities", "us"],
    ["MCP", "mcp"],
  ] as const) {
    await page.goto(`${baseUrl}#${hash}`, { waitUntil: "domcontentloaded" });
    await seoSection.waitFor();
    assert.equal(await seoHeading.count(), 1, `${label}: SEO heading must be present after reload`);
    await assertSeoIsBelowViewport(`${label} reload`);

    const tab = page.getByRole("button", { name: label, exact: true });
    assert.equal(await tab.count(), 1, `navigation must contain the ${label} tab`);
    await tab.click();
    await page.waitForTimeout(150);
    assert.equal(await seoHeading.count(), 1, `${label}: SEO heading must not disappear after tab change`);
    await assertSeoIsBelowViewport(label);
  }
  } finally {
    await browser.close();
  }
}

main().then(() => {
  console.log("Homepage SEO browser regression test passed.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
