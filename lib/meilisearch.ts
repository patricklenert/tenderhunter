import { Meilisearch, type SearchResponse } from "meilisearch";
import { db } from "@/lib/db";
import { structuredData, tenders } from "@/lib/schema";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getPublicAccessLimitedFallback } from "@/lib/public-tender-scraper";
import { resolvePublicTenderDeadline, resolvePublicTenderDisplayFacts } from "@/lib/public-tender-display-facts";
import { deriveBundesland, deriveCity } from "@/lib/bundesland";
import { getPublicSourceBundesland } from "@/lib/public-source-registry";
import {
  pickValidatedPublicProcedure,
  projectPublicTenderRecord,
  projectPublicDisplayFields,
} from "@/lib/public-content-quality";
import { acquireCatalogSync, finishCatalogSync, getCatalogState, releaseCatalogSync, touchCatalogSync } from "@/lib/catalog";
import { analyzeTenderForSmallVendor, toCompact } from "@/lib/small-vendor";
import { getCanonicalTenderSlug } from "@/lib/tender-canonical";
import { normalizeStructured } from "@/lib/structurer";
import { readPublicTenderMeta } from "@/lib/tender-meta";

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
  procedureType: string | null;
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
  smallVendorFit: number | null;
  priceWeightPct: number | null;
  lowEntryBarrier: boolean;
  remoteFriendly: boolean;
  isItDomain: boolean;
  isLot: boolean;
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
  procedureType?: string | null;
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

export const getStaleIds = (existingIds: Iterable<number>, desiredIds: ReadonlySet<number>): number[] =>
  [...existingIds].filter((id) => !desiredIds.has(id));

