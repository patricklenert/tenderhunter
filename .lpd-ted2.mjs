import { chromium } from "playwright";

const test = async (name, port) => {
  try {
    const browser = await chromium.connectOverCDP(`ws://127.0.0.1:${port}`, { timeout: 15000 });
    const context = await browser.newContext({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36", viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const responses = [];
    page.on("response", (r) => { if (r.url().includes("ted.europa.eu")) responses.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 110)}`); });
    await page.goto("https://ted.europa.eu/en/search/result?country=DE&page=1", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(8000);
    const html = await page.content();
    const ids = new Set();
    const re = /href=["']([^"']*\/notice\/[^"']*?(\d+-\d+)[^"']*)["']/gi;
    let m; while ((m = re.exec(html)) !== null) ids.add(m[2]);
    const apiResponses = responses.filter(r => /api|search|json/i.test(r));
    console.log(`[${name}] html=${html.length} noticeIds=${ids.size} apiCalls=${apiResponses.length}`);
    apiResponses.slice(0, 6).forEach(r => console.log(`   ${r}`));
    await context.close();
    await browser.close();
  } catch (e) {
    console.log(`[${name}] FAILED: ${String(e).slice(0, 150)}`);
  }
};
await test("obscura", 9222);
await test("lightpanda", 9223);
