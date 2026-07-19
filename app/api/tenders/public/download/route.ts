import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCS_DIR = path.join(process.cwd(), "public", "docs");
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function sanitizeFilename(name: string): string {
  const cleaned = name
    .split(";")[0]
    .split("?")[0]
    .replace(/[^a-zA-Z0-9äöüÄÖÜß._\- ]/g, "")
    .trim();
  return cleaned.length > 3 ? cleaned : "dokument.pdf";
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(30000),
      redirect: "follow",
    });

    if (!resp.ok) {
      return NextResponse.json({ error: `upstream returned ${resp.status}` }, { status: 502 });
    }

    const contentType = resp.headers.get("content-type") ?? "";
    const contentLength = Number(resp.headers.get("content-length") ?? 0);
    if (contentLength > MAX_SIZE) {
      return NextResponse.json({ error: "file too large (max 50MB)" }, { status: 413 });
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "file too large (max 50MB)" }, { status: 413 });
    }

    // Determine extension
    let ext = ".pdf";
    if (contentType.includes("zip")) ext = ".zip";
    else if (contentType.includes("spreadsheet") || contentType.includes("excel") || url.endsWith(".xlsx")) ext = ".xlsx";
    else if (contentType.includes("html")) ext = ".html";

    // Build filename from URL or content-disposition
    const cd = resp.headers.get("content-disposition");
    let filename = "dokument.pdf";
    if (cd) {
      const match = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      if (match) filename = decodeURIComponent(match[1].trim());
    }
    if (filename === "dokument.pdf") {
      const urlPath = new URL(url).pathname;
      const last = urlPath.split("/").pop() ?? "";
      if (last && last.length > 3) filename = sanitizeFilename(decodeURIComponent(last));
    }
    if (!filename.endsWith(ext)) filename = filename.replace(/\.[^.]+$/, "") + ext;

    // Hash URL for deduplication
    const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
    const safeName = `${hash}-${filename}`.replace(/[^a-zA-Z0-9äöüÄÖÜß._\-]/g, "_").slice(0, 120);

    fs.mkdirSync(DOCS_DIR, { recursive: true });
    const filePath = path.join(DOCS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buffer);
    }

    const publicUrl = `https://palemaz.com/api/docs/${safeName}`;
    return NextResponse.json({ url: publicUrl, filename, size: buffer.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
