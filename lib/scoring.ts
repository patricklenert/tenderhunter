import { sanitizeTenderText, type StructuredData } from "@/lib/structurer";
import {
  assessLocationEligibility,
  type LocationEligibility,
  type LocationEligibilityStatus,
  type TenderLocationInput,
} from "@/lib/location";
import { callLLM } from "@/lib/llm";
import OpenAI from "openai";

const WORD_PATTERN = /[\p{L}\p{N}-]{3,}/gu;
const CPV_PATTERN = /\b\d{8}(?:-\d)?\b/g;

const clamp = (value: number, lower = 0, upper = 100): number => Math.max(lower, Math.min(upper, value));

const STOP_WORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines", "einem", "einen",
  "und", "oder", "aber", "sondern", "von", "zu", "zur", "zum", "fur", "fuer", "mit", "nach",
  "bei", "in", "an", "auf", "uber", "ueber", "unter", "vor", "hinter", "neben", "zwischen",
  "durch", "ohne", "um", "gegen", "bis", "ab", "aus", "ist", "sind", "wird", "werden", "war",
  "waren", "hat", "haben", "had", "hatte", "hatten", "kann", "kann", "soll", "muss", "darf",
  "nicht", "kein", "keine", "keinen", "keiner", "keines", "auch", "noch", "schon", "nur", "sehr",
  "the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "been", "have",
  "has", "had", "will", "would", "could", "should", "may", "might", "must", "shall", "can",
]);

const tokenize = (text: string): Set<string> => {
  const normalized = text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const tokens = (normalized.match(WORD_PATTERN) ?? []).map((item) => item.toLowerCase());
  return new Set(tokens.filter((t) => !STOP_WORDS.has(t) && t.length >= 4));
};

type CapabilityGroup =
  | "green_outdoor"
  | "construction"
  | "cleaning"
  | "transport"
  | "wood"
  | "it"
  | "medical"
  | "education"
  | "property_management";

const CAPABILITY_GROUPS: Record<CapabilityGroup, { terms: string[]; cpvPrefixes: string[] }> = {
  green_outdoor: {
    terms: ["galabau", "landschaftsbau", "landschaftspflege", "grunanlagen", "aussenanlagen", "freianlagen", "pflasterarbeiten", "zaunbau", "einfriedung", "spielplatzbau", "winterdienst"],
    cpvPrefixes: ["451127", "772", "773"],
  },
  construction: {
    terms: ["hochbau", "tiefbau", "strassenbau", "sanierungsarbeiten", "rohbau", "abbrucharbeiten", "fassadenarbeiten", "dachdecker", "betonarbeiten", "erdarbeiten"],
    cpvPrefixes: ["452", "453", "454", "455"],
  },
  cleaning: {
    terms: ["glasreinigung", "unterhaltsreinigung", "gebaeudereinigung", "reinigungsdienstleistungen"],
    cpvPrefixes: ["909"],
  },
  transport: {
    terms: ["transportdienstleistungen", "logistikdienstleistungen", "fuhrparkmanagement", "abfallentsorgung", "entsorgungsdienstleistungen"],
    cpvPrefixes: ["60", "63"],
  },
  wood: {
    terms: ["brennholz", "mischholz", "forstwirtschaft", "holzhandel"],
    cpvPrefixes: ["03", "16"],
  },
  it: {
    terms: ["softwareentwicklung", "cybersecurity", "webentwicklung", "datenbank", "programmierung", "it-betrieb", "digitalplattform"],
    cpvPrefixes: ["48", "72"],
  },
  medical: {
    terms: ["medizinische", "arzneimittel", "pharmazeutische", "krankenhaus", "pflegeleistungen", "notfallsanitaeter"],
    cpvPrefixes: ["33", "85"],
  },
  education: {
    terms: ["ausbildung", "fortbildung", "weiterbildung", "qualifizierung", "fuehrungskraeftequalifizierung", "seminare", "schulung"],
    cpvPrefixes: ["80"],
  },
  property_management: {
    terms: ["immobilienverwaltung", "immobilienmanagement", "hausverwaltung", "liegenschaftsverwaltung", "objektverwaltung", "mietverwaltung", "wohnungsverwaltung", "immobilienmakler", "immobilienvermittlung"],
    cpvPrefixes: ["70"],
  },
};

