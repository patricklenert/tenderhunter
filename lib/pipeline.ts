import * as cheerio from "cheerio";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, asc, eq, ne, isNotNull, isNull, lt, inArray, or, sql } from "drizzle-orm";
import { settings } from "@/lib/config";
import { discoverTendersFromSource } from "@/lib/crawler";
import { db } from "@/lib/db";
import {
  tenders,
  usTenders,
  usDocuments,
  usSourceRuns,
  documents,
  tenderResources,
  structuredData,
  companyProfiles,
  scores,
  insights,
  attributionEvents,
  jobs,
  publicScrapeRuns,
  publicSourceRuns,
  publicSourceCursors,
  type Tender,
  type Document as DocumentType,
  type DocumentRole,
  type StructuredData as StructuredDataType,
  type CompanyProfile as CompanyProfileType,
} from "@/lib/schema";
import { generateInsight } from "@/lib/insights";
import { extractTextFromFile } from "@/lib/parser";
import { decodeTextBuffer, repairKnownGermanEncoding } from "@/lib/text-normalization";
import { buildJobKey, claimNextJob, enqueueJob, getJobMaxRuntimeMs, heartbeatJob, markDone, markFailed, sanitizeErrorMessage, type ClaimJobOptions } from "@/lib/queue";
import { buildTenderMatchDocument, computeScores, getDomainEligibility, getLocationEligibility, llmBatchDomainMatch, type CompanyRow, type ScoreResult } from "@/lib/scoring";
import { ensureExtension, fetchAndStore, objectAbsolutePath, suggestedFilename } from "@/lib/storage";
import { buildStructuredDescriptionMarkdown, extractStructuredData, normalizeStructured, type StructuredData } from "@/lib/structurer";
import { assessTenderQuality } from "@/lib/tender-quality";
import { resolveSourceItem } from "@/lib/tender-sources";
import {
  canonicalPublicSourceKey,
  getPublicClientFallback,
  normalizePublicClient,
  scrapeAllPublicTenders,
  type ExtractedTender,
} from "@/lib/public-tender-scraper";
import { shouldSchedulePublicContinuation, type PublicSourceCursor } from "@/lib/public-pagination";
import { resolvePublicSourceKey } from "@/lib/public-source-registry";
import { scrapeAllUsTenders, type UsExtractedTender } from "@/lib/us-tender-scraper";
import { dedupeUsAttachments } from "@/lib/us/types";
import { categorizeUsTender } from "@/lib/us/categorize";
import { processUsAlerts } from "@/lib/us/alerts";
import {
  buildPublicAccessLimitedDescriptionMarkdown,
  enrichFromOeffentlicheVergabe,
  cleanPublicDescription,
  extractPublicPortalFacts,
  type OeffentlicheVergabeDetails,
} from "@/lib/public-tender-scraper";
import { buildTenderDescriptionMarkdown } from "@/lib/tender-description";
import { generateTenderSlug } from "@/lib/tender-slug";
import { scoreKnownTenders } from "@/lib/discovery";
import { configureMeiliIndex, syncTendersToMeili } from "@/lib/meilisearch";
import { scrapeWebsite } from "@/lib/firecrawl";
import OpenAI from "openai";
import { callLLM } from "@/lib/llm";
import { detectAccessPage, type AccessPageDetection } from "@/lib/access-page-detector";
import {
  assignRoleHints,
  extractResourcesFromHtml,
  extractResourcesFromLinks,
  normalizeResourceUrl,
  rankSubpageCandidates,
  type DiscoveredResource,
  type ResourceRoleHint,
  type ResourceSource,
  type ResourceType,
} from "@/lib/resource-discovery";
import { isPortalActionUrl } from "@/lib/resource-url";
import { documentIdentityKey } from "@/lib/document-identity";
import { processCompanyUrlPreview } from "@/lib/preview";
import { getCatalogState, markCatalogDirty, releaseCatalogSync } from "@/lib/catalog";
import { classifyDocumentRole, rolePriority } from "@/lib/document-classifier";
import { buildDocumentAnalysis, withEvidenceValues, type AnalyzedDocument } from "@/lib/document-analysis";
import { deduplicateParsedDocuments, type ParsedTenderDocument } from "@/lib/document-aggregation";
import { evaluateTenderReadiness } from "@/lib/tender-readiness";
import { runApiAnalysisJob } from "@/app/api/v1/analyze/route";
import {
  JOB_CRAWL,
  JOB_FETCH_DOCUMENTS,
  JOB_FETCH_US_DOCUMENTS,
  JOB_INSIGHT,
  JOB_NOTIFY,
  JOB_PARSE,
  JOB_SCORE,
  JOB_SCRAPE_PUBLIC,
  JOB_STRUCTURE,
  JOB_CACHE_DETAIL,
  JOB_SYNC_MEILI,
  JOB_DISCOVER_COMPANY,
  JOB_SCRAPE_US,
  JOB_PREVIEW_COMPANY_URL,
  JOB_API_ANALYZE,
  type JobProcessResult,
  type JobType,
  type JsonValue,
  type SourceItem
} from "@/lib/types";

const INDEXNOW_KEY = "4ebe462f0c8f45cbaa9b6bae50dc57dc";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://palemaz.com";
const MAX_TENDER_TEXT_CHARS = 250_000;
const MAX_DOCUMENT_TEXT_CHARS = 100_000;
const CLEANUP_BATCH_SIZE = 250;
const RESOURCE_MAX_CANDIDATES = 100;
const RESOURCE_MAX_SUBPAGES = 3;
const RESOURCE_FETCH_ACCEPT = "application/pdf,application/octet-stream,application/zip,application/vnd.openxmlformats-officedocument.document;q=0.9,application/msword;q=0.8,text/html;q=0.7,*/*;q=0.5";
const REALISTIC_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DOCUMENT_ROLE_VALUES = new Set<DocumentRole>([
  "bekanntmachung",
  "leistungsbeschreibung",
  "leistungsverzeichnis",
  "eignung",
  "zuschlagskriterien",
  "vertragsbedingungen",
  "formblatt",
  "anlage",
  "nachtrag",
  "other",
]);
const RESOURCE_ROLE_HINT_VALUES = new Set<ResourceRoleHint>([
  "bekanntmachung",
  "leistungsbeschreibung",
  "leistungsverzeichnis",
  "vergabeunterlagen",
  "teilnahmeunterlagen",
  "eignung",
  "zuschlagskriterien",
  "vertragsbedingungen",
  "formblatt",
  "anlage",
  "nachtrag",
]);

const appendBoundedTenderText = (current: string, addition: string): string => {
  const separator = current.length > 0 ? "\n\n[Dokument]\n" : "";
  return `${current}${separator}${addition}`.slice(0, MAX_TENDER_TEXT_CHARS);
};

const submitToIndexNow = async (urls: string[]): Promise<void> => {
  if (urls.length === 0) return;
  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "palemaz.com",
        key: INDEXNOW_KEY,
        keyLocation: `https://palemaz.com/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    if (!res.ok) {
      console.warn(`[indexnow] HTTP ${res.status} beim Einreichen von ${urls.length} URLs`);
    }
  } catch (err) {
    console.warn("[indexnow] Einreichung fehlgeschlagen:", err);
  }
};

const parseRecord = (value: string | Record<string, JsonValue>): Record<string, JsonValue> => {
  if (typeof value === "object" && value !== null) return value;
  try {
    const parsed = JSON.parse(value as string);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, JsonValue>;
  } catch {
    return {};
  }
};

const scoringInputSignature = (value: Record<string, unknown>): string => {
  const hardFacts = value.hard_facts as Record<string, unknown> | undefined;
  const decisionRelevant = value.decision_relevant as Record<string, unknown> | undefined;
  const procurement = value.procurement as Record<string, unknown> | undefined;

  return JSON.stringify({
    location: hardFacts?.location ?? null,
    summary: value.summary ?? value.description ?? null,
    scope: decisionRelevant?.scope ?? null,
    requirements: decisionRelevant?.requirements ?? null,
    mandatoryDocuments: decisionRelevant?.mandatory_documents ?? null,
    participationRequirements: procurement?.participation_requirements ?? null,
  });
};

const getTender = async (tenderId: number): Promise<Tender> => {
  const rows = await db
    .select()
    .from(tenders)
    .where(eq(tenders.id, tenderId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Tender ${tenderId} nicht gefunden`);
  }
  return rows[0];
};

interface UpsertTenderInput {
  source: string;
  sourceKey?: string;
  url: string;
  title: string;
  externalId?: string | null;
  metadata?: Record<string, JsonValue>;
  deadlineAt?: Date | null;
  category?: string | null;
  rawText?: string | null;
}

interface UpsertTenderResult {
  id: number;
  changed: boolean;
  inserted: boolean;
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "discovered_at")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));

const sameDate = (left: Date | null | undefined, right: Date | null | undefined): boolean =>
  (left?.getTime() ?? null) === (right?.getTime() ?? null);

const metadataRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const metadataArray = (record: Record<string, unknown>, keys: string[]): unknown[] => {
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

const metadataResourceUrl = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  const record = metadataRecord(value);
  for (const key of ["url", "href", "canonicalUrl", "canonical_url"]) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return null;
};

const sanitizeResourceUrl = (value: string | null | undefined, baseUrl?: string): string | null => {
  const normalized = normalizeResourceUrl(value, baseUrl);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    parsed.pathname = parsed.pathname.replace(/;jsessionid=[^;?/]+/gi, "");
    return parsed.toString();
  } catch {
    return normalized;
  }
};

const fingerprintResource = (value: unknown, baseUrl: string): Record<string, unknown> | null => {
  const record = metadataRecord(value);
  const rawUrl = metadataResourceUrl(value);
  const url = sanitizeResourceUrl(rawUrl, baseUrl);
  if (!url) return null;
  const canonicalUrl = sanitizeResourceUrl(
    typeof record.canonicalUrl === "string" ? record.canonicalUrl : record.canonical_url as string | undefined,
    baseUrl,
  ) ?? url;
  const rawRoleHints = record.roleHints ?? record.role_hints;
  const roleHints = Array.isArray(rawRoleHints)
    ? rawRoleHints.filter((role): role is string => typeof role === "string" && RESOURCE_ROLE_HINT_VALUES.has(role as ResourceRoleHint)).sort()
    : [];
  const resourceType = typeof (record.resourceType ?? record.resource_type ?? record["resource-type"] ?? record.type) === "string"
    ? String(record.resourceType ?? record.resource_type ?? record["resource-type"] ?? record.type)
    : "";
  const label = typeof (record.label ?? record.text ?? record.linkText ?? record.link_text) === "string"
    ? String(record.label ?? record.text ?? record.linkText ?? record.link_text).slice(0, 300)
    : "";
  return { canonicalUrl, url, label, resourceType, roleHints };
};

/** Stable, non-sensitive identity for the resources associated with a tender. */
export const buildResourceFingerprint = (sourceUrl: string, metadata: unknown): string => {
  const record = metadataRecord(metadata);
  const baseUrl = sanitizeResourceUrl(sourceUrl) ?? sourceUrl;
  const values: Array<Record<string, unknown>> = [];
  const structured = metadataArray(record, ["resources", "resource_candidates", "resourceCandidates", "subpage_candidates", "subpageCandidates"]);
  for (const value of structured) {
    const fingerprint = fingerprintResource(value, baseUrl);
    if (fingerprint) values.push(fingerprint);
  }
  for (const value of metadataArray(record, ["pdf_urls", "pdfUrls"])) {
    const fingerprint = fingerprintResource(value, baseUrl);
    if (fingerprint) values.push({ ...fingerprint, resourceType: "document", label: "" });
  }

  const deduplicated = Array.from(new Map(values.map((value) => [
    `${String(value.canonicalUrl)}|${String(value.resourceType)}|${String(value.label)}|${JSON.stringify(value.roleHints)}`,
    value,
  ])).values()).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return createHash("sha256")
    .update(JSON.stringify({ sourceUrl: baseUrl, resources: deduplicated }))
    .digest("hex")
    .slice(0, 24);
};

const documentRefreshBucket = (): number =>
  Math.floor(Date.now() / (settings.documentRefreshHours * 60 * 60 * 1000));

export const buildFetchDocumentsJobKey = (tenderId: number, resourceFingerprint: string): string =>
  buildJobKey(JOB_FETCH_DOCUMENTS, tenderId, `resources-${resourceFingerprint || "empty"}-refresh-${documentRefreshBucket()}`);

export type DocumentPersistenceAction = "insert" | "update" | "skip";

/** Decide how a downloaded resource should interact with existing document rows. */
export const decideDocumentPersistence = (
  existingByUrl: { downloadStatus: string | null; sha256: string } | null,
  existingByHash: { downloadStatus: string | null } | null,
  sha256: string,
): DocumentPersistenceAction => {
  if (existingByHash?.downloadStatus === "downloaded") return "skip";
  if (!existingByUrl) return "insert";
  if (existingByUrl.downloadStatus === "downloaded" && existingByUrl.sha256 === sha256) return "skip";
  return "update";
};

const normalizeDocumentRoles = (roles: unknown, fallback: string | null | undefined): DocumentRole[] => {
  const values = [
    ...(Array.isArray(roles) ? roles : []),
    fallback,
  ].filter((role): role is DocumentRole => typeof role === "string" && DOCUMENT_ROLE_VALUES.has(role as DocumentRole));
  const unique = values.filter((role, index) => values.indexOf(role) === index && role !== "other");
  return unique.length > 0 ? unique : ["other"];
};

const mergeDocumentRoles = (...roleGroups: unknown[]): DocumentRole[] => {
  const values = roleGroups.flatMap((group) => Array.isArray(group) ? group : [group]);
  return normalizeDocumentRoles(values, null);
};

const primaryDocumentRole = (roles: DocumentRole[]): DocumentRole =>
  [...roles].sort((left, right) => rolePriority(left) - rolePriority(right))[0] ?? "other";

// Merge incoming metadata without losing existing non-empty values to empty new ones.
// A later scrape that returns thinner data must not erase previously captured fields.
const mergeMetadata = (
  existing: unknown,
  incoming: Record<string, JsonValue> | undefined,
): Record<string, JsonValue> | undefined => {
  if (!incoming) return undefined;
  const existingRecord = (existing && typeof existing === "object")
    ? existing as Record<string, unknown>
    : {};
  const merged: Record<string, unknown> = { ...existingRecord };
  for (const [key, value] of Object.entries(incoming)) {
    const isEmpty = value === null || value === undefined || value === ""
      || (Array.isArray(value) && value.length === 0);
    if (isEmpty) continue;
    merged[key] = value;
  }
  if (typeof incoming.descriptionMarkdown === "string" && incoming.descriptionMarkdown.trim()) {
    delete merged.description_markdown;
  }
  return merged as Record<string, JsonValue>;
};

const upsertTender = async ({ source, sourceKey, url, title, externalId, metadata, deadlineAt, category, rawText }: UpsertTenderInput): Promise<UpsertTenderResult> => {
  const boundedRawText = rawText === undefined || rawText === null
    ? rawText
    : rawText.slice(0, MAX_TENDER_TEXT_CHARS);
  const bySourceKeyExternalId = externalId && sourceKey
    ? await db
        .select({
          id: tenders.id,
          sourceKey: tenders.sourceKey,
          url: tenders.url,
          title: tenders.title,
          externalId: tenders.externalId,
          metadataJson: tenders.metadataJson,
          deadlineAt: tenders.deadlineAt,
          category: tenders.category,
          rawText: tenders.rawText,
        })
        .from(tenders)
        .where(and(eq(tenders.sourceKey, sourceKey), eq(tenders.externalId, externalId)))
        .limit(1)
    : [];

  const byExternalId = externalId && bySourceKeyExternalId.length === 0
    ? await db
        .select({
          id: tenders.id,
          sourceKey: tenders.sourceKey,
          url: tenders.url,
          title: tenders.title,
          externalId: tenders.externalId,
          metadataJson: tenders.metadataJson,
          deadlineAt: tenders.deadlineAt,
          category: tenders.category,
          rawText: tenders.rawText,
        })
        .from(tenders)
        .where(and(eq(tenders.source, source), eq(tenders.externalId, externalId), isNull(tenders.sourceKey)))
        .limit(1)
    : [];

  const byPortalIdentity = externalId && byExternalId.length === 0
    ? await db
        .select({
          id: tenders.id,
          sourceKey: tenders.sourceKey,
          url: tenders.url,
          title: tenders.title,
          externalId: tenders.externalId,
          metadataJson: tenders.metadataJson,
          deadlineAt: tenders.deadlineAt,
          category: tenders.category,
          rawText: tenders.rawText,
        })
        .from(tenders)
        .where(and(
          eq(tenders.source, source),
          isNull(tenders.sourceKey),
          or(
            sql`${tenders.metadataJson} ->> 'reference_number' = ${externalId}`,
            sql`substring(${tenders.url} from '/project/([^/;?]+)') = ${externalId}`,
          ),
        ))
        .orderBy(asc(tenders.id))
        .limit(1)
    : [];

  const existing =
    bySourceKeyExternalId.length > 0
      ? bySourceKeyExternalId
      : byExternalId.length > 0
        ? byExternalId
      : byPortalIdentity.length > 0
        ? byPortalIdentity
        : await db
            .select({
              id: tenders.id,
              sourceKey: tenders.sourceKey,
              url: tenders.url,
              title: tenders.title,
              externalId: tenders.externalId,
              metadataJson: tenders.metadataJson,
              deadlineAt: tenders.deadlineAt,
              category: tenders.category,
              rawText: tenders.rawText,
            })
            .from(tenders)
            .where(and(eq(tenders.source, source), eq(tenders.url, url)))
            .limit(1);

  if (existing.length > 0) {
    const current = existing[0];

    // Non-destructive merge: don't let empty new values erase non-empty existing ones.
    const mergedMeta = mergeMetadata(current.metadataJson, metadata);
    const effectiveDeadline = deadlineAt !== undefined ? (deadlineAt ?? current.deadlineAt ?? null) : undefined;
    const effectiveRawText = boundedRawText !== undefined ? (boundedRawText || current.rawText || null) : undefined;

    const changed =
      (sourceKey !== undefined && current.sourceKey !== sourceKey) ||
      current.url !== url ||
      current.title !== title ||
      (externalId !== undefined && current.externalId !== externalId) ||
      (mergedMeta !== undefined && !sameValue(current.metadataJson, mergedMeta)) ||
      (effectiveDeadline !== undefined && !sameDate(current.deadlineAt, effectiveDeadline)) ||
      (category !== undefined && current.category !== category) ||
      (effectiveRawText !== undefined && current.rawText !== effectiveRawText);

    const updateData: Record<string, unknown> = { lastSeenAt: new Date() };
    if (changed) {
      updateData.updatedAt = new Date();
      updateData.version = sql`${tenders.version} + 1`;
      if (sourceKey !== undefined) updateData.sourceKey = sourceKey;
      updateData.url = url;
      updateData.title = title;
      if (externalId !== undefined) updateData.externalId = externalId;
      if (mergedMeta !== undefined) updateData.metadataJson = mergedMeta;
      if (effectiveDeadline !== undefined) updateData.deadlineAt = effectiveDeadline;
      if (category !== undefined) updateData.category = category;
      if (effectiveRawText !== undefined) updateData.rawText = effectiveRawText;
    }
    await db
      .update(tenders)
      .set(updateData)
      .where(eq(tenders.id, current.id));
    if (changed) await markCatalogDirty();
    return { id: current.id, changed, inserted: false };
  }

  const result = await db
    .insert(tenders)
    .values({
      source,
      sourceKey: sourceKey ?? undefined,
      url,
      title,
      externalId: externalId ?? undefined,
      metadataJson: metadata ?? undefined,
      deadlineAt: deadlineAt ?? undefined,
      category: category ?? undefined,
      rawText: boundedRawText ?? undefined,
    })
    .returning({ id: tenders.id });

  await markCatalogDirty();
  return { id: result[0].id, changed: true, inserted: true };
};

