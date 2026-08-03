import OpenAI from "openai";
import { callLLM } from "@/lib/llm";
import type { DocumentAnalysis } from "@/lib/document-analysis";

const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY ist nicht gesetzt.");
    openaiClient = new OpenAI({ apiKey: openrouterKey, baseURL: "https://openrouter.ai/api/v1" });
  }
  return openaiClient;
}

const DATE_PATTERN = /\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/;
const BUDGET_PATTERN =
  /(?:budget|auftragswert|gesamtwert|wert|auftragsvolumen|netto)\s*[:\-]?\s*([0-9][0-9\.,\s]{2,20}(?:euro|eur|€))/i;
const CPV_PATTERN = /\b(\d{8}(?:-\d)?)\b/g;
const DURATION_PATTERN = /(?:laufzeit|vertragslaufzeit|dauer|zeitraum)\s*[:\-]?\s*(\d+)\s*(?:monat|jahr|tag)/i;

const compactSpaces = (value: string): string => value.split(/\s+/).join(" ").trim();

const normalizeUmlauts = (value: string): string =>
  value.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue");

// Detect "glued words" — text where HTML→text conversion lost whitespace between
// block elements (Cheerio's .text() concatenates child text nodes without separators).
// Symptoms: lowercase→uppercase transitions inside a phrase ("HüpstedtVergabeart") and/or
// multiple known label keywords packed into one value.
const MANGLED_KEYWORDS = [
  "auftraggeber", "vergabestelle", "beschaffer", "frist", "deadline",
  "ort der ausf", "ort der leistung", "ausfuehrungsort", "erfuellungsort",
  "vergabeart", "auftragswert", "auftragsgegenstand", "leistungsbeschreibung",
];

export const looksMangled = (text: string): boolean => {
  if (!text || text.trim().length === 0) return true;
  // Count lowercase→Uppercase transitions inside the text.
  // Proper nouns allow up to 1; 2+ almost always means glued elements.
  const glueMatches = text.match(/[a-zäöüß][A-ZÄÖÜ]/g);
  if (glueMatches && glueMatches.length >= 2) return true;
  // Multiple distinct label keywords in a single value is a strong mangle signal.
  const lower = normalizeUmlauts(text.toLowerCase());
  const keywordHits = MANGLED_KEYWORDS.filter(kw => lower.includes(kw)).length;
  if (keywordHits >= 2) return true;
  // Excessive length for a label value (buyer / location are short phrases).
  if (text.length > 300) return true;
  return false;
};

const firstMatchingLine = (lines: string[], keywords: string[]): string | null => {
  for (let i = 0; i < lines.length; i++) {
    const lower = normalizeUmlauts(lines[i].toLowerCase());
    if (!keywords.some((keyword) => lower.includes(keyword))) continue;

    // Try the next 1-3 lines (label-on-own-line format like "e) Ort der Ausführung")
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const nextLine = lines[j].trim();
      if (nextLine.length === 0) continue;
      // Skip section headers like "g)", "h)" etc.
      if (/^[a-z]\)\s*[A-ZÄÖÜ]/.test(nextLine)) break;
      // Skip lines that look like more label text (contain keywords for other fields)
      const nextLower = normalizeUmlauts(nextLine.toLowerCase());
      if (["auftraggeber", "vergabestelle", "beschaffer", "frist", "deadline"].some(kw => nextLower.includes(kw))) break;
      // Clean up common prefixes from the next line
      const cleaned = nextLine.replace(/^(Name|Stra[ßs]e|Plz,?\s*Ort|Telefon|Fax|E-Mail|Internet|Bezeichnung|Haupterf[üu]llungsort|Auftragsgegenstand)\s*/i, "").trim();
      const candidate = cleaned.length > 2 ? cleaned : nextLine;
      // Reject obviously mangled candidates (whitespace lost between HTML elements)
      if (looksMangled(candidate)) break;
      return candidate.slice(0, 400);
    }

    // Try extracting value from the same line (label: value format)
    const sameLineValue = extractValueFromLine(lines[i], keywords);
    if (sameLineValue && !looksMangled(sameLineValue)) {
      return sameLineValue.slice(0, 400);
    }

    // IMPORTANT: do NOT fall back to returning the raw label line.
    // Previously this returned `lines[i].slice(0, 400)`, which — on single-line/mangled
    // input — propagated the entire caption (labels glued to values) into buyer/location.
    // Continue searching the remaining lines instead.
  }
  return null;
};

