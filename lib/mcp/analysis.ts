import { z } from "zod";
import { resolveTenderDeadlineFilter, TENDER_DEADLINE_FILTERS } from "@/lib/date-utils";
import type { McpRequestAccess } from "@/lib/mcp/auth";
import {
  categoryInput,
  dateInput,
  mapMcpTenders,
  MCP_SEARCH_SCOPE_NOTE,
  reserveMcpQuota,
  smallVendorFitMinInput,
  type McpQuota,
  type McpTender,
} from "@/lib/mcp/tenders";
import { searchTenders } from "@/lib/meilisearch";
import {
  evaluateTenderFit,
  type BarrierCheck,
  type CapacityRuleSummary,
  type MatchProfile,
  type TenderFitVerdict,
  type TenderMatchResult,
} from "@/lib/profile-match";
import { extractTenderCriteria, type CriterionFinding } from "@/lib/tender-criteria";
import { loadTenderCriteriaSources } from "@/lib/tender-criteria-sources";
import { loadTenderDocumentText, loadTenderDossier } from "@/lib/tender-dossier-loader";

const MEILI_PAGE_SIZE = 30;
const MATCH_CONCURRENCY = 4;
const MATCH_TIME_BUDGET_MS = 60_000;
const VERDICT_ORDER: Record<TenderFitVerdict, number> = { no_barrier_found: 0, unclear: 1, barrier: 2 };

const bidderSchema = z.object({
  legalForm: z.string().trim().max(100).optional(),
  foundedOn: dateInput,
  registeredInGermany: z.boolean().optional(),
  revenueByYearEur: z.record(z.string(), z.number()).optional(),
  financialStatementsYears: z.number().int().min(0).optional(),
  referenceCount: z.number().int().min(0).optional(),
  certificates: z.array(z.string().trim().max(200)).max(50).optional(),
  liabilityInsuranceEur: z.number().min(0).optional(),
  employees: z.number().int().min(0).optional(),
  inGermany: z.boolean().optional(),
  germanLanguage: z.boolean().optional(),
  available24x7: z.boolean().optional(),
});

export const matchProfileSchema = z.object({
  bidder: bidderSchema,
  partner: bidderSchema.extend({
    name: z.string().trim().min(1).max(200),
    roles: z.array(z.enum(["subcontractor", "capacity_provider", "consortium_member"])).min(1).max(3).optional(),
  }).optional(),
  asOf: dateInput,
});

export const matchTendersInputSchema = z.object({
  query: z.string().trim().max(200).default(""),
  searchQueries: z.array(z.string().trim().min(1).max(200)).max(7).default([]),
  bundesland: z.string().trim().max(100).optional(),
  category: categoryInput,
  smallVendorFitMin: smallVendorFitMinInput,
  deadlineFilter: z.enum(TENDER_DEADLINE_FILTERS).default("all"),
  candidatePool: z.number().int().min(1).max(100).default(40),
  limit: z.number().int().min(1).max(10).default(5),
  profile: matchProfileSchema,
});

export const tenderDossierInputSchema = z.object({
  tenderId: z.number().int().min(1),
  profile: matchProfileSchema.optional(),
});

export const documentTextInputSchema = z.object({
  documentId: z.number().int().min(1),
  page: z.number().int().min(1).optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(12_000).default(12_000),
});

export type MatchTendersInput = z.infer<typeof matchTendersInputSchema>;
export type TenderDossierInput = z.infer<typeof tenderDossierInputSchema>;
export type DocumentTextInput = z.infer<typeof documentTextInputSchema>;

export interface McpMatchEvidence {
  documentId: number | null;
  filename: string | null;
  page: number | null;
  quote: string;
}

export interface McpMatchCheck {
  kind: BarrierCheck["kind"];
  status: BarrierCheck["status"];
  reason?: string;
  evidence?: McpMatchEvidence[];
}

export interface McpCapacityRule {
  kind: CapacityRuleSummary["kind"];
  rule: CapacityRuleSummary["rule"];
  evidence: McpMatchEvidence[];
}

