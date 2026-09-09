import { Meilisearch, type SearchResponse } from "meilisearch";
import { db } from "@/lib/db";
import { structuredData, tenders } from "@/lib/schema";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getPublicClientFallback, normalizePublicClient, pickPublicDescription } from "@/lib/public-tender-scraper";
import { deriveBundesland, deriveCity } from "@/lib/bundesland";
import { getPublicSourceBundesland } from "@/lib/public-source-registry";
import { pickValidatedPublicCandidate, pickValidatedPublicClient, pickValidatedPublicLocationForTender } from "@/lib/public-content-quality";
import { acquireCatalogSync, finishCatalogSync, getCatalogState, releaseCatalogSync, touchCatalogSync } from "@/lib/catalog";

const MEILI_HOST = process.env.MEILI_HOST ?? "http://localhost:7700";
const MEILI_KEY = process.env.MEILI_MASTER_KEY ?? "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const MEILI_EMBEDDINGS_ENABLED = process.env.MEILI_EMBEDDINGS_ENABLED === "true";
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
  firstSeenAt: number | null;
  hasDeadline: boolean;
  pdfCount: number;
  readinessStatus: string;
  contractValueMax: number | null;
  slug: string | null;
}

export interface TenderIndexInput {
  id: number;
  title: string | null;
  source: string;
  sourceKey: string | null;
  url: string;
  deadlineAt: Date | null;
  firstSeenAt: Date | null;
  category: string | null;
  metadataJson: unknown;
  structuredJson: unknown;
  rawText: string | null;
  contractValueMax: number | null;
  slug: string | null;
  readinessStatus: string;
}

const parseRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

/** Build the public document used by both indexing and search result cleanup. */
export const buildTenderIndexDocument = (item: TenderIndexInput): TenderDocument => {
  const meta = parseRecord(item.metadataJson);
  const structured = parseRecord(item.structuredJson);
  const hardFacts = structured.hard_facts && typeof structured.hard_facts === "object"
    ? structured.hard_facts as Record<string, unknown>
    : {};
  const title = pickValidatedPublicCandidate(item.title) || `Ausschreibung #${item.id}`;
  const client = pickValidatedPublicClient(
    meta.client,
    meta.buyer,
    hardFacts.buyer,
    getPublicClientFallback(item.source, item.url),
  ) || "Unbekannt";
  const location = pickValidatedPublicLocationForTender(title, client, meta.location, hardFacts.location);
  const bundesland = deriveBundesland(location)
    ?? getPublicSourceBundesland(item.sourceKey ?? item.source, item.url);
  const pdfUrls = Array.isArray(meta.pdf_urls)
    ? meta.pdf_urls
    : Array.isArray(meta.pdfUrls) ? meta.pdfUrls : [];

  return {
    id: item.id,
    title,
    description: pickPublicDescription(
      structured.summary,
      structured.description,
      structured.scope,
      meta.description,
      meta.summary,
      item.rawText,
    ).slice(0, 5_000),
    client,
    category: item.category ?? "Sonstiges",
    bundesland,
    city: deriveCity(location),
    location,
    source: item.source,
    sourceUrl: item.url,
    deadlineAt: item.deadlineAt ? item.deadlineAt.getTime() / 1000 : null,
    firstSeenAt: item.firstSeenAt ? Math.floor(item.firstSeenAt.getTime() / 1000) : null,
    hasDeadline: item.deadlineAt !== null,
    pdfCount: pdfUrls.length,
    readinessStatus: item.readinessStatus,
    contractValueMax: item.contractValueMax,
    slug: item.slug ?? null,
  };
};

async function waitForMeiliTask(task: { taskUid: number }, operation: string): Promise<void> {
  const result = await getMeiliClient().tasks.waitForTask(task.taskUid, {
    timeout: 10 * 60 * 1_000,
    interval: 1_000,
  });
  if (result.status === "succeeded") return;

  const failed = result as { status: string; error?: { message?: string } };
  throw new Error(`${operation} fehlgeschlagen: ${failed.error?.message ?? failed.status}`);
}

