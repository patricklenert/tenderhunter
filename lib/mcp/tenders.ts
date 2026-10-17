import { inArray } from "drizzle-orm";
import { z } from "zod";
import { formatDeadlineDE, getGermanLastThreeDaysUnixRange, resolveTenderDeadlineFilter, TENDER_DEADLINE_FILTERS } from "@/lib/date-utils";
import { db } from "@/lib/db";
import { searchTenders } from "@/lib/meilisearch";
import { normalizePublicClient, pickValidatedPublicCandidate, pickValidatedPublicLocationForTender, pickValidatedPublicProcedure } from "@/lib/public-content-quality";
import { pickPublicDescription } from "@/lib/public-tender-scraper";
import { sanitizeTenderUrl } from "@/lib/date-utils";
import { tenders } from "@/lib/schema";
import { CATEGORY_LABELS, SLUG_TO_CATEGORY } from "@/lib/categories";
import { getMcpDailyQuota, getUtcQuotaWindow, McpQuotaExceededError, reserveMcpTenderQuota, type McpQuotaState } from "@/lib/mcp/quota";

export const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
export const smallVendorFitMinInput = z.number().int().min(0).max(100).optional();
const CATEGORY_ACCEPTED: Record<string, string> = Object.fromEntries([
  ...Object.entries(CATEGORY_LABELS).map(([label, value]) => [label.toLowerCase(), value] as const),
  ...Object.entries(SLUG_TO_CATEGORY).map(([slug, category]) => [slug.toLowerCase(), category] as const),
]);

const CATEGORY_VALUES = Object.values(CATEGORY_LABELS);

export const categoryInput = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return CATEGORY_ACCEPTED[trimmed.toLowerCase()] ?? trimmed;
  },
  z
    .string()
    .max(100)
    .refine(
      (value) => CATEGORY_VALUES.includes(value),
      { message: `Ungültige Kategorie. Gültige Werte: ${CATEGORY_VALUES.join(", ")}` },
    )
    .optional(),
);

export const mcpTenderSearchSchema = z.object({
  query: z.string().trim().max(200).default(""),
  bundesland: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  category: categoryInput,
  smallVendorFitMin: smallVendorFitMinInput,
  limit: z.number().int().min(1).max(30).default(10),
  page: z.number().int().min(1).max(1_000).default(1),
  todayNew: z.boolean().default(false),
  deadlineFilter: z.enum(TENDER_DEADLINE_FILTERS).default("all"),
  deadlineFrom: dateInput,
  deadlineTo: dateInput,
  sort: z.enum(["deadline", "newest", "smallVendorFit"]).default("deadline"),
});

export const MCP_SEARCH_SCOPE_NOTE =
  "Durchsucht nur qualifizierte Ausschreibungen im aktuellen Tenderhunter-Index. Bekannte Fristen sind nicht abgelaufen; Einträge ohne bekannte Frist können enthalten sein. Keine Vollständigkeitsgarantie für alle Vergabeportale.";

export type McpTenderSearchInput = z.infer<typeof mcpTenderSearchSchema>;

export interface McpTender {
  id: number;
  title: string;
  client: string;
  location: string;
  bundesland: string | null;
  city: string | null;
  category: string;
  description: string;
  deadline: string | null;
  deadlineISO: string | null;
  source: string;
  sourceUrl: string;
  slug: string | null;
  pdfCount: number;
  readinessStatus: string;
  contractValueMax: number | null;
  contractValueMin: number | null;
  smallVendorFit: number | null;
  lowEntryBarrier: boolean;
  remoteFriendly: boolean;
  isItDomain: boolean;
  isLot: boolean;
  procedureType: string | null;
  externalId: string | null;
}

export interface McpTenderSearchResult {
  items: McpTender[];
  total: number;
  returned: number;
  processingTimeMs: number;
  scopeNote: string;
  quota:
    | {
        limit: number;
        used: number;
        remaining: number;
        resetAt: string;
      }
    | {
        limit: null;
        used: null;
        remaining: null;
        resetAt: string;
        unlimited: true;
      };
}

export type McpQuota = McpTenderSearchResult["quota"];

type TenderSearchHit = Awaited<ReturnType<typeof searchTenders>>["hits"][number];

interface McpTenderDetails {
  procedureType: string | null;
  contractValueMin: number | null;
  externalId: string | null;
}

function serializeQuota(quota: McpQuotaState): McpQuota {
  return {
    limit: quota.limit,
    used: quota.used,
    remaining: quota.remaining,
    resetAt: quota.resetAt.toISOString(),
  };
}

function unlimitedQuotaState(): McpQuota {
  return {
    limit: null,
    used: null,
    remaining: null,
    resetAt: getUtcQuotaWindow().resetAt.toISOString(),
    unlimited: true,
  };
}

