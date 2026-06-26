import fs from "node:fs";
import * as cheerio from "cheerio";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

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

  const response = await fetch(OPENROUTER_BASE, {
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

  const response = await fetch(OPENROUTER_BASE, {
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

export const extractTextFromFile = async (filePath: string, contentType?: string | null): Promise<string> => {
  const loweredType = (contentType ?? "").toLowerCase();
  const loweredPath = filePath.toLowerCase();

  if (loweredPath.endsWith(".pdf") || loweredType.includes("pdf")) {
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
          const ocrMessage = ocrError instanceof Error ? ocrError.message : String(ocrError);
          console.warn("[parser] mistral-ocr fehlgeschlagen, fallback auf pdf-parse:", ocrMessage);
        }
      }
    }

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
    const html = fs.readFileSync(filePath, "utf8");
    const $ = cheerio.load(html);
    $("script,style,noscript").remove();
    return $.text().replace(/\s+/g, " ").trim();
  }

  return fs.readFileSync(filePath, "utf8");
};
