import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as cheerio from "cheerio";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

const FETCH_TIMEOUT_MS = 300_000; // 5 Minuten Timeout für OpenRouter Aufrufe

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

export const extractTextFromFile = async (filePath: string, contentType?: string | null): Promise<string> => {
  const loweredType = (contentType ?? "").toLowerCase();
  const loweredPath = filePath.toLowerCase();

  if (loweredPath.endsWith(".pdf") || loweredType.includes("pdf")) {
    // 1. Versuch: pdf-parse (kostenlos, schnell, für textbasierte PDFs)
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const payload = fs.readFileSync(filePath);
      const parsed = await pdfParse(payload);
      const text = parsed.text.trim();
      if (text.length >= 200) {
        return text;
      }
      console.log(`[parser] pdf-parse: nur ${text.length} Zeichen, versuche OCR...`);
    } catch (pdfErr) {
      console.warn("[parser] pdf-parse fehlgeschlagen:", pdfErr);
    }

    // 2. Versuch: Gemini OCR (nur bei wenig extrahiertem Text = wahrscheinlich gescanntes PDF)
    if (OPENROUTER_API_KEY) {
      try {
        console.log("[parser] Parsing PDF mit OpenRouter cloudflare-ai:", filePath);
        return await parsePdfWithOpenRouter(filePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[parser] cloudflare-ai fehlgeschlagen, versuche mistral-ocr:", message);
        try {
          return await parsePdfWithMistralOCR(filePath);
        } catch (ocrError) {
          console.warn("[parser] mistral-ocr fehlgeschlagen:", ocrError);
        }
      }
    }

    // 3. Fallback: pdf-parse Ergebnis auch wenn wenig Text
    const pdfParse = (await import("pdf-parse")).default;
    const payload = fs.readFileSync(filePath);
    const parsed = await pdfParse(payload);
    return parsed.text.trim();
  }

  if (loweredPath.endsWith(".xlsx") || loweredPath.endsWith(".xls") || loweredType.includes("spreadsheet") || loweredType.includes("excel")) {
    console.log("[parser] Parsing XLSX:", filePath);
    return parseXlsxToText(filePath);
  }

  if (loweredPath.endsWith(".html") || loweredPath.endsWith(".htm") || loweredType.includes("html")) {
    const raw = fs.readFileSync(filePath);
    const encoding = detectHtmlEncoding(raw);
    const decoder = new TextDecoder(encoding);
    const html = decoder.decode(raw);
    const $ = cheerio.load(html);
    $("script,style,noscript").remove();
    return $.text().replace(/\s+/g, " ").trim();
  }

  if (loweredPath.endsWith(".zip") || loweredType.includes("zip") || loweredType.includes("archive")) {
    console.log("[parser] Parsing ZIP:", filePath);
    return await parseZipToText(filePath);
  }

  return fs.readFileSync(filePath, "utf8");
};

async function parseZipToText(filePath: string): Promise<string> {
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const parts: string[] = [];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zip-extract-"));

  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryName = entry.entryName.toLowerCase();
      const ext = path.extname(entryName);

      // Only process known document types
      if (![".pdf", ".xlsx", ".xls", ".html", ".htm", ".txt", ".csv"].includes(ext)) continue;

      const tmpFile = path.join(tmpDir, path.basename(entryName));
      fs.writeFileSync(tmpFile, entry.getData());

      try {
        const contentType = ext === ".pdf" ? "application/pdf" : ext === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : null;
        const text = await extractTextFromFile(tmpFile, contentType);
        if (text && text.trim().length > 10) {
          parts.push(`=== ${entry.entryName} ===\n${text}`);
        }
      } catch (parseError) {
        console.warn(`[parser] ZIP-Entry Parse fehlgeschlagen: ${entryName}`, parseError);
      }
    }
  } finally {
    // Cleanup temp directory
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  return parts.join("\n\n").trim().replace(/\x00/g, "");
}
