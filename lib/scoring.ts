import type { StructuredData } from "@/lib/structurer";
import { deriveBundesland } from "@/lib/bundesland";
import OpenAI from "openai";

const WORD_PATTERN = /[\p{L}\p{N}-]{3,}/gu;

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

const CAPABILITY_GROUPS: Record<string, string[]> = {
  green_outdoor: ["garten", "galabau", "landschaft", "gruen", "grunanlage", "aussenanlage", "pflege", "winterdienst", "pflaster", "zaun", "einfriedung", "teich", "spielplatz"],
  construction: ["bau", "hochbau", "tiefbau", "strassenbau", "sanierung", "rohbau", "abbruch", "fassade", "dach", "beton", "erdarbeiten"],
  cleaning: ["reinigung", "glasreinigung", "unterhaltsreinigung", "gebaeudereinigung"],
  transport: ["transport", "logistik", "fuhrpark", "abfall", "entsorgung"],
  wood: ["brennholz", "mischholz", "forst", "holzhandel"],
  it: ["software", "it", "digital", "programmierung", "webentwicklung", "datenbank", "cyber", "antivirus"],
  medical: ["medizin", "arznei", "pharma", "krankenhaus", "pflegeleistung"],
};

const groupsForText = (text: string): Set<string> => {
  const tokens = tokenize(text);
  const groups = new Set<string>();
  for (const [group, terms] of Object.entries(CAPABILITY_GROUPS)) {
    if (terms.some((term) => [...tokens].some((token) =>
      token === term ||
      (term.length >= 4 && token.includes(term)) ||
      (term.length >= 4 && term.includes(token))
    ))) {
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

const COUNTRY_NAMES = new Set(["deutschland", "germany", "germania", "deutsche", "german"]);

const regionMatch = (regions: string[], location: string | null): number => {
  if (regions.length === 0) {
    return 0.15;
  }

  const hasOnlyCountry = regions.every((r) => COUNTRY_NAMES.has(r.toLowerCase().trim()));
  if (hasOnlyCountry) {
    return 0.2;
  }

  if (!location) {
    return 0.15;
  }

  const locationBundesland = deriveBundesland(location);
  if (locationBundesland) {
    const specificRegions = regions.filter((r) => !COUNTRY_NAMES.has(r.toLowerCase().trim()));
    for (const region of specificRegions) {
      if (region.toLowerCase().trim() === locationBundesland.toLowerCase()) {
        return 1;
      }
    }
    for (const region of specificRegions) {
      if (locationBundesland.toLowerCase().includes(region.toLowerCase()) || region.toLowerCase().includes(locationBundesland.toLowerCase())) {
        return 0.8;
      }
    }
    if (specificRegions.some((r) => location.toLowerCase().includes(r.toLowerCase()))) {
      return 0.9;
    }
    return 0;
  }

  const lower = location.toLowerCase();
  return regions.some((region) => lower.includes(region.toLowerCase())) ? 0.9 : 0;
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
  };
}

export const computeScores = (
  tenderTitle: string,
  structured: StructuredData,
  company: CompanyRow,
  llmDomainScore?: number,
): ScoreResult => {
  const capabilities = parseList(company.capabilities_json);
  const certifications = parseList(company.certifications_json);
  const regions = parseList(company.regions_json);

  const scopeText = structured.decision_relevant.scope.join(" ");
  const requirementLines = [
    ...structured.decision_relevant.requirements,
    ...structured.decision_relevant.mandatory_documents
  ].join(" ");

  // Also include LLM-extracted participation_requirements for richer coverage assessment
  const participationReqs = structured.procurement?.participation_requirements ?? [];
  const allRequirementText = [requirementLines, ...participationReqs].join(" ");

  // Portal pages often append navigation and unrelated tender titles to summary.
  // Keep deterministic domain matching focused on the tender itself.
  const matchText = `${tenderTitle} ${scopeText}`;
  const deterministicDomain = capabilityMatch(capabilities, company.industry ?? null, matchText);
  const semanticDomain = llmDomainScore;
  // LLM output is useful for synonyms, but it must not override a clear
  // deterministic mismatch (e.g. IT or medicine for a landscaping company).
  const domain = semanticDomain === undefined
    ? deterministicDomain
    : deterministicDomain < 0.1
      ? Math.min(0.2, semanticDomain * 0.35)
      : deterministicDomain * 0.45 + semanticDomain * 0.55;
  const deterministicReq = allRequirementText
    ? keywordMatchRatio([...capabilities, ...certifications], allRequirementText)
    : Math.min(1, domain * 0.75);
  const reqCoverage = allRequirementText
    ? Math.max(deterministicReq, domain * 0.5)
    : deterministicReq;
  const regional = regionMatch(regions, structured.hard_facts.location);
  const size = sizeMatch(company.team_size, scopeText);

  const fit = clamp((domain * 0.4 + reqCoverage * 0.35 + regional * 0.15 + size * 0.1) * 100);
  const complexity = complexityScore(structured);
  const effort = clamp(complexity * 100);
  const winProbability = clamp(fit * 0.7 + (100 - effort) * 0.2 + reqCoverage * 10);

  // Kill-switch: trigger if mandatory documents exist OR participation requirements exist
  // AND the company doesn't meet the threshold. This catches real Eignungskriterien.
  const hasHardRequirements =
    structured.decision_relevant.mandatory_documents.length > 0 ||
    participationReqs.length > 0;
  const killSwitch = hasHardRequirements && reqCoverage < 0.45;

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
      complexity: Number(complexity.toFixed(2))
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

  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
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
      const response = await client.chat.completions.create({
        model: "poolside/laguna-xs-2.1",
        messages: [
          { role: "system", content: "Du bist ein Experte für das Matching von Unternehmensleistungen mit öffentlichen Ausschreibungen. Antworte nur mit JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content ?? "";
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
