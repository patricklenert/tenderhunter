import * as cheerio from "cheerio";

/** Decode HTML entities without treating literal angle brackets as markup. */
export function decodeHtmlEntities(text: string): string {
  let decoded = text;

  for (let pass = 0; pass < 3; pass += 1) {
    const escaped = decoded.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const next = cheerio.load(`<span>${escaped}</span>`, null, false)("span").text();
    if (next === decoded) return decoded;
    decoded = next;
  }

  return decoded;
}
