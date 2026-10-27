// Relevance gate: LLM budget is only spent on tenders a fullstack developer
// could apply to (software development, IT, ... in the broadest sense).
// The decision itself uses Perplexity's Decider model via the OpenRouter
// Decisions API — NOT chat completions: the request posts a `state` plus named
// `questions`, and answers carry calibrated probabilities (`noul` = P(yes)).
// Input pricing is ~$0.02/1M tokens with free output, so a decision on a
// tender's title + description costs a fraction of a cent.

export interface TenderRelevanceInput {
  title: string;
  url?: string | null;
  client?: string | null;
  procedure?: string | null;
  description?: string | null;
  scope?: string | null;
  category?: string | null;
  cpvCodes?: readonly (string | null | undefined)[];
}

export type TenderRelevanceSource = "gate-disabled" | "cpv-fastpath" | "decider" | "fallback-heuristic";

export interface TenderRelevanceDecision {
  relevant: boolean;
  /** P(yes) from the decider; null when decided without it. */
  probability: number | null;
  source: TenderRelevanceSource;
}

export const DEFAULT_RELEVANCE_THRESHOLD = 0.5;
export const DEFAULT_DECIDER_MODEL = "perplexity/pplx-decider-v1.2";

// Kill switch: "off" restores the old behavior (everything is LLM-eligible).
export const isRelevanceGateEnabled = (): boolean =>
  (process.env.TENDER_RELEVANCE_GATE ?? "on").trim().toLowerCase() !== "off";

export const relevanceThreshold = (): number => {
  const parsed = Number(process.env.TENDER_RELEVANCE_THRESHOLD ?? DEFAULT_RELEVANCE_THRESHOLD);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_RELEVANCE_THRESHOLD;
};

const deciderModel = (): string => process.env.DECIDER_MODEL?.trim() || DEFAULT_DECIDER_MODEL;

// Mirrors PUBLIC_IT_CPV_PATTERN / PUBLIC_IT_TEXT_PATTERN in
// lib/public-tender-scraper.ts; kept local so this module stays dependency-free.
const IT_CPV_PATTERN = /^(?:48|72)\d{6}(?:-\d)?$/;
const IT_TEXT_PATTERN = /\b(?:citrix|software(?:lizenz(?:en)?)?|microsoft|vmware|cloud(?:-?migration)?|cybersecurity|informationstechnologie|informationstechnik|it[- ]?dienstleistungen?|it[- ]?projekt|programmierung|softwareentwicklung|anwendungsentwicklung|webentwicklung|web(?:-?applikation| application)|app(?:-?entwicklung|entwicklung)|datenbank|rechenzentrum|netzwerk|hosting|saas|devops|erp|crm|cms|sap|oracle|cisco|uipath|e[- ]?government|digitalisierung)\b/i;

const hasItCpvCode = (cpvCodes: readonly (string | null | undefined)[] = []): boolean =>
  cpvCodes.some((code) => typeof code === "string" && IT_CPV_PATTERN.test(code.trim()));

const heuristicRelevant = (input: TenderRelevanceInput): boolean => {
  if (input.category === "IT-Dienstleistungen") return true;
  const context = [input.title, input.client, input.scope, input.description]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
  return IT_TEXT_PATTERN.test(context);
};

const MAX_STATE_DESCRIPTION_CHARS = 6000;

const buildDeciderState = (input: TenderRelevanceInput): Record<string, string> => {
  const description = [input.description, input.scope]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n\n")
    .slice(0, MAX_STATE_DESCRIPTION_CHARS);
  const state: Record<string, string> = {
    title: input.title.slice(0, 500),
    beschreibung: description,
  };
  if (input.url) state.url = input.url;
  if (input.client) state.auftraggeber = input.client.slice(0, 300);
  if (input.procedure) state.verfahren = input.procedure.slice(0, 200);
  const cpv = (input.cpvCodes ?? []).filter((code): code is string => typeof code === "string" && code.trim().length > 0);
  if (cpv.length > 0) state.cpv_codes = cpv.join(", ");
  return state;
};

