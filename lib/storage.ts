import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { settings } from "@/lib/config";
import { detectAccessPage } from "@/lib/access-page-detector";

export interface StoredObject {
  storagePath: string;
  sha256: string;
  contentType: string;
  finalUrl?: string;
  filename?: string | null;
  contentDisposition?: string | null;
}

export interface FetchAndStoreOptions {
  /** Only a small allow-list of request headers is accepted. */
  headers?: Readonly<Record<string, string>>;
  referer?: string;
  userAgent?: string;
}

const hashBytes = (payload: Buffer): string => createHash("sha256").update(payload).digest("hex");

const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_EMPTY_MAGIC = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const bufStartsWith = (buf: Buffer, magic: Buffer): boolean =>
  buf.length >= magic.length && buf.subarray(0, magic.length).equals(magic);

// Detect the real content type from magic bytes, overriding the often-wrong
// Content-Type header. Returns null if no known signature is recognised.
export const sniffContentType = (head: Buffer): string | null => {
  if (head.length === 0) return null;
  if (bufStartsWith(head, PDF_MAGIC)) return "application/pdf";
  if (bufStartsWith(head, ZIP_MAGIC) || bufStartsWith(head, ZIP_EMPTY_MAGIC)) return "application/zip";
  if (bufStartsWith(head, OLE2_MAGIC)) return "application/vnd.ms-excel";
  const textHead = head.subarray(0, Math.min(head.length, 256)).toString("latin1").replace(/^[ \t\r\n\uFEFF]+/, "");
  if (/^<(?:!doctype\s+html|html|head|body|\?xml)/i.test(textHead)) return "text/html";
  return null;
};

export const saveBytes = (relativePath: string, payload: Buffer, contentType: string): StoredObject => {
  const absolute = path.join(settings.objectStorePath, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, payload);
  return {
    storagePath: relativePath,
    sha256: hashBytes(payload),
    contentType
  };
};

const FETCH_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const HEAD_SAMPLE_BYTES = 8192;
const DEFAULT_ACCEPT = "application/pdf,application/octet-stream,application/zip,application/vnd.openxmlformats-officedocument.document;q=0.9,application/msword;q=0.8,text/html;q=0.7,*/*;q=0.5";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SAFE_REQUEST_HEADERS = new Set(["accept", "accept-language", "referer", "user-agent"]);
const CANONICAL_REQUEST_HEADERS: Record<string, string> = {
  accept: "Accept",
  "accept-language": "Accept-Language",
  referer: "Referer",
  "user-agent": "User-Agent",
};

const boundedHeaderValue = (value: unknown, maxLength = 2_000): string | null => {
  if (typeof value !== "string") return null;
  const bounded = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
  return bounded || null;
};

const safeReferer = (value: string | undefined): string | null => {
  const bounded = boundedHeaderValue(value, 2_048);
  if (!bounded) return null;
  try {
    const parsed = new URL(bounded);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

export const buildSafeRequestHeaders = (options?: FetchAndStoreOptions): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: DEFAULT_ACCEPT,
    "User-Agent": DEFAULT_USER_AGENT,
  };

  for (const [name, value] of Object.entries(options?.headers ?? {})) {
    const normalizedName = name.toLowerCase();
    if (!SAFE_REQUEST_HEADERS.has(normalizedName)) continue;
    const bounded = boundedHeaderValue(value);
    if (bounded) headers[CANONICAL_REQUEST_HEADERS[normalizedName]] = bounded;
  }

  const referer = safeReferer(options?.referer);
  if (referer) headers.Referer = referer;
  const userAgent = boundedHeaderValue(options?.userAgent, 512);
  if (userAgent) headers["User-Agent"] = userAgent;
  return headers;
};

const responseFilename = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename\*\s*=\s*(?:UTF-8''|[^']*'[^']*')?([^;]+)/i)
    ?? contentDisposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the bounded header value when RFC 5987 decoding is not possible.
  }
  const safe = path.basename(decoded.replace(/\\/g, "/")).replace(/[^a-zA-Z0-9._ -]/g, "").trim();
  return safe ? safe.slice(0, 255) : null;
};