const extractValueFromLine = (line: string, keywords: string[]): string | null => {
  // Remove the keyword prefix and common label patterns
  let cleaned = line.trim();
  // Remove patterns like "a)", "b)", "1.", "•" at the start
  cleaned = cleaned.replace(/^[a-z]\)\s*/, "").replace(/^\d+\.\s*/, "").replace(/^[•\-]\s*/, "");
  // Find and extract value after the keyword — only if keyword is near the start
  for (const keyword of keywords) {
    const idx = normalizeUmlauts(cleaned.toLowerCase()).indexOf(keyword);
    if (idx >= 0 && idx <= 5) {
      const afterKeyword = cleaned.slice(idx + keyword.length).trim();
      // Remove common separators after keyword
      const value = afterKeyword.replace(/^[:\s,\-]+/, "").trim();
      // Remove common label suffixes
      const finalValue = value.replace(/\(Vergabestelle\)/gi, "").replace(/\(Auftraggeber\)/gi, "").replace(/^Bezeichnung\s*/i, "").trim();
      if (finalValue.length > 2) return finalValue;
    }
  }
  return null;
};

const matchingLines = (lines: string[], keywords: string[], limit = 8): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const lower = normalizeUmlauts(line.toLowerCase());
    if (!keywords.some((keyword) => lower.includes(keyword))) {
      continue;
    }

    const compact = compactSpaces(line);
    if (seen.has(compact)) {
      continue;
    }

    seen.add(compact);
    result.push(compact.slice(0, 500));
    if (result.length >= limit) {
      break;
    }
  }

  return result;
};

const matchingLinesWithContext = (lines: string[], keywords: string[], contextLines = 10, maxTotalChars = 3000): string[] => {
  const result: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < lines.length; i++) {
    const lower = normalizeUmlauts(lines[i].toLowerCase());
    if (!keywords.some((keyword) => lower.includes(keyword))) {
      continue;
    }

    // Collect the content lines after the keyword line
    const contentLines: string[] = [];
    for (let j = i + 1; j < Math.min(i + 1 + contextLines, lines.length); j++) {
      const nextLine = lines[j].trim();
      if (nextLine.length === 0) continue;
      // Stop if we hit another section header (single letter + closing paren like "g)" or "h)")
      if (/^[a-z]\)\s*[A-ZÄÖÜ]/.test(nextLine)) break;
      contentLines.push(nextLine);
    }

    if (contentLines.length > 0) {
      const joined = contentLines.join(" ").slice(0, 2000);
      totalChars += joined.length;
      if (totalChars > maxTotalChars) break;
      result.push(joined);
    }
  }

  return result;
};

const extractDeadline = (lines: string[]): string | null => {
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!["frist", "deadline", "abgabefrist", "angebotsfrist", "teilnahmefrist", "einreichungsfrist"].some((keyword) => lower.includes(keyword))) {
      continue;
    }

    const match = line.match(DATE_PATTERN);
    if (match) {
      return match[1] ?? null;
    }
  }
  return null;
};

const extractBudget = (text: string): string | null => {
  const match = text.match(BUDGET_PATTERN);
  if (!match?.[1]) {
    return null;
  }
  return compactSpaces(match[1]);
};

