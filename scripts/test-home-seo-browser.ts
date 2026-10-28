import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.HOME_SEO_TEST_URL ?? "http://127.0.0.1:3025/";
const headingText = "Öffentliche Ausschreibungen in Deutschland finden";

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const companyUrl = page.locator("#company-url");

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await companyUrl.waitFor();
    await page.waitForTimeout(150);

    const fieldState = await companyUrl.evaluate((input) => ({
      focused: document.activeElement === input,
      labelFloated: document.querySelector(`label[for="${input.id}"]`)?.classList.contains("MuiInputLabel-shrink") ?? false,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }));

    assert.equal(fieldState.focused, false, `${width}px: website field must not steal focus on initial load`);
    assert.equal(fieldState.labelFloated, true, `${width}px: website label must remain distinct from its example URL`);
    assert.equal(fieldState.horizontalOverflow, false, `${width}px: homepage must not overflow horizontally`);

    if (width === 390) {
      await page.keyboard.press("Tab");
      const skipLinkState = await page.evaluate(() => {
        const active = document.activeElement;
        const rect = active?.getBoundingClientRect();
        return {
          href: active?.getAttribute("href"),
          label: active?.textContent?.trim(),
          visible: Boolean(rect && rect.top >= 0 && rect.bottom <= window.innerHeight),
          focusRing: getComputedStyle(active!).outlineStyle !== "none",
        };
      });
      assert.equal(skipLinkState.href, "#website-analysis-title", "first Tab must expose a skip link to the primary task");
      assert.equal(skipLinkState.label, "Zum Analyseformular");
      assert.equal(skipLinkState.visible, true, "skip link must become visible when focused");
      assert.equal(skipLinkState.focusRing, true, "skip link must show the brand focus ring");

      await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.location.hash === "#website-analysis-title");
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        "website-analysis-title",
        "skip link must move focus to the analysis heading",
      );
    }
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Navigation öffnen" }).click();
  const mobileBrand = page.getByRole("link", { name: "Tenderhunter Startseite" });
  assert.equal(await mobileBrand.getByText("Tenderhunter", { exact: true }).count(), 1, "mobile navigation must use the shared Tenderhunter wordmark");
  assert.equal(await mobileBrand.locator("svg").count(), 1, "mobile navigation must show the shared brand mark");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const desktopBrand = page.getByRole("link", { name: "Tenderhunter Startseite" });
  assert.equal(await desktopBrand.getByText("Tenderhunter", { exact: true }).count(), 1, "desktop navigation must use the shared Tenderhunter wordmark");
  assert.equal(await desktopBrand.locator("svg").count(), 1, "desktop navigation must show the shared brand mark");

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
