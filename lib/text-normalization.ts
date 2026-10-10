import * as cheerio from "cheerio";

const CHARSET_PATTERN = /charset\s*=\s*["']?([a-z0-9_-]+)/i;
const REPLACEMENT_CHARACTER = "\uFFFD";

const normalizeCharset = (value: string): string => {
  const charset = value.toLowerCase().trim();
  if (charset === "latin1" || charset === "iso8859-1") return "iso-8859-1";
  if (charset === "latin9" || charset === "iso8859-15") return "iso-8859-15";
  if (charset === "utf8") return "utf-8";
  if (charset === "cp1252") return "windows-1252";
  return charset;
};

const replacementCount = (value: string): number => value.split(REPLACEMENT_CHARACTER).length - 1;

/** Detect a page encoding from its header or a meta/XML declaration. */
export function detectTextEncoding(raw: Uint8Array, contentType?: string | null): string {
  const declared = typeof contentType === "string" ? contentType.match(CHARSET_PATTERN)?.[1] : null;
  if (declared) return normalizeCharset(declared);

  // Some older portals put the declaration after a long script block in <head>.
  const head = new TextDecoder("iso-8859-1").decode(raw.subarray(0, 8192));
  const metaCharset = head.match(CHARSET_PATTERN)?.[1];
  return metaCharset ? normalizeCharset(metaCharset) : "utf-8";
}

/** Decode HTML/XML bytes conservatively, recovering legacy single-byte pages. */
export function decodeTextBuffer(raw: Uint8Array, contentType?: string | null): string {
  const preferredEncoding = detectTextEncoding(raw, contentType);
  let preferred: string;
  try {
    preferred = new TextDecoder(preferredEncoding).decode(raw);
  } catch {
    preferred = new TextDecoder("utf-8").decode(raw);
  }
  if (replacementCount(preferred) === 0) return preferred;

  const alternatives = ["windows-1252", "iso-8859-1", "utf-8"];
  return alternatives.reduce((best, encoding) => {
    try {
      const candidate = new TextDecoder(encoding).decode(raw);
      return replacementCount(candidate) < replacementCount(best) ? candidate : best;
    } catch {
      return best;
    }
  }, preferred);
}

const KNOWN_GERMAN_REPAIRS: Array<[string, string]> = [
  ["�bersicht", "Übersicht"],
  ["Erkl�rung", "Erklärung"],
  ["Adresse im neuen Fenster �ffnen", "Adresse im neuen Fenster öffnen"],
  ["Bed�rfnisse", "Bedürfnisse"],
  ["Baugrundst�ck", "Baugrundstück"],
  ["pers�nlichen", "persönlichen"],
  ["st�dtischen", "städtischen"],
  ["F�rderschulen", "Förderschulen"],
  ["Tr�gerschaft", "Trägerschaft"],
  ["Fortf�hrung", "Fortführung"],
  ["Ma�nahme", "Maßnahme"],
];

/** Repair known replacement-character sequences from legacy portal encodings. */
export function repairKnownGermanEncoding(value: string): string {
  return KNOWN_GERMAN_REPAIRS.reduce((text, [broken, repaired]) => text.replaceAll(broken, repaired), value);
}

/** Decode HTML entities without treating literal angle brackets as markup. */
export function decodeHtmlEntities(text: string): string {
  let decoded = text;

  for (let pass = 0; pass < 3; pass += 1) {
    const escaped = decoded.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const next = cheerio.load(`<span>${escaped}</span>`, null, false)("span").text();
    if (next === decoded) return decoded;
    decoded = next;
  }

  return decoded;
}