const upsertUsTender = async (tender: UsExtractedTender): Promise<UpsertTenderResult> => {
  const metadata: Record<string, JsonValue> = {
    ...tender.metadata as Record<string, JsonValue>,
    contacts: tender.contacts.map((contact) => ({
      ...(contact.name ? { name: contact.name } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.phone ? { phone: contact.phone } : {}),
    })),
    attachments: tender.attachments.map((attachment) => ({ name: attachment.name, url: attachment.url })),
    discovered_at: new Date().toISOString(),
  };
  const existingByExternalId = await db
    .select({
      id: usTenders.id,
      url: usTenders.url,
      title: usTenders.title,
      description: usTenders.description,
      buyer: usTenders.buyer,
      location: usTenders.location,
      state: usTenders.state,
      solicitationNumber: usTenders.solicitationNumber,
      naicsCodesJson: usTenders.naicsCodesJson,
      pscCodesJson: usTenders.pscCodesJson,
      setAside: usTenders.setAside,
      contractType: usTenders.contractType,
      category: usTenders.category,
      deadlineAt: usTenders.deadlineAt,
      metadataJson: usTenders.metadataJson,
    })
    .from(usTenders)
    .where(and(eq(usTenders.source, tender.source), eq(usTenders.externalId, tender.externalId)))
    .limit(1);
  const existing = existingByExternalId.length > 0
    ? existingByExternalId
    : await db
      .select({
        id: usTenders.id,
        url: usTenders.url,
        title: usTenders.title,
        description: usTenders.description,
        buyer: usTenders.buyer,
        location: usTenders.location,
        state: usTenders.state,
        solicitationNumber: usTenders.solicitationNumber,
        naicsCodesJson: usTenders.naicsCodesJson,
        pscCodesJson: usTenders.pscCodesJson,
        setAside: usTenders.setAside,
        contractType: usTenders.contractType,
        category: usTenders.category,
        deadlineAt: usTenders.deadlineAt,
        metadataJson: usTenders.metadataJson,
      })
      .from(usTenders)
      .where(and(eq(usTenders.source, tender.source), eq(usTenders.url, tender.url)))
      .limit(1);

  const values = {
    sourceKey: tender.sourceKey,
    url: tender.url,
    title: tender.title,
    externalId: tender.externalId,
    description: tender.description,
    buyer: tender.buyer,
    location: tender.location,
    state: tender.state,
    solicitationNumber: tender.solicitationNumber,
    naicsCodesJson: tender.naicsCodes,
    pscCodesJson: tender.pscCodes,
    setAside: tender.setAside,
    contractType: tender.contractType,
    category: categorizeUsTender({ naicsCodesJson: tender.naicsCodes, title: tender.title, description: tender.description }),
    deadlineAt: tender.deadlineAt,
    metadataJson: metadata,
    qualityStatus: "qualified",
    qualityReason: null,
    lastSeenAt: new Date(),
  };

  if (existing.length === 0) {
    const inserted = await db.insert(usTenders).values({
      source: tender.source,
      ...values,
      firstSeenAt: new Date(),
      version: 1,
    }).returning({ id: usTenders.id });
    return { id: inserted[0].id, changed: true, inserted: true };
  }

  const current = existing[0];
  const changed =
    current.url !== values.url ||
    current.title !== values.title ||
    current.description !== values.description ||
    current.buyer !== values.buyer ||
    current.location !== values.location ||
    current.state !== values.state ||
    current.solicitationNumber !== values.solicitationNumber ||
    !sameValue(current.naicsCodesJson, values.naicsCodesJson) ||
    !sameValue(current.pscCodesJson, values.pscCodesJson) ||
    current.setAside !== values.setAside ||
    current.contractType !== values.contractType ||
    current.category !== values.category ||
    !sameDate(current.deadlineAt, values.deadlineAt) ||
    !sameValue(current.metadataJson, values.metadataJson);

  await db.update(usTenders).set({
    ...values,
    ...(changed ? { version: sql`${usTenders.version} + 1`, updatedAt: new Date() } : {}),
  }).where(eq(usTenders.id, current.id));
  return { id: current.id, changed, inserted: false };
};

const queueTenderStage = async (
  jobType: JobType,
  tenderId: number,
  payload: Record<string, JsonValue> = {},
  keySuffix?: string,
): Promise<number> => {
  return enqueueJob(
    jobType,
    { tender_id: tenderId, ...payload },
    {
      jobKey: buildJobKey(jobType, tenderId, keySuffix),
      dedupeCompleted: jobType !== JOB_NOTIFY,
    },
  );
};

const queueTenderProcessing = async (tenderId: number): Promise<void> => {
  const tender = await getTender(tenderId);
  const metadata = parseRecord(tender.metadataJson as string);
  const resourceFingerprint = buildResourceFingerprint(tender.url, metadata);
  await enqueueJob(
    JOB_FETCH_DOCUMENTS,
    { tender_id: tenderId, resource_fingerprint: resourceFingerprint },
    { jobKey: buildFetchDocumentsJobKey(tenderId, resourceFingerprint) },
  );
};

const TENDER_PIPELINE_STAGES = [
  JOB_FETCH_DOCUMENTS,
  JOB_PARSE,
  JOB_STRUCTURE,
  JOB_SCORE,
  JOB_CACHE_DETAIL,
] as const;

/** Requeue the first missing or permanently failed stage after a re-discovery. */
export const recoverTenderProcessing = async (tenderId: number): Promise<void> => {
  const tender = await getTender(tenderId);
  const stageRows = await db
    .select({ type: jobs.type, status: jobs.status })
    .from(jobs)
    .where(and(
      inArray(jobs.type, [...TENDER_PIPELINE_STAGES]),
      sql`${jobs.payload} ->> 'tender_id' = ${String(tenderId)}`,
    ))
    .orderBy(sql`${jobs.id} DESC`);
  const latestByStage = new Map<string, string>();
  for (const row of stageRows) {
    if (!latestByStage.has(row.type)) latestByStage.set(row.type, row.status);
  }

  const fetchStatus = latestByStage.get(JOB_FETCH_DOCUMENTS);
  if (!fetchStatus || fetchStatus === "failed") {
    await queueTenderProcessing(tenderId);
    return;
  }
  if (fetchStatus !== "done") return;

  for (const stage of [JOB_PARSE, JOB_STRUCTURE] as const) {
    const status = latestByStage.get(stage);
    if (!status || status === "failed") {
      await queueTenderStage(stage, tenderId);
      return;
    }
    if (status !== "done") return;
  }

  const structured = await db
    .select({ tenderId: structuredData.tenderId })
    .from(structuredData)
    .where(eq(structuredData.tenderId, tenderId))
    .limit(1);
  if (structured.length === 0) {
    await queueTenderStage(JOB_STRUCTURE, tenderId, {}, "recovery");
    return;
  }

  if (tender.qualityStatus !== "qualified") return;

  if (tender.readinessStatus === "ready") {
    const scoreStatus = latestByStage.get(JOB_SCORE);
    if (!scoreStatus || scoreStatus === "failed") {
      await queueTenderStage(JOB_SCORE, tenderId);
      return;
    }
    if (scoreStatus !== "done") return;
  }

  const cacheStatus = latestByStage.get(JOB_CACHE_DETAIL);
  if (!cacheStatus || cacheStatus === "failed") {
    await queueTenderStage(JOB_CACHE_DETAIL, tenderId);
  }
};

/** Recover newly completed tenders that were not rediscovered after analysis. */
export const recoverIncompleteTenderPipelines = async (limit = 50): Promise<number> => {
  const candidates = await db
    .select({ id: tenders.id })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      eq(tenders.qualityStatus, "qualified"),
      sql`(
        ${structuredData.tenderId} IS NULL
        OR (
          ${tenders.readinessStatus} = 'ready'
          AND NOT EXISTS (
            SELECT 1 FROM jobs score_job
            WHERE score_job.type = 'score_tender'
              AND score_job.status = 'done'
              AND score_job.payload ->> 'tender_id' = ${tenders.id}::text
          )
        )
      )`,
    ))
    .limit(Math.max(1, Math.min(limit, 100)));

  for (const candidate of candidates) {
    await recoverTenderProcessing(candidate.id);
  }
  return candidates.length;
};

const cleanUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Strip jsessionid from path
    parsed.pathname = parsed.pathname.replace(/;jsessionid=[^;?/]+/gi, "");
    return parsed.toString();
  } catch {
    return url;
  }
};

const responseHtml = async (response: Response): Promise<string> =>
  decodeTextBuffer(Buffer.from(await response.arrayBuffer()), response.headers.get("content-type"));

export interface DiscoveredLink {
  url: string;
  linkText: string;
}

const findPdfLinks = async (baseUrl: string): Promise<DiscoveredLink[]> => {
  const response = await fetch(baseUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      "User-Agent": REALISTIC_USER_AGENT,
    },
    redirect: "follow",
  });
  if (!response.ok) {
    return [];
  }
  const html = await responseHtml(response);
  const $ = cheerio.load(html);

  const links: DiscoveredLink[] = [];
  const seen = new Set<string>();

  const DOCUMENT_KEYWORDS = /\b(bekanntmachung|leistungsbeschreibung|vergabeunterlagen|leistungsverzeichnis|lv\b|eignung|zuschlag|vertragsbedingungen|formblatt|anlage|nachtrag|dokument|unterlage)\b/i;
  const DOCUMENT_EXTENSIONS = /\.(pdf|zip|xlsx|xls|docx?)(\?|$)/i;

  const addLink = (absoluteUrl: string, text: string) => {
    if (seen.has(absoluteUrl)) return;
    seen.add(absoluteUrl);
    links.push({ url: absoluteUrl, linkText: text.trim() });
  };

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    let absolute: string;
    try {
      absolute = cleanUrl(new URL(href, baseUrl).toString());
    } catch {
      return;
    }
    const lowerUrl = absolute.toLowerCase();
    // Match .pdf/.zip/.xlsx extensions OR /download/ endpoints with document-keyword link text
    const linkText = $(element).text().trim();
    const isDocumentUrl = lowerUrl.includes(".pdf") || DOCUMENT_EXTENSIONS.test(lowerUrl);
    const isDownloadWithKeyword = (lowerUrl.includes("/download/") || lowerUrl.includes("/document/")) && DOCUMENT_KEYWORDS.test(linkText);
    if (!isDocumentUrl && !isDownloadWithKeyword) return;
    addLink(absolute, linkText);
  });

  // Evergabe: Vergabe-ID extrahieren und Documents-Seite direkt laden
  if (links.length === 0 && baseUrl.includes("evergabe.de")) {
    const vergabeIdMatch = html.match(/Vergabe-?ID[:\s]*(\d{5,})/i);
    if (vergabeIdMatch) {
      const vergabeId = vergabeIdMatch[1];
      const docsUrl = `https://www.evergabe.de/unterlagen/${vergabeId}`;
      console.log(`[pipeline] evergabe: Vergabe-ID ${vergabeId} gefunden, lade Documents-Seite ${docsUrl}`);
      try {
         const docsResp = await fetch(docsUrl, {
           headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "User-Agent": REALISTIC_USER_AGENT },
           redirect: "follow",
         });
        if (docsResp.ok) {
          const docsHtml = await responseHtml(docsResp);
          const $docs = cheerio.load(docsHtml);
          $docs("a[href*='/download/']").each((_, element) => {
           const href = $docs(element).attr("href");
           if (!href) return;
            let absolute: string;
            try {
              absolute = cleanUrl(new URL(href, "https://www.evergabe.de").toString());
            } catch {
              return;
            }
            addLink(absolute, $docs(element).text().trim());
          });
          console.log(`[pipeline] evergabe: ${links.length} PDFs von Documents-Seite geladen`);
        }
      } catch (err) {
        console.warn(`[pipeline] evergabe Documents-Seite Fehler:`, err);
      }
    }
  }

  // For DTVP: also check "Vergabeunterlagen" / "documents" subpages
  if (links.length === 0) {
    const detailPaths: string[] = [];
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
       if (!href) return;
       const text = $(element).text().toLowerCase();
       if (text.includes("vergabeunterlagen") || text.includes("documents") || text.includes("bekanntmachung")) {
         let absolute: string;
         try {
           absolute = cleanUrl(new URL(href, baseUrl).toString());
         } catch {
           return;
         }
        if (!detailPaths.includes(absolute)) {
          detailPaths.push(absolute);
        }
      }
    });

    // Evergabe: /unterlagen/ Links zur Documents-Seite folgen
    if (baseUrl.includes("evergabe.de")) {
      $("a[href]").each((_, element) => {
         const href = $(element).attr("href");
         if (!href || !href.includes("/unterlagen/")) return;
         let absolute: string;
         try {
           absolute = cleanUrl(new URL(href, baseUrl).toString());
         } catch {
           return;
         }
        if (!detailPaths.includes(absolute)) {
          detailPaths.push(absolute);
        }
      });
    }

    for (const subUrl of detailPaths.slice(0, 3)) {
      try {
        // Evergabe: /zustellweg-auswaehlen von URL entfernen
        const docsUrl = subUrl.replace(/\/zustellweg-auswaehlen\/?$/, "");
         const subResponse = await fetch(docsUrl, {
           headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "User-Agent": REALISTIC_USER_AGENT },
           redirect: "follow",
         });
        if (!subResponse.ok) continue;
         const subHtml = await responseHtml(subResponse);
        const $sub = cheerio.load(subHtml);
        $sub("a[href]").each((_, element) => {
           const href = $sub(element).attr("href");
           if (!href) return;
           let absolute: string;
           try {
             absolute = cleanUrl(new URL(href, docsUrl).toString());
           } catch {
             return;
           }
          if (!absolute.toLowerCase().includes(".pdf") && !absolute.includes("/download/")) return;
          addLink(absolute, $sub(element).text().trim());
        });
      } catch {
        // ignore fetch errors on subpages
      }
    }
  }

  return links;
};

export interface ResourceCandidateRecord {
  url: string;
  canonicalUrl: string;
  label: string;
  filename: string | null;
  resourceType: ResourceType;
  roleHints: ResourceRoleHint[];
  sourcePageUrl: string | null;
  discoveryMethod: string;
  method: string;
  contentType: string | null;
  contentDisposition: string | null;
}

const RESOURCE_TYPES = new Set<ResourceType>([
  "api",
  "download",
  "document",
  "page",
  "image",
  "media",
  "stylesheet",
  "script",
  "font",
  "unknown",
]);

const resourceTypePriority: Record<ResourceType, number> = {
  unknown: 0,
  page: 1,
  api: 2,
  document: 3,
  download: 4,
  image: 0,
  media: 0,
  stylesheet: 0,
  script: 0,
  font: 0,
};

const boundedResourceText = (value: unknown, maxLength = 500): string =>
  typeof value === "string"
    ? repairKnownGermanEncoding(value).replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";

const safeResourceRoleHints = (value: unknown): ResourceRoleHint[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((role): role is ResourceRoleHint => typeof role === "string" && RESOURCE_ROLE_HINT_VALUES.has(role as ResourceRoleHint))
    .filter((role, index, values) => values.indexOf(role) === index);
};

const safeResourceMethod = (value: unknown): string => {
  const method = boundedResourceText(value, 32).toUpperCase();
  return /^[A-Z][A-Z0-9-]*$/.test(method) ? method : "GET";
};

const resourceFilenameFromUrl = (url: string): string | null => {
  try {
    const pathname = new URL(url).pathname.replace(/\\/g, "/");
    const basename = pathname.split("/").pop() ?? "";
    const safe = basename.replace(/[^a-zA-Z0-9._ -]/g, "").trim();
    if (!safe || /^(?:download|document|file|index)$/i.test(safe)) return null;
    return safe.slice(0, 255);
  } catch {
    return null;
  }
};

const validResourceType = (value: unknown): ResourceType | null => {
  if (typeof value !== "string") return null;
  return RESOURCE_TYPES.has(value as ResourceType) ? value as ResourceType : null;
};

const resourceCandidateFromDiscovered = (
  resource: DiscoveredResource,
  sourcePageUrl: string,
  discoveryMethod: string,
): ResourceCandidateRecord => {
  const url = sanitizeResourceUrl(resource.url) ?? resource.url;
  const canonicalUrl = documentIdentityKey({
    url,
    filename: resourceFilenameFromUrl(url),
    contentType: resource.contentType,
    resourceType: resource.type,
  }) ?? url;
  return {
    url,
    canonicalUrl: documentIdentityKey({
      url: sanitizeResourceUrl(resource.canonicalUrl) ?? canonicalUrl,
      filename: resourceFilenameFromUrl(url),
      contentType: resource.contentType,
      resourceType: resource.type,
    }) ?? canonicalUrl,
    label: boundedResourceText(resource.label || resource.text),
    filename: resourceFilenameFromUrl(url),
    resourceType: resource.type,
    roleHints: safeResourceRoleHints(resource.roleHints),
    sourcePageUrl: sanitizeResourceUrl(sourcePageUrl) ?? null,
    discoveryMethod: boundedResourceText(discoveryMethod, 64) || "unknown",
    method: safeResourceMethod(resource.method),
    contentType: boundedResourceText(resource.contentType, 200) || null,
    contentDisposition: boundedResourceText(resource.contentDisposition, 2_000) || null,
  };
};

const structuredResourceCandidate = (
  value: unknown,
  baseUrl: string,
): ResourceCandidateRecord | null => {
  const record = metadataRecord(value);
  const rawUrl = metadataResourceUrl(value);
  const pageUrl = sanitizeResourceUrl(
    typeof (record.sourcePageUrl ?? record.source_page_url) === "string"
      ? String(record.sourcePageUrl ?? record.source_page_url)
      : baseUrl,
    baseUrl,
  ) ?? baseUrl;
  if (!rawUrl) return null;

  const source = typeof record.source === "string" && ["anchor", "button", "form", "iframe", "source", "link", "network"].includes(record.source)
    ? record.source as ResourceSource
    : "anchor";
  const rawResourceType = record.resourceType ?? record.resource_type ?? record.type;
  const resource = extractResourcesFromLinks([{
    href: rawUrl,
    text: typeof (record.label ?? record.text ?? record.linkText ?? record.link_text) === "string"
      ? String(record.label ?? record.text ?? record.linkText ?? record.link_text)
      : "",
    source,
    contentType: typeof (record.contentType ?? record.content_type ?? record["content-type"]) === "string" ? String(record.contentType ?? record.content_type ?? record["content-type"]) : null,
    contentDisposition: typeof (record.contentDisposition ?? record.content_disposition ?? record["content-disposition"]) === "string" ? String(record.contentDisposition ?? record.content_disposition ?? record["content-disposition"]) : null,
    resourceType: typeof rawResourceType === "string" ? rawResourceType : null,
    rel: typeof record.rel === "string" ? record.rel : null,
    attribute: typeof record.attribute === "string" ? record.attribute : undefined,
    method: typeof record.method === "string" ? record.method : undefined,
  }], pageUrl, { maxResources: 1 })[0];
  if (!resource) return null;

  const explicitType = validResourceType(rawResourceType);
  const candidate = resourceCandidateFromDiscovered(
    explicitType ? { ...resource, type: explicitType } : resource,
    pageUrl,
    boundedResourceText(record.discoveryMethod ?? record.discovery_method, 64) || "metadata",
  );
  const explicitCanonical = sanitizeResourceUrl(
    typeof (record.canonicalUrl ?? record.canonical_url) === "string"
      ? String(record.canonicalUrl ?? record.canonical_url)
      : null,
    pageUrl,
  );
  const explicitFilename = boundedResourceText(record.filename, 255);
  return {
    ...candidate,
    canonicalUrl: documentIdentityKey({
      url: explicitCanonical ?? candidate.canonicalUrl,
      filename: explicitFilename || candidate.filename,
      contentType: candidate.contentType,
      resourceType: explicitType ?? candidate.resourceType,
    }) ?? explicitCanonical ?? candidate.canonicalUrl,
    filename: explicitFilename || candidate.filename,
    roleHints: safeResourceRoleHints(record.roleHints ?? record.role_hints).concat(candidate.roleHints)
      .filter((role, index, values) => values.indexOf(role) === index),
    discoveryMethod: boundedResourceText(record.discoveryMethod ?? record.discovery_method, 64) || "metadata",
    method: safeResourceMethod(record.method ?? candidate.method),
  };
};