const detectContractType = (text: string): string | null => {
  const lower = text.toLowerCase();
  if (lower.includes("bauleistung") || lower.includes("vob")) {
    return "bau";
  }
  if (lower.includes("liefer")) {
    return "lieferung";
  }
  if (lower.includes("dienstleistung") || lower.includes("vol")) {
    return "dienstleistung";
  }
  return null;
};

const extractCpvCodes = (text: string): string[] => {
  const matches = text.match(CPV_PATTERN);
  if (!matches) return [];
  return [...new Set(matches)];
};

const extractDuration = (text: string): { months: number | null; renewal: boolean } => {
  const match = text.match(DURATION_PATTERN);
  let months: number | null = null;
  
  if (match) {
    const value = parseInt(match[1], 10);
    if (text.toLowerCase().includes("jahr")) {
      months = value * 12;
    } else if (text.toLowerCase().includes("tag")) {
      months = Math.ceil(value / 30);
    } else {
      months = value;
    }
  }
  
  const renewal = /verlängerung|verlängerbar|option|optionszeitraum/i.test(text);
  
  return { months, renewal };
};

const detectProcedureType = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes("offenes verfahren") || lower.includes("öffentlich")) return "offen";
  if (lower.includes("beschränktes verfahren") || lower.includes("beschränkt")) return "beschränkt";
  if (lower.includes("verhandlungsverfahren") || lower.includes("verhandelt")) return "verhandelt";
  if (lower.includes("wettbewerblicher dialog")) return "dialog";
  if (lower.includes("innovationspartnerschaft")) return "innovation";
  return "offen";
};

const extractContractValue = (text: string): { min: number | null; max: number | null; currency: string } => {
  const valuePatterns = [
    /(?:geschätzter|geschätzte|netto|brutto)\s*(?:auftragswert|auftragsvolumen|gesamtwert|wert)\s*[:\-]?\s*(?:ca\.?\s*)?(\d[\d\.,\s]*)\s*(?:euro|eur|€)/i,
    /(?:auftragswert|auftragsvolumen|gesamtwert|wert)\s*[:\-]?\s*(?:ca\.?\s*)?(\d[\d\.,\s]*)\s*(?:euro|eur|€)/i,
    /(\d[\d\.,\s]*)\s*(?:euro|eur|€)\s*(?:netto|brutto|gesamt)/i,
  ];
  
  for (const pattern of valuePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
      const value = parseFloat(cleaned);
      if (!isNaN(value) && value > 0) {
        return { min: null, max: value, currency: "EUR" };
      }
    }
  }
  
  // Range pattern: "zwischen X und Y EUR"
  const rangeMatch = text.match(/zwischen\s+(\d[\d\.,\s]*)\s*(?:euro|eur|€)\s*und\s+(\d[\d\.,\s]*)\s*(?:euro|eur|€)/i);
  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    const min = parseFloat(rangeMatch[1].replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    const max = parseFloat(rangeMatch[2].replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    if (!isNaN(min) && !isNaN(max)) {
      return { min, max, currency: "EUR" };
    }
  }
  
  return { min: null, max: null, currency: "EUR" };
};

export interface AwardCriterion {
  criterion: string;
  weight: number | null;
}

export interface StructuredData {
  title: string;
  hard_facts: {
    deadline: string | null;
    budget: string | null;
    location: string | null;
    buyer: string | null;
    contract_type: string | null;
  };
  decision_relevant: {
    requirements: string[];
    scope: string[];
    award_criteria: string[];
    mandatory_documents: string[];
  };
  procurement: {
    contract_value: { min: number | null; max: number | null; currency: string };
    contract_duration: { months: number | null; renewal: boolean };
    award_criteria_detailed: AwardCriterion[];
    participation_requirements: string[];
    cpv_codes: string[];
    procedure_type: string;
  };
  summary: string;
  confidence: number;
  document_analysis?: DocumentAnalysis;
}

const PORTAL_TEXT_MARKERS = [
  "vergabeplattform",
  "bekanntmachung",
  "postanschrift",
  "impressum",
  "datenschutzerklarung",
  "zur seite drucken",
  "internetadresse",
];

