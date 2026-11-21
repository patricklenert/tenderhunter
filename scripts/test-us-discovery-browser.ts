import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.US_DISCOVERY_TEST_URL ?? "http://127.0.0.1:3025/";
const viewports = [390, 768, 1024, 1440] as const;

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(new URL("/#us", baseUrl).toString(), { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Öffentliche und private Aufträge in den USA" }).waitFor();

      assert.equal(await page.getByRole("textbox", { name: "Suchbegriffe" }).count(), 1, `${width}px: search must have an accessible German label`);
      assert.equal(await page.getByRole("combobox", { name: "Auftragsart" }).count(), 1, `${width}px: opportunity type filter must be localized`);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${width}px: US discovery must not overflow horizontally`,
      );

      if (width === 390) {
        await page.getByRole("button", { name: "Navigation öffnen" }).click();
        const usNav = page.getByRole("button", { name: "US-Aufträge", exact: true });
        assert.equal(await usNav.count(), 1, "mobile navigation must use the German US label");
        await usNav.click();

        await page.getByRole("button", { name: "Suchbenachrichtigung einrichten" }).click();
        assert.equal(await page.getByRole("textbox", { name: "E-Mail-Adresse" }).count(), 1);
        assert.equal(await page.getByText("Benachrichtigung für diese Suche einrichten").count(), 1);
        await page.getByRole("button", { name: "Suchbenachrichtigung schließen" }).click();
        await page.screenshot({ path: "/tmp/opencode/tenderhunter-us-discovery-390.png", fullPage: true });
      }

      if (width === 1440) {
        await page.getByRole("combobox", { name: "Kategorie" }).click();
        assert.equal(await page.getByRole("option", { name: "IT und Software" }).count(), 1, "category labels must be translated for display");
        await page.keyboard.press("Escape");
        await page.screenshot({ path: "/tmp/opencode/tenderhunter-us-discovery-1440.png", fullPage: true });
      }
    }

    assert.deepEqual(pageErrors, [], `US discovery must not emit browser errors: ${pageErrors.join("; ")}`);
  } finally {
    await browser.close();
  }
}

main().then(() => {
  console.log("US discovery browser checks passed at 390, 768, 1024, and 1440px.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
