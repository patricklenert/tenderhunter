import { z } from "zod";
import { resolveTenderDeadlineFilter, TENDER_DEADLINE_FILTERS } from "@/lib/date-utils";
import type { McpRequestAccess } from "@/lib/mcp/auth";
import {
  categoryInput,
  dateInput,
  mapMcpTenders,
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
const MATCH_TIME_BUDGET_MS = 25_000;
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
  partner: bidderSchema.extend({ name: z.string().trim().min(1).max(200) }).optional(),
  asOf: dateInput,
});

export const matchTendersInputSchema = z.object({
  query: z.string().trim().max(200).default(""),
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
  extends Pick<McpTender, "id" | "title" | "client" | "bundesland" | "city" | "deadlineISO" | "sourceUrl" | "source" | "smallVendorFit"> {
  verdict: TenderFitVerdict;
  barrierCount: number;
  unclearCount: number;
  notFoundCount: number;
  documentsSearched: number;
  checks: McpMatchCheck[];
  capacityRules: McpCapacityRule[];
  limitations: string[];
}

export interface McpMatchResult {
  items: McpMatchItem[];
  evaluated: number;
  pool: number;
  quota: McpQuota;
  notFoundNote: string;
  limitations: string[];
}

async function collectCandidates(input: MatchTendersInput): Promise<McpTender[]> {
  const candidates: McpTender[] = [];
  const deadlineBounds = resolveTenderDeadlineFilter(input.deadlineFilter);

  for (let page = 1; candidates.length < input.candidatePool; page += 1) {
    const result = await searchTenders({
      query: input.query,
      bundesland: input.bundesland ?? null,
      category: input.category ?? null,
      smallVendorFitMin: input.smallVendorFitMin,
      sort: "smallVendorFit",
      limit: MEILI_PAGE_SIZE,
      page,
      ...deadlineBounds,
    });
    if (result.hits.length === 0) break;
    candidates.push(...(await mapMcpTenders(result.hits)));
    if (page * MEILI_PAGE_SIZE >= result.estimatedTotalHits) break;
  }

  return candidates.slice(0, input.candidatePool);
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
    deadlineISO: tender.deadlineISO,
    sourceUrl: tender.sourceUrl,
    source: tender.source,
    smallVendorFit: tender.smallVendorFit,
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
  const candidates = await collectCandidates(normalized);
  const { items, failures, timedOut } = await evaluateCandidates(candidates, normalized.profile, deadlineAt);
  const ranked = rankMatchItems(items).slice(0, normalized.limit);

  return {
    items: ranked,
    evaluated: items.length,
    pool: candidates.length,
    quota: await reserveMcpQuota(ranked.length, access.unlimitedQuota),
    notFoundNote: "not_found bedeutet: in den je Treffer genannten Dokumenten (documentsSearched) nicht gefunden – nicht 'nicht erforderlich'.",
    limitations: timedOut
      ? ["Zeitbudget erreicht: nur die bis dahin bewerteten Kandidaten wurden gerankt.", ...failures]
      : failures,
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