/** Build the public document used by both indexing and search result cleanup. */
export const buildTenderIndexDocument = (item: TenderIndexInput): TenderDocument => {
  const meta = parseRecord(item.metadataJson);
  const structured = parseRecord(item.structuredJson);
  const publicMeta = readPublicTenderMeta(meta, {
    title: item.title,
    source: item.source,
    sourceUrl: item.url,
  });
  const publicFacts = resolvePublicTenderDisplayFacts({
    title: item.title,
    metadata: publicMeta,
    deadlineAt: item.deadlineAt,
    procedureType: item.procedureType,
    hasUsableRawText: Boolean(item.rawText?.trim()),
  });
  const accessFallback = getPublicAccessLimitedFallback({
    title: item.title ?? "",
    factsText: publicMeta.description,
    evidenceText: item.rawText,
    explicitlyAccessLimited: publicMeta.accessLimited,
  });
  const fallbackFacts = publicFacts.fallbackFacts;
  const normalizedStructured = normalizeStructured(structured, item.title ?? "", fallbackFacts);
  const deadlineAt = resolvePublicTenderDeadline(publicFacts.deadlineAt, normalizedStructured.hard_facts.deadline);
  const baseDisplay = projectPublicTenderRecord({
    title: item.title,
    metadata: meta,
    structured: normalizedStructured,
    clientFallbacks: [fallbackFacts.buyer],
    locationFallbacks: [fallbackFacts.location],
    summaryFallbacks: [accessFallback?.description, fallbackFacts.summary, fallbackFacts.scope],
  });
  const title = baseDisplay.title || `Ausschreibung #${item.id}`;
  const client = baseDisplay.client || "Unbekannt";
  const display = baseDisplay;
  const location = display.location || "";
  const canonicalSlug = getCanonicalTenderSlug(
    item.slug,
    item.title,
    item.metadataJson,
    item.rawText?.trim() ? item.structuredJson : null,
  );
  const bundesland = deriveBundesland(location)
    ?? getPublicSourceBundesland(item.sourceKey ?? item.source, item.url);
  const pdfUrls = [
    ...(Array.isArray(meta.pdf_urls) ? meta.pdf_urls : []),
    ...(Array.isArray(meta.pdfUrls) ? meta.pdfUrls : []),
  ].filter((value): value is string => typeof value === "string")
    .filter((value, index, values) => values.indexOf(value) === index);
  const smallVendor = toCompact(analyzeTenderForSmallVendor(title, structured));

  return {
    id: item.id,
    title,
    description: (display.description || "").slice(0, 5_000),
    client,
    procedureType: normalizedStructured.procurement.procedure_type
      || (item.rawText?.trim() ? pickValidatedPublicProcedure(item.procedureType) : null),
    category: item.category ?? "Sonstiges",
    bundesland,
    city: deriveCity(location),
    location,
    source: item.source,
    sourceUrl: item.url,
    deadlineAt: deadlineAt ? Math.floor(deadlineAt.getTime() / 1000) : null,
    firstSeenAt: item.firstSeenAt ? Math.floor(item.firstSeenAt.getTime() / 1000) : null,
    hasDeadline: deadlineAt !== null,
    pdfCount: pdfUrls.length,
    readinessStatus: item.readinessStatus,
    contractValueMax: item.contractValueMax,
    slug: canonicalSlug,
    smallVendorFit: smallVendor.fit,
    priceWeightPct: smallVendor.priceWeightPct,
    lowEntryBarrier: smallVendor.lowEntryBarrier,
    remoteFriendly: smallVendor.remoteFriendly,
    isItDomain: smallVendor.isItDomain,
    isLot: smallVendor.isLot,
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
    "bundesland", "city", "category", "source", "hasDeadline", "deadlineAt", "firstSeenAt", "readinessStatus", "smallVendorFit",
  ]);

  await index.updateSortableAttributes([
    "deadlineAt", "firstSeenAt", "hasDeadline", "contractValueMax", "smallVendorFit",
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
    const desiredIds = new Set<number>();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      // Keep the live index in place so Meilisearch can reuse cached embeddings
      // for documents whose embedded content did not change.
      desiredIds.clear();
      const now = new Date();
      let lastId = 0;
      let indexed = 0;
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
             procedureType: tenders.procedureType,
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

        const staleIds = getStaleIds(existingIds, desiredIds);
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
    const existingIds = new Set<number>();
    let offset = 0;
    while (true) {
      const page = await index.getDocuments<{ id: number }>({ limit: 1_000, offset, fields: ["id"] });
      for (const document of page.results) {
        const id = Number(document.id);
        if (Number.isInteger(id)) existingIds.add(id);
      }
      if (page.results.length < 1_000) break;
      offset += page.results.length;
    }
    const staleIds = getStaleIds(existingIds, desiredIds);
    for (let offset = 0; offset < staleIds.length; offset += 1_000) {
      const batch = staleIds.slice(offset, offset + 1_000);
      await waitForMeiliTask(await index.deleteDocuments(batch), `Löschen veralteter Tender ab ${batch[0]}`);
    }
    await finishCatalogSync(targetRevision);
    console.warn(`[meilisearch] Sync abgeschlossen, obwohl der Katalog weiter geändert wurde (Revision ${targetRevision}).`);
    return { indexed: lastProcessed, skipped: staleIds.length };
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
  sort?: "deadline" | "newest" | "smallVendorFit";
  smallVendorFitMin?: number;
  // SEO: source filter for portal landing pages (supports OR via array)
  source?: string | string[] | null;
  limit?: number;
  page?: number;
}

export const projectTenderSearchHit = (
  hit: TenderDocument,
  current: {
    title: string | null;
    source: string;
    url: string;
    metadataJson: unknown;
    structuredJson: unknown;
    deadlineAt?: Date | null;
    procedureType?: string | null;
    rawText?: string | null;
  },
): TenderDocument => {
  const publicMeta = readPublicTenderMeta(current.metadataJson, {
    title: current.title,
    source: current.source,
    sourceUrl: current.url,
  });
  const publicFacts = resolvePublicTenderDisplayFacts({
    title: current.title,
    metadata: publicMeta,
    deadlineAt: current.deadlineAt,
    procedureType: current.procedureType,
    hasUsableRawText: Boolean(current.rawText?.trim()),
  });
  const accessFallback = getPublicAccessLimitedFallback({
    title: current.title ?? "",
    factsText: publicMeta.description,
    evidenceText: current.rawText,
    explicitlyAccessLimited: publicMeta.accessLimited,
  });
  const normalizedStructured = normalizeStructured(current.structuredJson, current.title ?? "", publicFacts.fallbackFacts);
  const deadlineAt = resolvePublicTenderDeadline(publicFacts.deadlineAt, normalizedStructured.hard_facts.deadline);
  const currentDisplay = projectPublicTenderRecord({
    title: current.title,
    metadata: current.metadataJson,
    structured: normalizedStructured,
    summaryFallbacks: [accessFallback?.description, publicFacts.fallbackFacts.summary, publicFacts.fallbackFacts.scope],
    clientFallbacks: [publicFacts.fallbackFacts.buyer],
    locationFallbacks: [publicFacts.fallbackFacts.location],
  });
  const display = projectPublicDisplayFields({
    title: [currentDisplay.title, hit.title],
    client: [currentDisplay.client],
    location: [currentDisplay.location],
    summary: [currentDisplay.description],
  });

  return {
    ...hit,
    title: display.title || `Ausschreibung #${hit.id}`,
    client: display.client || "Unbekannt",
    location: display.location || "",
    city: display.location ? deriveCity(display.location) : null,
    description: display.description || "",
    deadlineAt: deadlineAt ? Math.floor(deadlineAt.getTime() / 1000) : null,
    hasDeadline: deadlineAt !== null,
    procedureType: normalizedStructured.procurement.procedure_type || null,
  };
};

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

  if (params.smallVendorFitMin !== undefined) {
    filters.push(`smallVendorFit >= ${params.smallVendorFitMin}`);
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

  searchParams.sort = params.sort === "smallVendorFit"
    ? ["smallVendorFit:desc", "hasDeadline:desc", "deadlineAt:asc"]
    : params.sort === "newest"
      ? ["firstSeenAt:desc"]
      : ["hasDeadline:desc", "deadlineAt:asc"];

  const response: SearchResponse<TenderDocument> = await index.search(
    params.query ?? "",
    searchParams,
  );

  const hits = response.hits ?? [];
  const currentTenders = hits.length > 0
    ? await db
      .select({
        id: tenders.id,
        title: tenders.title,
        source: tenders.source,
        url: tenders.url,
        metadataJson: tenders.metadataJson,
        structuredJson: structuredData.jsonBlob,
        deadlineAt: tenders.deadlineAt,
        procedureType: tenders.procedureType,
        rawText: tenders.rawText,
      })
      .from(tenders)
      .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
      .where(and(inArray(tenders.id, hits.map((hit) => hit.id)), eq(tenders.qualityStatus, "qualified")))
    : [];
  const currentTendersById = new Map(currentTenders.map((row) => [row.id, row]));
  const visibleHits = hits
    .filter((hit) => currentTendersById.has(hit.id))
    .map((hit) => {
      const current = currentTendersById.get(hit.id)!;
      return projectTenderSearchHit(hit, current);
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