export const sanitizeTenderText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > 1_600) return "";

  const lower = text.toLowerCase();
  const markerCount = PORTAL_TEXT_MARKERS.filter((marker) => lower.includes(marker)).length;
  return markerCount >= 2 ? "" : text;
};

export function normalizeStructured(raw: unknown, fallbackTitle: string): StructuredData {
  const obj = raw as Record<string, unknown>;
  if (obj && typeof obj === "object" && obj.decision_relevant) {
    const structured = raw as unknown as StructuredData;
    return {
      ...structured,
      summary: sanitizeTenderText(structured.summary) || fallbackTitle,
      decision_relevant: {
        ...structured.decision_relevant,
        scope: (structured.decision_relevant.scope ?? []).map(sanitizeTenderText).filter(Boolean),
        requirements: (structured.decision_relevant.requirements ?? []).map(sanitizeTenderText).filter(Boolean),
        mandatory_documents: (structured.decision_relevant.mandatory_documents ?? []).map(sanitizeTenderText).filter(Boolean),
      },
    };
  }
  const flat = obj as Record<string, unknown>;
  const scopeStr = sanitizeTenderText(flat.scope);
  const descStr = sanitizeTenderText(flat.description);
  const reqArr = Array.isArray(flat.requirements) ? (flat.requirements as string[]).map(sanitizeTenderText).filter(Boolean) : [];
  const awardArr = Array.isArray(flat.awardCriteria) ? (flat.awardCriteria as string[]) : [];
  const titleStr = typeof flat.title === "string" ? flat.title : fallbackTitle;

  return {
    title: titleStr,
    summary: descStr || scopeStr || titleStr,
    confidence: 0.5,
    hard_facts: {
      location: typeof flat.location === "string" ? flat.location : null,
      deadline: (flat.deadline as string | null) ?? null,
      budget: (flat.estimatedValue as string | null) ?? null,
      buyer: typeof flat.client === "string" ? flat.client : null,
      contract_type: typeof flat.procedure === "string" ? flat.procedure : null,
    },
    decision_relevant: {
      scope: [...scopeStr.split(/\s+/).filter((w) => w.length > 3), ...titleStr.split(/\s+/).filter((w) => w.length > 3)],
      requirements: reqArr,
      mandatory_documents: [],
      award_criteria: awardArr,
    },
    procurement: {
      contract_value: { min: null, max: null, currency: "EUR" },
      contract_duration: { months: null, renewal: false },
      award_criteria_detailed: [],
      participation_requirements: [],
      cpv_codes: [],
      procedure_type: typeof flat.procedure === "string" ? flat.procedure : "offen",
    },
  };
}

interface LLMExtractionResult {
  contract_value: { min: number | null; max: number | null; currency: string };
  contract_duration_months: number | null;
  contract_duration_renewal: boolean;
  award_criteria: AwardCriterion[];
  participation_requirements: string[];
  cpv_codes: string[];
  procedure_type: string;
}

