import assert from "node:assert/strict";
import { chromium } from "playwright";
import { BRAND_COLORS } from "../lib/brand-tokens";

const pageUrl = process.env.US_PROFILE_TEST_URL ?? "http://127.0.0.1:3025/us/profile";
const viewports = [390, 768, 1024, 1440] as const;
const actionChannels = BRAND_COLORS.actionPrimary.match(/[\da-f]{2}/gi);
assert.ok(actionChannels, "Primary action token must be a six-digit hex color");
const expectedActionColor = `rgb(${actionChannels.map((channel) => Number.parseInt(channel, 16)).join(", ")})`;

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const hydrationErrors: string[] = [];
    const runtimeErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error" && /hydration|did not match|server rendered HTML/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      const hydrationErrorCount = hydrationErrors.length;
      const runtimeErrorCount = runtimeErrors.length;
      const response = await page.goto(pageUrl, { waitUntil: "commit" });

      assert.equal(response?.status(), 200, `${width}px: profile page must respond successfully`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1, `${width}px: render one page heading`);

      await page.keyboard.press("Tab");
      const focusOutlineWidth = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.activeElement!).outlineWidth));
      assert.ok(focusOutlineWidth >= 2, `${width}px: keyboard focus must be visible`);

      await page.getByLabel("Company name").fill("Test Company");

      const submitButton = page.getByRole("button", { name: "Save U.S. profile" });
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled);
      await page.waitForFunction((expectedColor) => {
        const button = document.querySelector("button[type=submit]");
        return button !== null && getComputedStyle(button).backgroundColor === expectedColor;
      }, expectedActionColor);
      assert.equal(await submitButton.evaluate((button) => getComputedStyle(button).backgroundColor), expectedActionColor, `${width}px: use the shared primary action color`);
      const submitButtonHeight = await submitButton.evaluate((button) => button.getBoundingClientRect().height);
      assert.ok(submitButtonHeight >= 44, `${width}px: primary action must retain a practical touch target`);

      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(documentWidth <= width, `${width}px: page must not overflow horizontally (${documentWidth}px)`);
      await page.waitForTimeout(150);
      assert.equal(hydrationErrors.length, hydrationErrorCount, `${width}px: no hydration mismatch`);
      assert.equal(runtimeErrors.length, runtimeErrorCount, `${width}px: no client runtime error`);

      if (width === 390 || width === 1440) {
        await page.screenshot({ path: `/tmp/opencode/tenderhunter-us-profile-${width}.png`, fullPage: true });
      }
    }

    const usUrl = new URL("/us", pageUrl);
    const usResponse = await page.request.get(usUrl.toString(), { maxRedirects: 0 });
    assert.equal(usResponse.status(), 301, "/us must retain its canonical redirect");
    const redirect = new URL(usResponse.headers().location, usUrl);
    assert.equal(`${redirect.pathname}${redirect.hash}`, "/#us", "/us must continue to resolve to the U.S. opportunities section");
  } finally {
    await browser.close();
  }
}

main().then(() => {
  console.log("U.S. profile passed hydration, action-token, overflow, and /us redirect checks at 390, 768, 1024, and 1440px.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