const mergeResourceCandidate = (first: ResourceCandidateRecord, next: ResourceCandidateRecord): ResourceCandidateRecord => {
  const roleHints = [...first.roleHints];
  for (const role of next.roleHints) if (!roleHints.includes(role)) roleHints.push(role);
  const preferred = resourceTypePriority[next.resourceType] > resourceTypePriority[first.resourceType] ? next : first;
  return {
    ...first,
    resourceType: preferred.resourceType,
    label: first.label || next.label,
    filename: first.filename || next.filename,
    roleHints,
    sourcePageUrl: first.sourcePageUrl || next.sourcePageUrl,
    discoveryMethod: first.discoveryMethod || next.discoveryMethod,
    method: first.method || next.method,
    contentType: first.contentType || next.contentType,
    contentDisposition: first.contentDisposition || next.contentDisposition,
  };
};

export const mergeResourceCandidates = (...groups: ReadonlyArray<ResourceCandidateRecord>[]): ResourceCandidateRecord[] => {
  const byCanonicalUrl = new Map<string, ResourceCandidateRecord>();
  for (const candidate of groups.flat()) {
    const existing = byCanonicalUrl.get(candidate.canonicalUrl);
    byCanonicalUrl.set(candidate.canonicalUrl, existing ? mergeResourceCandidate(existing, candidate) : candidate);
  }
  return [...byCanonicalUrl.values()];
};