const LLM_STRUCTURE_PROMPT = `Du bist ein Experte für öffentliche Ausschreibungen in Deutschland.
Analysiere den folgenden Text einer Ausschreibung und extrahiere die Vergabedaten.

Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Text davor/danach):

{
  "contract_value": { "min": null, "max": null, "currency": "EUR" },
  "contract_duration_months": null,
  "contract_duration_renewal": false,
  "award_criteria": [],
  "participation_requirements": [],
  "cpv_codes": [],
  "procedure_type": "offen"
}

Regeln:
- contract_value: Geschätzter Auftragswert in EUR. min/max wenn Range, sonst max = geschätzter Wert, min = null
- contract_duration_months: Vertragslaufzeit in Monaten (null wenn nicht angegeben)
- contract_duration_renewal: true wenn Verlängerungsoption existiert
- award_criteria: Array von { "criterion": "Name", "weight": 40 } (Gewichtung in %, null wenn nicht angegeben)
- participation_requirements: Teilnahmevoraussetzungen (Eignungsnachweise, Referenzen, etc.)
- cpv_codes: CPV-Codes (8-stellig, z.B. "90910000")
- procedure_type: "offen", "beschränkt", "verhandelt", "dialog", "innovation"

Der Text kann mit [ROLLE: ...] markierte Abschnitte enthalten, die den Dokumenttyp kennzeichnen:
- [ROLLE: leistungsbeschreibung] → Leistungsumfang, Art und Umfang der Leistung
- [ROLLE: bekanntmachung] → Fristen, Auftraggeber, Vergabeart
- [ROLLE: leistungsverzeichnis] → Positionen, Mengen, Einheiten
- [ROLLE: eignung] → Eignungsnachweise, Teilnahmevoraussetzungen
- [ROLLE: zuschlagskriterien] → Zuschlagskriterien, Gewichtung
Nutze diese Markierungen, um die richtigen Abschnitte für jede Information zu finden.

Wenn etwas nicht im Text steht, verwende null bzw. leeres Array.`;

async function extractWithLLM(title: string, rawText: string): Promise<LLMExtractionResult | null> {
  try {
    const openai = getOpenAI();
    const textForLLM = rawText.slice(0, 8000); // Limit for context
    
    const content = await callLLM(openai, {
      messages: [
        { role: "system", content: LLM_STRUCTURE_PROMPT },
        { role: "user", content: `Titel: ${title}\n\nText:\n${textForLLM}` },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });
    if (!content) return null;

    const parsed = JSON.parse(content);
    
    // Validate and sanitize
    return {
      contract_value: {
        min: typeof parsed.contract_value?.min === "number" ? parsed.contract_value.min : null,
        max: typeof parsed.contract_value?.max === "number" ? parsed.contract_value.max : null,
        currency: parsed.contract_value?.currency || "EUR",
      },
      contract_duration_months: typeof parsed.contract_duration_months === "number" ? parsed.contract_duration_months : null,
      contract_duration_renewal: Boolean(parsed.contract_duration_renewal),
      award_criteria: Array.isArray(parsed.award_criteria) 
        ? parsed.award_criteria.map((c: { criterion?: string; weight?: number }) => ({
            criterion: String(c.criterion || ""),
            weight: typeof c.weight === "number" ? c.weight : null,
          })).filter((c: AwardCriterion) => c.criterion.length > 0)
        : [],
      participation_requirements: Array.isArray(parsed.participation_requirements)
        ? parsed.participation_requirements.map(String).filter(Boolean)
        : [],
      cpv_codes: Array.isArray(parsed.cpv_codes)
        ? parsed.cpv_codes.map(String).filter(Boolean)
        : [],
      procedure_type: ["offen", "beschränkt", "verhandelt", "dialog", "innovation"].includes(parsed.procedure_type)
        ? parsed.procedure_type
        : "offen",
    };
  } catch (error) {
    console.error("[structurer] LLM-Extraktion fehlgeschlagen:", error);
    return null;
  }
}

// Build a clean, human-readable summary from the structured text.
// Avoids the previous bug where `rawText.slice(0, 3000)` dumped mangled
// single-line captions (labels glued to values) into the summary field.
// Picks up to 8 well-formed lines (>=40 chars, not mangled) up to 1500 chars total.
const buildSummary = (lines: string[], rawText: string): string => {
  const picked: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (line.length < 40) continue;
    if (looksMangled(line)) continue;
    picked.push(line);
    total += line.length + 1;
    if (picked.length >= 8 || total >= 1500) break;
  }
  if (picked.length === 0) {
    // Last resort: keep the old behaviour but only if the input does not look mangled.
    const head = rawText.slice(0, 600).trim();
    return looksMangled(head) ? "" : head;
  }
  return picked.join("\n").slice(0, 1_500);
};

