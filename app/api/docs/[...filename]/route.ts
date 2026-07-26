import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCS_DIR = path.join(process.cwd(), "public", "docs");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string[] }> },
) {
  const premiumOrResponse = await requirePremiumSession(req);
  if (premiumOrResponse instanceof Response) return premiumOrResponse;

  const { filename } = await params;
  const filePath = path.join(DOCS_DIR, ...filename);

  // Security: prevent directory traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(DOCS_DIR))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stat = fs.statSync(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const contentType =
    ext === ".pdf" ? "application/pdf" :
    ext === ".zip" ? "application/zip" :
    ext === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
    "application/octet-stream";

  return new NextResponse(fs.readFileSync(resolved), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Content-Disposition": `inline; filename="${path.basename(resolved)}"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