export interface McpMatchItem
  extends Pick<
    McpTender,
    | "id"
    | "title"
    | "client"
    | "bundesland"
    | "city"
    | "category"
    | "deadlineISO"
    | "sourceUrl"
    | "source"
    | "smallVendorFit"
    | "contractValueMin"
    | "contractValueMax"
    | "procedureType"
    | "lowEntryBarrier"
    | "remoteFriendly"
    | "isItDomain"
    | "isLot"
  > {
  descriptionPreview: string;
  verdict: TenderFitVerdict;
  barrierCount: number;
  unclearCount: number;
  notFoundCount: number;
  documentsSearched: number;
  checks: McpMatchCheck[];
  capacityRules: McpCapacityRule[];
  limitations: string[];
}

export type MatchSearchStatus = "no_candidates" | "evaluation_failed" | "partial" | "completed";

export interface McpMatchSearchQuery {
  query: string | null;
  estimatedTotalHits: number | null;
  pagesRead: number;
  candidatesAdded: number;
  hasMore: boolean | null;
}

export interface McpMatchSearchDiagnostics {
  status: MatchSearchStatus;
  scopeNote: string;
  category: string | null;
  bundesland: string | null;
  deadlineFilter: MatchTendersInput["deadlineFilter"];
  candidatePoolRequested: number;
  candidatePoolLimitReached: boolean;
  candidatesFound: number;
  candidatesEvaluated: number;
  candidatesFailed: number;
  timedOut: boolean;
  queries: McpMatchSearchQuery[];
}

export interface McpMatchResult {
  items: McpMatchItem[];
  evaluated: number;
  pool: number;
  searchDiagnostics: McpMatchSearchDiagnostics;
  assessmentScope: string;
  /** Concrete next step for the calling agent when the run is incomplete. */
  retryHint: string | null;
  quota: McpQuota;
  notFoundNote: string;
  limitations: string[];
}

export function resolveMatchSearchQueries(
  input: Pick<MatchTendersInput, "query" | "searchQueries">,
): string[] {
  const queries = [...new Set([input.query, ...input.searchQueries].map((query) => query.trim()).filter(Boolean))];
  return queries.length > 0 ? queries : [""];
}

export function getMatchSearchStatus(
  candidatesFound: number,
  candidatesEvaluated: number,
  candidatesFailed: number,
  timedOut: boolean,
): MatchSearchStatus {
  if (candidatesFound === 0) return "no_candidates";
  if (candidatesEvaluated === 0 && candidatesFailed > 0) return "evaluation_failed";
  if (timedOut || candidatesFailed > 0 || candidatesEvaluated + candidatesFailed < candidatesFound) return "partial";
  return "completed";
}

/**
 * Turns an incomplete run into one concrete instruction instead of a bare
 * status: the calling agent should never report "partial" without knowing
 * what to do next.
 */
export function buildMatchRetryHint(
  status: MatchSearchStatus,
  candidatesEvaluated: number,
  candidatesFound: number,
): string | null {
  switch (status) {
    case "partial":
      if (candidatesEvaluated === 0) {
        return `Zeitbudget verbraucht, bevor ein Kandidat bewertet werden konnte (0/${candidatesFound}) – Portale antworten langsam oder sind blockiert. Prüfe zuerst EINEN Kandidaten per get_tender_dossier, um eine Portal-Blockade zu isolieren, und wiederhole dann den Lauf mit kleinerem candidatePool (z. B. 8).`;
      }
      return `Unvollständig geprüft: ${candidatesEvaluated} von ${candidatesFound} Kandidaten. Prüfe die verbleibenden Top-Kandidaten einzeln per get_tender_dossier oder wiederhole den Lauf mit engeren Filtern – berichte "unvollständig geprüft (x von y)", nie "kein Fit".`;
    case "evaluation_failed":
      return `Kein Kandidat bewertbar (${candidatesFound} gefunden, Quelldaten nicht lesbar) – Portalzugriffe schlagen fehl. Nenne je Kandidat Portal-URL und spieglé Quellen (deutsche-eVergabe, TED), statt den Lauf als ergebnislos zu melden.`;
    case "no_candidates":
      return "Keine Kandidaten für diese Filter. Wiederhole den Lauf ohne Kategorie-Filter und mit breiteren Suchphrasen, bevor du 'keine Kandidaten' berichtest.";
    case "completed":
      return null;
  }
}

interface CandidateSearchState {
  query: string;
  nextPage: number;
  estimatedTotalHits: number | null;
  pagesRead: number;
  candidatesAdded: number;
  exhausted: boolean;
  pending: McpTender[];
}

interface CollectedCandidates {
  candidates: McpTender[];
  queries: McpMatchSearchQuery[];
}