export const fetchAndStore = async (url: string, relativePath: string, options?: FetchAndStoreOptions): Promise<StoredObject> => {
  // Strip jsessionid from URL for cleaner requests
  const cleanUrl = url.replace(/;jsessionid=[^;?/]+/gi, "");
  const response = await fetch(cleanUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: buildSafeRequestHeaders(options),
  });
  if (!response.ok) {
    throw new Error(`Dokument konnte nicht geladen werden: ${response.status}`);
  }

  const contentType = (response.headers.get("content-type") ?? "application/octet-stream")
    .split(";")[0]
    .trim();
  const contentDisposition = boundedHeaderValue(response.headers.get("content-disposition"));

  // Check Content-Length header for early rejection
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Dokument zu gross: ${contentLength} Bytes (Limit: ${MAX_FILE_SIZE_BYTES})`);
  }

  if (!response.body) {
    throw new Error("Dokument ohne lesbaren Response-Stream");
  }

  const absolute = path.join(settings.objectStorePath, relativePath);
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.mkdir(path.dirname(absolute), { recursive: true });

  let file: Awaited<ReturnType<typeof fs.promises.open>> | null = null;
  let size = 0;
  const hash = createHash("sha256");
  const headChunks: Buffer[] = [];
  let headSize = 0;
  try {
    file = await fs.promises.open(temporary, "w");
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_SIZE_BYTES) {
        await reader.cancel();
        throw new Error(`Dokument zu groß: ${size} Bytes (Limit: ${MAX_FILE_SIZE_BYTES})`);
      }
      hash.update(value);
      await file.write(value);
      if (headSize < HEAD_SAMPLE_BYTES) {
        headChunks.push(Buffer.from(value));
        headSize += value.byteLength;
      }
    }
    await file.close();
    file = null;

    const head = headChunks.length > 0 ? Buffer.concat(headChunks) : Buffer.alloc(0);
    const sniffed = sniffContentType(head);
    const finalContentType = sniffed ?? contentType;

    // Validate actual content using magic bytes, not just the Content-Type header.
    if (finalContentType.includes("html")) {
      const accessPage = detectAccessPage(head.toString("latin1"), { url: cleanUrl });
      if (accessPage.blocked) {
        throw new Error(`Zugriffsblockierte Seite statt Dokument (${accessPage.reason})`);
      }
      if (size < 100) {
        throw new Error(`Dokument zu kurz (${size} Bytes), vermutlich Fehlerseite`);
      }
    }

    await fs.promises.rename(temporary, absolute);
    return {
      storagePath: relativePath,
      sha256: hash.digest("hex"),
      contentType: finalContentType,
      finalUrl: (response.url || cleanUrl).replace(/;jsessionid=[^;?/]+/gi, ""),
      filename: responseFilename(contentDisposition),
      contentDisposition,
    };
  } catch (error) {
    if (file) await file.close().catch(() => undefined);
    await fs.promises.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
};

export const objectAbsolutePath = (relativePath: string): string => path.join(settings.objectStorePath, relativePath);

export const suggestedFilename = (url: string, fallbackPrefix: string): string => {
  // Prefix with a short URL hash so two URLs that yield the same basename
  // (e.g. /download/document.pdf?id=1 vs ?id=2) no longer overwrite each other.
  const urlHash = createHash("sha256").update(url).digest("hex").slice(0, 12);
  try {
    const parsed = new URL(url.replace(/;jsessionid=[^;?/]+/gi, ""));
    const base = path.basename(parsed.pathname);
    if (!base) {
      return `${urlHash}-${fallbackPrefix}.html`;
    }
    const safe = base.replace(/[^a-zA-Z0-9._-]/g, "");
    return safe ? `${urlHash}-${safe}` : `${urlHash}-${fallbackPrefix}.bin`;
  } catch {
    return `${urlHash}-${fallbackPrefix}.bin`;
  }
};

export const ensureExtension = (filename: string, contentType: string): string => {
  if (filename.includes(".")) {
    return filename;
  }
  if (contentType.includes("pdf")) {
    return `${filename}.pdf`;
  }
  if (contentType.includes("html")) {
    return `${filename}.html`;
  }
  if (contentType.includes("spreadsheet") || contentType.includes("excel") || contentType.includes("xlsx")) {
    return `${filename}.xlsx`;
  }
  if (contentType.includes("zip") || contentType.includes("archive")) {
    return `${filename}.zip`;
  }
  return `${filename}.bin`;
};
