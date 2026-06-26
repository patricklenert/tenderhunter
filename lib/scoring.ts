import type { StructuredData } from "@/lib/structurer";
import { deriveBundesland } from "@/lib/bundesland";

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
  const tokens = (text.match(WORD_PATTERN) ?? []).map((item) => item.toLowerCase());
  return new Set(tokens.filter((t) => !STOP_WORDS.has(t) && t.length >= 4));
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
  let matched = 0;
  for (const keyword of keywords) {
    const keyTokens = tokenize(keyword);
    if (keyTokens.size === 0) {
      continue;
    }
    const allTokensFound = [...keyTokens].every((token) => tokens.has(token));
    if (allTokensFound) {
      matched += 1;
    }
  }
  return matched / Math.max(1, keywords.length);
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

export const computeScores = (tenderTitle: string, structured: StructuredData, company: CompanyRow): ScoreResult => {
  const capabilities = parseList(company.capabilities_json);
  const certifications = parseList(company.certifications_json);
  const regions = parseList(company.regions_json);

  const scopeText = structured.decision_relevant.scope.join(" ");
  const requirementLines = [
    ...structured.decision_relevant.requirements,
    ...structured.decision_relevant.mandatory_documents
  ].join(" ");

  const domain = keywordMatchRatio(capabilities, `${tenderTitle} ${scopeText}`);
  const reqCoverage = keywordMatchRatio([...capabilities, ...certifications], requirementLines);
  const regional = regionMatch(regions, structured.hard_facts.location);
  const size = sizeMatch(company.team_size, scopeText);

  const fit = clamp((domain * 0.35 + reqCoverage * 0.4 + regional * 0.15 + size * 0.1) * 100);
  const complexity = complexityScore(structured);
  const effort = clamp(complexity * 100);
  const winProbability = clamp(fit * 0.7 + (100 - effort) * 0.2 + reqCoverage * 10);
  const killSwitch = structured.decision_relevant.mandatory_documents.length > 0 && reqCoverage < 0.45;

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