const isAddressToken = (token: string): boolean =>
  /(?:strasse|weg|allee|platz|gasse|ring|ufer|damm|chaussee)$/u.test(token);

const matchesTerm = (token: string, term: string): boolean =>
  token === term || (
    term.length >= 6 &&
    token.length > term.length &&
    token.includes(term) &&
    !isAddressToken(token)
  );

const groupsForText = (text: string): Set<CapabilityGroup> => {
  const tokens = tokenize(text);
  const groups = new Set<CapabilityGroup>();
  for (const [group, definition] of Object.entries(CAPABILITY_GROUPS) as Array<[CapabilityGroup, { terms: string[]; cpvPrefixes: string[] }]>) {
    if (definition.terms.some((term) => [...tokens].some((token) => matchesTerm(token, term)))) {
      groups.add(group);
    }
  }
  return groups;
};

const groupsForCpvCodes = (codes: string[]): Set<CapabilityGroup> => {
  const normalizedCodes = codes.map((code) => code.replace(/\D/g, ""));
  const groups = new Set<CapabilityGroup>();
  for (const [group, definition] of Object.entries(CAPABILITY_GROUPS) as Array<[CapabilityGroup, { terms: string[]; cpvPrefixes: string[] }]>) {
    if (definition.cpvPrefixes.some((prefix) => normalizedCodes.some((code) => code.startsWith(prefix)))) {
      groups.add(group);
    }
  }
  return groups;
};