const configureIndex = async (
  index: ReturnType<Meilisearch["index"]>,
): Promise<void> => {
  await index.updateSearchableAttributes([
    "title", "description", "client", "category",
  ]);

  await index.updateFilterableAttributes([
    "bundesland", "city", "category", "source", "hasDeadline", "deadlineAt", "firstSeenAt", "readinessStatus",
  ]);

  await index.updateSortableAttributes([
    "deadlineAt", "firstSeenAt", "hasDeadline", "contractValueMax",
  ]);

  await index.updateLocalizedAttributes([
    { locales: ["deu"], attributePatterns: ["*"] },
  ]);

  if (MEILI_EMBEDDINGS_ENABLED && OPENROUTER_API_KEY) {
    console.log("[meilisearch] Konfiguriere REST Embedder (OpenRouter gemini-embedding-2)...");
    await index.updateEmbedders({
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
      .then((task) => waitForMeiliTask(task, "Embedder-Setup"));
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
  await index.updatePagination({ maxTotalHits: 1_000_000 }).catch((err) => {
    console.warn("[meilisearch] Pagination-Setting fehlgeschlagen:", err);
  });
};

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
  await configureIndex(index);

  console.log("[meilisearch] Index konfiguriert");
}

export async function syncTendersToMeili(): Promise<{ indexed: number; skipped: number }> {
  const client = getMeiliClient();
  const syncRevision = await acquireCatalogSync();
  if (syncRevision === null) {
    throw new Error("Meilisearch-Sync läuft bereits; erneuter Versuch erforderlich.");
  }

  try {
    const index = client.index(INDEX_NAME);
    await touchCatalogSync();
    const currentState = await getCatalogState();
    const stats = await index.getStats();
    if (
      currentState
      && currentState.revision <= currentState.syncedRevision
      && stats.numberOfDocuments > 0
      && stats.numberOfEmbeddedDocuments === stats.numberOfDocuments
    ) {
      await finishCatalogSync(currentState.revision);
      console.log(`[meilisearch] Kein Sync erforderlich: ${stats.numberOfDocuments} Dokumente und Embeddings bereits aktuell (Revision ${currentState.revision})`);
      return { indexed: 0, skipped: stats.numberOfDocuments };
    }

    const batchSize = 50;
    let targetRevision = syncRevision;
    let lastProcessed = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      // Keep the live index in place so Meilisearch can reuse cached embeddings
      // for documents whose embedded content did not change.
      const now = new Date();
      let lastId = 0;
      let indexed = 0;
    const desiredIds = new Set<number>();

      while (true) {
        const items = await db
          .select({
            id: tenders.id,
            title: tenders.title,
            source: tenders.source,
            sourceKey: tenders.sourceKey,
            url: tenders.url,
            deadlineAt: tenders.deadlineAt,
            firstSeenAt: tenders.firstSeenAt,
             category: tenders.category,
             metadataJson: tenders.metadataJson,
             structuredJson: structuredData.jsonBlob,
             rawText: tenders.rawText,
             contractValueMax: tenders.contractValueMax,
            slug: tenders.slug,
            readinessStatus: tenders.readinessStatus,
          })
          .from(tenders)
          .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
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
        for (const item of items) desiredIds.add(item.id);
        const docs: TenderDocument[] = items.map(buildTenderIndexDocument);
        await waitForMeiliTask(await index.addDocuments(docs), `Indizieren von Batch ab Tender ${docs[0].id}`);
        await touchCatalogSync();
        indexed += docs.length;
        lastId = items[items.length - 1].id;
      }
      lastProcessed = indexed;

      const state = await getCatalogState();
      const currentRevision = state?.revision ?? targetRevision;
      if (currentRevision <= targetRevision) {
        const existingIds = new Set<number>();
        let offset = 0;
        while (true) {
          const page = await index.getDocuments<{ id: number }>({
            limit: 1_000,
            offset,
            fields: ["id"],
          });
          for (const document of page.results) {
            const id = Number(document.id);
            if (Number.isInteger(id)) existingIds.add(id);
          }
          if (page.results.length < 1_000) break;
          offset += page.results.length;
        }

        const staleIds = [...existingIds].filter((id) => !desiredIds.has(id));
        for (let offset = 0; offset < staleIds.length; offset += 1_000) {
          const batch = staleIds.slice(offset, offset + 1_000);
          await waitForMeiliTask(await index.deleteDocuments(batch), `Löschen veralteter Tender ab ${batch[0]}`);
        }
        await finishCatalogSync(currentRevision);
        console.log(`[meilisearch] Sync abgeschlossen: ${indexed} Dokumente abgeglichen, ${staleIds.length} veraltete entfernt (Revision ${currentRevision})`);
        return { indexed, skipped: staleIds.length };
      }
      targetRevision = currentRevision;
      console.log(`[meilisearch] Katalog während des Syncs geändert (Revision ${currentRevision}), wiederhole.`);
    }
    await finishCatalogSync(targetRevision);
    console.warn(`[meilisearch] Sync abgeschlossen, obwohl der Katalog weiter geändert wurde (Revision ${targetRevision}).`);
    return { indexed: lastProcessed, skipped: 0 };
  } catch (error) {
    await releaseCatalogSync().catch(() => undefined);
    throw error;
  }
}

export interface MeilisearchParams {
  query: string;
  bundesland?: string | null;
  city?: string | null;
  category?: string | null;
  firstSeenAtFrom?: number;
  firstSeenAtTo?: number;
  hasDeadline?: boolean;
  deadlineAtFrom?: number;
  deadlineAtTo?: number;
  sort?: "deadline" | "newest";
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
  if (params.firstSeenAtFrom !== undefined) {
    filters.push(`firstSeenAt >= ${params.firstSeenAtFrom}`);
  }
  if (params.firstSeenAtTo !== undefined) {
    filters.push(`firstSeenAt < ${params.firstSeenAtTo}`);
  }
  if (params.hasDeadline !== undefined) {
    filters.push(`hasDeadline = ${params.hasDeadline}`);
  }
  if (params.deadlineAtFrom !== undefined) {
    filters.push(`deadlineAt >= ${params.deadlineAtFrom}`);
  }
  if (params.deadlineAtTo !== undefined) {
    filters.push(`deadlineAt < ${params.deadlineAtTo}`);
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

  if (hasQuery && MEILI_EMBEDDINGS_ENABLED && OPENROUTER_API_KEY) {
    searchParams.hybrid = { embedder: "default", semanticRatio: 0.5 };
  }

  searchParams.sort = params.sort === "newest"
    ? ["firstSeenAt:desc"]
    : ["hasDeadline:desc", "deadlineAt:asc"];

  const response: SearchResponse<TenderDocument> = await index.search(
    params.query ?? "",
    searchParams,
  );

  const hits = response.hits ?? [];
  const qualifiedIds = hits.length > 0
    ? new Set((await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(inArray(tenders.id, hits.map((hit) => hit.id)), eq(tenders.qualityStatus, "qualified"))))
      .map((row) => row.id))
    : new Set<number>();
  const visibleHits = hits
    .filter((hit) => qualifiedIds.has(hit.id))
    .map((hit) => {
      const title = pickValidatedPublicCandidate(hit.title) || `Ausschreibung #${hit.id}`;
      const client = normalizePublicClient(
        hit.client,
        getPublicClientFallback(hit.source, hit.sourceUrl),
      ) || "Unbekannt";
      return {
        ...hit,
        title,
        client,
        location: pickValidatedPublicLocationForTender(title, client, hit.location),
        city: pickValidatedPublicLocationForTender(title, client, hit.city) || null,
        description: pickPublicDescription(hit.description),
      };
    });

  return {
    hits: visibleHits,
    // `visibleHits` contains only the requested page and is capped at 30.
    // Preserve Meilisearch's filtered total for pagination and result counts.
    estimatedTotalHits: response.estimatedTotalHits ?? visibleHits.length,
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
