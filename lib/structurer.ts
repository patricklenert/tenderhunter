import OpenAI from "openai";
import { callLLM } from "@/lib/llm";
import type { DocumentAnalysis } from "@/lib/document-analysis";
import { buildTenderDescriptionMarkdown } from "@/lib/tender-description";
import { decodeHtmlEntities } from "@/lib/text-normalization";
import {
  isPublicNavigationSummary,
  isPublicDocumentArtifact,
  normalizePublicClient,
  normalizePublicDisplayCandidate,
  normalizePublicTextList,
  pickValidatedPublicCandidate,
  pickValidatedPublicProcedure,
  pickValidatedPublicLocation,
  pickValidatedPublicLocationForTender,
  isSourceBackedPublicValue,
} from "@/lib/public-content-quality";
import {
  createCommercialBriefFallback,
  validateCommercialBrief,
  type CommercialBrief,
  type CommercialBriefFacts,
} from "@/lib/commercial-brief";
import { classifyOpportunityStatus } from "@/lib/opportunity-status";

const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY ist nicht gesetzt.");
    openaiClient = new OpenAI({ apiKey: openrouterKey, baseURL: "https://openrouter.ai/api/v1", timeout: 120_000, maxRetries: 0 });
  }
  return openaiClient;
}

const DATE_PATTERN = /\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/;
const BUDGET_PATTERN =
  /(?:budget|auftragswert|gesamtwert|wert|auftragsvolumen|netto)\s*[:\-]?\s*([0-9][0-9\.,\s]{2,20}(?:euro|eur|€))/i;
const CPV_PATTERN = /\b(\d{8}(?:-\d)?)\b/g;
const DURATION_PATTERN = /(?:laufzeit|vertragslaufzeit|dauer|zeitraum)\s*[:\-]?\s*(\d+)\s*(?:monat|jahr|tag)/i;

const compactSpaces = (value: string): string => value.split(/\s+/).join(" ").trim();

const uniqueTextValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = compactSpaces(value).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const recordValue = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const normalizedTextList = (value: unknown): string[] => uniqueTextValues(normalizePublicTextList(value));

const hasStructuredValue = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
};

const firstStructuredValue = (record: Record<string, unknown>, keys: string[]): unknown => {
  let fallback: unknown;
  for (const key of keys) {
    const value = record[key];
    if (fallback === undefined) fallback = value;
    if (hasStructuredValue(value)) return value;
  }
  return fallback;
};

const structuredAliasValues = (records: unknown[], keys: string[]): unknown[] => records.flatMap((recordValueInput) => {
  const record = recordValue(recordValueInput);
  return keys.map((key) => record[key]);
});

/**
 * Select aliases only after normalizing each value. A non-empty but unusable
 * first alias (for example portal boilerplate) must not hide a valid later
 * alias from the same payload.
 */
const firstValidStructuredValue = <T>(
  records: unknown[],
  keys: string[],
  normalize: (value: unknown) => T,
): T | undefined => {
  for (const candidate of structuredAliasValues(records, keys)) {
    const normalized = normalize(candidate);
    if (hasStructuredValue(normalized)) return normalized;
  }
  return undefined;
};

const firstValidTextList = (records: unknown[], keys: string[]): string[] =>
  firstValidStructuredValue(records, keys, (value) => {
    const normalized = normalizedTextList(value);
    return normalized.length > 0 ? normalized : null;
  }) ?? [];

const mergeStructuredRecords = (...values: unknown[]): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  for (const value of values) {
    const record = recordValue(value);
    for (const [key, candidate] of Object.entries(record)) {
      const current = merged[key];
      const currentRecord = recordValue(current);
      const candidateRecord = recordValue(candidate);
      if (Object.keys(currentRecord).length > 0 && Object.keys(candidateRecord).length > 0) {
        merged[key] = mergeStructuredRecords(current, candidate);
      } else if (!(key in merged) || !hasStructuredValue(current)) {
        merged[key] = candidate;
      }
    }
  }
  return merged;
};

const normalizedAwardCriteria = (value: unknown): AwardCriterion[] => {
  const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  return values.map((criterion) => {
    if (typeof criterion === "string") return { criterion: sanitizeTenderText(criterion), weight: null };
    const item = recordValue(criterion);
    return {
      criterion: sanitizeTenderText(item.criterion ?? item.name ?? item.title),
      weight: typeof item.weight === "number" && Number.isFinite(item.weight) ? item.weight : null,
    };
  }).filter((criterion) => Boolean(criterion.criterion));
};

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