export const isFetchableResourceCandidate = (candidate: ResourceCandidateRecord): boolean => {
  if (
    isPortalActionUrl(candidate.url)
    && !/^(?:application\/pdf|application\/octet-stream|application\/msword|application\/vnd\.|application\/zip)/i.test(candidate.contentType ?? "")
    && !/\battachment\b/i.test(candidate.contentDisposition ?? "")
  ) return false;
  if (["document", "download"].includes(candidate.resourceType)) return true;
  if (/\battachment\b/i.test(candidate.contentDisposition ?? "")) return true;
  if (/^(?:application\/pdf|application\/octet-stream|application\/msword|application\/vnd\.|application\/zip)/i.test(candidate.contentType ?? "")) return true;
  return /\.(?:pdf|doc|docx|odt|rtf|xls|xlsx|ods|csv|zip|rar|7z|txt)(?:$|[?#])/i.test(candidate.url);
};

const isPersistableResourceCandidate = (candidate: ResourceCandidateRecord): boolean =>
  isFetchableResourceCandidate(candidate) || ["api", "page", "unknown"].includes(candidate.resourceType);

const isSameOriginCandidate = (candidate: ResourceCandidateRecord, baseUrl: string): boolean => {
  try {
    return new URL(candidate.url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
};

const resourceCandidateFromUrl = (
  url: string,
  sourcePageUrl: string,
  label: string,
  discoveryMethod: string,
  resourceType: ResourceType = "document",
): ResourceCandidateRecord | null => {
  const normalized = sanitizeResourceUrl(url, sourcePageUrl);
  if (!normalized) return null;
  return {
    url: normalized,
    canonicalUrl: documentIdentityKey({ url: normalized, resourceType }) ?? normalized,
    label: boundedResourceText(label),
    filename: resourceFilenameFromUrl(normalized),
    resourceType,
    roleHints: assignRoleHints({ label, url: normalized }),
    sourcePageUrl: sanitizeResourceUrl(sourcePageUrl) ?? null,
    discoveryMethod,
    method: "GET",
    contentType: null,
    contentDisposition: null,
  };
};

const discoverTenderResources = async (
  tender: Tender,
  metadata: Record<string, unknown>,
): Promise<ResourceCandidateRecord[]> => {
  const sourcePageUrl = sanitizeResourceUrl(tender.url);
  if (!sourcePageUrl) return [];

  const metadataCandidates: ResourceCandidateRecord[] = [];
  for (const value of metadataArray(metadata, ["resources", "resource_candidates", "resourceCandidates", "subpage_candidates", "subpageCandidates"])) {
    const candidate = structuredResourceCandidate(value, sourcePageUrl);
    if (candidate) metadataCandidates.push(candidate);
  }
  for (const value of metadataArray(metadata, ["pdf_urls", "pdfUrls"])) {
    if (typeof value !== "string") continue;
    const candidate = resourceCandidateFromUrl(value, sourcePageUrl, "", "legacy_pdf_url", "document");
    if (candidate) metadataCandidates.push(candidate);
  }

  const pageCandidates: ResourceCandidateRecord[] = [];
  let staticPageUrl = sourcePageUrl;
  let staticResources: DiscoveredResource[] = [];
  try {
    const response = await fetch(sourcePageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "User-Agent": REALISTIC_USER_AGENT,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) {
      staticPageUrl = sanitizeResourceUrl(response.url) ?? sourcePageUrl;
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (!Number.isFinite(contentLength) || contentLength <= 10 * 1024 * 1024) {
         const html = (await responseHtml(response)).slice(0, 10 * 1024 * 1024);
        staticResources = extractResourcesFromHtml(html, staticPageUrl, { maxResources: RESOURCE_MAX_CANDIDATES });
        pageCandidates.push(...staticResources.map((resource) => resourceCandidateFromDiscovered(resource, staticPageUrl, "dom")));
        pageCandidates.push(...rankSubpageCandidates(staticResources, {
          baseUrl: staticPageUrl,
          limit: RESOURCE_MAX_SUBPAGES,
        }).map((resource) => resourceCandidateFromDiscovered(resource, staticPageUrl, "ranked_subpage")));
      }
    }
  } catch (error) {
    console.warn(`[pipeline] Ressourcen-Seite konnte nicht statisch geladen werden: ${sourcePageUrl}`, error);
  }

  // Retain the older portal-specific fallbacks (e.g. Vergabe-ID document
  // pages) while the generic extractor handles extensionless and data-* links.
  try {
    const legacyLinks = await findPdfLinks(sourcePageUrl);
    pageCandidates.push(...legacyLinks.map((link) => resourceCandidateFromUrl(
      link.url,
      sourcePageUrl,
      link.linkText,
      "legacy_html",
      "document",
    )).filter((candidate): candidate is ResourceCandidateRecord => Boolean(candidate)));
  } catch (error) {
    console.warn(`[pipeline] Legacy-Ressourcenextraktion fehlgeschlagen: ${sourcePageUrl}`, error);
  }

  let renderedPage: Awaited<ReturnType<typeof scrapeWebsite>> | null = null;
  // Always merge rendered resources with static resources. Portals often expose
  // one public PDF in HTML while loading the remaining attachments via JS.
  try {
    renderedPage = await scrapeWebsite(sourcePageUrl, {
      onlyMainContent: false,
      waitUntil: "networkidle",
      waitMs: 1_000,
    });
    pageCandidates.push(...renderedPage.resources.map((resource) => resourceCandidateFromDiscovered(resource, renderedPage!.url, "rendered_dom")));
    pageCandidates.push(...renderedPage.subpageCandidates.map((resource) => resourceCandidateFromDiscovered(resource, renderedPage!.url, "ranked_subpage")));
  } catch (error) {
    console.warn(`[pipeline] Gerenderte Ressourcenextraktion fehlgeschlagen: ${sourcePageUrl}`, error);
  }

  const mergedBeforeSubpages = mergeResourceCandidates(metadataCandidates, pageCandidates)
    .filter(isPersistableResourceCandidate);
  const candidateSubpages = mergedBeforeSubpages
    .filter((candidate) => candidate.resourceType === "page" || candidate.resourceType === "unknown")
    .filter((candidate) => candidate.url !== sourcePageUrl && candidate.url !== staticPageUrl)
    .filter((candidate) => {
      try {
        return new URL(candidate.url).origin === new URL(sourcePageUrl).origin;
      } catch {
        return false;
      }
    })
    .slice(0, RESOURCE_MAX_SUBPAGES);

  for (const subpage of candidateSubpages) {
    try {
      const scrapedSubpage = await scrapeWebsite(subpage.url, {
        onlyMainContent: false,
        waitUntil: "networkidle",
        waitMs: 500,
      });
      pageCandidates.push(...scrapedSubpage.resources.map((resource) => resourceCandidateFromDiscovered(resource, scrapedSubpage.url, "subpage")));
    } catch (error) {
      console.warn(`[pipeline] Unterseite konnte nicht nach Ressourcen durchsucht werden: ${subpage.url}`, error);
    }
  }

  const finalCandidates = mergeResourceCandidates(metadataCandidates, pageCandidates)
    .filter(isPersistableResourceCandidate)
    .slice(0, RESOURCE_MAX_CANDIDATES);
  if (!finalCandidates.some(isFetchableResourceCandidate)) {
    const rootPage = resourceCandidateFromUrl(sourcePageUrl, sourcePageUrl, tender.title ?? "Ausschreibung", "source_page", "page");
    if (rootPage) finalCandidates.push(rootPage);
  }
  if (renderedPage && !finalCandidates.some((candidate) => candidate.url === renderedPage!.url)) {
    const renderedRoot = resourceCandidateFromUrl(renderedPage.url, sourcePageUrl, renderedPage.title ?? tender.title ?? "Ausschreibung", "rendered_page", "page");
    if (renderedRoot) finalCandidates.push(renderedRoot);
  }
  return mergeResourceCandidates(finalCandidates).slice(0, RESOURCE_MAX_CANDIDATES);
};

const parseStructured = (value: string | Record<string, unknown>, fallbackTitle = ""): StructuredData => {
  if (typeof value === "object" && value !== null) return normalizeStructured(value, fallbackTitle);
  const parsed = JSON.parse(value as string);
  return normalizeStructured(parsed, fallbackTitle);
};

const clearTenderScoring = async (tenderId: number): Promise<void> => {
  await db.delete(insights).where(eq(insights.tenderId, tenderId));
  await db.delete(scores).where(eq(scores.tenderId, tenderId));
};

const refreshTenderReadiness = async (tenderId: number, accessBlocked = false) => {
  const tender = await getTender(tenderId);
  const structuredRows = await db
    .select({ jsonBlob: structuredData.jsonBlob, confidence: structuredData.confidence })
    .from(structuredData)
    .where(eq(structuredData.tenderId, tenderId))
    .limit(1);
  const documentRows = await db
    .select({
      id: documents.id,
      url: documents.url,
      role: documents.role,
      roles: documents.roles,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
      roleConfidence: documents.roleConfidence,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  const analysis = buildDocumentAnalysis(documentRows.filter((document) => !isPortalActionUrl(document.url)) as AnalyzedDocument[]);
  const readiness = evaluateTenderReadiness({
    qualityStatus: tender.qualityStatus,
    rawText: tender.rawText,
    structuredExists: structuredRows.length > 0,
    structuredConfidence: structuredRows[0]?.confidence ?? null,
    documentAnalysis: analysis,
    accessBlocked,
  });
  await db.update(tenders).set({
    readinessStatus: readiness.status,
    readinessReason: readiness.reason,
    readinessUpdatedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tenders.id, tenderId));
  if (readiness.status !== "ready") await clearTenderScoring(tenderId);
  return { readiness, analysis };
};

const rejectBlockedTender = async (tenderId: number, detection: AccessPageDetection): Promise<void> => {
  await db.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
  await clearTenderScoring(tenderId);
  await db
    .update(tenders)
    .set({
      qualityStatus: "rejected",
      qualityReason: `Zugriffsschutz erkannt: ${detection.reason ?? "unbekannt"}`,
      readinessStatus: "blocked",
      readinessReason: `Zugriffsschutz erkannt: ${detection.reason ?? "unbekannt"}`,
      readinessUpdatedAt: new Date(),
      rawText: null,
      contentFingerprint: null,
      duplicateOfTenderId: null,
      updatedAt: new Date(),
    })
    .where(eq(tenders.id, tenderId));
  await markCatalogDirty();
};

const retryBlockedDetail = async (tender: Tender, detection: AccessPageDetection): Promise<never> => {
  if (!tender.deadlineAt || tender.deadlineAt.getTime() > Date.now()) {
    throw new Error(`Detailseite vorübergehend nicht verfügbar (${detection.reason ?? "unbekannt"})`);
  }
  await rejectBlockedTender(tender.id, detection);
  throw new Error(`Detailseite abgelaufen oder entfernt (${detection.reason ?? "unbekannt"})`);
};

const getAccessLimitedCacheResult = (
  tender: Tender,
  detection: AccessPageDetection,
): Record<string, JsonValue> | null => {
  const metadata = typeof tender.metadataJson === "object" && tender.metadataJson !== null
    ? tender.metadataJson as Record<string, unknown>
    : {};
  const description = typeof metadata.description === "string"
    ? cleanPublicDescription(metadata.description)
    : "";

  if (metadata.access_limited !== true && detection.reason !== "participation_required") return null;
  if (description.length < 80) return null;

  const existingDescriptionMarkdown = [metadata.descriptionMarkdown, metadata.description_markdown]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?? "";
  const portalFacts = extractPublicPortalFacts([
    tender.rawText,
    metadata.description,
  ].filter((value): value is string => typeof value === "string" && value.length > 0).join(" "));
  const descriptionMarkdown = existingDescriptionMarkdown || buildPublicAccessLimitedDescriptionMarkdown(tender.title ?? "", portalFacts);

  return {
    cached: true,
    detail_cached: false,
    access_limited: true,
    blocked: true,
    blocked_reason: detection.reason ?? "participation_required",
    descriptionMarkdown,
  };
};

const evaluateTenderQuality = async (tender: Tender, structured: StructuredData) => {
  const assessment = assessTenderQuality(tender.title ?? "", tender.url, tender.rawText ?? "", structured);
  if (assessment.status === "rejected") {
    return { ...assessment, duplicateOfTenderId: null as number | null };
  }

  // Check for exact title duplicates in the database
  const normalizedTitle = (tender.title ?? "").trim();
  if (normalizedTitle.length > 10) {
    const titleDuplicates = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(
        and(
          eq(tenders.title, normalizedTitle),
          ne(tenders.id, tender.id),
          ne(tenders.qualityStatus, "duplicate"),
        ),
      )
      .orderBy(asc(tenders.id))
      .limit(1);

    if (titleDuplicates.length > 0) {
      return {
        status: "duplicate" as const,
        reason: `Duplikat: Gleicher Titel wie Ausschreibung #${titleDuplicates[0].id}.`,
        fingerprint: assessment.fingerprint,
        duplicateOfTenderId: titleDuplicates[0].id,
      };
    }
  }

  if (!assessment.fingerprint) {
    return { ...assessment, duplicateOfTenderId: null as number | null };
  }

  const duplicates = await db
    .select({ id: tenders.id })
    .from(tenders)
    .where(and(eq(tenders.contentFingerprint, assessment.fingerprint), ne(tenders.id, tender.id)))
    .orderBy(asc(tenders.id))
    .limit(1);

  if (duplicates.length === 0) {
    return { ...assessment, duplicateOfTenderId: null as number | null };
  }

  return {
    status: "duplicate" as const,
    reason: `Inhalt entspricht bereits Ausschreibung #${duplicates[0].id}.`,
    fingerprint: assessment.fingerprint,
    duplicateOfTenderId: duplicates[0].id,
  };
};

const runCrawl = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const rawSources = payload.sources;
  const sources: SourceItem[] = [];

  if (Array.isArray(rawSources)) {
    for (const source of rawSources) {
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        continue;
      }
      const record = source as Record<string, JsonValue>;
      if (typeof record.url !== "string" || record.url.length === 0) {
        continue;
      }
      const resolved = resolveSourceItem({
        key: typeof record.key === "string" ? record.key : undefined,
        name: typeof record.name === "string" ? record.name : undefined,
        url: record.url,
      });
      if (resolved) {
        sources.push(resolved);
      }
    }
  } else {
    sources.push(...settings.defaultSources);
  }

  let discovered = 0;
  let changed = 0;
  let unchanged = 0;
  for (const src of sources) {
    const items = await discoverTendersFromSource(src);
    for (const tender of items) {
      const upserted = await upsertTender({
        source: tender.source,
        sourceKey: tender.sourceKey,
        url: tender.url,
        title: tender.title,
        externalId: tender.externalId,
        metadata: { discovered_at: new Date().toISOString() },
      });
      if (upserted.changed) {
        await queueTenderProcessing(upserted.id);
        changed += 1;
      } else {
        await recoverTenderProcessing(upserted.id);
        unchanged += 1;
      }
      discovered += 1;
    }
  }

  return { discovered, changed, unchanged };
};

interface ClassifiedResourceCandidate {
  candidate: ResourceCandidateRecord;
  role: DocumentRole;
  roles: DocumentRole[];
  roleSource: string;
  roleConfidence: number;
}

export const classifyResourceCandidate = (candidate: ResourceCandidateRecord): ClassifiedResourceCandidate => {
  const filename = candidate.filename ?? resourceFilenameFromUrl(candidate.url);
  const roleResult = classifyDocumentRole({
    filename,
    url: candidate.url,
    linkText: [candidate.label, ...candidate.roleHints].filter(Boolean).join(" "),
  });
  const roles = mergeDocumentRoles(
    roleResult.roles,
    candidate.roleHints
      .filter((hint) => DOCUMENT_ROLE_VALUES.has(hint as DocumentRole))
      .map((hint) => hint as DocumentRole),
  );
  const role = primaryDocumentRole(roles);
  const roleHint = roleResult.roleHints.find((hint) => hint.role === role);
  return {
    candidate,
    role,
    roles,
    roleSource: roleHint?.source ?? roleResult.source,
    roleConfidence: roleHint?.confidence ?? roleResult.confidence,
  };
};

export const prioritizeResourceCandidates = (candidates: ResourceCandidateRecord[]): ClassifiedResourceCandidate[] => {
  const classified = candidates.map(classifyResourceCandidate);
  const sorted = [...classified].sort((left, right) => {
    const leftPriority = Math.min(...left.roles.map(rolePriority));
    const rightPriority = Math.min(...right.roles.map(rolePriority));
    return leftPriority - rightPriority || left.candidate.canonicalUrl.localeCompare(right.candidate.canonicalUrl);
  });
  const reservedRoles = new Set<DocumentRole>();
  const prioritized = sorted.filter((candidate) => {
    const meaningfulRoles = candidate.roles.filter((role) => role !== "other");
    if (meaningfulRoles.length === 0 || meaningfulRoles.every((role) => reservedRoles.has(role))) return false;
    for (const role of meaningfulRoles) reservedRoles.add(role);
    return true;
  });
  return [...prioritized, ...sorted.filter((candidate) => !prioritized.includes(candidate))];
};

interface PipelineDocumentRow {
  id: number;
  url: string | null;
  sha256: string;
  downloadStatus: string | null;
  storagePath: string;
  contentType: string | null;
  filename: string | null;
  updatedAt: Date;
}

const documentMatchesCandidate = (document: PipelineDocumentRow, candidate: ResourceCandidateRecord): boolean =>
  document.url === candidate.url
  || (Boolean(document.url) && sanitizeResourceUrl(document.url) === candidate.canonicalUrl);

const documentFilename = (candidate: ResourceCandidateRecord, storedFilename: string | null | undefined, contentType: string): string => {
  const safeStored = boundedResourceText(storedFilename, 255);
  const safeCandidate = boundedResourceText(candidate.filename, 255);
  const fallback = suggestedFilename(candidate.url, "document").replace(/^[0-9a-f]{12}-/, "");
  return ensureExtension(safeStored || safeCandidate || fallback, contentType);
};

const isDocumentRefreshDue = (document: PipelineDocumentRow): boolean => {
  const updatedAt = document.updatedAt instanceof Date ? document.updatedAt.getTime() : Number.NaN;
  return !Number.isFinite(updatedAt)
    || Date.now() - updatedAt >= settings.documentRefreshHours * 60 * 60 * 1000;
};

const upsertDownloadedDocument = async (
  tenderId: number,
  candidate: ResourceCandidateRecord,
  stored: Awaited<ReturnType<typeof fetchAndStore>>,
  classification: ClassifiedResourceCandidate,
  documentsByTender: PipelineDocumentRow[],
  storagePath: string,
): Promise<{ id: number | null; saved: boolean }> => {
  const existingByUrl = documentsByTender.find((document) => documentMatchesCandidate(document, candidate)) ?? null;
  const existingByHash = documentsByTender.find((document) => document.sha256 === stored.sha256) ?? null;
  const action = decideDocumentPersistence(existingByUrl, existingByHash, stored.sha256);
  const filename = documentFilename(candidate, stored.filename, stored.contentType);
  const values = {
    tenderId,
    url: candidate.url,
    storagePath,
    sha256: stored.sha256,
    contentType: stored.contentType,
    filename,
    downloadStatus: "downloaded" as const,
    parseStatus: "pending" as const,
    errorMessage: null,
    role: classification.role,
    roles: classification.roles,
    roleSource: classification.roleSource,
    roleConfidence: classification.roleConfidence,
    aiSummary: null,
    updatedAt: new Date(),
  };

  if (action === "skip") {
    if (existingByUrl && existingByUrl.sha256 === stored.sha256) {
      await db.update(documents).set({ updatedAt: new Date(), errorMessage: null }).where(eq(documents.id, existingByUrl.id));
      existingByUrl.updatedAt = new Date();
    }
    return { id: existingByHash?.id ?? existingByUrl?.id ?? null, saved: false };
  }

  if (action === "update" && existingByUrl) {
    await db.update(documents).set(values).where(eq(documents.id, existingByUrl.id));
    existingByUrl.sha256 = stored.sha256;
    existingByUrl.storagePath = storagePath;
    existingByUrl.contentType = stored.contentType;
    existingByUrl.filename = filename;
    existingByUrl.downloadStatus = "downloaded";
    existingByUrl.updatedAt = new Date();
    return { id: existingByUrl.id, saved: true };
  }

  const inserted = await db.insert(documents).values(values).onConflictDoNothing().returning({ id: documents.id });
  if (inserted.length > 0) {
    documentsByTender.push({
      id: inserted[0].id,
      url: candidate.url,
      sha256: stored.sha256,
      downloadStatus: "downloaded",
      storagePath,
      contentType: stored.contentType,
      filename,
      updatedAt: new Date(),
    });
    return { id: inserted[0].id, saved: true };
  }

  const existingHashRows = await db
    .select({ id: documents.id, downloadStatus: documents.downloadStatus })
    .from(documents)
    .where(and(eq(documents.tenderId, tenderId), eq(documents.sha256, stored.sha256)))
    .limit(1);
  return { id: existingHashRows[0]?.id ?? null, saved: false };
};

const upsertFailedDocument = async (
  tenderId: number,
  candidate: ResourceCandidateRecord,
  classification: ClassifiedResourceCandidate,
  message: string,
  documentsByTender: PipelineDocumentRow[],
): Promise<void> => {
  const existing = documentsByTender.find((document) => documentMatchesCandidate(document, candidate));
  if (existing?.downloadStatus === "downloaded") return;
  const urlHash = createHash("sha256").update(candidate.url).digest("hex");
  const values = {
    tenderId,
    url: candidate.url,
    storagePath: `tenders/${tenderId}/failed-${urlHash}.download`,
    sha256: `failed:${urlHash}`,
    filename: candidate.filename ?? resourceFilenameFromUrl(candidate.url),
    downloadStatus: "failed" as const,
    parseStatus: "pending" as const,
    errorMessage: message.slice(0, 500),
    role: classification.role,
    roles: classification.roles,
    roleSource: classification.roleSource,
    roleConfidence: classification.roleConfidence,
    aiSummary: null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(documents).set(values).where(eq(documents.id, existing.id));
    existing.sha256 = values.sha256;
    existing.downloadStatus = "failed";
    return;
  }

  const inserted = await db.insert(documents).values(values).onConflictDoNothing().returning({ id: documents.id });
  if (inserted.length > 0) {
    documentsByTender.push({
      id: inserted[0].id,
      url: candidate.url,
      sha256: values.sha256,
      downloadStatus: "failed",
      storagePath: values.storagePath,
      contentType: null,
      filename: values.filename,
      updatedAt: new Date(),
    });
  }
};

const upsertTenderResource = async (tenderId: number, candidate: ResourceCandidateRecord): Promise<{ id: number; status: string }> => {
  const rows = await db
    .insert(tenderResources)
    .values({
      tenderId,
      url: candidate.url,
      canonicalUrl: candidate.canonicalUrl,
      label: candidate.label,
      filename: candidate.filename,
      resourceType: candidate.resourceType,
      roleHints: candidate.roleHints,
      sourcePageUrl: candidate.sourcePageUrl,
      discoveryMethod: candidate.discoveryMethod,
      method: candidate.method,
      contentType: candidate.contentType,
      contentDisposition: candidate.contentDisposition,
    })
    .onConflictDoUpdate({
      target: [tenderResources.tenderId, tenderResources.canonicalUrl],
      set: {
        url: candidate.url,
        label: candidate.label,
        filename: candidate.filename,
        resourceType: candidate.resourceType,
        roleHints: candidate.roleHints,
        sourcePageUrl: candidate.sourcePageUrl,
        discoveryMethod: candidate.discoveryMethod,
        method: candidate.method,
        contentType: candidate.contentType,
        contentDisposition: candidate.contentDisposition,
        updatedAt: new Date(),
      },
    })
    .returning({ id: tenderResources.id, status: tenderResources.status });
  return rows[0];
};

const runFetchDocuments = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }

  const tender = await getTender(tenderId);

  const metadata = parseRecord(tender.metadataJson as string);
  const candidates = await discoverTenderResources(tender, metadata);
  const resourceRows = new Map<string, { id: number; status: string }>();
  for (const candidate of candidates) {
    const row = await upsertTenderResource(tenderId, candidate);
    resourceRows.set(candidate.canonicalUrl, row);
    if (candidate.method !== "GET") {
      await db.update(tenderResources).set({
        status: "skipped",
        errorMessage: "Nur sichere GET-Ressourcen werden automatisch geladen.",
        updatedAt: new Date(),
      }).where(eq(tenderResources.id, row.id));
      row.status = "skipped";
    }
  }

  const fetchable = candidates.filter(isFetchableResourceCandidate);
  const pageFallbacks = candidates
    .filter((candidate) => ["page", "unknown"].includes(candidate.resourceType))
    .filter((candidate) => !isPortalActionUrl(candidate.url))
    .filter((candidate) => isSameOriginCandidate(candidate, tender.url));
  const candidatePool = (fetchable.length > 0 ? fetchable : pageFallbacks)
    .filter((candidate) => candidate.method === "GET");
  const prioritized = prioritizeResourceCandidates(candidatePool)
    .slice(0, Math.max(1, settings.maxPdfLinksPerTender));
  const existingDocuments = await db
    .select({
      id: documents.id,
      url: documents.url,
      sha256: documents.sha256,
      downloadStatus: documents.downloadStatus,
      storagePath: documents.storagePath,
      contentType: documents.contentType,
      filename: documents.filename,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  let saved = 0;
  let attemptedResources = 0;
  let failedResources = 0;

  for (const classified of prioritized) {
    const candidate = classified.candidate;
    const resource = resourceRows.get(candidate.canonicalUrl);
    if (!resource) continue;
    const existingByUrl = existingDocuments.find((document) => documentMatchesCandidate(document, candidate));
    if (resource.status === "downloaded" && existingByUrl?.downloadStatus === "downloaded" && !isDocumentRefreshDue(existingByUrl)) continue;
    if (existingByUrl?.downloadStatus === "downloaded" && !isDocumentRefreshDue(existingByUrl)) {
      await db.update(tenderResources).set({ status: "downloaded", errorMessage: null, updatedAt: new Date() }).where(eq(tenderResources.id, resource.id));
      resource.status = "downloaded";
      continue;
    }

    attemptedResources += 1;
    await db.update(tenderResources).set({
      status: "downloading",
      attempts: sql`${tenderResources.attempts} + 1`,
      lastAttemptAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    }).where(eq(tenderResources.id, resource.id));

    const baseName = suggestedFilename(candidate.url, `tender-${tenderId}-${attemptedResources}`);
    const relative = `tenders/${tenderId}/${baseName}`;
    try {
      const stored = await fetchAndStore(candidate.url, relative, {
        referer: candidate.sourcePageUrl ?? tender.url,
        sessionPageUrl: candidate.sourcePageUrl ?? tender.url,
        userAgent: REALISTIC_USER_AGENT,
        headers: { Accept: RESOURCE_FETCH_ACCEPT },
      });
      const normalizedPath = ensureExtension(stored.storagePath, stored.contentType);
      if (normalizedPath !== stored.storagePath) {
        const original = objectAbsolutePath(stored.storagePath);
        const target = objectAbsolutePath(normalizedPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(original, target);
        fs.unlinkSync(original);
      }

      const persisted = await upsertDownloadedDocument(
        tenderId,
        candidate,
        stored,
        classified,
        existingDocuments,
        normalizedPath,
      );
      if (persisted.saved) saved += 1;
      await db.update(tenderResources).set({
        url: sanitizeResourceUrl(stored.finalUrl) ?? candidate.url,
        filename: stored.filename ?? candidate.filename,
        contentType: stored.contentType,
        contentDisposition: stored.contentDisposition ?? candidate.contentDisposition,
        status: "downloaded",
        errorMessage: null,
        updatedAt: new Date(),
      }).where(eq(tenderResources.id, resource.id));
      resource.status = "downloaded";
    } catch (error) {
      failedResources += 1;
      const message = error instanceof Error ? error.message : "unbekannter Downloadfehler";
      await upsertFailedDocument(tenderId, candidate, classified, message, existingDocuments);
      await db.update(tenderResources).set({
        status: "failed",
        errorMessage: message.slice(0, 500),
        updatedAt: new Date(),
      }).where(eq(tenderResources.id, resource.id));
      resource.status = "failed";
      console.warn(`[pipeline] Ressourcen-Download fehlgeschlagen: ${candidate.url}`, error);
    }
  }

  await refreshTenderReadiness(tenderId);
  await queueTenderStage(JOB_PARSE, tenderId);
  return {
    documents_saved: saved,
    resources_discovered: candidates.length,
    resources_attempted: attemptedResources,
    resources_failed: failedResources,
    resource_fingerprint: buildResourceFingerprint(tender.url, metadata),
  };
};

const runParseDocuments = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }

  const tender = await getTender(tenderId);
  const docs = (await db
    .select({
      id: documents.id,
      storagePath: documents.storagePath,
      contentType: documents.contentType,
      filename: documents.filename,
      url: documents.url,
      role: documents.role,
      roles: documents.roles,
      roleSource: documents.roleSource,
      roleConfidence: documents.roleConfidence,
      extractedText: documents.extractedText,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId))
    .orderBy(documents.id))
    .filter((document) => !isPortalActionUrl(document.url));

  if (docs.length === 0) {
    // No documents to parse — raw_text may already be set (e.g. from RSS description)
    await refreshTenderReadiness(tenderId);
    await queueTenderStage(JOB_STRUCTURE, tenderId);
    return { chunks: 0, skipped: "keine Dokumente, raw_text bereits vorhanden" };
  }

  // Parse every document before applying the aggregate text budget. Otherwise
  // an early, unclassified attachment could hide a later Leistungsbeschreibung.
  const parsedDocumentCandidates: ParsedTenderDocument[] = [];
  let partial = false;

  for (const doc of docs) {
    const absPath = objectAbsolutePath(doc.storagePath);
    try {
      const extracted = await extractTextFromFile(absPath, doc.contentType);
      const pageText = (extracted.pages.length > 0
        ? extracted.pages
          .map((page, index) => `[Seite ${index + 1}]\n${page}`)
          .join("\n\n")
        : extracted.text).replace(/\u0000/g, "");
      const bounded = pageText.length > MAX_DOCUMENT_TEXT_CHARS
        ? `${pageText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}\n[Text wegen Größenlimit gekürzt]`
        : pageText;

      // Refine weak filename/URL classifications with document content.
      let effectiveRoles = normalizeDocumentRoles(doc.roles, doc.role);
      let effectiveRole = primaryDocumentRole(effectiveRoles);
      let effectiveRoleSource = doc.roleSource ?? null;
      let effectiveRoleConfidence = doc.roleConfidence ?? 0;
      if (!doc.role || doc.role === "other" || effectiveRoleConfidence < 0.75) {
        const refined = classifyDocumentRole({
          filename: doc.filename,
          url: doc.url,
          textSample: bounded.slice(0, 3000),
        });
        if (refined.role !== "other" && (!doc.role || doc.role === "other" || refined.confidence >= effectiveRoleConfidence)) {
          effectiveRoles = mergeDocumentRoles(effectiveRoles, refined.roles);
          effectiveRole = primaryDocumentRole(effectiveRoles);
          effectiveRoleSource = refined.source;
          effectiveRoleConfidence = refined.confidence;
        }
      }
      effectiveRole = primaryDocumentRole(effectiveRoles);

      if (bounded.trim().length >= 20) {
        parsedDocumentCandidates.push({ id: doc.id, role: effectiveRole, roles: effectiveRoles, text: bounded });
      } else {
        partial = true;
      }

      await db
        .update(documents)
        .set({
          extractedText: bounded.trim().length >= 20 ? bounded : doc.extractedText,
          parseStatus: bounded.trim().length >= 20 ? "parsed" : "empty",
          errorMessage: null,
          pageCount: extracted.pageCount,
          role: effectiveRole,
          roles: effectiveRoles,
          roleSource: effectiveRoleSource,
          roleConfidence: effectiveRoleConfidence || null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id));
    } catch (error) {
      partial = true;
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : "unbekannter Parserfehler");
      // Store the error on the document row for debugging, but do NOT pollute
      // the tender's analytical rawText with error markers. A failed parse is a
      // document-level failure, not tender content.
      await db
        .update(documents)
        .set({ extractedText: doc.extractedText, parseStatus: "failed", errorMessage: message, updatedAt: new Date() })
        .where(eq(documents.id, doc.id));
    }
  }

  // Sort by role priority (Leistungsbeschreibung first) and tag sections so the
  // structurer knows which document type each text block comes from.
  const parsedDocs = deduplicateParsedDocuments(parsedDocumentCandidates);
  parsedDocs.sort((a, b) => rolePriority(a.role) - rolePriority(b.role) || a.id - b.id);
  let remainingText = MAX_TENDER_TEXT_CHARS;
  const mergedParts: string[] = [];
  for (const document of parsedDocs) {
    if (remainingText <= 0) break;
    const text = document.text.slice(0, remainingText);
    if (!text.trim()) continue;
    mergedParts.push(`[ROLLEN: ${document.roles.join(", ")}] [ROLLE: ${document.role}] [DOKUMENT-ID: ${document.id}]\n${text}`);
    remainingText -= text.length;
  }

  // Only overwrite rawText when we actually extracted content. An all-failed
  // parse must not erase the listing-page description that was already stored.
  const merged = mergedParts.join("\n\n").slice(0, MAX_TENDER_TEXT_CHARS).trim();
  // A partial parse must not replace a previously usable raw text snapshot.
  // New tenders without a snapshot may still use the successful subset.
  if (merged && (!partial || !(tender.rawText ?? "").trim())) {
    await db
      .update(tenders)
      .set({ rawText: merged, updatedAt: new Date() })
      .where(eq(tenders.id, tenderId));
  }
  await markCatalogDirty();
  await queueTenderStage(JOB_STRUCTURE, tenderId);
  const refreshedDocs = await db
    .select({
      id: documents.id,
      url: documents.url,
      role: documents.role,
      roles: documents.roles,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
      roleConfidence: documents.roleConfidence,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  const analysis = buildDocumentAnalysis(refreshedDocs.filter((document) => !isPortalActionUrl(document.url)) as AnalyzedDocument[]);
  return {
    parsed_documents: docs.length,
    parsed_successfully: parsedDocs.length,
    text_length: merged.length,
    partial,
    missing_roles: analysis.coverage.missingRoles,
  };
};

const runStructureTender = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }

  const tender = await getTender(tenderId);
  if (!tender.rawText || tender.rawText.trim().length === 0) {
    throw new Error("kein Rohtext vorhanden");
  }

  const accessPage = detectAccessPage(tender.rawText, { title: tender.title ?? undefined, url: tender.url });
  if (accessPage.blocked) {
    console.warn(`[pipeline] Tender ${tenderId} blockierte Zugriffsseite (${accessPage.reason})`);
    await rejectBlockedTender(tenderId, accessPage);
    return { blocked: true, blocked_reason: accessPage.reason ?? "unknown" };
  }

  const tenderMetadata = parseRecord(tender.metadataJson as string);
  const reference = typeof tenderMetadata.reference_number === "string"
    ? tenderMetadata.reference_number
    : typeof tenderMetadata.referenceNumber === "string"
      ? tenderMetadata.referenceNumber
      : null;
  const structured = await extractStructuredData(tender.title ?? "Unbenannte Ausschreibung", tender.rawText, { reference });

  const documentRows = await db
    .select({
      id: documents.id,
      url: documents.url,
      role: documents.role,
      roles: documents.roles,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
      roleConfidence: documents.roleConfidence,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  const baseDocumentAnalysis = buildDocumentAnalysis(documentRows.filter((document) => !isPortalActionUrl(document.url)) as AnalyzedDocument[]);
  structured.document_analysis = withEvidenceValues(baseDocumentAnalysis, {
    deadline: structured.hard_facts.deadline,
    scope: structured.decision_relevant.scope.join(" ") || structured.summary,
    requirements: structured.decision_relevant.requirements.join(" ") || null,
    award_criteria: structured.decision_relevant.award_criteria.join(" ") || null,
  });

  // If the LLM didn't extract a deadline but the DB already has one, use it
  if (!structured.hard_facts.deadline && tender.deadlineAt) {
    const d = new Date(tender.deadlineAt);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    structured.hard_facts.deadline = `${dd}.${mm}.${yyyy}, ${hh}:${mi} Uhr`;
  }
  structured.descriptionMarkdown = buildStructuredDescriptionMarkdown(structured, reference);

  await db
    .insert(structuredData)
    .values({
      tenderId,
      jsonBlob: structured,
      confidence: structured.confidence,
    })
    .onConflictDoUpdate({
      target: structuredData.tenderId,
      set: {
        jsonBlob: structured,
        confidence: structured.confidence,
        updatedAt: new Date(),
      },
    });

  // Store procurement data in tenders table
  const procurement = structured.procurement;
  await db
    .update(tenders)
    .set({
      contractValueMin: procurement?.contract_value?.min ?? null,
      contractValueMax: procurement?.contract_value?.max ?? null,
      contractDurationMonths: procurement?.contract_duration?.months ?? null,
      procedureType: procurement?.procedure_type ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tenders.id, tenderId));

  const quality = await evaluateTenderQuality(tender, structured);
  const qualityUpdate: Record<string, unknown> = {
    qualityStatus: quality.status,
    qualityReason: quality.reason,
    contentFingerprint: quality.fingerprint,
    duplicateOfTenderId: quality.duplicateOfTenderId,
    updatedAt: new Date(),
  };
  if (quality.status === "qualified" && !tender.slug) {
    const metadata = parseRecord(tender.metadataJson as string);
    const location = metadata.location;
    qualityUpdate.slug = generateTenderSlug(
      tender.title ?? "",
      typeof location === "string" ? location : undefined,
    );
  }
  await db
    .update(tenders)
    .set(qualityUpdate)
    .where(eq(tenders.id, tenderId));
  const readiness = await refreshTenderReadiness(tenderId);
  await markCatalogDirty();
  await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });

  if (quality.status !== "qualified") {
    await clearTenderScoring(tenderId);
    return {
      confidence: structured.confidence,
      quality_status: quality.status,
      quality_reason: quality.reason,
      duplicate_of_tender_id: quality.duplicateOfTenderId,
    };
  }

  if (readiness.readiness.status === "ready") {
    await queueTenderStage(JOB_SCORE, tenderId);
  }
  await queueTenderStage(JOB_CACHE_DETAIL, tenderId);
  return {
    confidence: structured.confidence,
    quality_status: quality.status,
    quality_reason: quality.reason,
    readiness_status: readiness.readiness.status,
  };
};

const DETAIL_CACHE_PROMPT = `Du bist ein Experte fuer oeffentliche Ausschreibungen in Deutschland.
Analysiere den folgenden Inhalt und extrahiere ALLE Details.

WICHTIG:
- Der Inhalt kann auf Deutsch ODER Englisch sein. Antworte IMMER auf Deutsch.
- Extrahiere NUR Informationen die EXPLIZIT auf der Seite stehen. NIEMALS erfinden!
- Bei Zuschlagskriterien: Lies die Zahlen EXAKT ab. "Zuschlagskriterium — Zahl: 100" = 100%.
- "description" MUSS eine ausfuehrliche Zusammenfassung der Ausschreibung sein (mindestens 200 Zeichen).
- "scope" MUSS den Leistungsumfang beschreiben.

KRITISCH - Ignoriere diese Inhalte VOLLSTAENDIG:
- VHB-Formblätter (Eigenerklärung, Eignungserklärung, Formblatt 124, etc.)
- GAEB-Software-Anleitungen (wingaeb.xml, Kalkulationsprogramm, Bietercockpit)
- Anleitungen zur Angebotsabgabe im Bietercockpit
- PDF-Formular-Vorlagen und deren Feldbeschreibungen
- Rechtliche Hinweise/AGB, die NICHT spezifisch fuer diese Ausschreibung sind
- Nur den TATSaECHLICHEN Auftragsgegenstand beschreiben, NICHT die Formulare

Antworte NUR mit validem JSON:
{
  "title": "Titel",
  "client": "Auftraggeber",
  "deadline": "2026-06-15" oder null,
  "description": "Ausfuehrliche Beschreibung mit allen Details (min. 200 Zeichen)",
  "requirements": ["Anforderung 1"],
  "scope": "Leistungsumfang",
  "contact": "Kontaktdaten",
  "procedure": "Verfahrensart",
  "awardCriteria": ["Preis (100%)"],
  "duration": "Laufzeit",
  "location": "Ort",
  "referenceNumber": "Referenz",
  "pdfUrls": ["https://..."],
  "estimatedValue": "Schaetzwert" oder null
}`;

const runCacheDetail = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }

  const rows = await db.select().from(tenders).where(eq(tenders.id, tenderId)).limit(1);
  if (rows.length === 0 || !rows[0].url) {
    throw new Error("Tender nicht gefunden oder keine URL");
  }

  const tender = rows[0];
  const sourceUrl = tender.url;

  // Check if already cached with good content
  const existing = await db.select().from(structuredData).where(eq(structuredData.tenderId, tenderId)).limit(1);
  if (existing.length > 0) {
    const blob = parseRecord(existing[0].jsonBlob as string);
    const cachedAccessPage = detectAccessPage(JSON.stringify(blob), { title: tender.title ?? undefined, url: sourceUrl });
    if (cachedAccessPage.blocked) {
      console.warn(`[cache-detail] Entferne blockierten Cache fuer Tender ${tenderId} (${cachedAccessPage.reason})`);
      const accessLimitedResult = getAccessLimitedCacheResult(tender, cachedAccessPage);
      if (accessLimitedResult) {
        console.info(`[cache-detail] Nutze vorhandene Zugangsbeschraenkungs-Zusammenfassung fuer Tender ${tenderId}`);
        return accessLimitedResult;
      }
      await db.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
      await retryBlockedDetail(tender, cachedAccessPage);
    }

    // Check flat format (from cache_detail)
    const hasFlatDescription = typeof blob.description === "string" && cleanPublicDescription(blob.description).length > 200;
    const hasKeyFields = blob.estimatedValue && blob.procedure && blob.duration;

    // Check nested format (from structure_tender) — look at summary and hard_facts
    const hasNestedData = blob.decision_relevant && typeof blob.decision_relevant === "object";
    const hardFacts = hasNestedData ? (blob.hard_facts as Record<string, unknown>) : null;
    const hasNestedDeadline = hardFacts?.deadline;
    const hasNestedScope = hasNestedData && Array.isArray((blob.decision_relevant as Record<string, unknown>).scope) && ((blob.decision_relevant as Record<string, unknown>).scope as unknown[]).length > 0;

    // Skip if we have good flat data OR rich nested data with deadline + scope
    if ((hasFlatDescription && hasKeyFields) || (hasNestedDeadline && hasNestedScope)) {
      const normalizedCached = normalizeStructured(blob, tender.title ?? "");
      const cachedDescriptionMarkdown = typeof normalizedCached.descriptionMarkdown === "string"
        ? normalizedCached.descriptionMarkdown
        : "";
      const existingDescriptionMarkdown = [blob.descriptionMarkdown, blob.description_markdown]
        .find((value): value is string => typeof value === "string" && value.trim().length > 0)
        ?? "";
      if (cachedDescriptionMarkdown || existingDescriptionMarkdown) {
        blob.descriptionMarkdown = cachedDescriptionMarkdown || existingDescriptionMarkdown;
        delete blob.description_markdown;
        await db.update(structuredData).set({ jsonBlob: blob, updatedAt: new Date() }).where(eq(structuredData.tenderId, tenderId));
      }
      return { cached: true, detail_cached: true };
    }
  }

  const meta = parseRecord(tender.metadataJson as string);

  // Build detail from existing metadata (instant, no API calls)
  const description = cleanPublicDescription(String(meta.description ?? ""));
  const client = String(meta.client ?? "Unbekannt");

  // Only use LLM if we have substantial page content to extract from
  const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";
  let result: Record<string, unknown> | undefined;

  // Always scrape the full page for best content, but prefer raw_text if richer
  let fullContent = description;
  const rawText = tender.rawText ?? "";
  const isSPA = /meinauftrag\.rib\.de/.test(sourceUrl);
  if (openrouterKey) {
    try {
      // SPA pages need networkidle + extra wait to render content + body text extraction
      const page = await scrapeWebsite(sourceUrl, isSPA ? { waitUntil: "networkidle", waitMs: 5000, onlyMainContent: false, useBodyText: true } : undefined);
      const markdown = page.markdown ?? "";
      console.log(`[cache-detail] Scrape: ${markdown.length} Zeichen (description: ${description.length}, isSPA: ${isSPA})`);
      if (markdown.length > description.length) {
        // Find actual tender content (skip navigation/sidebar)
        const contentMarkers = ["Beschaffer", "Auftraggeber", "Vergabestelle", "Verfahren", "Zuschlagskriterien", "Bietfrist", "Angebotsfrist", "CONTRACTING AUTHORITY", "DATES AND DEADLINES", "TENDER PROCEDURES"];
        let contentStart = -1;
        for (const marker of contentMarkers) {
          const idx = markdown.indexOf(marker);
          if (idx >= 0 && (contentStart < 0 || idx < contentStart)) {
            contentStart = idx;
          }
        }
        const startPos = contentStart > 500 ? contentStart - 500 : 0;
        fullContent = markdown.substring(startPos, startPos + 30000);
      }
    } catch (e) {
      console.log(`[cache-detail] Scrape fehlgeschlagen, nutze Metadaten: ${e}`);
    }
  }

  // Use raw_text (PDF/document content) if it's significantly richer than the scraped page
  // But skip rawText if it's mostly PDF form boilerplate (VHB, GAEB, Bietercockpit)
  if (rawText.length > fullContent.length + 500) {
    const formMarkerHits = [
      /VHB\s*-\s*Bund\s*-\s*Ausgabe/i,
      /Eigenerklärung\s+(?:zur\s+)?Eignung/i,
      /Eigenerklärung\s+fuer\s+nicht\s+praequalifizierte/i,
      /Angaben?\s+zu\s+Arbeitskraeften/i,
      /Angabe\s+zur\s+Mitgliedschaft\s+bei\s+der\s+Berufsgenossenschaft/i,
      /AI\s+Bietercockpit/i,
      /GAEB\s*-\s*Kalkulationssoftware/i,
      /wingaeb\.xml/i,
      /Massnahmennummer\s+Vergabenummer\s+Vergabeart/i,
      /Oeffentliche\s+Ausschreibung\s+Offenes\s+Verfahren/i,
      /Beschraenkte\s+Ausschreibung\s+Nichtoffenes\s+Verfahren/i,
      /Freihaendige\s+Vergabe\s+Verhandlungsverfahren/i,
      /NATO\s*-\s*Ausschreibung/i,
      /Baumassnahme\s+Leistung\s+Bewerber/i,
      /nicht\s+praequalifizierte\s+Unternehmen/i,
      /VHB\s+\d+.*?©\s*VHB/i,
    ].filter((p) => p.test(rawText)).length;

    if (formMarkerHits >= 2) {
      console.log(`[cache-detail] rawText uebersprungen: ${formMarkerHits} PDF-Formular-Marker erkannt`);
    } else {
      console.log(`[cache-detail] Nutze raw_text (${rawText.length} Zeichen) statt gescrapter Seite (${fullContent.length} Zeichen)`);
      fullContent = rawText.slice(0, 30000);
    }
  }

  const scrapedAccessPage = detectAccessPage(fullContent, { title: tender.title ?? undefined, url: sourceUrl });
  if (scrapedAccessPage.blocked) {
    console.warn(`[cache-detail] Blockierte Detailseite fuer Tender ${tenderId} (${scrapedAccessPage.reason})`);
    const accessLimitedResult = getAccessLimitedCacheResult(tender, scrapedAccessPage);
    if (accessLimitedResult) {
      console.info(`[cache-detail] Nutze vorhandene Zugangsbeschraenkungs-Zusammenfassung fuer Tender ${tenderId}`);
      return accessLimitedResult;
    }
    await retryBlockedDetail(tender, scrapedAccessPage);
  }

  if (fullContent.length > 200 && openrouterKey) {
    // We have good content — use LLM to structure it
    try {
      const llmClient = new OpenAI({ apiKey: openrouterKey, baseURL: "https://openrouter.ai/api/v1", timeout: 120_000, maxRetries: 0 });
      const content = await callLLM(llmClient, {
        messages: [
          { role: "system", content: DETAIL_CACHE_PROMPT },
          { role: "user", content: `URL: ${sourceUrl}\n\nInhalt:\n${fullContent}` },
        ],
        temperature: 0.1,
        max_tokens: 6000,
      });
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
          console.log(`[cache-detail] LLM: desc=${String(extracted.description ?? "").length} proc=${extracted.procedure ?? "nein"} scope=${String(extracted.scope ?? "").length}`);
          result = {
          title: String(extracted.title ?? tender.title ?? ""),
          client: String(extracted.client ?? client),
          deadline: extracted.deadline ? String(extracted.deadline) : (tender.deadlineAt ? new Date(tender.deadlineAt).toISOString().split("T")[0] : null),
          description: cleanPublicDescription(String(extracted.description ?? description)),
          requirements: Array.isArray(extracted.requirements) ? extracted.requirements : [],
          scope: String(extracted.scope ?? ""),
          contact: String(extracted.contact ?? ""),
          procedure: String(extracted.procedure ?? ""),
          awardCriteria: Array.isArray(extracted.awardCriteria) ? extracted.awardCriteria : [],
          duration: String(extracted.duration ?? ""),
          location: String(extracted.location ?? ""),
          referenceNumber: extracted.referenceNumber ? String(extracted.referenceNumber) : (meta.reference_number ? String(meta.reference_number) : null),
          pdfUrls: Array.isArray(extracted.pdfUrls) ? extracted.pdfUrls.filter((u: unknown) => typeof u === "string" && (u as string).startsWith("http")) : (Array.isArray(meta.pdf_urls) ? meta.pdf_urls : []),
          estimatedValue: extracted.estimatedValue ? String(extracted.estimatedValue) : null,
          sourceUrl,
          cached: false,
          scrapedAt: new Date().toISOString(),
        };
        } catch { /* fall through */ }
      }
    } catch (error) {
      console.warn(`[cache-detail] LLM-Anreicherung fehlgeschlagen, nutze Fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Try oeffentlichevergabe.de enrichment if key data is missing or description is thin
  const hasThinDescription = !result || !result.description || (typeof result.description === "string" && result.description.length < 100);
  const hasLimitedData = !result || (
    !result.estimatedValue ||
    !result.procedure ||
    !result.duration
  );

  if ((hasLimitedData || hasThinDescription) && tender.title && tender.title.length >= 10) {
    try {
      console.log(`[cache-detail] Versuche oeffentlichevergabe.de Anreicherung fuer: ${tender.title.slice(0, 60)}...`);
      const oeffDetails = await enrichFromOeffentlicheVergabe(tender.title, description);

      if (oeffDetails) {
        console.log(`[cache-detail] oeffentlichevergabe.de Daten gefunden: value=${oeffDetails.estimatedValue ?? "nein"}, docs=${oeffDetails.evergabeDocumentUrls.length}`);

        // Merge enriched data into result
        if (!result) {
          result = {
            title: String(tender.title ?? ""),
            client: oeffDetails.buyer ?? client,
            deadline: tender.deadlineAt ? new Date(tender.deadlineAt).toISOString().split("T")[0] : null,
            description: cleanPublicDescription(oeffDetails.description ?? description),
            requirements: [],
            scope: oeffDetails.lotDescription ?? "",
            contact: oeffDetails.contact ?? "",
            procedure: oeffDetails.procedure ?? "",
            awardCriteria: [],
            duration: oeffDetails.duration ?? "",
            location: String(meta.location ?? ""),
            referenceNumber: meta.reference_number ? String(meta.reference_number) : null,
            pdfUrls: oeffDetails.evergabeDocumentUrls.length > 0 ? oeffDetails.evergabeDocumentUrls : (Array.isArray(meta.pdf_urls) ? meta.pdf_urls : []),
            estimatedValue: oeffDetails.estimatedValue,
            sourceUrl: oeffDetails.portalUrl ?? sourceUrl,
            cached: false,
            scrapedAt: new Date().toISOString(),
          };
        } else {
          // Merge missing fields from enriched data
          if (!result.estimatedValue && oeffDetails.estimatedValue) {
            result.estimatedValue = oeffDetails.estimatedValue;
          }
          if (!result.procedure && oeffDetails.procedure) {
            result.procedure = oeffDetails.procedure;
          }
          if (!result.duration && oeffDetails.duration) {
            result.duration = oeffDetails.duration;
          }
          if (!result.contact && oeffDetails.contact) {
            result.contact = oeffDetails.contact;
          }
          if ((!result.scope || (typeof result.scope === "string" && result.scope.length < 20)) && oeffDetails.lotDescription) {
            result.scope = oeffDetails.lotDescription;
          }
          // Enrich thin description from oeffentlichevergabe.de
          if (oeffDetails.description && oeffDetails.description.length > 50 && (!result.description || (typeof result.description === "string" && result.description.length < 100))) {
            result.description = cleanPublicDescription(oeffDetails.description);
          }
          if (oeffDetails.evergabeDocumentUrls.length > 0) {
            const existingUrls = Array.isArray(result.pdfUrls) ? result.pdfUrls as string[] : [];
            const newUrls = oeffDetails.evergabeDocumentUrls.filter(u => !existingUrls.includes(u));
            result.pdfUrls = [...existingUrls, ...newUrls];
          }
          if (oeffDetails.buyer && (!result.client || result.client === "Unbekannt")) {
            result.client = oeffDetails.buyer;
          }
        }

        // If enrichment found a public portal URL, update the tender's source URL
        if (oeffDetails.portalUrl) {
          console.log(`[cache-detail] Oeffentl. Portal-URL: ${oeffDetails.portalUrl.slice(0, 80)}`);
          result.sourceUrl = oeffDetails.portalUrl;
          try {
            await db.update(tenders).set({ url: oeffDetails.portalUrl, updatedAt: new Date() }).where(eq(tenders.id, tenderId));
          } catch (e) {
            console.warn("[cache-detail] Portal-URL Update fehlgeschlagen:", e);
          }
        }
      }
    } catch (error) {
      console.warn(`[cache-detail] oeffentlichevergabe.de Anreicherung fehlgeschlagen:`, error);
    }
  }

  // Download evergabe.de documents (XLSX, PDF) if found during enrichment
  const enrichedPdfUrls = result && Array.isArray(result.pdfUrls) ? result.pdfUrls as string[] : [];
  const evergabeUrls = enrichedPdfUrls
    .filter(u => typeof u === "string" && u.includes("evergabe.de"))
    .slice(0, settings.maxPdfLinksPerTender);
  if (evergabeUrls.length > 0) {
    console.log(`[cache-detail] Lade ${evergabeUrls.length} evergabe.de Dokumente herunter...`);
    const existingDocs = await db
      .select({
        id: documents.id,
        url: documents.url,
        sha256: documents.sha256,
        downloadStatus: documents.downloadStatus,
        storagePath: documents.storagePath,
        contentType: documents.contentType,
        filename: documents.filename,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.tenderId, tenderId));
    const existingUrls = new Set(existingDocs.filter((d) => d.downloadStatus === "downloaded").map((d) => d.url));
    let docIndex = 0;

    for (const docUrl of evergabeUrls) {
      const resourceCandidate = resourceCandidateFromUrl(docUrl, sourceUrl, "", "cache_detail", "document");
      if (!resourceCandidate) continue;
      const baseName = suggestedFilename(docUrl, `tender-${tenderId}-evergabe-${docIndex + 1}`);
      const cleanFilename = baseName.replace(/^[0-9a-f]{12}-/, "");
      const initialRole = classifyDocumentRole({ filename: cleanFilename, url: docUrl });
      const resourceClassification = classifyResourceCandidate(resourceCandidate);
      let resourceRow: { id: number; status: string } | null = null;
      try {
        resourceRow = await upsertTenderResource(tenderId, resourceCandidate);
        if (existingUrls.has(docUrl)) {
          await db.update(tenderResources).set({ status: "downloaded", errorMessage: null, updatedAt: new Date() }).where(eq(tenderResources.id, resourceRow.id));
          continue;
        }
        await db.update(tenderResources).set({
          status: "downloading",
          attempts: sql`${tenderResources.attempts} + 1`,
          lastAttemptAt: new Date(),
          errorMessage: null,
          updatedAt: new Date(),
        }).where(eq(tenderResources.id, resourceRow.id));
        docIndex += 1;
        const relative = `tenders/${tenderId}/${baseName}`;
        const stored = await fetchAndStore(docUrl, relative, {
          referer: sourceUrl,
          sessionPageUrl: sourceUrl,
          userAgent: REALISTIC_USER_AGENT,
          headers: { Accept: RESOURCE_FETCH_ACCEPT },
        });
        const normalizedPath = ensureExtension(stored.storagePath, stored.contentType);

        if (normalizedPath !== stored.storagePath) {
          const original = objectAbsolutePath(stored.storagePath);
          const target = objectAbsolutePath(normalizedPath);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(original, target);
          fs.unlinkSync(original);
        }

        const persisted = await upsertDownloadedDocument(
          tenderId,
          resourceCandidate,
          stored,
          resourceClassification,
          existingDocs,
          normalizedPath,
        );
        const documentId = persisted.id;
        await db.update(tenderResources).set({
          url: sanitizeResourceUrl(stored.finalUrl) ?? resourceCandidate.url,
          filename: stored.filename ?? resourceCandidate.filename,
          contentType: stored.contentType,
          contentDisposition: stored.contentDisposition ?? resourceCandidate.contentDisposition,
          status: "downloaded",
          errorMessage: null,
          updatedAt: new Date(),
        }).where(eq(tenderResources.id, resourceRow.id));

        // Parse XLSX/PDF and append to rawText
        try {
          const absPath = objectAbsolutePath(normalizedPath);
          const extracted = await extractTextFromFile(absPath, stored.contentType);
          const documentText = extracted.pages.length > 0
            ? extracted.pages.map((page, index) => `[Seite ${index + 1}]\n${page}`).join("\n\n")
            : extracted.text;
          if (documentText.trim().length > 20) {
            const contentRole = classifyDocumentRole({
              filename: cleanFilename,
              url: docUrl,
              textSample: documentText.slice(0, 3000),
            });
            const effectiveRoles = mergeDocumentRoles(initialRole.roles, contentRole.roles);
            const effectiveRole = contentRole.role !== "other" && contentRole.confidence >= initialRole.confidence
              ? contentRole
              : initialRole;
            const effectiveScalarRole = primaryDocumentRole(effectiveRoles);
            if (documentId) {
              await db.update(documents).set({
                extractedText: documentText,
                parseStatus: "parsed",
                errorMessage: null,
                pageCount: extracted.pageCount,
                role: effectiveScalarRole,
                roles: effectiveRoles,
                roleSource: effectiveRole.source,
                roleConfidence: effectiveRole.confidence,
                updatedAt: new Date(),
              }).where(eq(documents.id, documentId));
            }
            // Re-fetch rawText to avoid lost-update when multiple docs are processed
            const freshTender = await getTender(tenderId);
            const currentRaw = freshTender.rawText ?? "";
            await db.update(tenders).set({
              rawText: appendBoundedTenderText(currentRaw, `[ROLLEN: ${effectiveRoles.join(", ")}] [ROLLE: ${effectiveScalarRole}] [DOKUMENT-ID: ${documentId ?? "unbekannt"}]\n${documentText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}`),
              updatedAt: new Date(),
            }).where(eq(tenders.id, tenderId));
            console.log(`[cache-detail] evergabe Dokument geparst: ${normalizedPath} (${documentText.length} Zeichen)`);
          } else if (documentId) {
            await db.update(documents).set({ parseStatus: "empty", pageCount: extracted.pageCount, updatedAt: new Date() }).where(eq(documents.id, documentId));
          }
        } catch (parseError) {
          const parseMsg = parseError instanceof Error ? parseError.message : "unbekannter Parserfehler";
          if (documentId) {
            await db.update(documents).set({ parseStatus: "failed", errorMessage: parseMsg, updatedAt: new Date() }).where(eq(documents.id, documentId));
          }
          console.warn(`[cache-detail] evergabe Dokument Parsing fehlgeschlagen:`, parseError);
        }
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "unbekannter Downloadfehler";
        await upsertFailedDocument(tenderId, resourceCandidate, resourceClassification, message, existingDocs);
        if (resourceRow) {
          await db.update(tenderResources).set({
            status: "failed",
            errorMessage: message.slice(0, 500),
            updatedAt: new Date(),
          }).where(eq(tenderResources.id, resourceRow.id));
        }
        console.warn(`[cache-detail] evergabe Dokument Download fehlgeschlagen: ${docUrl}`, fetchError);
      }
    }

    // Re-run structuring if we got new document text
    const updatedTender = await getTender(tenderId);
    if (updatedTender.rawText && updatedTender.rawText.length > (tender.rawText?.length ?? 0) + 50) {
      console.log(`[cache-detail] Neuer Text von evergabe-Dokumenten, re-strukturiere...`);
      await queueTenderStage(JOB_STRUCTURE, tenderId);
    }
  }

  // Fallback: check if evergabe documents exist in DB with extracted_text but weren't appended to rawText
  const allDocs = await db
    .select({ url: documents.url, extractedText: documents.extractedText })
    .from(documents)
    .where(eq(documents.tenderId, tenderId))
    .limit(settings.maxPdfLinksPerTender);
  const evergabeDocTexts = allDocs.filter(d => d.url && d.url.includes("evergabe.de") && d.url.includes("download") && d.extractedText && d.extractedText.length > 20);
  if (evergabeDocTexts.length > 0) {
    const freshTender = await getTender(tenderId);
    const currentRaw = freshTender.rawText ?? "";
    const textsToAppend = evergabeDocTexts.filter(d => !currentRaw.includes(d.extractedText!.slice(0, 100)));
    if (textsToAppend.length > 0) {
      const appended = textsToAppend
        .slice(0, settings.maxPdfLinksPerTender)
        .map(d => d.extractedText!.slice(0, MAX_DOCUMENT_TEXT_CHARS))
        .join("\n\n[Evergabe-Dokument]\n");
      await db.update(tenders).set({
        rawText: appendBoundedTenderText(currentRaw, appended),
        updatedAt: new Date(),
      }).where(eq(tenders.id, tenderId));
      console.log(`[cache-detail] ${textsToAppend.length} Evergabe-Dokumente nachgetragen (${appended.length} Zeichen)`);
      await queueTenderStage(JOB_STRUCTURE, tenderId);
    }
  }

  // Fallback: build from metadata directly (no LLM call, instant)
  if (!result!) {
    result = {
      title: String(tender.title ?? ""),
      client,
      deadline: tender.deadlineAt ? new Date(tender.deadlineAt).toISOString().split("T")[0] : null,
       description,
      requirements: [],
      scope: "",
      contact: "",
      procedure: tender.procedureType ?? "",
      awardCriteria: [],
      duration: tender.contractDurationMonths ? `${tender.contractDurationMonths} Monate` : "",
      location: String(meta.location ?? ""),
      referenceNumber: meta.reference_number ? String(meta.reference_number) : null,
      pdfUrls: Array.isArray(meta.pdf_urls) ? meta.pdf_urls : [],
      estimatedValue: tender.contractValueMax ? `${tender.contractValueMax} EUR` : null,
      sourceUrl,
      cached: false,
      scrapedAt: new Date().toISOString(),
    };
  }

  if (result && typeof result.description === "string") {
    result.description = cleanPublicDescription(result.description);
  }
  result.descriptionMarkdown = buildTenderDescriptionMarkdown({
    client: result.client,
    procedure: result.procedure,
    deadline: result.deadline,
    location: result.location,
    value: result.estimatedValue,
    duration: result.duration,
    reference: result.referenceNumber,
    summary: typeof result.description === "string" ? result.description : "",
    scope: result.scope,
    requirements: result.requirements,
    awardCriteria: result.awardCriteria,
    cpv: result.cpvCodes ?? result.cpv_codes,
  });

  const resultAccessPage = detectAccessPage(
    `${String(result.title ?? "")} ${String(result.description ?? "")} ${String(result.scope ?? "")}`,
    { title: tender.title ?? undefined, url: sourceUrl },
  );
  if (resultAccessPage.blocked) {
    console.warn(`[cache-detail] Blockiertes Ergebnis fuer Tender ${tenderId} (${resultAccessPage.reason})`);
    await retryBlockedDetail(tender, resultAccessPage);
  }

  // Merge cache_detail result into existing structured_data instead of overwriting.
  // This preserves the rich nested structure from structure_tender (hard_facts, decision_relevant, procurement)
  // while enriching it with the cache_detail's flatter data (description, requirements, scope, etc.).
  const existingStructured = await db
    .select({ jsonBlob: structuredData.jsonBlob, confidence: structuredData.confidence })
    .from(structuredData)
    .where(eq(structuredData.tenderId, tenderId))
    .limit(1);

  let mergedBlob: Record<string, unknown>;
  let mergedConfidence: number;
  let scoringInputChanged = true;

  if (existingStructured.length > 0) {
    const existing = parseRecord(existingStructured[0].jsonBlob as string);
    const existingConfidence = existingStructured[0].confidence ?? 0.5;

    // Start from the existing structured data (preserves hard_facts, decision_relevant, procurement)
    mergedBlob = { ...existing };

    // Enrich hard_facts with cache_detail data where existing values are missing
    const hardFacts = (mergedBlob.hard_facts as Record<string, unknown>) ?? {};
    if (!hardFacts.deadline && result.deadline) hardFacts.deadline = result.deadline;
    if (!hardFacts.buyer && result.client) hardFacts.buyer = result.client;
    if (!hardFacts.location && result.location) hardFacts.location = result.location;
    if (!hardFacts.budget && result.estimatedValue) hardFacts.budget = result.estimatedValue;
    mergedBlob.hard_facts = hardFacts;

    // Enrich decision_relevant with cache_detail requirements/scope if richer
    const decisionRelevant = (mergedBlob.decision_relevant as Record<string, unknown>) ?? {};
    if (Array.isArray(result.requirements) && result.requirements.length > 0) {
      const existingReqs = Array.isArray(decisionRelevant.requirements) ? decisionRelevant.requirements as string[] : [];
      if (result.requirements.length > existingReqs.length) {
        decisionRelevant.requirements = result.requirements;
      }
    }
    if (typeof result.scope === "string" && result.scope.length > 20) {
      const existingScope = Array.isArray(decisionRelevant.scope) ? decisionRelevant.scope as string[] : [];
      if (existingScope.length === 0) {
        decisionRelevant.scope = result.scope.split(/\s+/).filter((w: string) => w.length > 3);
      }
    }
    if (Array.isArray(result.awardCriteria) && result.awardCriteria.length > 0) {
      decisionRelevant.award_criteria = result.awardCriteria;
    }
    mergedBlob.decision_relevant = decisionRelevant;

    // Prefer the richer description (don't overwrite good existing data with thin LLM output)
    const existingDesc = typeof mergedBlob.description === "string" ? mergedBlob.description : "";
    const newDesc = typeof result.description === "string" ? result.description : "";
    console.log(`[cache-detail] Merge: existingDesc=${existingDesc.length}, newDesc=${newDesc.length}`);
    if (newDesc.length > 20 && newDesc.length > existingDesc.length && newDesc.length < 5000) {
      mergedBlob.description = result.description;
      console.log(`[cache-detail] Description updated to ${newDesc.length} chars`);
    }

    // Update summary only if cache_detail has substantially better content
    // Don't replace a good summary with raw text (which can be 10K+ chars from PDFs)
    const existingSummary = typeof mergedBlob.summary === "string" ? mergedBlob.summary : "";
    if (typeof result.description === "string" && result.description.length > 100 && result.description.length < 5000 && result.description.length > existingSummary.length + 50) {
      mergedBlob.summary = result.description.slice(0, 3000);
    }

    const existingDescriptionMarkdown = [mergedBlob.descriptionMarkdown, mergedBlob.description_markdown]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0)
      ?? "";
    const newDescriptionMarkdown = typeof result.descriptionMarkdown === "string"
      ? result.descriptionMarkdown
      : "";
    if (newDescriptionMarkdown && newDescriptionMarkdown.length > existingDescriptionMarkdown.length) {
      mergedBlob.descriptionMarkdown = newDescriptionMarkdown;
    } else if (existingDescriptionMarkdown) {
      mergedBlob.descriptionMarkdown = existingDescriptionMarkdown;
    }
    delete mergedBlob.description_markdown;

    // Boost confidence since we now have more data
    mergedConfidence = Math.min(1, existingConfidence + 0.1);
    scoringInputChanged = scoringInputSignature(existing) !== scoringInputSignature(mergedBlob);
  } else {
    // No existing structured data — write the cache_detail result as-is
    // but wrap it in the StructuredData shape for consistency
    mergedBlob = {
      title: result.title,
      summary: String(result.description ?? "").slice(0, 3000),
      confidence: 0.85,
      hard_facts: {
        deadline: result.deadline,
        budget: result.estimatedValue,
        location: result.location,
        buyer: result.client,
        contract_type: result.procedure,
      },
      decision_relevant: {
        requirements: result.requirements ?? [],
        scope: typeof result.scope === "string" ? result.scope.split(/\s+/).filter((w: string) => w.length > 3) : [],
        award_criteria: result.awardCriteria ?? [],
        mandatory_documents: [],
      },
      procurement: {
        contract_value: { min: null, max: null, currency: "EUR" },
        contract_duration: { months: null, renewal: false },
        award_criteria_detailed: [],
        participation_requirements: [],
        cpv_codes: [],
        procedure_type: result.procedure ?? "offen",
      },
      descriptionMarkdown: result.descriptionMarkdown ?? "",
    };
    mergedConfidence = 0.85;
  }

  const latestDocumentRows = await db
    .select({
      id: documents.id,
      url: documents.url,
      role: documents.role,
      roles: documents.roles,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
      roleConfidence: documents.roleConfidence,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  mergedBlob.document_analysis = withEvidenceValues(
    buildDocumentAnalysis(latestDocumentRows.filter((document) => !isPortalActionUrl(document.url)) as AnalyzedDocument[]),
    {
      deadline: typeof result.deadline === "string" ? result.deadline : null,
      scope: typeof result.scope === "string" ? result.scope : null,
      requirements: Array.isArray(result.requirements) ? result.requirements.join(" ") : null,
      award_criteria: Array.isArray(result.awardCriteria) ? result.awardCriteria.join(" ") : null,
    },
  );

  await db
    .insert(structuredData)
    .values({ tenderId, jsonBlob: mergedBlob, confidence: mergedConfidence })
    .onConflictDoUpdate({ target: structuredData.tenderId, set: { jsonBlob: mergedBlob, confidence: mergedConfidence, updatedAt: new Date() } });

  const readiness = await refreshTenderReadiness(tenderId);
  if (scoringInputChanged && readiness.readiness.status === "ready") {
    // This distinct key queues a second score even if the initial score job is still running.
    await queueTenderStage(JOB_SCORE, tenderId, {}, "cache-detail");
  }

  console.log(`[cache-detail] Tender ${tenderId} details cached`);
  return { cached: true, detail_cached: true };
};

type AttributionScore = {
  fit: number;
  winProbability: number;
  effort: number;
  requirementCoverage: number;
  killSwitch: boolean;
  details: unknown;
};

const recordShownAttribution = async (
  tenderId: number,
  companyId: number,
  score: AttributionScore,
): Promise<void> => {
  if (score.killSwitch) return;

  const existing = await db
    .select({ id: attributionEvents.id })
    .from(attributionEvents)
    .where(and(
      eq(attributionEvents.tenderId, tenderId),
      eq(attributionEvents.companyId, companyId),
      eq(attributionEvents.eventType, "shown"),
    ))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(attributionEvents).values({
    tenderId,
    companyId,
    eventType: "shown",
    metadataJson: { stage: "notify_company", created_at: new Date().toISOString() },
    scoreSnapshotJson: {
      fit: score.fit,
      win_probability: score.winProbability,
      effort: score.effort,
      requirement_coverage: score.requirementCoverage,
      kill_switch: score.killSwitch,
      details: score.details,
    },
  });
};

const persistInsight = async (
  tenderId: number,
  companyId: number,
  score: ScoreResult,
  structured: StructuredData,
): Promise<void> => {
  const insight = generateInsight(score, structured);
  await db
    .insert(insights)
    .values({
      tenderId,
      companyId,
      explanation: insight.explanation,
      actionsJson: insight.actions,
      missingItemsJson: insight.missing_items,
    })
    .onConflictDoUpdate({
      target: [insights.tenderId, insights.companyId],
      set: {
        explanation: insight.explanation,
        actionsJson: insight.actions,
        missingItemsJson: insight.missing_items,
        updatedAt: new Date(),
      },
    });
  await recordShownAttribution(tenderId, companyId, {
    fit: score.fit,
    winProbability: score.win_probability,
    effort: score.effort,
    requirementCoverage: score.requirement_coverage,
    killSwitch: score.kill_switch,
    details: score.details,
  });
};

const runScoreTender = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }

  const tender = await getTender(tenderId);
  if (tender.qualityStatus !== "qualified") {
    return {
      skipped: true,
      quality_status: tender.qualityStatus,
      quality_reason: tender.qualityReason ?? "Ausschreibung ist nicht fuer das Scoring freigegeben.",
    };
  }
  if (tender.readinessStatus !== "ready") {
    return {
      skipped: true,
      readiness_status: tender.readinessStatus,
      readiness_reason: tender.readinessReason ?? "Ausschreibung ist noch nicht vollständig analysiert.",
    };
  }

  const structuredRows = await db
    .select({ jsonBlob: structuredData.jsonBlob })
    .from(structuredData)
    .where(eq(structuredData.tenderId, tenderId))
    .limit(1);

  if (structuredRows.length === 0) {
    throw new Error("strukturierte Daten fehlen");
  }

  const structured = parseStructured(structuredRows[0].jsonBlob as string, tender.title ?? "");
  const metadata = parseRecord(tender.metadataJson as string);
  const tenderLocation = {
    metadataLocation: metadata.location,
    metadataDescription: metadata.description,
    structuredLocation: structured.hard_facts.location,
  };
  const companies = await db
    .select({
      id: companyProfiles.id,
      capabilitiesJson: companyProfiles.capabilitiesJson,
      certificationsJson: companyProfiles.certificationsJson,
      regionsJson: companyProfiles.regionsJson,
      teamSize: companyProfiles.teamSize,
      industry: companyProfiles.industry,
    })
    .from(companyProfiles)
    .orderBy(companyProfiles.id);

  const matchDocument = buildTenderMatchDocument(tender.title ?? "", structured, tenderLocation);
  const tenderBatchItem = [{
    id: tenderId,
    title: tender.title ?? "",
    scope: matchDocument.scope,
    description: matchDocument.description,
  }];

  let scored = 0;
  for (const company of companies) {
    const companyRow: CompanyRow & { id: number } = {
      id: company.id,
      capabilities_json: JSON.stringify(company.capabilitiesJson),
      certifications_json: JSON.stringify(company.certificationsJson),
      regions_json: JSON.stringify(company.regionsJson),
      team_size: company.teamSize,
      industry: company.industry,
    };

    const locationEligibility = getLocationEligibility(companyRow, tenderLocation);
    const domainEligibility = getDomainEligibility(companyRow, tender.title ?? "", structured, tenderLocation);

    // A model may refine an evidenced match, but cannot turn an unknown service into one.
    const capabilities = Array.isArray(company.capabilitiesJson) ? company.capabilitiesJson as string[] : [];
    const regions = Array.isArray(company.regionsJson) ? company.regionsJson as string[] : [];
    const llmScores = locationEligibility.status === "match" && domainEligibility.status === "match"
      ? await llmBatchDomainMatch(capabilities, company.industry, regions, tenderBatchItem)
      : new Map<number, number>();
    const llmDomainScore = llmScores.get(tenderId);

    const result = computeScores(tender.title ?? "", structured, companyRow, llmDomainScore, tenderLocation);
    await db
      .insert(scores)
      .values({
        tenderId,
        companyId: company.id,
        fit: result.fit,
        winProbability: result.win_probability,
        effort: result.effort,
        requirementCoverage: result.requirement_coverage,
        killSwitch: result.kill_switch,
        detailsJson: result.details,
      })
      .onConflictDoUpdate({
        target: [scores.tenderId, scores.companyId],
        set: {
          fit: result.fit,
          winProbability: result.win_probability,
          effort: result.effort,
          requirementCoverage: result.requirement_coverage,
          killSwitch: result.kill_switch,
          detailsJson: result.details,
          updatedAt: new Date(),
        },
      });

    await persistInsight(tenderId, company.id, result, structured);
    scored += 1;
  }

  // IndexNow: Notify search engines about the new qualified tender
  if (scored > 0) {
    const metadata = parseRecord(tender.metadataJson as string);
    const location = metadata.location;
    const slug = tender.slug ?? generateTenderSlug(
      tender.title ?? "",
      typeof location === "string" ? location : undefined,
    );
    const tenderUrl = `${SITE_URL}/ausschreibung/${tenderId}/${slug}`;
    await submitToIndexNow([tenderUrl]).catch((err) => {
      console.warn(`[indexnow] Einreichung fuer Tender ${tenderId} fehlgeschlagen:`, err);
    });

    // Google Ping: Notify Google about sitemap update
    await fetch(`https://ping.google.com/ping?sitemap=${encodeURIComponent(`${SITE_URL}/sitemap.xml`)}`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      // Best Effort — Google Ping may fail silently
    });
  }

  return { companies_scored: scored };
};

