import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, tenderResources, tenders } from "@/lib/schema";
import { settings } from "@/lib/config";
import { normalizeResourceUrl } from "@/lib/resource-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 50 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const parsePositiveInt = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Resolve only relative paths below the configured object store. */
export const resolveSafeStoredDocumentPath = (root: string, storagePath: string): string | null => {
  if (!root || !storagePath || storagePath.includes("\0") || storagePath.includes("\\") || storagePath.split("/").includes("..") || path.isAbsolute(storagePath)) {
    return null;
  }

  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, storagePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return resolvedPath;
};

const isPathInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};

const sanitizeFilename = (name: string): string => {
  const basename = path.basename(name.replace(/\\/g, "/"));
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/^\.+$/, "")
    .trim()
    .slice(0, 180);
  return cleaned || "dokument";
};

const extensionForContentType = (contentType: string): string => {
  if (contentType.includes("pdf")) return ".pdf";
  if (contentType.includes("zip")) return ".zip";
  if (contentType.includes("spreadsheet") || contentType.includes("excel") || contentType.includes("xlsx")) return ".xlsx";
  if (contentType.includes("word") || contentType.includes("document")) return ".docx";
  if (contentType.includes("html")) return ".html";
  return ".bin";
};

const contentTypeForDocument = (contentType: string | null, filename: string): string => {
  const normalized = contentType?.split(";", 1)[0].trim() ?? "";
  if (/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(normalized)) return normalized;
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".zip") return "application/zip";
  if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === ".html" || extension === ".htm") return "text/html";
  return "application/octet-stream";
};

const withExtension = (filename: string, contentType: string): string => {
  if (path.extname(filename)) return filename;
  return `${filename}${extensionForContentType(contentType)}`;
};

const canonicalDownloadUrl = (value: string | null | undefined, baseUrl?: string): string | null => {
  const normalized = normalizeResourceUrl(value, baseUrl);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    parsed.pathname = parsed.pathname.replace(/;jsessionid=[^/;?]*/gi, "");
    return parsed.toString();
  } catch {
    return normalized;
  }
};

