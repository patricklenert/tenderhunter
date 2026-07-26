import { Meilisearch, type SearchResponse } from "meilisearch";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { cleanPublicDescription } from "@/lib/public-tender-scraper";
import { deriveBundesland, deriveCity } from "@/lib/bundesland";

const MEILI_HOST = process.env.MEILI_HOST ?? "http://localhost:7700";
const MEILI_KEY = process.env.MEILI_MASTER_KEY ?? "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const INDEX_NAME = "tenders";

let clientInstance: Meilisearch | null = null;
let configurePromise: Promise<void> | null = null;

export function getMeiliClient(): Meilisearch {
  if (clientInstance) return clientInstance;
  clientInstance = new Meilisearch({
    host: MEILI_HOST,
    apiKey: MEILI_KEY,
  });
  return clientInstance;
}

interface TenderDocument {
  id: number;
  title: string;
  description: string;
  client: string;
  category: string;
  bundesland: string | null;
  city: string | null;
  location: string;
  source: string;
  sourceUrl: string;
  deadlineAt: number | null;
  hasDeadline: boolean;
  pdfCount: number;
  contractValueMax: number | null;
  slug: string | null;
}

export function configureMeiliIndex(): Promise<void> {
  if (configurePromise) return configurePromise;
  configurePromise = configureMeiliIndexOnce().catch((error) => {
    configurePromise = null;
    throw error;
  });
  return configurePromise;
}

async function configureMeiliIndexOnce(): Promise<void> {
  const client = getMeiliClient();

  await client.createIndex(INDEX_NAME, { primaryKey: "id" }).catch(() => {});

  const index = client.index(INDEX_NAME);

  await index.updateSearchableAttributes([
    "title", "description", "client", "category",
  ]);

  await index.updateFilterableAttributes([
    "bundesland", "city", "category", "source", "hasDeadline", "deadlineAt",
  ]);

  await index.updateSortableAttributes([
    "deadlineAt", "contractValueMax",
  ]);

  await index.updateLocalizedAttributes([
    { locales: ["deu"], attributePatterns: ["*"] },
  ]);

  if (OPENROUTER_API_KEY) {
    console.log("[meilisearch] Konfiguriere REST Embedder (OpenRouter gemini-embedding-2)...");
    await index
      .updateEmbedders({
        default: {
          source: "rest",
          url: "https://openrouter.ai/api/v1/embeddings",
          apiKey: OPENROUTER_API_KEY,
          dimensions: 3072,
          request: {
            model: "google/gemini-embedding-2",
            input: ["{{text}}"],
          },
          response: {
            data: [{ embedding: "{{embedding}}" }],
          },
        } as never,
      })
      .catch((err) => {
        console.warn("[meilisearch] Embedder-Setup fehlgeschlagen:", err);
      });
  } else {
    console.warn("[meilisearch] Kein OPENROUTER_API_KEY — nur Keyword-Suche verfügbar");
  }

  await index.updateRankingRules([
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
  ]);

  // Meilisearch defaults maxTotalHits to 1000, which caps estimatedTotalHits and pagination.
  // Lift the cap so all qualified tenders are searchable/counted.
  await index.updatePagination({ maxTotalHits: 1_000_000 }).catch((err) => {
    console.warn("[meilisearch] Pagination-Setting fehlgeschlagen:", err);
  });

  console.log("[meilisearch] Index konfiguriert");
}