const runGenerateInsight = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  const companyId = Number(payload.company_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0 || !Number.isFinite(companyId) || companyId <= 0) {
    throw new Error("ungueltige IDs");
  }

  const scoreRows = await db
    .select({
      fit: scores.fit,
      winProbability: scores.winProbability,
      effort: scores.effort,
      requirementCoverage: scores.requirementCoverage,
      killSwitch: scores.killSwitch,
      detailsJson: scores.detailsJson,
    })
    .from(scores)
    .where(and(eq(scores.tenderId, tenderId), eq(scores.companyId, companyId)))
    .limit(1);

  const structuredRows = await db
    .select({ jsonBlob: structuredData.jsonBlob })
    .from(structuredData)
    .where(eq(structuredData.tenderId, tenderId))
    .limit(1);

  if (scoreRows.length === 0 || structuredRows.length === 0) {
    return { skipped: true, reason: "Score oder strukturierte Daten fehlen" };
  }

  const scoreRow = scoreRows[0];
  const structured = parseStructured(structuredRows[0].jsonBlob as string, "");
  const details = parseRecord(scoreRow.detailsJson as string);
  const insight = generateInsight(
    {
      fit: scoreRow.fit,
      win_probability: scoreRow.winProbability,
      effort: scoreRow.effort,
      requirement_coverage: scoreRow.requirementCoverage,
      kill_switch: scoreRow.killSwitch,
      details: {
        domain_match: Number(details.domain_match ?? 0),
        requirement_coverage: Number(details.requirement_coverage ?? scoreRow.requirementCoverage),
        region_match: Number(details.region_match ?? 0),
        size_match: Number(details.size_match ?? 0),
        complexity: Number(details.complexity ?? 0),
        location_status:
          details.location_status === "match" ||
          details.location_status === "mismatch" ||
          details.location_status === "tender_location_unknown" ||
          details.location_status === "company_location_unknown"
            ? details.location_status
            : "tender_location_unknown",
        location_reason: typeof details.location_reason === "string"
          ? details.location_reason
          : "Der Ausführungsort der Ausschreibung ist nicht eindeutig erkannt.",
        tender_bundesland: typeof details.tender_bundesland === "string" ? details.tender_bundesland : null,
        tender_city: typeof details.tender_city === "string" ? details.tender_city : null,
        location_source: typeof details.location_source === "string" ? details.location_source : "unknown",
        domain_status:
          details.domain_status === "match" ||
          details.domain_status === "mismatch" ||
          details.domain_status === "domain_unknown"
            ? details.domain_status
            : "domain_unknown",
        domain_reason: typeof details.domain_reason === "string"
          ? details.domain_reason
          : "Die fachliche Leistungsart der Ausschreibung ist nicht eindeutig erkannt.",
        domain_source:
          details.domain_source === "cpv" || details.domain_source === "text" || details.domain_source === "unknown"
            ? details.domain_source
            : "unknown",
      }
    },
    structured
  );

  await db
    .insert(insights)
    .values({
      tenderId,
      companyId,
      explanation: insight.explanation,
      actionsJson: insight.actions,
      missingItemsJson: insight.missing_items,
    })
    .onConflictDoUpdate({
      target: [insights.tenderId, insights.companyId],
      set: {
        explanation: insight.explanation,
        actionsJson: insight.actions,
        missingItemsJson: insight.missing_items,
        updatedAt: new Date(),
      },
    });
  await recordShownAttribution(tenderId, companyId, {
    fit: scoreRow.fit,
    winProbability: scoreRow.winProbability,
    effort: scoreRow.effort,
    requirementCoverage: scoreRow.requirementCoverage,
    killSwitch: scoreRow.killSwitch,
    details,
  });
  return { generated: true };
};

