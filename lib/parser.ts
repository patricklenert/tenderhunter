import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { htmlToBasicMarkdown } from "@/lib/firecrawl";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

const FETCH_TIMEOUT_MS = 300_000; // 5 Minuten Timeout für OpenRouter Aufrufe

/** Maximale Seiten für native Textextraktion (pdf-parse). */
const MAX_NATIVE_PAGES = parseIntEnv("PARSER_MAX_NATIVE_PAGES", 300);
/** Dateien größer als dieses Limit überspringen OCR (base64-Upload zu teuer). */
const MAX_OCR_FILE_SIZE = parseIntEnv("PARSER_MAX_OCR_FILE_MB", 15) * 1024 * 1024;
/** Mindest-Zeichen für native Extraktion, damit OCR übersprungen wird. */
const MIN_NATIVE_TEXT_CHARS = 200;
const MAX_DOCUMENT_TEXT_CHARS = parseIntEnv("PARSER_MAX_TEXT_CHARS", 5_000_000);

// Shared archive limits protect both generic ZIPs and DOCX files.
const MAX_ZIP_ENTRIES = 50;
const MAX_ZIP_ENTRY_SIZE = 50 * 1024 * 1024;
const MAX_ZIP_TOTAL_SIZE = 200 * 1024 * 1024;

export type ExtractionMethod =
  | "native"
  | "ocr"
  | "fallback_native"
  | "ocr_skipped_size"
  | "xlsx"
  | "html"
  | "zip"
  | "docx"
  | "doc"
  | "plain";

export interface ExtractedDocument {
  text: string;
  /** Native PDF text split by page when the parser can provide it. */
  pages: string[];
  pageCount: number | null;
  method: ExtractionMethod;
  truncated: boolean;
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseXlsxToText(filePath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_csv(sheet, { FS: " | " });
    if (data.trim().length > 0) {
      parts.push(`=== ${sheetName} ===\n${data}`);
    }
  }

  // Remove null bytes and other problematic characters for PostgreSQL UTF8
  return parts.join("\n\n").trim().replace(/\x00/g, "");
}

async function parsePdfWithOpenRouter(filePath: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY nicht gesetzt");
  }

  const pdfBuffer = fs.readFileSync(filePath);
  const base64Pdf = pdfBuffer.toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

  const payload = {
    model: "google/gemini-3.1-flash-lite",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extrahiere den gesamten Text aus diesem PDF-Dokument. Gib NUR den extrahierten Text zurück, ohne zusätzliche Kommentare oder Zusammenfassungen. Behalte die ursprüngliche Struktur und Formatierung bei.",
          },
          {
            type: "file",
            file: {
              filename: "document.pdf",
              file_data: dataUrl,
            },
          },
        ],
      },
    ],
    plugins: [
      {
        id: "file-parser",
        pdf: {
          engine: "cloudflare-ai",
        },
      },
    ],
    stream: false,
  };

  const response = await fetchWithTimeout(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter PDF-Parsing fehlgeschlagen (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }

  throw new Error("OpenRouter PDF-Parsing: Keine Textextraktion erhalten");
}

async function parsePdfWithMistralOCR(filePath: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY nicht gesetzt");
  }

  const pdfBuffer = fs.readFileSync(filePath);
  const base64Pdf = pdfBuffer.toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

  const payload = {
    model: "google/gemini-3.1-flash-lite",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extrahiere den gesamten Text aus diesem PDF-Dokument. Gib NUR den extrahierten Text zurück, ohne zusätzliche Kommentare oder Zusammenfassungen. Behalte die ursprüngliche Struktur und Formatierung bei.",
          },
          {
            type: "file",
            file: {
              filename: "document.pdf",
              file_data: dataUrl,
            },
          },
        ],
      },
    ],
    plugins: [
      {
        id: "file-parser",
        pdf: {
          engine: "mistral-ocr",
        },
      },
    ],
    stream: false,
  };

  const response = await fetchWithTimeout(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter Mistral-OCR fehlgeschlagen (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }

  throw new Error("OpenRouter Mistral-OCR: Keine Textextraktion erhalten");
}