const parseList = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
    }
  } catch {
    return value
      .split(",")
      .map((item) => item.toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
};

const keywordMatchRatio = (keywords: string[], text: string): number => {
  if (keywords.length === 0) {
    return 0.15;
  }
  if (!text) {
    return 0;
  }

  const tokens = tokenize(text);
  const tokenArray = [...tokens];
  let matched = 0;
  for (const keyword of keywords) {
    const keyTokens = tokenize(keyword);
    if (keyTokens.size === 0) {
      continue;
    }
    // 1. Exact token match (full score)
    const allTokensFound = [...keyTokens].every((token) => tokens.has(token));
    if (allTokensFound) {
      matched += 1;
      continue;
    }
    // 2. German compound match (partial score): keyToken appears as substring in any textToken
    // e.g. "sanierung" is contained in "komplexsanierung", "sanierungsarbeiten"
    const compoundMatched = [...keyTokens].every((token) => {
      if (token.length < 6) return false; // Only for longer, specific tokens
      return tokenArray.some((textToken) => textToken.length >= token.length && textToken.includes(token));
    });
    if (compoundMatched) {
      matched += 0.5;
    }
  }
  return Math.min(1, matched / Math.max(1, Math.min(keywords.length, 6)));
};

const capabilityMatch = (keywords: string[], industry: string | null, text: string): number => {
  const profileGroups = groupsForText(`${keywords.join(" ")} ${industry ?? ""}`);
  if (profileGroups.size === 0) return keywordMatchRatio(keywords, text);

  const tenderGroups = groupsForText(text);
  const matchedGroups = [...profileGroups].filter((group) => tenderGroups.has(group)).length;
  if (matchedGroups === 0) return 0.03;

  const directMatch = keywordMatchRatio(keywords, text);
  const base = matchedGroups >= 2 ? 0.82 : 0.58;
  return Math.min(1, base + directMatch * 0.15);
};

const sizeMatch = (teamSize: number | null, scopeText: string): number => {
  if (!teamSize) {
    return 0.3;
  }
  const lower = scopeText.toLowerCase();
  if (lower.includes("gro") && teamSize < 20) {
    return 0.2;
  }
  if (lower.includes("klein") && teamSize > 250) {
    return 0.4;
  }
  return 1;
};

const complexityScore = (structured: StructuredData): number => {
  const mandatoryCount = structured.decision_relevant.mandatory_documents.length;
  const requirementCount = structured.decision_relevant.requirements.length;
  const textFactor = Math.min(1, structured.summary.length / 12_000);
  const checklistFactor = Math.min(1, mandatoryCount * 0.1 + requirementCount * 0.05);
  return Math.min(1, textFactor * 0.5 + checklistFactor * 0.5);
};

export interface CompanyRow {
  capabilities_json: string;
  certifications_json: string;
  regions_json: string;
  team_size: number | null;
  industry?: string | null;
}

export interface TenderScoringInput extends TenderLocationInput {
  metadataDescription?: unknown;
  allowUnknownTenderLocation?: boolean;
}

export type DomainEligibilityStatus = "match" | "mismatch" | "domain_unknown";

export interface DomainEligibility {
  status: DomainEligibilityStatus;
  reason: string;
  source: "cpv" | "text" | "unknown";
}

export interface TenderMatchDocument {
  text: string;
  scope: string;
  description: string;
  cpvCodes: string[];
}

const uniqueNonEmpty = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const explicitCpvCodes = (text: string): string[] => text.match(CPV_PATTERN) ?? [];

const domainMatchText = (tenderTitle: string, document: TenderMatchDocument): string =>
  uniqueNonEmpty([tenderTitle, document.scope || document.description]).join(" ");

export const buildTenderMatchDocument = (
  tenderTitle: string,
  structured: StructuredData,
  input: TenderScoringInput = {},
): TenderMatchDocument => {
  const scope = uniqueNonEmpty((structured.decision_relevant.scope ?? []).map(sanitizeTenderText));
  const requirements = uniqueNonEmpty([
    ...(structured.decision_relevant.requirements ?? []),
    ...(structured.decision_relevant.mandatory_documents ?? []),
    ...(structured.procurement?.participation_requirements ?? []),
  ].map(sanitizeTenderText));
  const structuredDescription = sanitizeTenderText(
    (structured as StructuredData & { description?: unknown }).description,
  );
  const description = uniqueNonEmpty([
    structuredDescription,
    sanitizeTenderText(input.metadataDescription),
    sanitizeTenderText(structured.summary),
  ])[0] ?? "";
  const cpvText = [tenderTitle, description, ...scope, ...requirements, sanitizeTenderText(structured.summary)].join(" ");
  const explicitCodes = explicitCpvCodes(cpvText);
  const explicitCodeDigits = new Set(explicitCodes.map((code) => code.replace(/\D/g, "")));
  const structuredCodes = Array.isArray(structured.procurement?.cpv_codes)
    ? structured.procurement.cpv_codes.filter((code): code is string => typeof code === "string")
    : [];

  return {
    text: uniqueNonEmpty([sanitizeTenderText(tenderTitle), description, ...scope, ...requirements]).join(" ").slice(0, 5_000),
    scope: uniqueNonEmpty([...scope, ...requirements]).join(" ").slice(0, 2_000),
    description: description.slice(0, 2_000),
    cpvCodes: uniqueNonEmpty([
      ...explicitCodes,
      ...structuredCodes.filter((code) => explicitCodeDigits.has(code.replace(/\D/g, ""))),
    ]),
  };
};

export const getDomainEligibility = (
  company: CompanyRow,
  tenderTitle: string,
  structured: StructuredData,
  input: TenderScoringInput = {},
): DomainEligibility => {
  const capabilities = parseList(company.capabilities_json);
  const profileGroups = groupsForText(`${capabilities.join(" ")} ${company.industry ?? ""}`);
  const document = buildTenderMatchDocument(tenderTitle, structured, input);
  const domainText = domainMatchText(tenderTitle, document);
  const textGroups = groupsForText(domainText);
  const cpvGroups = groupsForCpvCodes(document.cpvCodes);
  const tenderGroups = new Set<CapabilityGroup>([...textGroups, ...cpvGroups]);
  const directMatch = keywordMatchRatio(capabilities, domainText);

  if ([...profileGroups].some((group) => cpvGroups.has(group))) {
    return { status: "match", reason: "Passende CPV-Leistungsfamilie erkannt.", source: "cpv" };
  }
  if ([...profileGroups].some((group) => textGroups.has(group)) || directMatch >= 0.2) {
    return { status: "match", reason: "Passende fachliche Leistungsbegriffe erkannt.", source: "text" };
  }
  if (profileGroups.size > 0 && tenderGroups.size > 0) {
    return { status: "mismatch", reason: "Die Leistungsart der Ausschreibung passt nicht zu den hinterlegten Kernleistungen.", source: cpvGroups.size > 0 ? "cpv" : "text" };
  }
  return { status: "domain_unknown", reason: "Es wurde kein belastbarer fachlicher Leistungsbeleg für dieses Unternehmen erkannt.", source: "unknown" };
};

export interface ScoreResult {
  fit: number;
  win_probability: number;
  effort: number;
  requirement_coverage: number;
  kill_switch: boolean;
  details: {
    domain_match: number;
    requirement_coverage: number;
    region_match: number;
    size_match: number;
    complexity: number;
    location_status: LocationEligibilityStatus;
    location_reason: string;
    tender_bundesland: string | null;
    tender_city: string | null;
    location_source: string;
    domain_status: DomainEligibilityStatus;
    domain_reason: string;
    domain_source: DomainEligibility["source"];
  };
}

export function getLocationEligibility(company: CompanyRow, tenderLocation: TenderLocationInput): LocationEligibility {
  return assessLocationEligibility(parseList(company.regions_json), tenderLocation);
}

export const computeScores = (
  tenderTitle: string,
  structured: StructuredData,
  company: CompanyRow,
  llmDomainScore?: number,
  tenderInput: TenderScoringInput = {},
): ScoreResult => {
  const capabilities = parseList(company.capabilities_json);
  const certifications = parseList(company.certifications_json);
  const matchDocument = buildTenderMatchDocument(tenderTitle, structured, tenderInput);
  const domainText = domainMatchText(tenderTitle, matchDocument);
  const requirementLines = [
    ...structured.decision_relevant.requirements,
    ...structured.decision_relevant.mandatory_documents
  ].map(sanitizeTenderText).filter(Boolean).join(" ");

  // Also include LLM-extracted participation_requirements for richer coverage assessment
  const participationReqs = structured.procurement?.participation_requirements ?? [];
  const allRequirementText = [requirementLines, ...participationReqs.map(sanitizeTenderText).filter(Boolean)].join(" ");
  const domainEligibility = getDomainEligibility(company, tenderTitle, structured, tenderInput);
  const domainBlocked = domainEligibility.status !== "match";
  const deterministicDomain = domainBlocked
    ? 0
    : Math.max(
        capabilityMatch(capabilities, company.industry ?? null, domainText),
        domainEligibility.source === "cpv" ? 0.58 : 0,
      );
  const semanticDomain = llmDomainScore;
  // LLM output is useful for synonyms, but it must not override a clear
  // deterministic mismatch (e.g. IT or medicine for a landscaping company).
  const domain = domainBlocked
    ? 0
    : semanticDomain === undefined
    ? deterministicDomain
    : deterministicDomain < 0.1
      ? Math.min(0.2, semanticDomain * 0.35)
      : deterministicDomain * 0.45 + semanticDomain * 0.55;
  const deterministicReq = allRequirementText
    ? keywordMatchRatio([...capabilities, ...certifications], allRequirementText)
    : 0;
  const reqCoverage = allRequirementText
    ? Math.max(deterministicReq, domain * 0.5)
    : deterministicReq;
  const locationEligibility = getLocationEligibility(company, {
    ...tenderInput,
    structuredLocation: tenderInput.structuredLocation ?? structured.hard_facts.location,
  });
  const regional = locationEligibility.status === "match"
    ? 1
    : locationEligibility.status === "tender_location_unknown" && tenderInput.allowUnknownTenderLocation
      ? 0.35
      : 0;
  const size = sizeMatch(company.team_size, matchDocument.scope);

  const locationBlocked = locationEligibility.status === "mismatch"
    || locationEligibility.status === "company_location_unknown"
    || (locationEligibility.status === "tender_location_unknown" && !tenderInput.allowUnknownTenderLocation);
  const fit = locationBlocked || domainBlocked
    ? 0
    : clamp((domain * 0.4 + reqCoverage * 0.35 + regional * 0.15 + size * 0.1) * 100);
  const complexity = complexityScore(structured);
  const effort = clamp(complexity * 100);
  const winProbability = locationBlocked || domainBlocked
    ? 0
    : clamp(fit * 0.7 + (100 - effort) * 0.2 + reqCoverage * 10);

  // Kill-switch: trigger if mandatory documents exist OR participation requirements exist
  // AND the company doesn't meet the threshold. This catches real Eignungskriterien.
  const hasHardRequirements =
    structured.decision_relevant.mandatory_documents.length > 0 ||
    participationReqs.length > 0;
  const killSwitch = locationBlocked || domainBlocked || (hasHardRequirements && reqCoverage < 0.45);

  return {
    fit: Number(fit.toFixed(2)),
    win_probability: Number(winProbability.toFixed(2)),
    effort: Number(effort.toFixed(2)),
    requirement_coverage: Number(reqCoverage.toFixed(2)),
    kill_switch: killSwitch,
    details: {
      domain_match: Number(domain.toFixed(2)),
      requirement_coverage: Number(reqCoverage.toFixed(2)),
      region_match: Number(regional.toFixed(2)),
      size_match: Number(size.toFixed(2)),
      complexity: Number(complexity.toFixed(2)),
      location_status: locationEligibility.status,
      location_reason: locationEligibility.reason,
      tender_bundesland: locationEligibility.tender.bundesland,
      tender_city: locationEligibility.tender.city,
      location_source: locationEligibility.tender.source,
      domain_status: domainEligibility.status,
      domain_reason: domainEligibility.reason,
      domain_source: domainEligibility.source,
    }
  };
};

interface TenderBatchItem {
  id: number;
  title: string;
  scope: string;
  description: string;
}

export async function llmBatchDomainMatch(
  capabilities: string[],
  industry: string | null,
  regions: string[],
  tenders: TenderBatchItem[],
): Promise<Map<number, number>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const result = new Map<number, number>();
  if (!apiKey || tenders.length === 0 || capabilities.length === 0) {
    return result;
  }

  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1", timeout: 120_000, maxRetries: 0 });
  const BATCH_SIZE = 50;

  for (let i = 0; i < tenders.length; i += BATCH_SIZE) {
    const batch = tenders.slice(i, i + BATCH_SIZE);

    const tenderList = batch.map((t) => {
      const parts = [t.title];
      if (t.scope) parts.push(t.scope.slice(0, 200));
      if (t.description && t.description !== t.scope) parts.push(t.description.slice(0, 200));
      return `[${t.id}] ${parts.join(" — ")}`;
    }).join("\n");

    const prompt = `Unternehmen:
- Leistungen: ${capabilities.join(", ")}
- Branche: ${industry ?? "unbekannt"}
- Regionen: ${regions.join(", ")}

Bewerte für jede Ausschreibung, wie gut die Leistungen des Unternehmens dazu passen.
Berücksichtige deutsche Komposita (z.B. "Sanierung" passt zu "Komplexsanierung"), Synonyme und semantische Zusammenhänge.
Ignoriere die Region — bewerte nur die fachliche Übereinstimmung.
0 = überhaupt keine Passung, 100 = perfekte Passung.

Ausschreibungen:
${tenderList}

Antworte NUR mit JSON: {"scores":[{"id":123,"score":45},...]}`;

    try {
      const content = await callLLM(client, {
        messages: [
          { role: "system", content: "Du bist ein Experte für das Matching von Unternehmensleistungen mit öffentlichen Ausschreibungen. Antworte nur mit JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const scoreArr = Array.isArray(parsed.scores) ? parsed.scores : (Array.isArray(parsed) ? parsed : []);
        for (const item of scoreArr) {
          if (typeof item.id === "number" && typeof item.score === "number") {
            result.set(item.id, Math.max(0, Math.min(100, item.score)) / 100);
          }
        }
      }
    } catch (error) {
      console.warn(`[llm-score] Batch ${i / BATCH_SIZE + 1} failed, using deterministic fallback:`, error instanceof Error ? error.message : error);
    }
  }

  return result;
}