const runNotifyCompany = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  const companyId = Number(payload.company_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0 || !Number.isFinite(companyId) || companyId <= 0) {
    throw new Error("ungueltige IDs");
  }

  const scoreRows = await db
    .select({
      fit: scores.fit,
      winProbability: scores.winProbability,
      effort: scores.effort,
      requirementCoverage: scores.requirementCoverage,
      killSwitch: scores.killSwitch,
      detailsJson: scores.detailsJson,
    })
    .from(scores)
    .where(and(eq(scores.tenderId, tenderId), eq(scores.companyId, companyId)))
    .limit(1);

  const score = scoreRows[0];
  if (!score) return { skipped: true, reason: "Score fehlt" };

  await recordShownAttribution(tenderId, companyId, {
    fit: score.fit,
    winProbability: score.winProbability,
    effort: score.effort,
    requirementCoverage: score.requirementCoverage,
    killSwitch: score.killSwitch,
    details: parseRecord(score.detailsJson as string),
  });

  return { notified: true };
};

const parseDeadline = (value: string | null): Date | null => {
  if (!value) return null;

  // Handle German date format: "DD.MM.YYYY, HH:MM" or "DD.MM.YYYY HH:MM"
  const germanMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})$/);
  if (germanMatch) {
    const [, day, month, year, hour, minute] = germanMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Also handle "DD.MM.YYYY" without time
  const germanDateOnly = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanDateOnly) {
    const [, day, month, year] = germanDateOnly;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 23, 59);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Date-only ISO deadlines apply through the end of that local calendar day.
  const isoDateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const runScrapePublicTenders = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const jobId = Number(payload.__job_id ?? 0) || null;
  const requestedSource = typeof payload.source === "string" && payload.source.trim() ? payload.source.trim() : undefined;
  const sourceFilter = requestedSource ? resolvePublicSourceKey(requestedSource) ?? requestedSource : undefined;
  const scrapeRun = await db.insert(publicScrapeRuns).values({
    jobId,
    scopeSourceKey: sourceFilter ?? null,
    isFullRun: !sourceFilter,
    status: "running",
  }).returning({ id: publicScrapeRuns.id });
  const runId = scrapeRun[0].id;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let upsertPersistenceError: string | null = null;
  const changesBySource = new Map<string, { accepted: number; inserted: number; updated: number }>();

  try {
    const resetCursor = payload.reset_cursor === true;
    const cursorRows = await db
      .select({
        sourceKey: publicSourceCursors.sourceKey,
        cursorJson: publicSourceCursors.cursorJson,
        cursorVersion: publicSourceCursors.cursorVersion,
      })
      .from(publicSourceCursors);
    const sourceCursors: Record<string, PublicSourceCursor | null> = {};
    const cursorVersions = new Map<string, number>();
    for (const row of cursorRows) {
      sourceCursors[row.sourceKey] = row.cursorJson as PublicSourceCursor;
      cursorVersions.set(row.sourceKey, row.cursorVersion);
    }
    if (resetCursor && sourceFilter) sourceCursors[sourceFilter] = null;
    const result = await scrapeAllPublicTenders(async (sourceKey, tenders) => {
      const changes = changesBySource.get(sourceKey) ?? { accepted: 0, inserted: 0, updated: 0 };
    for (const tender of tenders) {
      const deadline = parseDeadline(tender.deadline);
      if (deadline && deadline.getTime() < Date.now()) {
        skipped += 1;
        continue;
      }

      try {
        const tenderMetadata: Record<string, JsonValue> = {
          client: normalizePublicClient(
            tender.client,
            getPublicClientFallback(tender.source, tender.sourceUrl),
          ) || "Unbekannt",
          description: tender.description,
          ...(tender.descriptionMarkdown ? { descriptionMarkdown: tender.descriptionMarkdown } : {}),
          reference_number: tender.referenceNumber,
          location: tender.location,
          ...(tender.procedure ? { procedure: tender.procedure } : {}),
          pdf_urls: tender.pdfUrls ?? [],
          discovered_at: new Date().toISOString(),
          scraper: "public_tender_scraper",
        };
        if (tender.resources && tender.resources.length > 0) {
          tenderMetadata.resources = tender.resources as unknown as JsonValue;
        }
        if (tender.subpageCandidates && tender.subpageCandidates.length > 0) {
          tenderMetadata.subpage_candidates = tender.subpageCandidates as unknown as JsonValue;
        }
        const upserted = await upsertTender({
          source: tender.source,
          sourceKey: canonicalPublicSourceKey(tender.sourceKey ?? sourceKey),
          url: tender.sourceUrl,
          title: tender.title,
          metadata: tenderMetadata,
          externalId: tender.externalId ?? undefined,
          deadlineAt: deadline,
          category: tender.category,
          rawText: tender.description || undefined,
        });
        if (upserted.changed) {
          await queueTenderProcessing(upserted.id);
          if (upserted.inserted) {
            inserted += 1;
            changes.inserted += 1;
          } else {
            updated += 1;
            changes.updated += 1;
          }
        } else {
          await recoverTenderProcessing(upserted.id);
        }
        changes.accepted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unbekannt";
        upsertPersistenceError ??= message;
        console.error(`[public-scraper] Upsert fehlgeschlagen fuer "${tender.title}": ${message}`);
      }
    }
    changesBySource.set(sourceKey, changes);
    }, sourceFilter, sourceCursors);

    const persistenceFailure = result.persistenceError ?? upsertPersistenceError;
    const continuationSources: string[] = [];
    await db.transaction(async (tx) => {
      for (const sourceRun of result.sourceRuns) {
        const expectedVersion = cursorVersions.get(sourceRun.sourceKey) ?? 0;
        const shouldCommit = !persistenceFailure && sourceRun.cursorCommit === "commit" && sourceRun.cursorAdvanced;
        const candidateCursor = sourceRun.cursorAfter ?? {};
        let versionAfter = expectedVersion;

        if (shouldCommit) {
          let committed = false;
          if (!cursorVersions.has(sourceRun.sourceKey)) {
            const insertedCursor = await tx.insert(publicSourceCursors).values({
              sourceKey: sourceRun.sourceKey,
              cursorJson: candidateCursor,
              cursorVersion: 1,
              exhausted: sourceRun.exhausted,
              continuationRequired: sourceRun.continuationRequired,
              lastRunId: runId,
              lastStatus: sourceRun.status,
              lastError: null,
              lastAdvancedAt: new Date(),
              updatedAt: new Date(),
            }).onConflictDoNothing().returning({ cursorVersion: publicSourceCursors.cursorVersion });
            committed = insertedCursor.length > 0;
            if (committed) versionAfter = insertedCursor[0].cursorVersion;
          }
          if (!committed) {
            const updatedCursor = await tx.update(publicSourceCursors).set({
              cursorJson: candidateCursor,
              cursorVersion: sql`${publicSourceCursors.cursorVersion} + 1`,
              exhausted: sourceRun.exhausted,
              continuationRequired: sourceRun.continuationRequired,
              lastRunId: runId,
              lastStatus: sourceRun.status,
              lastError: null,
              lastAdvancedAt: new Date(),
              updatedAt: new Date(),
            }).where(and(
              eq(publicSourceCursors.sourceKey, sourceRun.sourceKey),
              eq(publicSourceCursors.cursorVersion, expectedVersion),
            )).returning({ cursorVersion: publicSourceCursors.cursorVersion });
            committed = updatedCursor.length > 0;
            if (committed) versionAfter = updatedCursor[0].cursorVersion;
          }
          if (!committed) {
            sourceRun.status = "partial";
            sourceRun.errorMessage = "Cursor-Konflikt: Quelle wurde parallel fortgeschrieben.";
            sourceRun.cursorCommit = "hold";
            sourceRun.cursorAdvanced = false;
            sourceRun.cursorAfter = sourceRun.cursorBefore;
            sourceRun.exhausted = false;
            sourceRun.continuationRequired = true;
            continuationSources.push(sourceRun.sourceKey);
          }
        } else {
          const errorMessage = persistenceFailure ?? sourceRun.errorMessage;
          if (!cursorVersions.has(sourceRun.sourceKey)) {
            await tx.insert(publicSourceCursors).values({
              sourceKey: sourceRun.sourceKey,
              cursorJson: sourceRun.cursorBefore ?? {},
              cursorVersion: expectedVersion,
              exhausted: false,
              continuationRequired: sourceRun.continuationRequired,
              lastRunId: runId,
              lastStatus: sourceRun.status,
              lastError: errorMessage,
              updatedAt: new Date(),
            }).onConflictDoNothing();
          } else {
            await tx.update(publicSourceCursors).set({
              lastRunId: runId,
              lastStatus: sourceRun.status,
              lastError: errorMessage,
              continuationRequired: sourceRun.continuationRequired,
              updatedAt: new Date(),
            }).where(eq(publicSourceCursors.sourceKey, sourceRun.sourceKey));
          }
        }

        if (
          sourceRun.continuationRequired
          && !persistenceFailure
          && !continuationSources.includes(sourceRun.sourceKey)
          && shouldSchedulePublicContinuation(
            sourceRun.cursorAfter ?? sourceRun.cursorBefore ?? null,
            sourceRun.exhausted,
            sourceRun.continuationRequired,
            sourceRun.status,
            null,
          )
        ) {
          continuationSources.push(sourceRun.sourceKey);
        }
        sourceRun.cursorVersionBefore = expectedVersion;
        sourceRun.cursorVersionAfter = versionAfter;
      }

      await tx.insert(publicSourceRuns).values(result.sourceRuns.map((sourceRun) => {
        const changes = changesBySource.get(sourceRun.sourceKey) ?? { accepted: sourceRun.acceptedCount, inserted: 0, updated: 0 };
        return {
          runId,
          sourceKey: sourceRun.sourceKey,
          status: sourceRun.status,
          discoveredCount: sourceRun.discoveredCount,
          listedCount: sourceRun.listedCount,
          detailAttempted: sourceRun.detailAttempted,
          detailFailed: sourceRun.detailFailed,
          pendingCount: sourceRun.pendingCount,
          continuationScheduled: false,
          acceptedCount: changes.accepted || sourceRun.acceptedCount,
          insertedCount: changes.inserted,
          updatedCount: changes.updated,
          errorMessage: sourceRun.errorMessage,
          cursorBeforeJson: sourceRun.cursorBefore,
          cursorAfterJson: sourceRun.cursorAfter,
          cursorVersionBefore: sourceRun.cursorVersionBefore,
          cursorVersionAfter: sourceRun.cursorVersionAfter,
          pagesFetched: sourceRun.pagesFetched,
          exhausted: sourceRun.exhausted,
          cursorAdvanced: sourceRun.cursorAdvanced,
          startedAt: new Date(Date.now() - sourceRun.durationMs),
          finishedAt: new Date(),
        };
      }));

      const hasFailures = Boolean(persistenceFailure)
        || result.sourceRuns.some((sourceRun) => ["failed", "timed_out", "partial"].includes(sourceRun.status));
      await tx.update(publicScrapeRuns).set({
        status: persistenceFailure ? "failed" : hasFailures ? "partial" : "success",
        totalFound: result.totalFound,
        afterDedup: result.afterDedup,
        acceptedCount: result.sourceRuns.reduce((sum, sourceRun) => sum + sourceRun.acceptedCount, 0),
        insertedCount: inserted,
        updatedCount: updated,
        skippedExpired: skipped,
        errorMessage: persistenceFailure,
        finishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(publicScrapeRuns.id, runId));
    });

    for (const sourceKey of continuationSources) {
      try {
        await enqueueJob(JOB_SCRAPE_PUBLIC, { source: sourceKey }, {
          jobKey: `public-continuation:${sourceKey}`,
          groupKey: `public-source:${sourceKey}`,
          runAfter: new Date(Date.now() + 30_000),
          dedupeCompleted: false,
        });
        await db.update(publicSourceRuns).set({ continuationScheduled: true }).where(and(
          eq(publicSourceRuns.runId, runId),
          eq(publicSourceRuns.sourceKey, sourceKey),
        ));
      } catch (error) {
        console.error(`[public-scraper] Continuation fuer ${sourceKey} konnte nicht eingeplant werden:`, error);
      }
    }

    try {
      await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
    } catch (error) {
      console.error("[public-scraper] Meilisearch-Sync konnte nicht eingeplant werden:", error);
    }
    if (persistenceFailure) throw new Error(persistenceFailure);
    return {
      total_found: result.totalFound,
      after_dedup: result.afterDedup,
      inserted,
      updated,
      skipped_expired: skipped,
      continuations: continuationSources.length,
      by_source: result.bySource,
    };
  } catch (error) {
    await db.update(publicScrapeRuns).set({ status: "failed", errorMessage: error instanceof Error ? error.message : "Public-Scrape fehlgeschlagen", insertedCount: inserted, updatedCount: updated, skippedExpired: skipped, finishedAt: new Date(), updatedAt: new Date() }).where(eq(publicScrapeRuns.id, runId));
    throw error;
  }
};