export async function syncTendersToMeili(): Promise<{ indexed: number; skipped: number }> {
  const client = getMeiliClient();
  const index = client.index(INDEX_NAME);

  const batchSize = 250;
  const now = new Date();
  let lastId = 0;
  let indexed = 0;

  // Clear first so deleted, expired, and disqualified tenders cannot remain searchable.
  await index.deleteAllDocuments();

  while (true) {
    const items = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        source: tenders.source,
        url: tenders.url,
        deadlineAt: tenders.deadlineAt,
        category: tenders.category,
        metadataJson: tenders.metadataJson,
        contractValueMax: tenders.contractValueMax,
        slug: tenders.slug,
      })
      .from(tenders)
      .where(
        and(
          eq(tenders.qualityStatus, "qualified"),
          gt(tenders.id, lastId),
          or(isNull(tenders.deadlineAt), gt(tenders.deadlineAt, now)),
        ),
      )
      .orderBy(tenders.id)
      .limit(batchSize);

    if (items.length === 0) break;
    const docs: TenderDocument[] = items.map((item) => {
      const meta =
        typeof item.metadataJson === "object" && item.metadataJson !== null
          ? (item.metadataJson as Record<string, unknown>)
          : {};
      const location = String(meta.location ?? "");
      const pdfUrls = Array.isArray(meta.pdf_urls) ? meta.pdf_urls : [];
      return {
        id: item.id,
        title: item.title ?? `Ausschreibung #${item.id}`,
        description: cleanPublicDescription(String(meta.description ?? "")).slice(0, 5000),
        client: String(meta.client ?? "Unbekannt"),
        category: item.category ?? "Sonstiges",
        bundesland: deriveBundesland(location),
        city: deriveCity(location),
        location,
        source: item.source,
        sourceUrl: item.url,
        deadlineAt: item.deadlineAt ? new Date(item.deadlineAt).getTime() / 1000 : null,
        hasDeadline: item.deadlineAt !== null,
        pdfCount: pdfUrls.length,
        contractValueMax: item.contractValueMax,
        slug: item.slug ?? null,
      };
    });
    await index.addDocuments(docs);
    indexed += docs.length;
    lastId = items[items.length - 1].id;
  }

  console.log(`[meilisearch] Sync abgeschlossen: ${indexed} Dokumente in Batches indiziert`);
  return { indexed, skipped: 0 };
}

export interface MeilisearchParams {
  query: string;
  bundesland?: string | null;
  city?: string | null;
  category?: string | null;
  // SEO: source filter for portal landing pages (supports OR via array)
  source?: string | string[] | null;
  limit?: number;
  page?: number;
}

export async function searchTenders(
  params: MeilisearchParams,
): Promise<{ hits: TenderDocument[]; estimatedTotalHits: number; processingTimeMs: number }> {
  const client = getMeiliClient();
  const index = client.index(INDEX_NAME);

  const filters: string[] = [];

  if (params.bundesland) {
    filters.push(`bundesland = "${params.bundesland}"`);
  }
  if (params.city) {
    filters.push(`city = "${params.city}"`);
  }
  if (params.category) {
    filters.push(`category = "${params.category}"`);
  }
  // SEO: source filter supports single string or OR-array for portal pages
  if (params.source) {
    const sources = Array.isArray(params.source) ? params.source : [params.source];
    if (sources.length === 1) {
      filters.push(`source = "${sources[0]}"`);
    } else {
      const orParts = sources.map((s) => `source = "${s}"`).join(" OR ");
      filters.push(`(${orParts})`);
    }
  }

  // Keep stale index entries from reaching the UI between full syncs.
  const nowUnix = Math.floor(Date.now() / 1000);
  filters.push(`(deadlineAt IS NULL OR deadlineAt > ${nowUnix})`);

  const filterStr = filters.length > 0 ? filters.join(" AND ") : undefined;

  const hasQuery = params.query.trim().length > 0;

  const limit = Math.min(Math.max(params.limit ?? 24, 1), 30);
  const page = Math.max(params.page ?? 1, 1);
  const searchParams: Record<string, unknown> = {
    limit,
    offset: (page - 1) * limit,
    showRankingScore: true,
  };

  if (filterStr) {
    searchParams.filter = filterStr;
  }

  if (hasQuery && OPENROUTER_API_KEY) {
    searchParams.hybrid = { embedder: "default", semanticRatio: 0.5 };
  }

  if (!hasQuery) {
    searchParams.sort = ["deadlineAt:asc"];
  }

  const response: SearchResponse<TenderDocument> = await index.search(
    params.query ?? "",
    searchParams,
  );

  return {
    hits: response.hits ?? [],
    estimatedTotalHits: response.estimatedTotalHits ?? response.hits?.length ?? 0,
    processingTimeMs: response.processingTimeMs ?? 0,
  };
}

export async function deleteTenderFromMeili(tenderId: number): Promise<void> {
  const client = getMeiliClient();
  try {
    await client.index(INDEX_NAME).deleteDocument(tenderId);
    console.log(`[meilisearch] Tender ${tenderId} aus Meilisearch gelöscht.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[meilisearch] Fehler beim Löschen von Tender ${tenderId}: ${message}`);
  }
}
