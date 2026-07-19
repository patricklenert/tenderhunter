import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { tenders, documents } from "../lib/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { objectAbsolutePath } from "../lib/storage.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

function detectHtmlEncoding(raw: Buffer): string {
  const head = raw.subarray(0, 2048).toString("ascii");
  const metaMatch = head.match(/charset[=:\s]+([a-zA-Z0-9_-]+)/i);
  if (metaMatch) {
    const charset = metaMatch[1].toLowerCase().trim();
    if (charset === "iso-8859-1" || charset === "latin1") return "iso-8859-1";
    if (charset === "iso-8859-15" || charset === "latin9") return "iso-8859-15";
    if (charset === "windows-1252" || charset === "cp1252") return "windows-1252";
    if (charset === "utf-8" || charset === "utf8") return "utf-8";
    return charset;
  }
  return "utf-8";
}

function extractTextFromHtml(filePath: string): string {
  const raw = fs.readFileSync(filePath);
  const encoding = detectHtmlEncoding(raw);
  if (encoding === "utf-8") {
    // Already UTF-8, check if there are replacement characters
    const text = raw.toString("utf8");
    if (!text.includes("\uFFFD")) return ""; // No encoding issue
  }
  const decoder = new TextDecoder(encoding);
  const html = decoder.decode(raw);
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  return $.text().replace(/\s+/g, " ").trim();
}

async function main() {
  // Find tenders with replacement characters in raw_text
  const corrupted = await db
    .select({ id: tenders.id, title: tenders.title })
    .from(tenders)
    .where(
      and(
        sql`raw_text LIKE '%' || chr(65533) || '%'`,
        eq(tenders.qualityStatus, "qualified"),
      ),
    )
    .limit(500);

  console.log(`Found ${corrupted.length} corrupted tenders`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const tender of corrupted) {
    try {
      // Find the HTML document for this tender
      const docs = await db
        .select({ storagePath: documents.storagePath, contentType: documents.contentType })
        .from(documents)
        .where(eq(documents.tenderId, tender.id))
        .limit(5);

      const htmlDoc = docs.find(
        (d) =>
          d.storagePath.endsWith(".html") ||
          d.storagePath.endsWith(".htm") ||
          (d.contentType && d.contentType.includes("html")),
      );

      if (!htmlDoc) {
        skipped++;
        continue;
      }

      const absPath = objectAbsolutePath(htmlDoc.storagePath);
      if (!fs.existsSync(absPath)) {
        skipped++;
        continue;
      }

      const text = extractTextFromHtml(absPath);
      if (text.length < 50) {
        skipped++;
        continue;
      }

      await db
        .update(tenders)
        .set({ rawText: text, updatedAt: new Date() })
        .where(eq(tenders.id, tender.id));

      console.log(`Fixed tender ${tender.id}: ${tender.title?.slice(0, 60)}`);
      fixed++;
    } catch (error) {
      console.error(`Failed tender ${tender.id}:`, error);
      failed++;
    }
  }

  console.log(`\nDone: ${fixed} fixed, ${skipped} skipped, ${failed} failed`);
  await pool.end();
}

main().catch(console.error);