async function collectCandidates(input: MatchTendersInput): Promise<CollectedCandidates> {
  const candidates = new Map<number, McpTender>();
  const states: CandidateSearchState[] = resolveMatchSearchQueries(input).map((query) => ({
    query,
    nextPage: 1,
    estimatedTotalHits: null,
    pagesRead: 0,
    candidatesAdded: 0,
    exhausted: false,
    pending: [],
  }));
  const deadlineBounds = resolveTenderDeadlineFilter(input.deadlineFilter);

  const loadNextPage = async (state: CandidateSearchState): Promise<void> => {
    const result = await searchTenders({
      query: state.query,
      bundesland: input.bundesland ?? null,
      category: input.category ?? null,
      smallVendorFitMin: input.smallVendorFitMin,
      sort: "smallVendorFit",
      limit: MEILI_PAGE_SIZE,
      page: state.nextPage,
      ...deadlineBounds,
    });
    state.estimatedTotalHits = result.estimatedTotalHits;
    state.pagesRead += 1;
    state.nextPage += 1;
    state.pending.push(...(await mapMcpTenders(result.hits)));
    state.exhausted = result.hits.length === 0 || state.pagesRead * MEILI_PAGE_SIZE >= result.estimatedTotalHits;
  };

  while (candidates.size < input.candidatePool && states.some((state) => state.pending.length > 0 || !state.exhausted)) {
    let progressed = false;
    for (const state of states) {
      if (candidates.size >= input.candidatePool) break;
      if (state.pending.length === 0 && !state.exhausted) await loadNextPage(state);
      const tender = state.pending.shift();
      if (!tender) continue;
      progressed = true;
      if (!candidates.has(tender.id)) {
        candidates.set(tender.id, tender);
        state.candidatesAdded += 1;
      }
    }
    if (!progressed) break;
  }

  return {
    candidates: [...candidates.values()],
    queries: states.map((state) => ({
      query: state.query || null,
      estimatedTotalHits: state.estimatedTotalHits,
      pagesRead: state.pagesRead,
      candidatesAdded: state.candidatesAdded,
      hasMore: state.pagesRead === 0 ? null : state.pending.length > 0 || !state.exhausted,
    })),
  };
}

function serializeEvidence(findings: CriterionFinding[]): McpMatchEvidence[] {
  return findings.map((finding) => ({
    documentId: finding.source.documentId,
    filename: finding.source.filename,
    page: finding.source.page,
    quote: finding.quote,
  }));
}

function serializeCheck(check: BarrierCheck): McpMatchCheck {
  if (check.status === "not_found") return { kind: check.kind, status: check.status };

  return {
    kind: check.kind,
    status: check.status,
    reason: check.reason,
    evidence: serializeEvidence(check.evidence),
  };
}

function toMatchItem(tender: McpTender, fit: TenderMatchResult): McpMatchItem {
  return {
    id: tender.id,
    title: tender.title,
    client: tender.client,
    bundesland: tender.bundesland,
    city: tender.city,
    category: tender.category,
    deadlineISO: tender.deadlineISO,
    sourceUrl: tender.sourceUrl,
    source: tender.source,
    descriptionPreview: tender.description.slice(0, 800),
    smallVendorFit: tender.smallVendorFit,
    contractValueMin: tender.contractValueMin,
    contractValueMax: tender.contractValueMax,
    procedureType: tender.procedureType,
    lowEntryBarrier: tender.lowEntryBarrier,
    remoteFriendly: tender.remoteFriendly,
    isItDomain: tender.isItDomain,
    isLot: tender.isLot,
    verdict: fit.verdict,
    barrierCount: fit.barrierCount,
    unclearCount: fit.unclearCount,
    notFoundCount: fit.notFoundCount,
    documentsSearched: fit.documentsSearched,
    checks: fit.checks.map(serializeCheck),
    capacityRules: fit.capacityRules.map((rule) => ({ kind: rule.kind, rule: rule.rule, evidence: serializeEvidence(rule.evidence) })),
    limitations: fit.limitations,
  };
}