interface UsDocumentPipelineRow {
  id: number;
  url: string;
  sha256: string;
  storagePath: string;
  contentType: string | null;
  filename: string | null;
  extractedText: string | null;
  downloadStatus: string;
  parseStatus: string;
  errorMessage: string | null;
  updatedAt: Date;
}

const isUsDocumentRefreshDue = (document: UsDocumentPipelineRow): boolean =>
  !Number.isFinite(document.updatedAt.getTime())
  || Date.now() - document.updatedAt.getTime() >= settings.documentRefreshHours * 60 * 60 * 1000;

const buildUsAttachmentFingerprint = (attachments: Array<{ name: string; url: string }>): string =>
  createHash("sha256")
    .update(JSON.stringify([...attachments].sort((left, right) => left.url.localeCompare(right.url))))
    .digest("hex")
    .slice(0, 24);

export const buildFetchUsDocumentsJobKey = (
  usTenderId: number,
  attachments: Array<{ name: string; url: string }>,
): string => buildJobKey(
  JOB_FETCH_US_DOCUMENTS,
  usTenderId,
  `attachments-${buildUsAttachmentFingerprint(attachments)}-refresh-${documentRefreshBucket()}`,
);

const queueUsDocumentFetch = async (usTenderId: number, tender: UsExtractedTender): Promise<boolean> => {
  const attachments = dedupeUsAttachments(tender.attachments, tender.url);
  if (attachments.length === 0) return false;
  await enqueueJob(JOB_FETCH_US_DOCUMENTS, { us_tender_id: usTenderId }, {
    jobKey: buildFetchUsDocumentsJobKey(usTenderId, attachments),
    groupKey: `us-tender:${usTenderId}`,
  });
  return true;
};