function detectHtmlEncoding(raw: Buffer): string {
  // Look for charset in first 2048 bytes (meta tag or XML declaration)
  const head = raw.subarray(0, 2048).toString("ascii");
  // <meta http-equiv="Content-Type" content="text/html; charset=iso-8859-15" />
  const metaMatch = head.match(/charset[=:\s]+([a-zA-Z0-9_-]+)/i);
  if (metaMatch) {
    const charset = metaMatch[1].toLowerCase().trim();
    // Map common aliases
    if (charset === "iso-8859-1" || charset === "latin1") return "iso-8859-1";
    if (charset === "iso-8859-15" || charset === "latin9") return "iso-8859-15";
    if (charset === "windows-1252" || charset === "cp1252") return "windows-1252";
    if (charset === "utf-8" || charset === "utf8") return "utf-8";
    return charset;
  }
  return "utf-8";
}

const DOCX_TEXT_ENTRIES = /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i;
const DOCX_XML_TOKEN = /<(?:(?:[A-Za-z_][\w.-]*):)?(p|br|tab)(?:\s[^>]*)?\/?>|<(?:(?:[A-Za-z_][\w.-]*):)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:(?:[A-Za-z_][\w.-]*):)?t\s*>/gi;

const boundedText = (text: string): { text: string; truncated: boolean } => {
  const normalized = text.replace(/\x00/g, "").trim();
  return normalized.length > MAX_DOCUMENT_TEXT_CHARS
    ? { text: normalized.slice(0, MAX_DOCUMENT_TEXT_CHARS), truncated: true }
    : { text: normalized, truncated: false };
};

const decodeXmlEntities = (value: string): string => value
  .replace(/&#x([0-9a-f]+);/gi, (match: string, hex: string) => {
    const codePoint = Number.parseInt(hex, 16);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ? String.fromCodePoint(codePoint)
      : match;
  })
  .replace(/&#(\d+);/g, (match: string, decimal: string) => {
    const codePoint = Number.parseInt(decimal, 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ? String.fromCodePoint(codePoint)
      : match;
  })
  .replace(/&quot;/gi, '"')
  .replace(/&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&amp;/gi, "&");

/** Extract only text-bearing DOCX tags; XML is never executed or resolved. */
const extractDocxXmlText = (xml: string): string => {
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  DOCX_XML_TOKEN.lastIndex = 0;
  while ((match = DOCX_XML_TOKEN.exec(xml)) !== null) {
    if (match[1] === "p" || match[1] === "br") parts.push("\n");
    else if (match[1] === "tab") parts.push("\t");
    else if (match[2]) parts.push(decodeXmlEntities(match[2]));
  }
  return parts.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

function parseDocxToText(filePath: string): { text: string; truncated: boolean } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  type DocxZipEntry = {
    isDirectory?: boolean;
    entryName?: string;
    header?: { size?: number };
    getData: () => Buffer;
  };
  let entries: DocxZipEntry[];
  try {
    const zip: { getEntries: () => DocxZipEntry[] } = new AdmZip(filePath);
    entries = zip.getEntries();
  } catch (error) {
    console.warn("[parser] DOCX-Archiv konnte nicht geöffnet werden:", error);
    return { text: "", truncated: false };
  }

  const parts: string[] = [];
  let totalUncompressed = 0;
  let processed = 0;
  let truncated = false;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (processed >= MAX_ZIP_ENTRIES) {
      truncated = true;
      break;
    }
    processed += 1;

    const entryName = String(entry.entryName ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!DOCX_TEXT_ENTRIES.test(entryName)) continue;

    const declaredSize = Number(entry.header?.size ?? 0);
    if (declaredSize > MAX_ZIP_ENTRY_SIZE || declaredSize > MAX_ZIP_TOTAL_SIZE - totalUncompressed) {
      truncated = true;
      continue;
    }

    let data: Buffer;
    try {
      data = entry.getData();
    } catch (error) {
      console.warn(`[parser] DOCX-XML konnte nicht gelesen werden: ${entryName}`, error);
      continue;
    }
    if (data.length > MAX_ZIP_ENTRY_SIZE || data.length > MAX_ZIP_TOTAL_SIZE - totalUncompressed) {
      truncated = true;
      continue;
    }
    totalUncompressed += data.length;
    const text = extractDocxXmlText(data.toString("utf8"));
    if (text) parts.push(text);
  }

  const bounded = boundedText(parts.join("\n\n"));
  return { text: bounded.text, truncated: truncated || bounded.truncated };
}

function runOptionalTextCommand(command: string, args: readonly string[], filePath: string): string {
  try {
    const output = execFileSync(command, [...args, filePath], {
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: MAX_DOCUMENT_TEXT_CHARS * 4,
      windowsHide: true,
    });
    return typeof output === "string" ? output : "";
  } catch {
    return "";
  }
}

