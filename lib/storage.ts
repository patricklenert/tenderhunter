import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { settings } from "@/lib/config";

export interface StoredObject {
  storagePath: string;
  sha256: string;
  contentType: string;
}

const hashBytes = (payload: Buffer): string => createHash("sha256").update(payload).digest("hex");

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
  try {
    file = await fs.promises.open(temporary, "w");
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_SIZE_BYTES) {
        await reader.cancel();
        throw new Error(`Dokument zu gross: ${size} Bytes (Limit: ${MAX_FILE_SIZE_BYTES})`);
      }
      hash.update(value);
      await file.write(value);
    }
    await file.close();
    file = null;

    // Validate that we got actual content, not an error/login page
    if (size < 100 && contentType.includes("html")) {
      throw new Error(`Dokument zu kurz (${size} Bytes), vermutlich Fehlerseite`);
    }

    await fs.promises.rename(temporary, absolute);
    return {
      storagePath: relativePath,
      sha256: hash.digest("hex"),
      contentType,
    };
  } catch (error) {
    if (file) await file.close().catch(() => undefined);
    await fs.promises.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
};

export const objectAbsolutePath = (relativePath: string): string => path.join(settings.objectStorePath, relativePath);

export const suggestedFilename = (url: string, fallbackPrefix: string): string => {
  try {
    const parsed = new URL(url.replace(/;jsessionid=[^;?/]+/gi, ""));
    const base = path.basename(parsed.pathname);
    if (!base) {
      return `${fallbackPrefix}.html`;
    }
    const safe = base.replace(/[^a-zA-Z0-9._-]/g, "");
    return safe || `${fallbackPrefix}.bin`;
  } catch {
    return `${fallbackPrefix}.bin`;
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