const runFetchUsDocuments = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const usTenderId = Number(payload.us_tender_id ?? 0);
  if (!Number.isFinite(usTenderId) || usTenderId <= 0) throw new Error("ungueltige us_tender_id");

  const tenderRows = await db
    .select({ id: usTenders.id, url: usTenders.url, metadataJson: usTenders.metadataJson })
    .from(usTenders)
    .where(eq(usTenders.id, usTenderId))
    .limit(1);
  const tender = tenderRows[0];
  if (!tender) throw new Error(`US Tender ${usTenderId} nicht gefunden`);

  const metadata = parseRecord(tender.metadataJson as string);
  const rawAttachments = Array.isArray(metadata.attachments)
    ? metadata.attachments as Array<{ name?: unknown; url?: unknown }>
    : [];
  const attachments = dedupeUsAttachments(rawAttachments, tender.url).slice(0, Math.max(1, settings.maxPdfLinksPerTender));
  if (attachments.length === 0) return { us_documents_saved: 0, attachments_discovered: 0 };

  const existingDocuments = await db
    .select({
      id: usDocuments.id,
      url: usDocuments.url,
      sha256: usDocuments.sha256,
      storagePath: usDocuments.storagePath,
      contentType: usDocuments.contentType,
      filename: usDocuments.filename,
      extractedText: usDocuments.extractedText,
      downloadStatus: usDocuments.downloadStatus,
      parseStatus: usDocuments.parseStatus,
      errorMessage: usDocuments.errorMessage,
      updatedAt: usDocuments.updatedAt,
    })
    .from(usDocuments)
    .where(eq(usDocuments.usTenderId, usTenderId));
  const documentRows = existingDocuments as UsDocumentPipelineRow[];
  const analysis: Array<Record<string, JsonValue>> = [];
  let saved = 0;
  let downloadFailures = 0;

  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    const existing = documentRows.find((document) => document.url === attachment.url);
    if (existing?.downloadStatus === "downloaded" && !isUsDocumentRefreshDue(existing)) {
      analysis.push({
        name: attachment.name,
        url: attachment.url,
        status: existing.parseStatus,
        document_id: existing.id,
        content_type: existing.contentType,
        text_preview: existing.extractedText?.slice(0, 600) ?? null,
      });
      continue;
    }

    const relative = `us-tenders/${usTenderId}/${suggestedFilename(attachment.url, `attachment-${index + 1}`)}`;
    let stored: Awaited<ReturnType<typeof fetchAndStore>>;
    try {
      stored = await fetchAndStore(attachment.url, relative, {
        referer: tender.url,
        sessionPageUrl: tender.url,
        userAgent: REALISTIC_USER_AGENT,
        headers: { Accept: RESOURCE_FETCH_ACCEPT },
      });
    } catch (error) {
      downloadFailures += 1;
      analysis.push({
        name: attachment.name,
        url: attachment.url,
        status: "download_failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "Download fehlgeschlagen",
      });
      continue;
    }

    const normalizedPath = ensureExtension(stored.storagePath, stored.contentType);
    if (normalizedPath !== stored.storagePath) {
      const original = objectAbsolutePath(stored.storagePath);
      const target = objectAbsolutePath(normalizedPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(original, target);
      fs.unlinkSync(original);
    }

    let extractedText: string | null = null;
    let pageCount: number | null = null;
    let parseStatus = "empty";
    let parseError: string | null = null;
    try {
      const extracted = await extractTextFromFile(objectAbsolutePath(normalizedPath), stored.contentType);
      const pageText = extracted.pages.length > 0
        ? extracted.pages.map((page, pageIndex) => `[Page ${pageIndex + 1}]\n${page}`).join("\n\n")
        : extracted.text;
      extractedText = pageText.slice(0, MAX_DOCUMENT_TEXT_CHARS).trim() || null;
      pageCount = extracted.pageCount;
      parseStatus = extractedText && extractedText.length >= 20 ? "parsed" : "empty";
    } catch (error) {
      parseStatus = "failed";
      parseError = error instanceof Error ? error.message.slice(0, 500) : "Parserfehler";
    }

    const classification = classifyDocumentRole({
      filename: stored.filename ?? attachment.name,
      url: attachment.url,
      linkText: attachment.name,
      textSample: extractedText?.slice(0, 3000),
    });
    const roles = mergeDocumentRoles(classification.roles);
    const values = {
      usTenderId,
      url: attachment.url,
      storagePath: normalizedPath,
      sha256: stored.sha256,
      contentType: stored.contentType,
      extractedText,
      downloadStatus: "downloaded" as const,
      parseStatus,
      errorMessage: parseError,
      filename: documentFilename({
        url: attachment.url,
        canonicalUrl: attachment.url,
        label: attachment.name,
        filename: null,
        resourceType: "document",
        roleHints: [],
        sourcePageUrl: tender.url,
        discoveryMethod: "us-attachment",
        method: "GET",
        contentType: stored.contentType,
        contentDisposition: stored.contentDisposition ?? null,
      }, stored.filename, stored.contentType),
      pageCount,
      role: primaryDocumentRole(roles),
      roles,
      roleSource: classification.source,
      roleConfidence: classification.confidence,
      updatedAt: new Date(),
    };

    let documentId = existing?.id ?? null;
    if (existing) {
      await db.update(usDocuments).set(values).where(eq(usDocuments.id, existing.id));
    } else {
      const inserted = await db.insert(usDocuments).values(values).onConflictDoNothing().returning({ id: usDocuments.id });
      documentId = inserted[0]?.id ?? null;
    }
    if (documentId) {
      saved += 1;
      documentRows.push({
        id: documentId,
        url: attachment.url,
        sha256: stored.sha256,
        storagePath: normalizedPath,
        contentType: stored.contentType,
        filename: values.filename ?? null,
        extractedText,
        downloadStatus: "downloaded",
        parseStatus,
        errorMessage: parseError,
        updatedAt: new Date(),
      });
    }
    analysis.push({
      name: attachment.name,
      url: attachment.url,
      status: parseStatus,
      document_id: documentId,
      content_type: stored.contentType,
      text_preview: extractedText?.slice(0, 600) ?? null,
      error: parseError,
    });
  }

  metadata.attachments = attachments.map((attachment) => {
    const item = analysis.find((entry) => entry.url === attachment.url);
    return { ...attachment, ...(item ? { status: item.status, document_id: item.document_id } : {}) } as JsonValue;
  });
  metadata.attachment_analysis = analysis as JsonValue[];
  metadata.attachment_analysis_at = new Date().toISOString();
  await db.update(usTenders).set({ metadataJson: metadata, updatedAt: new Date() }).where(eq(usTenders.id, usTenderId));

  if (downloadFailures > 0) {
    throw new Error(`${downloadFailures} US-Dokumente konnten nicht geladen werden`);
  }
  return { us_documents_saved: saved, attachments_discovered: attachments.length, download_failures: 0 };
};

const runScrapeUsTenders = async (_payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const startedAt = new Date();
  const result = await scrapeAllUsTenders();
  let inserted = 0;
  let updated = 0;
  const changesBySource = new Map<string, { inserted: number; updated: number }>();

  for (const tender of result.tenders) {
    try {
      const upserted = await upsertUsTender(tender);
      const changes = changesBySource.get(tender.source) ?? { inserted: 0, updated: 0 };
      if (upserted.inserted) {
        inserted += 1;
        changes.inserted += 1;
      } else if (upserted.changed) {
        updated += 1;
        changes.updated += 1;
      }
      try {
        await queueUsDocumentFetch(upserted.id, tender);
      } catch (error) {
        console.warn(`[us-scraper] Dokumentjob konnte nicht eingeplant werden (${upserted.id}):`, error);
      }
      changesBySource.set(tender.source, changes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[us-scraper] Upsert failed for "${tender.title}": ${message}`);
    }
  }

  await db.insert(usSourceRuns).values(result.sourceRuns.map((run) => {
    const changes = changesBySource.get(run.source) ?? { inserted: 0, updated: 0 };
    return {
      source: run.source,
      status: run.status,
      discoveredCount: run.discoveredCount,
      acceptedCount: run.acceptedCount,
      insertedCount: changes.inserted,
      updatedCount: changes.updated,
      errorMessage: run.errorMessage,
      startedAt,
      finishedAt: new Date(),
    };
  }));

  try {
    const alerts = await processUsAlerts();
    console.log(`[us-alerts] processed ${alerts.processed} subscriptions, notified ${alerts.notified}.`);
  } catch (error) {
    console.warn("[us-alerts] Alert processing failed without failing the scrape:", error);
  }

  return {
    total_found: result.tenders.length,
    inserted,
    updated,
    by_source: result.bySource,
    errors: result.errors,
  };
};

const runSyncMeili = async (_payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  await configureMeiliIndex();
  const result = await syncTendersToMeili();
  return { indexed: result.indexed, skipped: result.skipped };
};

const runDiscoverCompany = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const companyId = Number(payload.company_id ?? 0);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new Error("ungueltige company_id");
  }

  const rows = await db
    .select({
      id: companyProfiles.id,
      capabilitiesJson: companyProfiles.capabilitiesJson,
      certificationsJson: companyProfiles.certificationsJson,
      regionsJson: companyProfiles.regionsJson,
      teamSize: companyProfiles.teamSize,
      industry: companyProfiles.industry,
    })
    .from(companyProfiles)
    .where(eq(companyProfiles.id, companyId))
    .limit(1);

  if (rows.length === 0) throw new Error(`Firma ${companyId} nicht gefunden`);
  const company = rows[0];
  const scored = await scoreKnownTenders(companyId, {
    capabilities_json: JSON.stringify(company.capabilitiesJson),
    certifications_json: JSON.stringify(company.certificationsJson),
    regions_json: JSON.stringify(company.regionsJson),
    team_size: company.teamSize,
    industry: company.industry,
  });

  return { company_id: companyId, scored };
};

const runPreviewCompanyUrl = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const cacheId = Number(payload.cache_id ?? 0);
  if (!Number.isFinite(cacheId) || cacheId <= 0) throw new Error("ungueltige preview cache_id");
  await processCompanyUrlPreview(cacheId);
  return { cache_id: cacheId };
};

const runApiAnalyze = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  // Accept CamelCase for API jobs created before the queue payload contract was fixed.
  const apiJobId = Number(payload.api_job_id ?? payload.apiJobId ?? 0);
  const url = typeof payload.url === "string" ? payload.url : "";
  const mode = payload.mode === "rescore" ? "rescore" : "full";
  const rawCompanyId = payload.company_id ?? payload.companyId;
  const companyId = rawCompanyId === undefined ? undefined : Number(rawCompanyId);
  const rawProfileSlug = payload.profile_slug ?? payload.profileSlug;
  const profileSlug = typeof rawProfileSlug === "string" ? rawProfileSlug : undefined;

  if (!Number.isFinite(apiJobId) || apiJobId <= 0 || !url) {
    throw new Error("ungueltige api_analyze Nutzdaten");
  }

  await runApiAnalysisJob({ apiJobId, url, mode, companyId, profileSlug });
  return { api_job_id: apiJobId, mode };
};

const handlers: Record<JobType, (payload: Record<string, JsonValue>) => Promise<Record<string, JsonValue>>> = {
  [JOB_CRAWL]: runCrawl,
  [JOB_SCRAPE_PUBLIC]: runScrapePublicTenders,
  [JOB_FETCH_DOCUMENTS]: runFetchDocuments,
  [JOB_FETCH_US_DOCUMENTS]: runFetchUsDocuments,
  [JOB_PARSE]: runParseDocuments,
  [JOB_STRUCTURE]: runStructureTender,
  [JOB_SCORE]: runScoreTender,
  [JOB_INSIGHT]: runGenerateInsight,
  [JOB_NOTIFY]: runNotifyCompany,
  [JOB_CACHE_DETAIL]: runCacheDetail,
  [JOB_SYNC_MEILI]: runSyncMeili,
  [JOB_DISCOVER_COMPANY]: runDiscoverCompany,
  [JOB_SCRAPE_US]: runScrapeUsTenders,
  [JOB_PREVIEW_COMPANY_URL]: runPreviewCompanyUrl,
  [JOB_API_ANALYZE]: runApiAnalyze,
};

export const processJobById = async (jobId: number): Promise<JobProcessResult> => {
  const rows = await db
    .select({ id: jobs.id, type: jobs.type, payload: jobs.payload })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Job ${jobId} nicht gefunden`);
  }

  const row = rows[0];
  const handler = handlers[row.type as JobType];
  if (!handler) {
    throw new Error(`Kein Handler fuer Job-Typ ${row.type}`);
  }

  const payload = { ...parseRecord(row.payload as string), __job_id: row.id };
  const result = await handler(payload);
  return { job_id: row.id, job_type: row.type as JobType, status: "done", result };
};

type ProcessJobOptions = ClaimJobOptions & {
  /** Worker processes terminate after a timeout so a still-running handler cannot leak a slot. */
  terminateOnTimeout?: boolean;
};

export const processNextJob = async (workerId: string, options: ProcessJobOptions = {}): Promise<JobProcessResult | null> => {
  // Make the lock identity unique per attempt. This prevents a timed-out
  // handler from closing a later retry when callers reuse a worker label.
  const attemptWorkerId = `${workerId}:${randomUUID()}`;
  const job = await claimNextJob(attemptWorkerId, options);
  if (!job) {
    return null;
  }

  const jobType = job.type as JobType;
  const startedAt = Date.now();
  const maxRuntimeMs = getJobMaxRuntimeMs(jobType);
  let timedOut = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const heartbeat = setInterval(() => {
    void heartbeatJob(job.id, attemptWorkerId).catch((error) => {
      console.warn(`[queue] Heartbeat für Job #${job.id} fehlgeschlagen:`, error);
    });
  }, 30_000);

  try {
    const handler = handlers[jobType];
    if (!handler) {
      throw new Error(`Kein Handler fuer Job-Typ ${jobType}`);
    }

    const payload = { ...parseRecord(job.payload as string), __job_id: job.id };
    const timeout = new Promise<never>((_, reject) => {
      watchdog = setTimeout(() => {
        timedOut = true;
        reject(new Error(`Job #${job.id} (${jobType}) überschritt die maximale Laufzeit von ${Math.round(maxRuntimeMs / 60_000)} Minuten.`));
      }, maxRuntimeMs);
      watchdog.unref();
    });
    const result = await Promise.race([handler(payload), timeout]);
    if (watchdog) clearTimeout(watchdog);
    clearInterval(heartbeat);
    await markDone(job.id, attemptWorkerId);
    if (jobType === JOB_SYNC_MEILI) {
      const catalog = await getCatalogState();
      if (catalog && catalog.revision > catalog.syncedRevision) {
        await enqueueJob(JOB_SYNC_MEILI, {}, {
          jobKey: JOB_SYNC_MEILI,
          runAfter: new Date(Date.now() + 30_000),
          dedupeCompleted: false,
        }).catch((error: unknown) => {
          console.warn("[pipeline] Folge-Sync für geänderten Katalog konnte nicht eingereiht werden:", error);
        });
      }
    }
    return {
      job_id: job.id,
      job_type: jobType,
      status: "done",
      queue_latency_ms: job.queueLatencyMs ?? Math.max(0, startedAt - job.createdAt.getTime()),
      duration_ms: Date.now() - startedAt,
      result
    };
  } catch (error) {
    if (watchdog) clearTimeout(watchdog);
    clearInterval(heartbeat);
    const message = sanitizeErrorMessage(error instanceof Error ? error.message : "Unbekannter Fehler");
    try {
      await markFailed(job.id, attemptWorkerId, message);
    } catch (markError) {
      const markMessage = sanitizeErrorMessage(markError instanceof Error ? markError.message : "Unbekannter Fehler");
      console.error(`[queue] Job #${job.id} konnte nicht als fehlgeschlagen markiert werden: ${markMessage}`);
    }
    if (timedOut && jobType === JOB_SYNC_MEILI) {
      await releaseCatalogSync().catch((releaseError: unknown) => {
        console.error(`[queue] Katalog-Lock nach Timeout von Job #${job.id} konnte nicht freigegeben werden: ${String(releaseError)}`);
      });
    }
    if (timedOut && options.terminateOnTimeout) {
      console.error(`[worker] Beende Prozess nach Timeout von Job #${job.id}, damit blockierte Browser-/Netzwerk-Ressourcen sicher freigegeben werden.`);
      process.exit(1);
    }
    return {
      job_id: job.id,
      job_type: jobType,
      status: "failed",
      queue_latency_ms: job.queueLatencyMs ?? Math.max(0, startedAt - job.createdAt.getTime()),
      duration_ms: Date.now() - startedAt,
      error: message
    };
  }
};

export const runBatch = async (workerId: string, limit = 20): Promise<JobProcessResult[]> => {
  const results: JobProcessResult[] = [];
  for (let index = 0; index < limit; index += 1) {
    const next = await processNextJob(workerId);
    if (!next) {
      break;
    }
    results.push(next);
  }
  return results;
};

export const seedManualTender = async (source: string, url: string, title: string, metadata?: Record<string, JsonValue>): Promise<number> => {
  const upserted = await upsertTender({ source, url, title, metadata });
  if (upserted.changed) await queueTenderProcessing(upserted.id);
  return upserted.id;
};

export const cleanupExpiredTenders = async (): Promise<{ deleted: number }> => {
  const now = new Date();
  let deleted = 0;

  while (true) {
    const expired = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(isNotNull(tenders.deadlineAt), lt(tenders.deadlineAt, now)))
      .orderBy(asc(tenders.id))
      .limit(CLEANUP_BATCH_SIZE);
    if (expired.length === 0) break;

    const ids = expired.map((t) => t.id);
    await db.delete(tenders).where(inArray(tenders.id, ids));
    deleted += ids.length;
    console.log(`[cleanup] Batch mit ${ids.length} abgelaufenen Ausschreibungen entfernt (gesamt ${deleted}).`);
  }

  if (deleted === 0) return { deleted: 0 };
  await markCatalogDirty();

  // Enqueue a full Meilisearch sync to ensure orphaned documents are removed
  try {
      await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
     console.log(`[cleanup] sync_meilisearch Job eingereiht nach ${deleted} Löschungen.`);
  } catch (err) {
    console.warn("[cleanup] Konnte sync_meilisearch nicht einreihen:", err);
  }

  return { deleted };
};

export const cleanupExpiredUsTenders = async (): Promise<{ deleted: number }> => {
  const now = new Date();
  let deleted = 0;

  while (true) {
    const expired = await db
      .select({ id: usTenders.id })
      .from(usTenders)
      .where(and(isNotNull(usTenders.deadlineAt), lt(usTenders.deadlineAt, now)))
      .orderBy(asc(usTenders.id))
      .limit(CLEANUP_BATCH_SIZE);
    if (expired.length === 0) break;

    const ids = expired.map((tender) => tender.id);
    await db.delete(usTenders).where(inArray(usTenders.id, ids));
    deleted += ids.length;
  }

  return { deleted };
};