function parseDocToText(filePath: string): { text: string; truncated: boolean } {
  const commands = [
    ["antiword", ["-f", "text"]],
    ["strings", ["-n", "4"]],
  ] as const;

  for (const [command, args] of commands) {
    const output = runOptionalTextCommand(command, args, filePath);
    if (!output.trim()) continue;
    return boundedText(output);
  }

  return { text: "", truncated: false };
}

export const extractTextFromFile = async (filePath: string, contentType?: string | null): Promise<ExtractedDocument> => {
  const loweredType = (contentType ?? "").toLowerCase();
  const loweredPath = filePath.toLowerCase();

  if (loweredPath.endsWith(".pdf") || loweredType.includes("pdf")) {
    let nativePageCount: number | null = null;
    let nativeText = "";
    const nativePages: string[] = [];

    // 1. Versuch: pdf-parse (kostenlos, schnell, für textbasierte PDFs)
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const payload = fs.readFileSync(filePath);
       const parsed = await pdfParse(payload, {
         max: MAX_NATIVE_PAGES,
         pagerender: async (pageData: { getTextContent: () => Promise<{ items?: Array<{ str?: unknown }> }> }) => {
           const content = await pageData.getTextContent();
           const pageText = (content.items ?? [])
             .map((item) => typeof item.str === "string" ? item.str : "")
             .join(" ")
             .replace(/\s+/g, " ")
             .trim();
           nativePages.push(pageText);
           return pageText;
         },
       });
      nativePageCount = typeof parsed.numpages === "number" ? parsed.numpages : null;
      nativeText = parsed.text.trim();
      if (nativeText.length >= MIN_NATIVE_TEXT_CHARS) {
        return {
          text: nativeText,
          pages: nativePages,
          pageCount: nativePageCount,
          method: "native",
          truncated: nativePageCount !== null && nativePageCount > MAX_NATIVE_PAGES,
        };
      }
      console.log(`[parser] pdf-parse: nur ${nativeText.length} Zeichen bei ${nativePageCount ?? "?"} Seiten, versuche OCR...`);
    } catch (pdfErr) {
      console.warn("[parser] pdf-parse fehlgeschlagen:", pdfErr);
    }

    // 2. Versuch: OCR — aber nur wenn die Datei nicht zu groß ist (base64-Upload-Limit)
    const fileSize = safeFileSize(filePath);
    if (OPENROUTER_API_KEY && fileSize !== null && fileSize <= MAX_OCR_FILE_SIZE) {
      try {
        console.log(`[parser] Parsing PDF mit OpenRouter cloudflare-ai (${(fileSize / 1024 / 1024).toFixed(1)} MB):`, filePath);
        const ocrText = await parsePdfWithOpenRouter(filePath);
        return {
          text: ocrText,
          pages: nativePages,
          pageCount: nativePageCount,
          method: "ocr",
          truncated: nativePageCount !== null && nativePageCount > MAX_NATIVE_PAGES,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[parser] cloudflare-ai fehlgeschlagen, versuche mistral-ocr:", message);
        try {
          const ocrText = await parsePdfWithMistralOCR(filePath);
          return {
            text: ocrText,
            pages: nativePages,
            pageCount: nativePageCount,
            method: "ocr",
            truncated: nativePageCount !== null && nativePageCount > MAX_NATIVE_PAGES,
          };
        } catch (ocrError) {
          console.warn("[parser] mistral-ocr fehlgeschlagen:", ocrError);
        }
      }
    } else if (fileSize !== null && fileSize > MAX_OCR_FILE_SIZE) {
      console.log(`[parser] OCR übersprungen: Datei zu groß (${(fileSize / 1024 / 1024).toFixed(1)} MB > ${MAX_OCR_FILE_SIZE / 1024 / 1024} MB)`);
    }

    // 3. Fallback: pdf-parse Ergebnis auch wenn wenig Text
    if (nativeText) {
      return {
        text: nativeText,
        pages: nativePages,
        pageCount: nativePageCount,
        method: fileSize !== null && fileSize > MAX_OCR_FILE_SIZE ? "ocr_skipped_size" : "fallback_native",
        truncated: nativePageCount !== null && nativePageCount > MAX_NATIVE_PAGES,
      };
    }

    // pdf-parse nie erfolgreich — versuche nochmal ohne max-Limit als letzten Strohhalm
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const payload = fs.readFileSync(filePath);
       const parsed = await pdfParse(payload);
       nativePageCount = typeof parsed.numpages === "number" ? parsed.numpages : null;
       return { text: parsed.text.trim(), pages: nativePages, pageCount: nativePageCount, method: "fallback_native", truncated: false };
     } catch {
       return { text: "", pages: nativePages, pageCount: nativePageCount, method: "fallback_native", truncated: false };
     }
  }

  if (loweredPath.endsWith(".xlsx") || loweredPath.endsWith(".xls") || loweredType.includes("spreadsheet") || loweredType.includes("excel")) {
    console.log("[parser] Parsing XLSX:", filePath);
     return { text: parseXlsxToText(filePath), pages: [], pageCount: null, method: "xlsx", truncated: false };
  }

  if (loweredPath.endsWith(".html") || loweredPath.endsWith(".htm") || loweredType.includes("html")) {
    const raw = fs.readFileSync(filePath);
    const encoding = detectHtmlEncoding(raw);
    const decoder = new TextDecoder(encoding);
    const html = decoder.decode(raw);
     return { text: htmlToBasicMarkdown(html), pages: [], pageCount: null, method: "html", truncated: false };
  }

  if (loweredPath.endsWith(".docx") || loweredType.includes("wordprocessingml.document")) {
    const parsed = parseDocxToText(filePath);
    return { text: parsed.text, pages: [], pageCount: null, method: "docx", truncated: parsed.truncated };
  }

  if (loweredPath.endsWith(".doc") || loweredType.includes("msword")) {
    const parsed = parseDocToText(filePath);
    return { text: parsed.text, pages: [], pageCount: null, method: "doc", truncated: parsed.truncated };
  }

  if (loweredPath.endsWith(".zip") || loweredType.includes("zip") || loweredType.includes("archive")) {
    console.log("[parser] Parsing ZIP:", filePath);
    const zipText = await parseZipToText(filePath);
     return { text: zipText, pages: [], pageCount: null, method: "zip", truncated: false };
  }

   return { text: fs.readFileSync(filePath, "utf8"), pages: [], pageCount: null, method: "plain", truncated: false };
};