const YES_CRITERIA = "Die Ausschreibung betrifft Softwareentwicklung, IT-Dienstleistungen, Web-/App-Entwicklung, IT-Infrastruktur, Datenverarbeitung, Digitalisierung oder eine vergleichbare technische Leistung — etwas, auf das sich ein Fullstack-Softwareentwickler im weitesten Sinne bewerben könnte.";
const NO_CRITERIA = "Die Ausschreibung betrifft überwiegend andere Leistungen (z. B. Bauarbeiten, Reinigung, Gartenpflege, Facility Management, Catering, Lieferungen, Mietgeräte), auch wenn IT darin nur am Rande vorkommt.";

interface DecisionsResponse {
  answers?: { it_relevant?: { type?: string; noul?: number } };
}

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const DECIDER_TIMEOUT_MS = 20_000;
const DECIDER_ATTEMPTS = 2;

// Returns P(yes), or null when the decider is unreachable/invalid so callers
// can fall back to the deterministic heuristic.
const callDeciderNoul = async (state: Record<string, string>): Promise<number | null> => {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) return null;
  const body = JSON.stringify({
    model: deciderModel(),
    state,
    questions: {
      it_relevant: { type: "noul", criteria: { true: YES_CRITERIA, false: NO_CRITERIA } },
    },
  });

  for (let attempt = 1; attempt <= DECIDER_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(DECISIONS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(DECIDER_TIMEOUT_MS),
      });
      if (!response.ok) {
        console.warn(`[tender-relevance] Decider HTTP ${response.status} (Versuch ${attempt}/${DECIDER_ATTEMPTS})`);
        if (response.status >= 500 && attempt < DECIDER_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        return null;
      }
      const payload = await response.json() as DecisionsResponse;
      const noul = payload.answers?.it_relevant?.noul;
      return typeof noul === "number" && noul >= 0 && noul <= 1 ? noul : null;
    } catch (error) {
      console.warn(`[tender-relevance] Decider-Aufruf fehlgeschlagen (Versuch ${attempt}/${DECIDER_ATTEMPTS}):`, error);
      if (attempt >= DECIDER_ATTEMPTS) return null;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return null;
};

// Decisions repeat within a scrape run (re-scraped pages, listing + detail of
// the same tender), so identical states are answered from this cache. Entries
// store P(yes); the process lifetime bounds staleness well enough.
const CACHE_LIMIT = 4096;
const decisionCache = new Map<string, number>();

const cacheKeyForState = (state: Record<string, string>): string => {
  const joined = `${state.title}\u0000${state.url ?? ""}\u0000${state.beschreibung}`;
  let hash = 0;
  for (let index = 0; index < joined.length; index += 1) {
    hash = (Math.imul(31, hash) + joined.charCodeAt(index)) | 0;
  }
  return `${hash}:${joined.length}`;
};

export const resetTenderRelevanceCacheForTests = (): void => {
  decisionCache.clear();
};

/**
 * Decide whether a tender may consume LLM budget. Order: kill switch,
 * IT-CPV fast path (no network), decider (cached), deterministic heuristic.
 * The heuristic also covers decider outages: it never blocks on the network
 * and errs on the permissive side so relevant tenders are not lost.
 */
export async function classifyTenderRelevance(input: TenderRelevanceInput): Promise<TenderRelevanceDecision> {
  if (!isRelevanceGateEnabled()) {
    return { relevant: true, probability: null, source: "gate-disabled" };
  }
  if (hasItCpvCode(input.cpvCodes)) {
    return { relevant: true, probability: null, source: "cpv-fastpath" };
  }

  const state = buildDeciderState(input);
  const cacheKey = cacheKeyForState(state);
  const cached = decisionCache.get(cacheKey);
  if (cached !== undefined) {
    return { relevant: cached >= relevanceThreshold(), probability: cached, source: "decider" };
  }

  const probability = await callDeciderNoul(state);
  if (probability !== null) {
    if (decisionCache.size >= CACHE_LIMIT) decisionCache.clear();
    decisionCache.set(cacheKey, probability);
    return { relevant: probability >= relevanceThreshold(), probability, source: "decider" };
  }

  return { relevant: heuristicRelevant(input), probability: null, source: "fallback-heuristic" };
}
