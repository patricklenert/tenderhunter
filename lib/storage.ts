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

export const fetchAndStore = async (url: string, relativePath: string): Promise<StoredObject> => {
  // Strip jsessionid from URL for cleaner requests
  const cleanUrl = url.replace(/;jsessionid=[^;?/]+/gi, "");
  const response = await fetch(cleanUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Dokument konnte nicht geladen werden: ${response.status}`);
  }

  const contentType = (response.headers.get("content-type") ?? "application/octet-stream")
    .split(";")[0]
    .trim();
  const payload = Buffer.from(await response.arrayBuffer());
  return saveBytes(relativePath, payload, contentType);
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
  return `${filename}.bin`;
};