/** Charges one unit per delivered record. Personal keys are never charged; failed calls throw before this point. */
export async function reserveMcpQuota(units: number, unlimitedQuota: boolean): Promise<McpQuota> {
  if (unlimitedQuota) return unlimitedQuotaState();
  return serializeQuota(await reserveMcpTenderQuota(units));
}

async function loadTenderDetails(ids: number[]): Promise<Map<number, McpTenderDetails>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: tenders.id,
      procedureType: tenders.procedureType,
      contractValueMin: tenders.contractValueMin,
      externalId: tenders.externalId,
    })
    .from(tenders)
    .where(inArray(tenders.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}

function mapTender(hit: TenderSearchHit, details: McpTenderDetails | undefined): McpTender {
  const title = pickValidatedPublicCandidate(hit.title) || `Ausschreibung #${hit.id}`;
  const client = normalizePublicClient(hit.client) || "Unbekannt";
  const deadlineISO = hit.deadlineAt ? new Date(hit.deadlineAt * 1_000).toISOString() : null;

  return {
    id: hit.id,
    title,
    client,
    location: pickValidatedPublicLocationForTender(title, client, hit.location),
    bundesland: hit.bundesland,
    city: pickValidatedPublicLocationForTender(title, client, hit.city) || null,
    category: hit.category,
    description: pickPublicDescription(hit.description),
    deadline: deadlineISO ? formatDeadlineDE(new Date(deadlineISO)) : null,
    deadlineISO,
    source: hit.source,
    sourceUrl: sanitizeTenderUrl(hit.sourceUrl) ?? "",
    slug: hit.slug,
    pdfCount: hit.pdfCount,
    readinessStatus: hit.readinessStatus,
    contractValueMax: hit.contractValueMax,
    contractValueMin: details?.contractValueMin ?? null,
    smallVendorFit: hit.smallVendorFit ?? null,
    lowEntryBarrier: hit.lowEntryBarrier,
    remoteFriendly: hit.remoteFriendly,
    isItDomain: hit.isItDomain,
    isLot: hit.isLot,
    procedureType: pickValidatedPublicProcedure(details?.procedureType) || null,
    externalId: details?.externalId ?? null,
  };
}

export async function mapMcpTenders(hits: TenderSearchHit[]): Promise<McpTender[]> {
  const details = await loadTenderDetails(hits.map((hit) => hit.id));
  return hits.map((hit) => mapTender(hit, details.get(hit.id)));
}

export async function searchMcpTenders(
  input: McpTenderSearchInput,
  { unlimitedQuota = false }: { unlimitedQuota?: boolean } = {},
): Promise<McpTenderSearchResult> {
  const normalized = mcpTenderSearchSchema.parse(input);
  const lastThreeDaysRange = getGermanLastThreeDaysUnixRange();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const quotaBefore = unlimitedQuota ? null : await getMcpDailyQuota();
    if (quotaBefore?.remaining === 0) {
      throw new McpQuotaExceededError(0, quotaBefore.resetAt);
    }

    const deadlineBounds = resolveTenderDeadlineFilter(
      normalized.deadlineFilter,
      normalized.deadlineFrom,
      normalized.deadlineTo,
    );
    const result = await searchTenders({
      query: normalized.query,
      bundesland: normalized.bundesland ?? null,
      city: normalized.city ?? null,
      category: normalized.category ?? null,
      smallVendorFitMin: normalized.smallVendorFitMin,
      limit: quotaBefore ? Math.min(normalized.limit, quotaBefore.remaining) : normalized.limit,
      page: normalized.page,
      ...deadlineBounds,
      sort: normalized.sort,
      ...(normalized.todayNew
        ? { firstSeenAtFrom: lastThreeDaysRange.from, firstSeenAtTo: lastThreeDaysRange.to }
        : {}),
    });

    const items = await mapMcpTenders(result.hits);
    try {
      return {
        items,
        total: result.estimatedTotalHits,
        returned: items.length,
        processingTimeMs: result.processingTimeMs,
        scopeNote: MCP_SEARCH_SCOPE_NOTE,
        quota: await reserveMcpQuota(items.length, unlimitedQuota),
      };
    } catch (error) {
      if (!(error instanceof McpQuotaExceededError) || attempt === 2) throw error;
    }
  }

  throw new Error("MCP-Suche konnte wegen paralleler Quota-Anfragen nicht abgeschlossen werden.");
}

export function serializeMcpError(error: unknown): Record<string, unknown> {
  if (error instanceof McpQuotaExceededError) {
    return {
      error: error.message,
      code: "MCP_DAILY_QUOTA_EXCEEDED",
      remaining: error.remaining,
      resetAt: error.resetAt.toISOString(),
    };
  }
  return { error: error instanceof Error ? error.message : "Unbekannter MCP-Fehler" };
}