const isLabelLine = (line: string, keyword: string): boolean => {
  const normalized = normalizeUmlauts(line.toLowerCase());
  const index = normalized.indexOf(keyword);
  if (index < 0) return false;

  const before = normalized.slice(0, index).trim();
  if (!/^(?:(?:[a-z]\)|\d+[.)]|[•-])\s*)?(?:oeffentlicher\s+)?$/i.test(before)) {
    return false;
  }

  // Exact buyer labels must not match prose such as "Auftraggebers".
  const exactBuyerKeyword = ["auftraggeber", "vergabestelle", "beschaffer"].includes(keyword);
  return !exactBuyerKeyword || !/^[a-z]/i.test(normalized.slice(index + keyword.length));
};

const firstMatchingLine = (lines: string[], keywords: string[], validate: (value: string) => boolean = () => true): string | null => {
  for (let i = 0; i < lines.length; i++) {
    if (!keywords.some((keyword) => isLabelLine(lines[i], keyword))) continue;

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
      if (/^(?:bezeichnung|name|name\s+und\s+anschrift|auftraggeber|vergabestelle)\s*:?[\s]*$/i.test(nextLine)) continue;
      const candidate = cleaned.length > 2 ? cleaned : nextLine;
      // Reject obviously mangled candidates (whitespace lost between HTML elements)
      if (looksMangled(candidate)) break;
      if (validate(candidate)) return candidate.slice(0, 400);
    }

    // Try extracting value from the same line (label: value format)
    const sameLineValue = extractValueFromLine(lines[i], keywords);
    if (sameLineValue && !looksMangled(sameLineValue) && validate(sameLineValue)) {
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
  return "";
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
  descriptionMarkdown?: string;
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
  commercialBrief?: CommercialBrief;
  document_analysis?: DocumentAnalysis;
}

export interface StructuredFallbackFacts {
  buyer?: string | null;
  deadline?: string | null;
  location?: string | null;
  procedure?: string | null;
  summary?: string | null;
  scope?: string | null;
}

const commercialBriefFacts = (structured: Pick<StructuredData, "title" | "hard_facts" | "decision_relevant" | "procurement">, awarded = false): CommercialBriefFacts => {
  const documentedScope = uniqueTextValues(structured.decision_relevant.scope ?? []);
  const documentedWinRequirements = uniqueTextValues([
    ...(structured.decision_relevant.requirements ?? []),
    ...(structured.procurement.participation_requirements ?? []),
    ...(structured.decision_relevant.mandatory_documents ?? []),
  ]);
  const hasAwardCriteria = (structured.decision_relevant.award_criteria?.length ?? 0) > 0
    || (structured.procurement.award_criteria_detailed?.length ?? 0) > 0;

  return {
    title: structured.title,
    awarded,
    // The official title is usable as a clearly marked scope fallback, but it
    // does not turn missing LV/Mengen into documented detail.
    whatIsBeingBought: documentedScope.length > 0 ? documentedScope : [structured.title],
    documentedWinRequirements,
    deliveryRequirements: [],
    risks: [],
    unknowns: [
      ...(documentedScope.length > 0 ? [] : ["Detaillierter Leistungsumfang und Mengen sind nicht dokumentiert."]),
      ...(hasAwardCriteria ? [] : ["Zuschlagskriterien sind nicht dokumentiert."]),
    ],
    buyer: structured.hard_facts.buyer,
    procedure: structured.procurement.procedure_type,
    deadline: structured.hard_facts.deadline,
    location: structured.hard_facts.location,
  };
};

export const buildStructuredDescriptionMarkdown = (
  structured: StructuredData,
  reference?: unknown,
): string => {
  const hardFacts = structured.hard_facts ?? {};
  const decisionRelevant = structured.decision_relevant ?? {};
  const procurement = structured.procurement ?? {};
  const extra = structured as unknown as Record<string, unknown>;
  const detailedAwardCriteria = procurement.award_criteria_detailed ?? [];
  const requirements = uniqueTextValues([
    ...(decisionRelevant.requirements ?? []),
    ...(procurement.participation_requirements ?? []),
  ]);

  return buildTenderDescriptionMarkdown({
    client: hardFacts.buyer,
    procedure: procurement.procedure_type,
    deadline: hardFacts.deadline,
    location: hardFacts.location,
    value: procurement.contract_value,
    duration: procurement.contract_duration,
    reference: reference ?? extra.referenceNumber ?? extra.reference_number,
    summary: structured.summary,
    scope: decisionRelevant.scope,
    requirements,
    mandatoryDocuments: decisionRelevant.mandatory_documents,
    awardCriteria: detailedAwardCriteria.length > 0
      ? detailedAwardCriteria
      : decisionRelevant.award_criteria,
    cpv: procurement.cpv_codes,
  });
};

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
  const text = normalizePublicDisplayCandidate(value) ?? "";
  if (!text || text.length > 1_600 || isPublicNavigationSummary(text)) return "";

  const lower = text.toLowerCase();
  if (/\bvergabeplattform\b/i.test(text)) return "";
  const markerCount = PORTAL_TEXT_MARKERS.filter((marker) => lower.includes(marker)).length;
  return markerCount >= 2 ? "" : text;
};

