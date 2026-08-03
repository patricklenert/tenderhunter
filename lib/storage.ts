import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { settings } from "@/lib/config";
import { detectAccessPage } from "@/lib/access-page-detector";

export interface StoredObject {
  storagePath: string;
  sha256: string;
  contentType: string;
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

export const fetchAndStore = async (url: string, relativePath: string): Promise<StoredObject> => {
  // Strip jsessionid from URL for cleaner requests
  const cleanUrl = url.replace(/;jsessionid=[^;?/]+/gi, "");
  const response = await fetch(cleanUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Dokument konnte nicht geladen werden: ${response.status}`);
  }

  const contentType = (response.headers.get("content-type") ?? "application/octet-stream")
    .split(";")[0]
    .trim();

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