async function evaluateCandidates(
  candidates: McpTender[],
  profile: MatchProfile,
  deadlineAt: number,
): Promise<{ items: McpMatchItem[]; failures: string[]; timedOut: boolean }> {
  const items: McpMatchItem[] = [];
  const failures: string[] = [];
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < candidates.length && Date.now() < deadlineAt) {
      const tender = candidates[nextIndex];
      nextIndex += 1;
      try {
        const criteria = extractTenderCriteria(await loadTenderCriteriaSources(tender.id));
        items.push(toMatchItem(tender, evaluateTenderFit(criteria, profile)));
      } catch (error) {
        failures.push(`Treffer #${tender.id} konnte nicht bewertet werden (Quelldaten nicht lesbar).`);
        console.error("match_tenders evaluation failed", tender.id, error);
      }
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, deadlineAt - Date.now()));
  });
  const workers = Array.from({ length: Math.min(MATCH_CONCURRENCY, candidates.length) }, worker);
  await Promise.race([Promise.all(workers), budget]);
  clearTimeout(timer);

  return {
    items: [...items],
    failures: [...failures],
    timedOut: items.length + failures.length < candidates.length,
  };
}

function compareDeadlines(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

export function rankMatchItems<T extends Pick<McpMatchItem, "verdict" | "smallVendorFit" | "deadlineISO">>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]
      || (b.smallVendorFit ?? -1) - (a.smallVendorFit ?? -1)
      || compareDeadlines(a.deadlineISO, b.deadlineISO),
  );
}

export async function matchTendersForMcp(input: MatchTendersInput, access: McpRequestAccess): Promise<McpMatchResult> {
  const deadlineAt = Date.now() + MATCH_TIME_BUDGET_MS;
  const normalized = matchTendersInputSchema.parse(input);
  const { candidates, queries } = await collectCandidates(normalized);
  const { items, failures, timedOut } = await evaluateCandidates(candidates, normalized.profile, deadlineAt);
  const ranked = rankMatchItems(items).slice(0, normalized.limit);
  const searchStatus = getMatchSearchStatus(candidates.length, items.length, failures.length, timedOut);
  const assessmentScope = "Die Bewertung prüft nur erkannte Muss-Eignungskriterien in den verfügbaren Unterlagen. Sie bestätigt weder technischen Leistungsfit noch Wirtschaftlichkeit, Datenstandort, rechtliche Zulässigkeit der Partnerrolle oder einen Zuschlag. no_barrier_found ist keine Bewerbungsempfehlung.";

  return {
    items: ranked,
    evaluated: items.length,
    pool: candidates.length,
    searchDiagnostics: {
      status: searchStatus,
      scopeNote: MCP_SEARCH_SCOPE_NOTE,
      category: normalized.category ?? null,
      bundesland: normalized.bundesland ?? null,
      deadlineFilter: normalized.deadlineFilter,
      candidatePoolRequested: normalized.candidatePool,
      candidatePoolLimitReached: candidates.length >= normalized.candidatePool,
      candidatesFound: candidates.length,
      candidatesEvaluated: items.length,
      candidatesFailed: failures.length,
      timedOut,
      queries,
    },
    assessmentScope,
    retryHint: buildMatchRetryHint(searchStatus, items.length, candidates.length),
    quota: await reserveMcpQuota(ranked.length, access.unlimitedQuota),
    notFoundNote: "not_found bedeutet: in den je Treffer genannten Dokumenten (documentsSearched) nicht gefunden – nicht 'nicht erforderlich'.",
    limitations: [
      MCP_SEARCH_SCOPE_NOTE,
      assessmentScope,
      ...(timedOut ? ["Zeitbudget erreicht: nur die bis dahin bewerteten Kandidaten wurden gerankt."] : []),
      ...failures,
    ],
  };
}

export async function getTenderDossierForMcp(input: TenderDossierInput, access: McpRequestAccess) {
  const normalized = tenderDossierInputSchema.parse(input);
  const dossier = await loadTenderDossier(normalized.tenderId, { profile: normalized.profile });
  if (!dossier) throw new Error("Ausschreibung nicht gefunden");

  return { dossier, quota: await reserveMcpQuota(1, access.unlimitedQuota) };
}

export async function getDocumentTextForMcp(input: DocumentTextInput, access: McpRequestAccess) {
  const normalized = documentTextInputSchema.parse(input);
  const document = await loadTenderDocumentText(normalized.documentId, {
    page: normalized.page,
    offset: normalized.offset,
    limit: normalized.limit,
  });
  if (!document) throw new Error("Dokument nicht gefunden");

  return { document, quota: await reserveMcpQuota(1, access.unlimitedQuota) };
}