export const extractStructuredData = async (
  title: string,
  rawText: string,
  options: { useLLM?: boolean } = {},
): Promise<StructuredData> => {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const deadline = extractDeadline(lines);
  const budget = extractBudget(rawText);
  const location = firstMatchingLine(lines, ["ort der ausf", "ort der leistung", "ausfuehrungsort", "ausfuhrungsort", "erfuellungsort", "erfuellungsort"]);
  const buyer = firstMatchingLine(lines, ["auftraggeber", "vergabestelle", "beschaffer"]);
  const contractType = detectContractType(rawText);

  const requirements = matchingLines(lines, ["eignung", "mindestanforderung", "fachkunde", "leistungsfaehigkeit"]);
  const scope = matchingLinesWithContext(lines, ["art und umfang der leistung", "leistungsbeschreibung", "leistungsumfang", "gegenstand der ausschreibung", "art und umfang", "umfang der leistung", "beschreibung der leistung", "auftragsgegenstand"])
    .map(sanitizeTenderText)
    .filter(Boolean);
  const awardCriteria = matchingLines(lines, ["zuschlagskriter", "bewertung", "gewichtung"]);
  const mandatoryDocuments = matchingLines(lines, ["nachweis", "zertifikat", "referenz", "pflichtunterlage", "muss"]);

  // Regex-based procurement data
  const contractValueRegex = extractContractValue(rawText);
  const contractDurationRegex = extractDuration(rawText);
  const cpvCodesRegex = extractCpvCodes(rawText);
  const procedureTypeRegex = detectProcedureType(rawText);

  // LLM-based extraction for enhanced data
  const llmResult = options.useLLM === false ? null : await extractWithLLM(title, rawText);

  // Merge regex and LLM results without allowing a valid-but-empty model
  // response to erase deterministic signals.
  const llmContractValue = llmResult?.contract_value;
  const contractValue = llmContractValue &&
    (typeof llmContractValue.min === "number" || typeof llmContractValue.max === "number")
    ? llmContractValue
    : contractValueRegex;
  const llmAwardCriteria = llmResult?.award_criteria?.length ? llmResult.award_criteria : [];
  const llmParticipationRequirements = llmResult?.participation_requirements?.length
    ? llmResult.participation_requirements
    : requirements;
  const procedureType = llmResult?.procedure_type &&
    (llmResult.procedure_type !== "offen" || procedureTypeRegex === "offen")
    ? llmResult.procedure_type
    : procedureTypeRegex;
  const procurement = {
    contract_value: contractValue,
    contract_duration: {
      months: typeof llmResult?.contract_duration_months === "number" && llmResult.contract_duration_months > 0
        ? llmResult.contract_duration_months
        : contractDurationRegex.months,
      renewal: Boolean(llmResult?.contract_duration_renewal) || contractDurationRegex.renewal,
    },
    award_criteria_detailed: llmAwardCriteria,
    participation_requirements: llmParticipationRequirements,
    cpv_codes: llmResult?.cpv_codes?.length ? llmResult.cpv_codes : cpvCodesRegex,
    procedure_type: procedureType,
  };

  const coveragePoints = [deadline, budget, location, buyer, contractType, requirements, awardCriteria];
  const hasValue = (item: unknown): boolean => {
    if (Array.isArray(item)) return item.length > 0;
    return typeof item === "string" ? item.trim().length > 0 : Boolean(item);
  };
  const present = coveragePoints.reduce((sum, item) => (hasValue(item) ? sum + 1 : sum), 0);
  const confidence = Math.min(1, Number((present / 7).toFixed(2)));

  return {
    title,
    hard_facts: {
      deadline,
      budget,
      location,
      buyer,
      contract_type: contractType,
    },
    decision_relevant: {
      requirements,
      scope,
      award_criteria: awardCriteria,
      mandatory_documents: mandatoryDocuments,
    },
    procurement,
    summary: sanitizeTenderText(buildSummary(lines, rawText)) || title,
    confidence,
  };
};