export function normalizeStructured(raw: unknown, fallbackTitle: string, fallbackFacts: StructuredFallbackFacts = {}): StructuredData {
  const obj = recordValue(raw);
  const safeFallbackTitle = sanitizeTenderText(fallbackTitle);
  if (obj && typeof obj === "object" && (obj.decision_relevant || obj.decisionRelevant)) {
    const structured = obj as unknown as StructuredData;
    const decisionRelevant = mergeStructuredRecords(obj.decision_relevant, obj.decisionRelevant);
    const procurement = recordValue(firstStructuredValue(obj, ["procurement"]));
    const rawScope = firstStructuredValue(decisionRelevant, ["scope", "subject"]);
    const rawScopeText = Array.isArray(rawScope)
      ? rawScope.filter((value): value is string | number => typeof value === "string" || typeof value === "number").map(String).join(" ")
      : typeof rawScope === "string" || typeof rawScope === "number" ? String(rawScope) : "";
    const structuredScope = firstValidStructuredValue(
      [obj.decision_relevant, obj.decisionRelevant],
      ["scope", "subject"],
      (value) => {
        const normalized = normalizedTextList(value);
        return normalized.length > 0 ? normalized : null;
      },
    ) ?? [];
    const scopeIsDocumentArtifact = structuredScope.length === 0
      && Boolean(rawScopeText && isPublicDocumentArtifact(rawScopeText));
    const normalizedScope = structuredScope.length > 0
      ? structuredScope
      : normalizePublicTextList(fallbackFacts.scope);
    const structuredBuyer = firstValidStructuredValue(
      [obj.hard_facts, obj.hardFacts],
      ["buyer", "client", "authority", "contractingAuthority"],
      (value) => normalizePublicClient(value) || null,
    ) ?? "";
    const structuredLocation = firstValidStructuredValue(
      [obj.hard_facts, obj.hardFacts],
      ["location", "city", "address"],
      (value) => pickValidatedPublicLocationForTender(
        safeFallbackTitle,
        fallbackFacts.buyer || structuredBuyer,
        value,
      ) || null,
    ) ?? "";
    const structuredDeadline = firstValidStructuredValue(
      [obj.hard_facts, obj.hardFacts],
      ["deadline", "deadlineAt", "submissionDeadline", "submission_deadline", "offerDeadline", "offer_deadline"],
      (value) => sanitizeTenderText(value) || null,
    ) ?? "";
    const structuredBudget = firstValidStructuredValue(
      [obj.hard_facts, obj.hardFacts],
      ["budget", "estimatedValue", "estimated_value"],
      (value) => sanitizeTenderText(value) || null,
    ) ?? "";
    const structuredContractType = firstValidStructuredValue(
      [obj.hard_facts, obj.hardFacts],
      ["contract_type", "contractType"],
      (value) => pickValidatedPublicProcedure(value) || null,
    ) ?? "";
    const structuredSummaryCandidates = structuredAliasValues([obj], ["summary", "description"]);
    const structuredProcedure = firstValidStructuredValue(
      [procurement, obj.hard_facts, obj.hardFacts],
      ["procedure", "procedure_type", "procedureType", "contract_type", "contractType"],
      (value) => pickValidatedPublicProcedure(value) || null,
    ) ?? "";
    const fallbackProcedure = pickValidatedPublicProcedure(fallbackFacts.procedure);
    const contractValue = recordValue(firstStructuredValue(procurement, ["contract_value", "contractValue"]));
    const contractDuration = recordValue(firstStructuredValue(procurement, ["contract_duration", "contractDuration"]));
    const normalized = {
      ...structured,
      title: sanitizeTenderText(structured.title) || safeFallbackTitle,
      summary: pickValidatedPublicCandidate(
        ...structuredSummaryCandidates,
        fallbackFacts.summary,
        fallbackFacts.scope,
        normalizedScope,
      ),
      hard_facts: {
        // Parsed portal labels are more reliable than legacy cache fragments
        // such as "## Kurzinfo" or a lone postal code.
        buyer: normalizePublicClient(fallbackFacts.buyer) || structuredBuyer || null,
        deadline: sanitizeTenderText(fallbackFacts.deadline) || structuredDeadline || null,
        budget: structuredBudget || null,
        contract_type: structuredContractType || null,
        location: pickValidatedPublicLocationForTender(
          safeFallbackTitle,
          fallbackFacts.buyer || structuredBuyer,
          fallbackFacts.location,
          structuredLocation,
        ) || null,
      },
      decision_relevant: {
        scope: normalizedScope,
        requirements: scopeIsDocumentArtifact
          ? []
          : firstValidTextList([obj.decision_relevant, obj.decisionRelevant], ["requirements"]),
        mandatory_documents: scopeIsDocumentArtifact
          ? []
          : firstValidTextList([obj.decision_relevant, obj.decisionRelevant], ["mandatory_documents", "mandatoryDocuments"]),
        award_criteria: firstValidTextList([obj.decision_relevant, obj.decisionRelevant], ["award_criteria", "awardCriteria"]),
      },
      procurement: {
        contract_value: {
          min: typeof contractValue.min === "number" ? contractValue.min : null,
          max: typeof contractValue.max === "number" ? contractValue.max : null,
          currency: sanitizeTenderText(contractValue.currency) || "EUR",
        },
        contract_duration: {
          months: typeof contractDuration.months === "number" ? contractDuration.months : null,
          renewal: contractDuration.renewal === true,
        },
        procedure_type: fallbackProcedure
          || structuredProcedure
          || "",
        participation_requirements: firstValidTextList([procurement], ["participation_requirements", "participationRequirements"]),
        award_criteria_detailed: firstValidStructuredValue(
          [procurement],
          ["award_criteria_detailed", "awardCriteriaDetailed"],
          (value) => {
            const normalized = normalizedAwardCriteria(value);
            return normalized.length > 0 ? normalized : null;
          },
        ) ?? [],
        cpv_codes: firstValidTextList([procurement], ["cpv_codes", "cpvCodes"]),
      },
    };
    const canonical = {
      ...normalized,
      ...(Object.prototype.hasOwnProperty.call(obj, "description") || Object.prototype.hasOwnProperty.call(obj, "summary")
        ? { description: pickValidatedPublicCandidate(...structuredSummaryCandidates) }
        : {}),
      descriptionMarkdown: buildStructuredDescriptionMarkdown(normalized, obj.referenceNumber ?? obj.reference_number),
      commercialBrief: normalized.commercialBrief
        ? validateCommercialBrief(normalized.commercialBrief, commercialBriefFacts(normalized)).brief
        : createCommercialBriefFallback(commercialBriefFacts(normalized)),
    };
    delete (canonical as Record<string, unknown>).description_markdown;
    return canonical;
  }
  const flat = obj as Record<string, unknown>;
  const scopeCandidates = structuredAliasValues([flat], ["scope", "subject"]);
  const descriptionCandidates = structuredAliasValues([flat], ["description", "summary"]);
  const scopeStr = firstValidStructuredValue([flat], ["scope", "subject"], (value) => sanitizeTenderText(value) || null) ?? "";
  const reqArr = firstValidTextList([flat], ["requirements", "participation_requirements", "participationRequirements"]);
  const awardArr = firstValidTextList([flat], ["awardCriteria", "award_criteria"]);
  const titleStr = sanitizeTenderText(flat.title) || safeFallbackTitle;
  const buyerStr = firstValidStructuredValue([flat], ["client", "buyer"], (value) => normalizePublicClient(value) || null)
    || normalizePublicClient(fallbackFacts.buyer)
    || null;
  const locationStr = firstValidStructuredValue(
    [flat],
    ["location", "city"],
    (value) => pickValidatedPublicLocationForTender(titleStr, buyerStr, value) || null,
  ) ?? "";
  const deadlineStr = firstValidStructuredValue([flat], ["deadline", "deadlineAt"], (value) => sanitizeTenderText(value) || null) ?? "";
  const procedureStr = firstValidStructuredValue(
    [flat],
    ["procedure", "procedureType", "procedure_type"],
    (value) => pickValidatedPublicProcedure(value) || null,
  ) ?? "";
  const fallbackProcedure = pickValidatedPublicProcedure(fallbackFacts.procedure);
  const fallbackScope = pickValidatedPublicCandidate(fallbackFacts.scope);
  const scopeWords = scopeStr && scopeStr.toLocaleLowerCase("de-DE") !== titleStr.toLocaleLowerCase("de-DE")
    ? scopeStr.split(/\s+/).filter((word) => word.length > 3)
    : fallbackScope && fallbackScope.toLocaleLowerCase("de-DE") !== titleStr.toLocaleLowerCase("de-DE")
      ? [fallbackScope]
      : [];

  const normalized = {
    title: titleStr,
    summary: pickValidatedPublicCandidate(
      ...descriptionCandidates,
      ...scopeCandidates,
      fallbackFacts.summary,
      fallbackFacts.scope,
    ),
    confidence: 0.5,
    hard_facts: {
      location: locationStr || pickValidatedPublicLocationForTender(titleStr, buyerStr, fallbackFacts.location) || null,
      deadline: deadlineStr || sanitizeTenderText(fallbackFacts.deadline) || null,
      budget: sanitizeTenderText(firstStructuredValue(flat, ["estimatedValue", "estimated_value", "value"])) || null,
      buyer: buyerStr,
      contract_type: procedureStr || fallbackProcedure || null,
    },
    decision_relevant: {
      scope: scopeWords,
      requirements: reqArr,
      mandatory_documents: [],
      award_criteria: awardArr,
    },
    procurement: {
      contract_value: { min: null, max: null, currency: "EUR" },
      contract_duration: { months: null, renewal: false },
      award_criteria_detailed: [],
      participation_requirements: [],
      cpv_codes: firstValidTextList([flat], ["cpvCodes", "cpv_codes"]),
      procedure_type: fallbackProcedure || procedureStr,
    },
  };
  return {
    ...normalized,
    descriptionMarkdown: buildTenderDescriptionMarkdown({
      client: normalized.hard_facts.buyer,
      procedure: normalized.procurement.procedure_type,
      deadline: normalized.hard_facts.deadline,
      location: normalized.hard_facts.location,
      value: firstStructuredValue(flat, ["estimatedValue", "estimated_value", "value"]),
      duration: firstStructuredValue(flat, ["duration", "contractDuration", "contract_duration"]),
      reference: firstStructuredValue(flat, ["referenceNumber", "reference_number"]),
      summary: normalized.summary,
      scope: scopeStr || fallbackScope,
      requirements: reqArr,
      awardCriteria: awardArr,
      cpv: firstValidTextList([flat], ["cpvCodes", "cpv_codes"]),
    }),
    commercialBrief: createCommercialBriefFallback(commercialBriefFacts(normalized)),
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
  commercial_brief: unknown;
}

const SOURCE_AMOUNT_NUMBER = String.raw`(?:\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[,.]\d+)?)`;
const SOURCE_CURRENCY_AMOUNT = new RegExp(
  `(?:€|\\bEUR\\b|\\bEURO\\b)\\s*(${SOURCE_AMOUNT_NUMBER})|(${SOURCE_AMOUNT_NUMBER})(?:\\s*(?:bis|[-–])\\s*(${SOURCE_AMOUNT_NUMBER}))?\\s*(?:€|\\bEUR\\b|\\bEURO\\b)`,
  "giu",
);

const parseSourceAmount = (value: string): number | null => {
  const compact = value.replace(/\s/gu, "");
  let normalized = compact;
  if (compact.includes(",") && compact.includes(".")) {
    normalized = compact.lastIndexOf(",") > compact.lastIndexOf(".")
      ? compact.replace(/\./gu, "").replace(",", ".")
      : compact.replace(/,/gu, "");
  } else if (compact.includes(",")) {
    normalized = /,\d{3}$/u.test(compact) ? compact.replace(/,/gu, "") : compact.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/u.test(compact)) {
    normalized = compact.replace(/\./gu, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const sourceEuroAmounts = (rawText: string): number[] => {
  const amounts: number[] = [];
  SOURCE_CURRENCY_AMOUNT.lastIndex = 0;
  for (const match of rawText.matchAll(SOURCE_CURRENCY_AMOUNT)) {
    const before = rawText.slice(Math.max(0, (match.index ?? 0) - 220), match.index ?? 0);
    if (!/(?:auftragswert|auftragsvolumen|gesamtwert|vertragswert|estimated\s+(?:(?:contract|total)\s+)?value|contract\s+value|budget|höchstwert|hoechstwert|schätzwert|schaetzwert)/iu.test(before)) continue;
    for (const candidate of [match[1], match[2], match[3]]) {
      if (!candidate) continue;
      const value = parseSourceAmount(candidate);
      if (value !== null) amounts.push(value);
    }
  }
  SOURCE_CURRENCY_AMOUNT.lastIndex = 0;
  return amounts;
};

const sourceDurationMonths = (rawText: string): number[] => {
  const values: number[] = [];
  const pattern = /(\d{1,4})\s*(monat(?:e|en)?|month(?:s)?|jahr(?:e|en)?|year(?:s)?|tag(?:e|en)?|day(?:s)?)/giu;
  for (const match of rawText.matchAll(pattern)) {
    const before = rawText.slice(Math.max(0, (match.index ?? 0) - 160), match.index ?? 0);
    if (!/(?:laufzeit|vertragslaufzeit|dauer\s+des\s+vertrags|vertrag(?:s)?\s+(?:läuft|laeuft|beträgt|betraegt|für|fuer)|zeitraum|contract\s+(?:duration|term)|duration|term)/iu.test(before)) continue;
    const amount = Number(match[1]);
    const unit = match[2].toLocaleLowerCase("de-DE");
    if (unit.startsWith("jahr") || unit.startsWith("year")) values.push(amount * 12);
    else if (unit.startsWith("tag") || unit.startsWith("day")) values.push(Math.ceil(amount / 30));
    else values.push(amount);
  }
  return values;
};

const sourceBackedAwardCriterion = (criterion: string, rawText: string): boolean => {
  if (!isSourceBackedPublicValue(criterion, rawText)) return false;
  const source = compactSpaces(decodeHtmlEntities(rawText)).toLocaleLowerCase("de-DE");
  const candidate = compactSpaces(decodeHtmlEntities(criterion)).toLocaleLowerCase("de-DE");
  let position = source.indexOf(candidate);
  while (position >= 0) {
    const before = source.slice(Math.max(0, position - 300), position);
    if (/(?:zuschlagskriter|award criteria|wertung|gewichtung)/iu.test(before)) return true;
    position = source.indexOf(candidate, position + 1);
  }
  return false;
};

const sourceBackedAwardWeight = (criterion: string, weight: number, rawText: string): boolean => {
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) return false;
  const source = compactSpaces(decodeHtmlEntities(rawText)).toLocaleLowerCase("de-DE");
  const candidate = compactSpaces(decodeHtmlEntities(criterion)).toLocaleLowerCase("de-DE");
  const numericWeight = String(weight).replace(".", "[.,]");
  const percentOrPoints = new RegExp(`(?:^|[^\\d])${numericWeight}(?:[.,]0+)?\\s*(?:%|prozent|punkte)`, "iu");
  const labelledWeight = new RegExp(`(?:zahl|weight)\\s*[:\\-]?\\s*${numericWeight}(?:[.,]0+)?\\b`, "iu");
  let position = source.indexOf(candidate);
  while (position >= 0) {
    const before = source.slice(Math.max(0, position - 300), position);
    if (/(?:zuschlagskriter|award criteria|wertung|gewichtung)/iu.test(before)) {
      const window = source.slice(Math.max(0, position - 80), position + candidate.length + 100);
      if (percentOrPoints.test(window) || labelledWeight.test(window)) return true;
    }
    position = source.indexOf(candidate, position + 1);
  }
  return false;
};

const sourceBackedCpvCode = (code: string, rawText: string): boolean => {
  if (!/^\d{8}(?:-\d)?$/u.test(code) || !isSourceBackedPublicValue(code, rawText)) return false;
  const source = compactSpaces(decodeHtmlEntities(rawText)).toLocaleLowerCase("de-DE");
  let position = source.indexOf(code.toLocaleLowerCase("de-DE"));
  while (position >= 0) {
    if (/\b(?:cpv(?:-code)?|common procurement vocabulary)\b/iu.test(source.slice(Math.max(0, position - 300), position))) return true;
    position = source.indexOf(code.toLocaleLowerCase("de-DE"), position + 1);
  }
  return false;
};

const sourceBackedProcedure = (procedure: string, rawText: string): boolean => {
  const evidence: Record<string, RegExp> = {
    offen: /\b(?:offenes verfahren|öffentliche ausschreibung|open procedure)\b/iu,
    beschränkt: /\b(?:beschränktes verfahren|beschränkte ausschreibung|restricted procedure)\b/iu,
    verhandelt: /\b(?:verhandlungsverfahren|verhandelte ausschreibung|negotiated procedure)\b/iu,
    dialog: /\b(?:wettbewerblicher dialog|competitive dialogue)\b/iu,
    innovation: /\b(?:innovationspartnerschaft|innovation partnership)\b/iu,
  };
  const value = procedure.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const labelled = new RegExp(`(?:verfahrensart|vergabeart|procedure type)\\s*[:\\-]?\\s*${value}\\b`, "iu");
  return Boolean(evidence[procedure]?.test(rawText) || labelled.test(rawText));
};

/** Keep LLM procurement values only when raw source text explicitly supports them. */
export const groundLLMExtractionAgainstSource = (
  extraction: LLMExtractionResult,
  rawText: string,
): LLMExtractionResult => {
  const source = decodeHtmlEntities(rawText);
  const amounts = sourceEuroAmounts(source);
  const durations = sourceDurationMonths(source);
  const awardCriteria = extraction.award_criteria
    .filter((item) => sourceBackedAwardCriterion(item.criterion, rawText))
    .map((item) => ({
      ...item,
      weight: item.weight !== null && sourceBackedAwardWeight(item.criterion, item.weight, rawText)
        ? item.weight
        : null,
    }));
  return {
    ...extraction,
    contract_value: {
      min: extraction.contract_value.min !== null && amounts.some((value) => Math.abs(value - extraction.contract_value.min!) < 0.005)
        ? extraction.contract_value.min
        : null,
      max: extraction.contract_value.max !== null && amounts.some((value) => Math.abs(value - extraction.contract_value.max!) < 0.005)
        ? extraction.contract_value.max
        : null,
      currency: "EUR",
    },
    contract_duration_months: extraction.contract_duration_months !== null
      && durations.includes(extraction.contract_duration_months)
      ? extraction.contract_duration_months
      : null,
    contract_duration_renewal: extraction.contract_duration_renewal
      && /(?:verlängerungsoption|verlängerbar|optionszeitraum|option\s+(?:zur\s+)?verlängerung|renewable|renewal\s+option|option\s+to\s+extend)/iu.test(source),
    award_criteria: awardCriteria,
    participation_requirements: extraction.participation_requirements
      .filter((requirement) => isSourceBackedPublicValue(requirement, rawText)),
    cpv_codes: extraction.cpv_codes.filter((code) => sourceBackedCpvCode(code, rawText)),
    procedure_type: sourceBackedProcedure(extraction.procedure_type, source) ? extraction.procedure_type : "",
  };
};

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
  "procedure_type": "offen",
  "commercial_brief": {
    "action": "verify",
    "headline": "",
    "rationale": "",
    "nextAction": ""
  }
}

Regeln:
- contract_value: Geschätzter Auftragswert in EUR. min/max wenn Range, sonst max = geschätzter Wert, min = null
- contract_duration_months: Vertragslaufzeit in Monaten (null wenn nicht angegeben)
- contract_duration_renewal: true wenn Verlängerungsoption existiert
- award_criteria: Array von { "criterion": "Name", "weight": 40 } (Gewichtung in %, null wenn nicht angegeben)
- participation_requirements: Teilnahmevoraussetzungen (Eignungsnachweise, Referenzen, etc.)
- cpv_codes: CPV-Codes (8-stellig, z.B. "90910000")
- procedure_type: "offen", "beschränkt", "verhandelt", "dialog", "innovation"
- commercial_brief: Eine knappe, geschäftliche Entscheidung für den Bieter. action ist immer "verify". Formuliere headline und rationale ausschließlich aus dokumentierten Fakten; nenne dabei mindestens den Titel oder einen dokumentierten Leistungsumfang beziehungsweise eine dokumentierte Anforderung wörtlich. Gib keine Listen für Anforderungen, Risiken oder offene Punkte aus.

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
    const sanitized: LLMExtractionResult = {
      contract_value: {
        min: typeof parsed.contract_value?.min === "number" ? parsed.contract_value.min : null,
        max: typeof parsed.contract_value?.max === "number" ? parsed.contract_value.max : null,
        currency: parsed.contract_value?.currency || "EUR",
      },
      contract_duration_months: typeof parsed.contract_duration_months === "number" ? parsed.contract_duration_months : null,
      contract_duration_renewal: Boolean(parsed.contract_duration_renewal),
      award_criteria: Array.isArray(parsed.award_criteria) 
        ? parsed.award_criteria.map((c: { criterion?: string; weight?: number }) => ({
            criterion: sanitizeTenderText(c.criterion),
            weight: typeof c.weight === "number" ? c.weight : null,
          })).filter((c: AwardCriterion) => c.criterion.length > 0)
        : [],
      participation_requirements: Array.isArray(parsed.participation_requirements)
        ? parsed.participation_requirements.map(sanitizeTenderText).filter(Boolean)
        : [],
      cpv_codes: Array.isArray(parsed.cpv_codes)
        ? parsed.cpv_codes.map(sanitizeTenderText).filter(Boolean)
        : [],
      procedure_type: ["offen", "beschränkt", "verhandelt", "dialog", "innovation"].includes(parsed.procedure_type)
        ? parsed.procedure_type
        : "",
      commercial_brief: parsed.commercial_brief,
    };
    return groundLLMExtractionAgainstSource(sanitized, rawText);
  } catch (error) {
    console.error("[structurer] LLM-Extraktion fehlgeschlagen:", error);
    return null;
  }
}