function safeFileSize(filePath: string): number | null {
  try {
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch {
    return null;
  }
}

async function parseZipToText(filePath: string): Promise<string> {
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const parts: string[] = [];
  let totalUncompressed = 0;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zip-extract-"));

  try {
    let processed = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (processed >= MAX_ZIP_ENTRIES) {
        console.warn(`[parser] ZIP: Limit von ${MAX_ZIP_ENTRIES} Einträgen erreicht, überspringe Rest`);
        break;
      }
      const entryName = entry.entryName.toLowerCase();
      const ext = path.extname(entryName);
      const entrySize = entry.header.size;

      // Only process known document types
      if (![".pdf", ".xlsx", ".xls", ".html", ".htm", ".txt", ".csv", ".docx", ".doc"].includes(ext)) continue;
      // Skip entries that are too large individually
      if (entrySize > MAX_ZIP_ENTRY_SIZE) {
        console.warn(`[parser] ZIP-Entry zu groß übersprungen: ${entryName} (${(entrySize / 1024 / 1024).toFixed(1)} MB)`);
        continue;
      }
      totalUncompressed += entrySize;
      if (totalUncompressed > MAX_ZIP_TOTAL_SIZE) {
        console.warn(`[parser] ZIP: Gesamtlimit ${MAX_ZIP_TOTAL_SIZE / 1024 / 1024} MB überschritten, breche ab`);
        break;
      }

      const tmpFile = path.join(tmpDir, path.basename(entryName));
      fs.writeFileSync(tmpFile, entry.getData());

      try {
        const contentType = ext === ".pdf"
          ? "application/pdf"
          : ext === ".xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : ext === ".docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : ext === ".doc"
                ? "application/msword"
                : null;
        const result = await extractTextFromFile(tmpFile, contentType);
        if (result.text && result.text.trim().length > 10) {
          parts.push(`=== ${entry.entryName} ===\n${result.text}`);
        }
      } catch (parseError) {
        console.warn(`[parser] ZIP-Entry Parse fehlgeschlagen: ${entryName}`, parseError);
      }
      processed += 1;
    }
  } finally {
    // Cleanup temp directory
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  return boundedText(parts.join("\n\n")).text;
}