const isDocumentLikeResource = (resourceType: string | null, url: string): boolean => {
  if (resourceType === "document" || resourceType === "download") return true;
  try {
    return /\.(?:pdf|docx?|odt|rtf|xls[xm]?|ods|csv|zip|rar|7z)(?:$|[?#])/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

const extractContentDispositionFilename = (value: string | null): string | null => {
  if (!value) return null;
  const match = value.match(/filename\*\s*=\s*(?:UTF-8''|[^']*'[^']*')?([^;]+)/i)
    ?? value.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Use the sanitized header value when RFC 5987 decoding fails.
  }
  return sanitizeFilename(decoded);
};

const storedDocumentResponse = async (document: {
  storagePath: string;
  filename: string | null;
  contentType: string | null;
  downloadStatus: string | null;
}): Promise<Response> => {
  if (document.downloadStatus !== "downloaded") {
    return NextResponse.json({ error: "document is not available" }, { status: 404 });
  }

  const filePath = resolveSafeStoredDocumentPath(settings.objectStorePath, document.storagePath);
  if (!filePath) return NextResponse.json({ error: "invalid document path" }, { status: 403 });

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return NextResponse.json({ error: "document not found" }, { status: 404 });
  }
  if (!stat.isFile()) return NextResponse.json({ error: "document not found" }, { status: 404 });
  if (stat.size > MAX_SIZE) return NextResponse.json({ error: "file too large" }, { status: 413 });

  const rootRealPath = await fs.promises.realpath(settings.objectStorePath).catch(() => path.resolve(settings.objectStorePath));
  const fileRealPath = await fs.promises.realpath(filePath).catch(() => null);
  if (!fileRealPath || !isPathInside(rootRealPath, fileRealPath)) {
    return NextResponse.json({ error: "invalid document path" }, { status: 403 });
  }

  const baseFilename = sanitizeFilename(document.filename || path.basename(filePath));
  const contentType = contentTypeForDocument(document.contentType, baseFilename);
  const filename = withExtension(baseFilename, contentType);
  const body = await fs.promises.readFile(fileRealPath);
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

const allowedLegacyUrls = async (tenderId: number, tenderUrl: string): Promise<Set<string>> => {
  const [documentRows, resourceRows] = await Promise.all([
    db.select({ url: documents.url }).from(documents).where(eq(documents.tenderId, tenderId)),
    db.select({ url: tenderResources.url, canonicalUrl: tenderResources.canonicalUrl, resourceType: tenderResources.resourceType })
      .from(tenderResources)
      .where(eq(tenderResources.tenderId, tenderId)),
  ]);
  const allowed = new Set<string>();
  for (const row of documentRows) {
    const value = canonicalDownloadUrl(row.url, tenderUrl);
    if (value) allowed.add(value);
  }
  for (const row of resourceRows) {
    const candidate = canonicalDownloadUrl(row.url, tenderUrl) ?? canonicalDownloadUrl(row.canonicalUrl, tenderUrl);
    if (candidate && isDocumentLikeResource(row.resourceType, candidate)) allowed.add(candidate);
    const canonical = canonicalDownloadUrl(row.canonicalUrl, tenderUrl);
    if (canonical && isDocumentLikeResource(row.resourceType, canonical)) allowed.add(canonical);
  }
  return allowed;
};

const fetchAllowlistedResource = async (url: string, allowedUrls: Set<string>): Promise<{ response: Response; url: string }> => {
  let currentUrl = url;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(currentUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(30_000),
      redirect: "manual",
    });
    if (!REDIRECT_STATUSES.has(response.status)) return { response, url: currentUrl };
    const location = canonicalDownloadUrl(response.headers.get("location"), currentUrl);
    if (!location || !allowedUrls.has(location)) throw new Error("unsafe upstream redirect");
    currentUrl = location;
  }
  throw new Error("too many upstream redirects");
};

const legacyShareResponse = async (url: string, allowedUrls: Set<string>): Promise<Response> => {
  const { response, url: finalUrl } = await fetchAllowlistedResource(url, allowedUrls);
  if (!response.ok) {
    return NextResponse.json({ error: `upstream returned ${response.status}` }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_SIZE) {
    return NextResponse.json({ error: "file too large (max 50MB)" }, { status: 413 });
  }
  if (!response.body) return NextResponse.json({ error: "upstream response has no body" }, { status: 502 });

  const headerFilename = extractContentDispositionFilename(response.headers.get("content-disposition"));
  const urlFilename = sanitizeFilename(path.basename(new URL(finalUrl).pathname));
  const filename = withExtension(headerFilename || (urlFilename === "" ? "dokument" : urlFilename), contentType);
  return new NextResponse(response.body, {
    headers: {
      "Content-Type": contentTypeForDocument(contentType, filename),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

export async function GET(req: NextRequest): Promise<Response> {
  const documentId = parsePositiveInt(req.nextUrl.searchParams.get("documentId"));
  const documentIdParam = req.nextUrl.searchParams.get("documentId");
  const tenderId = parsePositiveInt(req.nextUrl.searchParams.get("tenderId"));
  const url = req.nextUrl.searchParams.get("url");

  if (documentIdParam !== null && documentId === null) {
    return NextResponse.json({ error: "invalid documentId" }, { status: 400 });
  }

  try {
    if (documentId !== null) {
      const rows = await db
        .select({
          tenderId: documents.tenderId,
          storagePath: documents.storagePath,
          filename: documents.filename,
          contentType: documents.contentType,
          downloadStatus: documents.downloadStatus,
        })
        .from(documents)
        .innerJoin(tenders, and(eq(tenders.id, documents.tenderId), eq(tenders.qualityStatus, "qualified")))
        .where(eq(documents.id, documentId))
        .limit(1);
      if (rows.length === 0) return NextResponse.json({ error: "document not found" }, { status: 404 });
      if (tenderId !== null && rows[0].tenderId !== tenderId) {
        return NextResponse.json({ error: "document not found" }, { status: 404 });
      }
      return storedDocumentResponse(rows[0]);
    }

    if (!url) return NextResponse.json({ error: "documentId or url parameter required" }, { status: 400 });
    if (tenderId === null) {
      return NextResponse.json({ error: "tenderId is required for legacy URL mode" }, { status: 400 });
    }
    const requestedUrl = canonicalDownloadUrl(url);
    if (!requestedUrl) return NextResponse.json({ error: "invalid url" }, { status: 400 });

    const tenderRows = await db
      .select({ url: tenders.url })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.qualityStatus, "qualified")))
      .limit(1);
    if (tenderRows.length === 0) return NextResponse.json({ error: "tender not found" }, { status: 404 });

    const allowedUrls = await allowedLegacyUrls(tenderId, tenderRows[0].url);
    if (!allowedUrls.has(requestedUrl)) {
      return NextResponse.json({ error: "url is not a resource of this tender" }, { status: 403 });
    }
    return await legacyShareResponse(requestedUrl, allowedUrls);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = /unsafe upstream redirect|invalid document path/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