// Build a clean, human-readable summary from the structured text.
// Avoids the previous bug where `rawText.slice(0, 3000)` dumped mangled
// single-line captions (labels glued to values) into the summary field.
// Picks at most two well-formed lines, never a portal/PDF dump.
const buildSummary = (lines: string[], rawText: string, excludedTitle: string): string => {
  const picked: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (line.length < 40) continue;
    if (excludedTitle && compactSpaces(line).toLocaleLowerCase("de-DE") === compactSpaces(excludedTitle).toLocaleLowerCase("de-DE")) continue;
    if (looksMangled(line)) continue;
    picked.push(line);
    total += line.length + 1;
    if (picked.length >= 2 || total >= 420) break;
  }
  if (picked.length === 0) {
    // Last resort: keep the old behaviour but only if the input does not look mangled.
    const head = rawText.slice(0, 420).trim();
    if (head.length < 40 || looksMangled(head)) return "";
    return compactSpaces(head).toLocaleLowerCase("de-DE") === compactSpaces(excludedTitle).toLocaleLowerCase("de-DE")
      ? ""
      : head;
  }
  return picked.join(" ").slice(0, 420);
};

export const extractStructuredData = async (
  title: string,
  rawText: string,
  options: { useLLM?: boolean; reference?: string | null } = {},
): Promise<StructuredData> => {
  const safeTitle = pickValidatedPublicCandidate(title) || "Ausschreibung";
  const normalizedRawText = decodeHtmlEntities(rawText);
  const opportunityStatus = classifyOpportunityStatus(title, normalizedRawText);
  const lines = normalizedRawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const deadline = extractDeadline(lines);
  const budget = extractBudget(normalizedRawText);
  const buyer = normalizePublicClient(firstMatchingLine(lines, [
    "zur angebotsabgabe / teilnahme auffordernde stelle",
    "ausschreibende stelle",
    "oeffentlicher auftraggeber",
    "auftraggeber",
    "vergabestelle",
    "beschaffer",
  ], (candidate) => Boolean(normalizePublicClient(candidate))));
  const location = pickValidatedPublicLocationForTender(
    title,
    buyer,
    firstMatchingLine(
      lines,
      ["ort der ausf", "ort der leistung", "ausfuehrungsort", "ausfuhrungsort", "erfuellungsort", "erfuellungsort"],
      (candidate) => Boolean(pickValidatedPublicLocationForTender(title, buyer, pickValidatedPublicLocation(candidate))),
    ),
  );
  const contractType = detectContractType(rawText);

  const requirements = uniqueTextValues(matchingLines(lines, ["eignung", "mindestanforderung", "fachkunde", "leistungsfaehigkeit"])
    .map(sanitizeTenderText)
    .filter(Boolean)
    .filter((value) => !/^[a-z]\)\s*(?:beurteilung der eignung|zuschlagskriterien)$/i.test(value)));
  const scope = matchingLinesWithContext(lines, ["art und umfang der leistung", "leistungsbeschreibung", "leistungsumfang", "gegenstand der ausschreibung", "art und umfang", "umfang der leistung", "beschreibung der leistung", "auftragsgegenstand"])
    .map(sanitizeTenderText)
    .map((value) => value
      .replace(/^Art der Leistung:\s*/i, "")
      .replace(/\s+Umfang der Leistung:\s*/i, " ")
      .replace(/(?:^|\s+)Vergabe nach Losen\s+(?:Ja|Nein)\s*$/i, "")
      .trim())
    .filter((value, index, values) => !values.some((other, otherIndex) =>
      otherIndex !== index && other.length > value.length && other.includes(value)))
    .filter(Boolean);
  const awardCriteria = uniqueTextValues(matchingLinesWithContext(lines, ["zuschlagskriter", "bewertung", "gewichtung"], 4, 1_000)
    .map(sanitizeTenderText)
    .map((value) => value.replace(/^[a-z]\)\s*zuschlagskriterien\s*/i, "").trim())
    .filter(Boolean)
    .filter((value, index, values) => !values.some((other, otherIndex) =>
      otherIndex !== index && other.length > value.length && other.includes(value))));
  const mandatoryDocuments = uniqueTextValues(matchingLines(lines, ["nachweis", "zertifikat", "referenz", "pflichtunterlage", "muss"])
    .map(sanitizeTenderText)
    .filter(Boolean));

  // Regex-based procurement data
  const contractValueRegex = extractContractValue(normalizedRawText);
  const contractDurationRegex = extractDuration(normalizedRawText);
  const cpvCodesRegex = extractCpvCodes(normalizedRawText);
  const procedureTypeRegex = detectProcedureType(normalizedRawText);

  // LLM-based extraction for enhanced data
  const llmResult = options.useLLM === false || opportunityStatus.isAwarded
    ? null
    : await extractWithLLM(title, normalizedRawText);

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

  const summary = pickValidatedPublicCandidate(
    scope[0],
    buildSummary(lines, normalizedRawText, safeTitle),
  );
  const structured: StructuredData = {
    title: safeTitle,
    descriptionMarkdown: "",
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
    summary,
    confidence,
  };
  structured.descriptionMarkdown = buildStructuredDescriptionMarkdown(structured, options.reference);
  const facts = commercialBriefFacts(structured, opportunityStatus.isAwarded);
  const briefValidation = validateCommercialBrief(llmResult?.commercial_brief, facts);
  structured.commercialBrief = briefValidation.valid
    ? briefValidation.brief
    : createCommercialBriefFallback(facts);
  return structured;
};
