import * as cheerio from "cheerio";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, asc, eq, ne, isNotNull, isNull, lt, inArray, or, sql } from "drizzle-orm";
import { settings } from "@/lib/config";
import { parseDeadlineDate } from "@/lib/date-utils";
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
import { extractTextFromFile, formatExtractedDocumentText } from "@/lib/parser";
import { decodeTextBuffer, repairKnownGermanEncoding } from "@/lib/text-normalization";
import { buildJobKey, buildTenderPipelineGroupKey, claimNextJob, enqueueJob, getJobMaxRuntimeMs, heartbeatJob, markDone, markFailed, PUBLIC_CONTINUATION_PRIORITY, sanitizeErrorMessage, type ClaimJobOptions } from "@/lib/queue";
import { buildTenderMatchDocument, computeScores, getDomainEligibility, getLocationEligibility, llmBatchDomainMatch, type CompanyRow } from "@/lib/scoring";
import { ensureExtension, fetchAndStore, objectAbsolutePath, suggestedFilename } from "@/lib/storage";
import { fetchAndStoreWithParallelFallback, fetchEvergabeDocumentsViaParallel } from "@/lib/parallel-extract";
import { ColdStorageError, ensureLocalStored } from "@/lib/object-store-cold";
import { buildStructuredDescriptionMarkdown, extractStructuredData, normalizeStructured, type StructuredData } from "@/lib/structurer";
import { assessTenderQuality, withCanonicalTenderDeadline } from "@/lib/tender-quality";
import { resolveSourceItem } from "@/lib/tender-sources";
import { classifyTenderRelevance } from "@/lib/tender-relevance";
import {
  canonicalPublicSourceKey,
  normalizePublicClient,
  pickPublicDescription,
  scrapeAllPublicTenders,
  extractPublicCpvCodes,
  type ExtractedTender,
} from "@/lib/public-tender-scraper";
import { buildPublicContinuationJobKey, cursorNumber, resolvePublicSourcePersistenceError, shouldCommitPublicCursor, shouldSchedulePublicContinuation, type PublicSourceCursor } from "@/lib/public-pagination";
import { resolvePublicSourceKey } from "@/lib/public-source-registry";
import { scrapeAllUsTenders, type UsExtractedTender } from "@/lib/us-tender-scraper";
import { dedupeUsAttachments } from "@/lib/us/types";
import { categorizeUsTender } from "@/lib/us/categorize";
import { processUsAlerts } from "@/lib/us/alerts";
import {
  buildPublicAccessLimitedDescriptionMarkdown,
  buildPublicAccessLimitedDescription,
  enrichFromOeffentlicheVergabe,
  cleanPublicDescription,
  extractPublicPortalFacts,
  type OeffentlicheVergabeDetails,
} from "@/lib/public-tender-scraper";
import { buildTenderDescriptionMarkdown } from "@/lib/tender-description";
import { pickPublicTenderDescription, readPublicTenderMeta } from "@/lib/tender-meta";
import {
  isCanonicalPublicDescriptionMarkdown,
  isPdfFormBoilerplate,
  isPopulatedTenderNotice,
  mergePublicTextListWithFallback,
  normalizePublicDisplayCandidate,
  normalizePublicTextList,
  pickValidatedPublicCandidate,
  pickSourceBackedPublicCandidate,
  pickValidatedPublicProcedure,
  pickValidatedPublicLocationForTender,
  projectPublicDisplayFields,
  groundPublicTenderFields,
  isSourceBackedPublicValue,
} from "@/lib/public-content-quality";
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
import { isGenericPortalNavigationResource, isPortalActionUrl } from "@/lib/resource-url";
import { documentIdentityKey, isHtmlContentType } from "@/lib/document-identity";
import { processCompanyUrlPreview } from "@/lib/preview";
import { getCatalogState, markCatalogDirty, releaseCatalogSync } from "@/lib/catalog";
import { classifyDocumentRole, rolePriority, shouldRefineDocumentRole } from "@/lib/document-classifier";
import { buildDocumentAnalysis, withEvidenceValues, type AnalyzedDocument } from "@/lib/document-analysis";
import { deduplicateParsedDocuments, type ParsedTenderDocument } from "@/lib/document-aggregation";
import { evaluateTenderReadiness, isScorableReadiness } from "@/lib/tender-readiness";
import { runApiAnalysisJob } from "@/app/api/v1/analyze/route";
import { runDeepDiveAnalysis } from "@/lib/small-vendor-deep-dive";
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
  JOB_SMALL_VENDOR_DEEP_DIVE,
  type JobProcessResult,
  type JobType,
  type JsonValue,
  type SourceItem
} from "@/lib/types";

const INDEXNOW_KEY = "4ebe462f0c8f45cbaa9b6bae50dc57dc";
import { getSiteHost, getSiteUrl } from "@/lib/site-config";

const SITE_URL = getSiteUrl();
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

const replaceParsedDocumentSections = (existing: string, parsed: string): string => {
  const parsedIds = [...parsed.matchAll(/\[DOKUMENT-ID:\s*(\d+)\]/gu)].map((match) => match[1]);
  if (parsedIds.length === 0) return existing;
  const ids = new Set(parsedIds);
  const sectionStartPattern = /(?:^|\n\n)(?:\[Dokument\]\n)?\[ROLLEN:/gu;
  const starts = [...existing.matchAll(sectionStartPattern)];
  if (starts.length === 0) return existing;

  let result = "";
  let cursor = 0;
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index ?? 0;
    const end = starts[index + 1]?.index ?? existing.length;
    const section = existing.slice(start, end);
    const documentId = section.match(/\[DOKUMENT-ID:\s*(\d+)\]/u)?.[1];
    result += existing.slice(cursor, start);
    if (!documentId || !ids.has(documentId)) result += section;
    cursor = end;
  }
  return `${result}${existing.slice(cursor)}`.replace(/\n{3,}/g, "\n\n").trim();
};

export const mergeParsedTenderText = (existingRawText: string | null | undefined, parsedText: string, partial: boolean): string => {
  const existing = existingRawText?.trim() ?? "";
  const parsed = parsedText.trim();
  if (!parsed) return existing;
  if (!partial || !existing) return parsed.slice(0, MAX_TENDER_TEXT_CHARS);

  // Keep the listing snapshot on partial runs, replacing changed document
  // sections while retaining documents that were not part of this parse.
  const sections = parsed.split(/\n\n(?=\[ROLLEN:)/u);
  const replacement = sections.join("\n\n").trim();
  const withoutPrevious = replaceParsedDocumentSections(existing, replacement);
  if (withoutPrevious !== existing) return appendBoundedTenderText(withoutPrevious, replacement);
  const missing = sections.filter((section) => !existing.includes(section));
  return missing.length === 0 ? existing : appendBoundedTenderText(existing, missing.join("\n\n").trim());
};

/** Remove document sections that were later identified as portal HTML. */
export const removeParsedDocumentSections = (
  rawText: string | null | undefined,
  documentIds: readonly number[],
): string => {
  const existing = rawText?.trim() ?? "";
  const ids = new Set(documentIds);
  if (!existing || ids.size === 0) return existing;

  const sectionStartPattern = /(?:^|\n\n)(?:\[Dokument\]\n)?\[ROLLEN:/gu;
  const starts = [...existing.matchAll(sectionStartPattern)];
  if (starts.length === 0) return existing;

  let result = "";
  let cursor = 0;
  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index];
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? existing.length;
    const documentId = existing.slice(start, end).match(/\[DOKUMENT-ID:\s*(\d+)\]/u)?.[1];
    result += existing.slice(cursor, start);
    if (!documentId || !ids.has(Number(documentId))) result += existing.slice(start, end);
    cursor = end;
  }
  return `${result}${existing.slice(cursor)}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/** Keep valid document text out of the corpus only when the shared validator rejects it. */
export const shouldIncludeParsedDocumentText = (value: string): boolean =>
  value.trim().length >= 20 && (!isPdfFormBoilerplate(value) || isPopulatedTenderNotice(value));

const submitToIndexNow = async (urls: string[]): Promise<void> => {
  if (urls.length === 0) return;
  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: getSiteHost(),
        key: INDEXNOW_KEY,
        keyLocation: `${getSiteUrl()}/${INDEXNOW_KEY}.txt`,
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

const pipelineVersionFromPayload = (payload: unknown): number | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const raw = (payload as Record<string, unknown>).pipeline_version;
  const version = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(version) && version > 0 ? version : null;
};

export const pipelineVersionPayload = (payload: unknown): Record<string, JsonValue> => {
  const version = pipelineVersionFromPayload(payload);
  return version === null ? {} : { pipeline_version: version };
};

export const isCurrentPipelineVersion = (payload: unknown, currentVersion: number | null): boolean =>
  currentVersion !== null && pipelineVersionFromPayload(payload) === currentVersion;

export const isPipelineJobCompatibleWithVersion = (payload: unknown, currentVersion: number): boolean => {
  const jobVersion = pipelineVersionFromPayload(payload);
  // Legacy jobs without a version read the current tender row when they run.
  return jobVersion === null || jobVersion === currentVersion;
};

export const buildTenderStageJobKey = (
  jobType: JobType,
  tenderId: number,
  pipelineVersion: number,
  keySuffix?: string,
): string => buildJobKey(
  jobType,
  tenderId,
  `v${pipelineVersion}${keySuffix ? `:${keySuffix}` : ""}`,
);

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
  /** Relevance gate result (lib/tender-relevance); undefined leaves it untouched. */
  llmRelevant?: boolean;
}

interface UpsertTenderResult {
  id: number;
  changed: boolean;
  inserted: boolean;
}

/**
 * Preserve the distinction between an omitted snapshot and an explicitly
 * empty snapshot. Omitted raw text must not erase an existing corpus, while a
 * scraper that actually observed an empty description must clear it.
 */
export const resolveEffectiveRawText = (
  boundedRawText: string | null | undefined,
): string | null | undefined => {
  if (boundedRawText === undefined) return undefined;
  return boundedRawText !== null && boundedRawText.trim().length > 0 ? boundedRawText : null;
};

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
  const values = keys.flatMap((key) => Array.isArray(record[key]) ? record[key] as unknown[] : []);
  return values.filter((value, index) => values.findIndex((candidate) => sameValue(candidate, value)) === index);
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

export const hasResourceSnapshotChanged = (
  currentUrl: string,
  currentMetadata: unknown,
  nextUrl: string,
  nextMetadata: unknown,
): boolean => buildResourceFingerprint(currentUrl, currentMetadata)
  !== buildResourceFingerprint(nextUrl, nextMetadata);

const documentRefreshBucket = (): number =>
  Math.floor(Date.now() / (settings.documentRefreshHours * 60 * 60 * 1000));

export const buildFetchDocumentsJobKey = (
  tenderId: number,
  resourceFingerprint: string,
  tenderVersion?: number,
): string => buildJobKey(
  JOB_FETCH_DOCUMENTS,
  tenderId,
  `${tenderVersion === undefined ? "" : `version-${tenderVersion}-`}resources-${resourceFingerprint || "empty"}-refresh-${documentRefreshBucket()}`,
);

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
export const mergeMetadata = (
  existing: unknown,
  incoming: Record<string, JsonValue> | undefined,
): Record<string, JsonValue> | undefined => {
  if (!incoming) return undefined;
  const existingRecord = (existing && typeof existing === "object")
    ? existing as Record<string, unknown>
    : {};
  const merged: Record<string, unknown> = { ...existingRecord };
  for (const key of ["description", "summary"]) {
    if (!Object.prototype.hasOwnProperty.call(existingRecord, key)
      && !Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    const incomingDescription = pickPublicDescription(incoming[key]);
    const existingDescription = pickPublicDescription(existingRecord[key]);
    const incomingIsMateriallyThinner = incomingDescription && existingDescription
      && incomingDescription.length < existingDescription.length * 0.8;
    if (incomingDescription && !incomingIsMateriallyThinner) {
      merged[key] = incomingDescription;
    } else if (existingDescription) {
      merged[key] = existingDescription;
    } else delete merged[key];
  }
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "description" || key === "summary" || key === "descriptionMarkdown" || key === "description_markdown") continue;
    const isEmpty = value === null || value === undefined || value === ""
      || (Array.isArray(value) && value.length === 0);
    if (isEmpty) continue;
    merged[key] = value;
  }
  if (Object.prototype.hasOwnProperty.call(existingRecord, "descriptionMarkdown")
    || Object.prototype.hasOwnProperty.call(existingRecord, "description_markdown")
    || Object.prototype.hasOwnProperty.call(incoming, "descriptionMarkdown")
    || Object.prototype.hasOwnProperty.call(incoming, "description_markdown")) {
    const incomingDescriptionMarkdown = [incoming.descriptionMarkdown, incoming.description_markdown]
      .find(isCanonicalPublicDescriptionMarkdown);
    const existingDescriptionMarkdown = [existingRecord.descriptionMarkdown, existingRecord.description_markdown]
      .find(isCanonicalPublicDescriptionMarkdown);
    const hasIncomingTextSnapshot = ["description", "summary"]
      .some((key) => Object.prototype.hasOwnProperty.call(incoming, key));
    let selectedDescriptionMarkdown: string | undefined;
    if (!hasIncomingTextSnapshot) {
      selectedDescriptionMarkdown = incomingDescriptionMarkdown ?? existingDescriptionMarkdown;
    } else {
      const mergedPublicDescription = pickPublicTenderDescription({ metadata: merged });
      const incomingPublicDescription = pickPublicTenderDescription({ metadata: incoming });
      const existingPublicDescription = pickPublicTenderDescription({ metadata: existingRecord });
      const incomingMatches = Boolean(mergedPublicDescription)
        && incomingPublicDescription === mergedPublicDescription;
      const existingMatches = Boolean(mergedPublicDescription)
        && existingPublicDescription === mergedPublicDescription;
      if (incomingMatches) {
        selectedDescriptionMarkdown = incomingDescriptionMarkdown
          ?? (existingMatches ? existingDescriptionMarkdown : undefined);
      } else if (existingMatches) {
        selectedDescriptionMarkdown = existingDescriptionMarkdown;
      }
    }
    if (selectedDescriptionMarkdown) {
      merged.descriptionMarkdown = selectedDescriptionMarkdown;
      delete merged.description_markdown;
    } else {
      delete merged.descriptionMarkdown;
      delete merged.description_markdown;
    }
  }
  return merged as Record<string, JsonValue>;
};

const upsertTender = async ({ source, sourceKey, url, title, externalId, metadata, deadlineAt, category, rawText, llmRelevant }: UpsertTenderInput): Promise<UpsertTenderResult> => {
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
    const id = existing[0].id;
    const result = await db.transaction(async (tx) => {
      const lockedRows = await tx
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
          llmRelevant: tenders.llmRelevant,
        })
        .from(tenders)
        .where(eq(tenders.id, id))
        .for("update");
      const current = lockedRows[0];
      if (!current) throw new Error(`Tender ${id} wurde während des Upserts entfernt`);

      // Non-destructive merge: don't let empty new values erase non-empty existing ones.
      const mergedMeta = mergeMetadata(current.metadataJson, metadata);
      const effectiveDeadline = deadlineAt !== undefined ? (deadlineAt ?? current.deadlineAt ?? null) : undefined;
      const effectiveRawText = resolveEffectiveRawText(boundedRawText);

      const changed =
        (sourceKey !== undefined && current.sourceKey !== sourceKey) ||
        current.url !== url ||
        current.title !== title ||
        (externalId !== undefined && current.externalId !== externalId) ||
        (mergedMeta !== undefined && !sameValue(current.metadataJson, mergedMeta)) ||
        (effectiveDeadline !== undefined && !sameDate(current.deadlineAt, effectiveDeadline)) ||
        (category !== undefined && current.category !== category) ||
        (effectiveRawText !== undefined && current.rawText !== effectiveRawText);
      const nextMetadata = mergedMeta ?? current.metadataJson;
      const resourceSnapshotChanged = hasResourceSnapshotChanged(current.url, current.metadataJson, url, nextMetadata);

      const updateData: Record<string, unknown> = { lastSeenAt: new Date() };
      if (changed) {
        // Invalidate derived state atomically with the version bump so a stage
        // cannot commit stale output between these operations.
        await tx.delete(structuredData).where(eq(structuredData.tenderId, id));
        await tx.delete(insights).where(eq(insights.tenderId, id));
        await tx.delete(scores).where(eq(scores.tenderId, id));
        if (resourceSnapshotChanged) {
          const oldDocuments = await tx.select({ id: documents.id }).from(documents).where(eq(documents.tenderId, id));
          await tx.delete(documents).where(eq(documents.tenderId, id));
          await tx.delete(tenderResources).where(eq(tenderResources.tenderId, id));
          if (effectiveRawText === undefined && oldDocuments.length > 0) {
            updateData.rawText = removeParsedDocumentSections(
              current.rawText,
              oldDocuments.map((document) => document.id),
            ) || null;
          }
        }
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
        updateData.qualityStatus = "candidate";
        updateData.qualityReason = null;
        updateData.readinessStatus = "pending";
        updateData.readinessReason = "Ausschreibung wurde aktualisiert und wird erneut analysiert.";
        updateData.readinessUpdatedAt = new Date();
        updateData.contentFingerprint = null;
        updateData.duplicateOfTenderId = null;
        updateData.contractValueMin = null;
        updateData.contractValueMax = null;
        updateData.contractDurationMonths = null;
        updateData.procedureType = null;
      }
      await tx.update(tenders).set(updateData).where(eq(tenders.id, id));
      // The relevance flag is bookkeeping, not content: persisting it must not
      // count as `changed` (no version bump, no derived-state invalidation).
      if (llmRelevant !== undefined && current.llmRelevant !== llmRelevant) {
        await tx.update(tenders).set({ llmRelevant }).where(eq(tenders.id, id));
      }
      return { id, changed, inserted: false };
    });
    if (result.changed) await markCatalogDirty();
    return result;
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
      rawText: resolveEffectiveRawText(boundedRawText) ?? undefined,
      llmRelevant: llmRelevant ?? undefined,
    })
    .returning({ id: tenders.id });

  await markCatalogDirty();
  return { id: result[0].id, changed: true, inserted: true };
};

export const mergeUsTenderMetadata = (
  existing: unknown,
  incoming: Record<string, JsonValue>,
): Record<string, JsonValue> => {
  const current = metadataRecord(existing);
  const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
    ? value.filter((attachment) =>
      Boolean(attachment) && typeof attachment === "object" && !Array.isArray(attachment)) as Record<string, unknown>[]
    : [];
  const previousAttachments = records(current.attachments);
  const incomingAttachments = records(incoming.attachments);
  const previousAttachmentUrls = previousAttachments
    .map((attachment) => attachment.url)
    .filter((url): url is string => typeof url === "string")
    .sort();
  const incomingAttachmentUrls = incomingAttachments
    .map((attachment) => attachment.url)
    .filter((url): url is string => typeof url === "string")
    .sort();
  if (!sameValue(previousAttachmentUrls, incomingAttachmentUrls)) return incoming;

  const previousAttachmentsByUrl = new Map(
    previousAttachments.flatMap((attachment) =>
      typeof attachment.url === "string" ? [[attachment.url, attachment] as const] : []),
  );
  return {
    ...incoming,
    attachments: incomingAttachments.map((attachment) => {
      const previous = previousAttachmentsByUrl.get(attachment.url as string);
      return {
        ...attachment,
        ...(typeof previous?.status === "string" ? { status: previous.status } : {}),
        ...(typeof previous?.document_id === "number" ? { document_id: previous.document_id } : {}),
      } as JsonValue;
    }),
    ...(Array.isArray(current.attachment_analysis)
      ? { attachment_analysis: current.attachment_analysis as JsonValue[] }
      : {}),
    ...(typeof current.attachment_analysis_at === "string"
      ? { attachment_analysis_at: current.attachment_analysis_at }
      : {}),
  };
};

const upsertUsTender = async (tender: UsExtractedTender): Promise<UpsertTenderResult> => {
  const metadata: Record<string, JsonValue> = {
    ...tender.metadata as Record<string, JsonValue>,
    contacts: tender.contacts.map((contact) => ({
      ...(contact.name ? { name: contact.name } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.phone ? { phone: contact.phone } : {}),
    })),
    attachments: dedupeUsAttachments(tender.attachments, tender.url)
      .sort((left, right) => left.url.localeCompare(right.url)),
    discovered_at: new Date().toISOString(),
  };
  const existingByExternalId = tender.externalId
    ? await db
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
    .limit(1)
    : [];
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
  const mergedMetadata = mergeUsTenderMetadata(current.metadataJson, metadata);
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
    !sameValue(current.metadataJson, mergedMetadata);

  await db.update(usTenders).set({
    ...values,
    metadataJson: mergedMetadata,
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
  const tender = await getTender(tenderId);
  const pipelineVersion = pipelineVersionFromPayload(payload) ?? tender.version;
  return enqueueJob(
    jobType,
    { tender_id: tenderId, ...payload, pipeline_version: pipelineVersion },
    {
      jobKey: buildTenderStageJobKey(jobType, tenderId, pipelineVersion, keySuffix),
      groupKey: buildTenderPipelineGroupKey(tenderId),
      // A completed stage only describes the input generation it processed.
      // Active jobs are still coalesced by jobKey, but a later fetch or
      // enrichment must be able to run the stage again.
      dedupeCompleted: false,
    },
  );
};

const queueTenderProcessing = async (tenderId: number, retryKey?: string): Promise<void> => {
  const tenderRows = await db
    .select({
      url: tenders.url,
      metadataJson: tenders.metadataJson,
      version: tenders.version,
    })
    .from(tenders)
    .where(eq(tenders.id, tenderId))
    .limit(1);
  const tender = tenderRows[0];
  if (!tender) return;
  const metadata = parseRecord(tender.metadataJson as string);
  const resourceFingerprint = buildResourceFingerprint(tender.url, metadata);
  const baseJobKey = buildFetchDocumentsJobKey(tenderId, resourceFingerprint, tender.version);
  const jobKey = retryKey ? `${baseJobKey}:retry-${retryKey}` : baseJobKey;

  // Resource/version keys detect changed work. Coalesce pending jobs for the
  // current generation, but let newer work follow an older running attempt.
  const activeFetchJobs = await db
    .select({ id: jobs.id, status: jobs.status, payload: jobs.payload })
    .from(jobs)
    .where(and(
      eq(jobs.type, JOB_FETCH_DOCUMENTS),
      sql`${jobs.payload} ->> 'tender_id' = ${String(tenderId)}`,
      inArray(jobs.status, ["pending", "running"]),
    ))
    .orderBy(sql`${jobs.id} DESC`);
  const runningFetch = activeFetchJobs.find((job) => job.status === "running");
  const pendingFetches = activeFetchJobs.filter((job) => job.status === "pending");
  // Reuse only a pending job for this tender version (or a legacy job without
  // a version, which reads the current row). Older versioned jobs will skip.
  const currentPendingFetch = pendingFetches.find((job) =>
    isPipelineJobCompatibleWithVersion(job.payload, tender.version),
  );
  const redundantPendingIds = pendingFetches
    .filter((job) => job.id !== currentPendingFetch?.id)
    .map((job) => job.id);
  if (redundantPendingIds.length > 0) {
    // Re-check the status so a worker claiming between the read and delete is
    // never removed together with its attempt history.
    await db.delete(jobs).where(and(
      eq(jobs.status, "pending"),
      inArray(jobs.id, redundantPendingIds),
    ));
  }

  if (currentPendingFetch) return;
  if (runningFetch) {
    if (isPipelineJobCompatibleWithVersion(runningFetch.payload, tender.version)) return;
  }

  await enqueueJob(
    JOB_FETCH_DOCUMENTS,
    { tender_id: tenderId, resource_fingerprint: resourceFingerprint, pipeline_version: tender.version },
    { jobKey, groupKey: buildTenderPipelineGroupKey(tenderId) },
  );
};

const ensureCurrentPipelineVersion = async (
  tenderId: number,
  payload: Record<string, JsonValue>,
): Promise<boolean> => {
  const current = await db
    .select({ version: tenders.version })
    .from(tenders)
    .where(eq(tenders.id, tenderId))
    .limit(1);
  if (!current[0]) return false;
  if (isCurrentPipelineVersion(payload, current[0].version)) return true;
  await queueTenderProcessing(tenderId, "stale-version");
  return false;
};

type TenderPipelineTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TenderPipelineDatabase = typeof db | TenderPipelineTransaction;

const withCurrentPipelineVersion = async <T>(
  tenderId: number,
  payload: Record<string, JsonValue>,
  persist: (tx: TenderPipelineTransaction) => Promise<T>,
): Promise<{ current: true; value: T } | { current: false }> => {
  const result = await db.transaction(async (tx) => {
    const current = await tx
      .select({ version: tenders.version })
      .from(tenders)
      .where(eq(tenders.id, tenderId))
      .for("update");
    if (!current[0]) return { current: false as const, missing: true as const };
    if (!isCurrentPipelineVersion(payload, current[0].version)) {
      return { current: false as const, missing: false as const };
    }
    return { current: true as const, value: await persist(tx) };
  });

  if (!result.current) {
    if (!result.missing) await queueTenderProcessing(tenderId, "stale-version");
    return { current: false };
  }
  return result;
};

const TENDER_PIPELINE_STAGES = [
  JOB_FETCH_DOCUMENTS,
  JOB_PARSE,
  JOB_STRUCTURE,
  JOB_SCORE,
  JOB_CACHE_DETAIL,
] as const;

const FAILED_PIPELINE_RECOVERY_COOLDOWN_MS = 60 * 60 * 1000;

export const shouldRecoverFailedPipelineStage = (
  stage: { status: string; finishedAt: Date | null } | undefined,
  now = Date.now(),
): boolean => (
  !stage
  || stage.status === "done"
  || (stage.status === "failed"
    && (!stage.finishedAt || now - stage.finishedAt.getTime() >= FAILED_PIPELINE_RECOVERY_COOLDOWN_MS))
);

export const shouldRetryLowConfidenceStructure = (
  input: {
    qualityStatus: string | null | undefined;
    rawText: string | null | undefined;
    finishedAt: Date | null | undefined;
    confidence: number | null | undefined;
  },
  now = Date.now(),
): boolean => {
  const finishedAt = input.finishedAt?.getTime();
  return input.qualityStatus !== "rejected"
    && Boolean(input.rawText?.trim())
    && finishedAt !== undefined
    && now - finishedAt >= FAILED_PIPELINE_RECOVERY_COOLDOWN_MS
    && (input.confidence ?? 0) < 0.35;
};

export const isTenderDocumentRefreshDue = (
  lastFetchedAt: Date | null | undefined,
  now = Date.now(),
  refreshIntervalMs = settings.documentRefreshHours * 60 * 60 * 1_000,
): boolean => (
  !lastFetchedAt
  || !Number.isFinite(lastFetchedAt.getTime())
  || now - lastFetchedAt.getTime() >= refreshIntervalMs
);

const currentPipelineVersionSql = (jobAlias: string) => sql.raw(
  `(CASE WHEN ${jobAlias}.payload ->> 'pipeline_version' ~ '^[0-9]+$' `
  + `THEN (${jobAlias}.payload ->> 'pipeline_version')::integer ELSE 0 END) = tenders.version`,
);

/** Requeue the first missing or permanently failed stage after a re-discovery. */
export const recoverTenderProcessing = async (tenderId: number): Promise<void> => {
  const tender = await getTender(tenderId);
  const stageRows = await db
    .select({ type: jobs.type, status: jobs.status, lastError: jobs.lastError, finishedAt: jobs.finishedAt, payload: jobs.payload })
    .from(jobs)
    .where(and(
      inArray(jobs.type, [...TENDER_PIPELINE_STAGES]),
      sql`${jobs.payload} ->> 'tender_id' = ${String(tenderId)}`,
    ))
    .orderBy(sql`${jobs.id} DESC`);
  const latestByStage = new Map<string, { status: string; lastError: string | null; finishedAt: Date | null }>();
  for (const row of stageRows) {
    if (pipelineVersionFromPayload(row.payload) !== tender.version) continue;
    if (!latestByStage.has(row.type)) {
      latestByStage.set(row.type, { status: row.status, lastError: row.lastError, finishedAt: row.finishedAt });
    }
  }

  const failedResource = await db
    .select({ attempts: tenderResources.attempts })
    .from(tenderResources)
    .where(and(eq(tenderResources.tenderId, tenderId), eq(tenderResources.status, "failed")))
    .limit(1);
  if (failedResource.length > 0) {
    const fetchStage = latestByStage.get(JOB_FETCH_DOCUMENTS);
    if (shouldRecoverFailedPipelineStage(fetchStage)) {
      await queueTenderProcessing(tenderId, `resource-${failedResource[0].attempts}`);
    }
    return;
  }

  const failedParseDocument = await db
    .select({ id: documents.id, updatedAt: documents.updatedAt })
    .from(documents)
    .where(and(
      eq(documents.tenderId, tenderId),
      eq(documents.downloadStatus, "downloaded"),
      eq(documents.parseStatus, "failed"),
    ))
    .limit(1);
  if (failedParseDocument.length > 0) {
    const parseStage = latestByStage.get(JOB_PARSE);
    if (shouldRecoverFailedPipelineStage(parseStage)) {
      await queueTenderStage(
        JOB_PARSE,
        tenderId,
        { pipeline_version: tender.version },
        `retry-${failedParseDocument[0].id}-${failedParseDocument[0].updatedAt.getTime()}`,
      );
    }
    return;
  }

  const fetchStage = latestByStage.get(JOB_FETCH_DOCUMENTS);
  const fetchStatus = fetchStage?.status;
  if (!fetchStatus) {
    await queueTenderProcessing(tenderId);
    return;
  }
  if (fetchStatus === "failed") {
    if (shouldRecoverFailedPipelineStage(latestByStage.get(JOB_FETCH_DOCUMENTS))) await queueTenderProcessing(tenderId);
    return;
  }
  if (fetchStatus !== "done") return;
  if (isTenderDocumentRefreshDue(fetchStage?.finishedAt)) {
    // Unchanged rediscoveries still need to refresh portal documents: a file
    // can change at the same URL without changing the tender listing itself.
    await queueTenderProcessing(tenderId);
    return;
  }

  const structureStage = latestByStage.get(JOB_STRUCTURE);
  if (structureStage?.status === "done"
    && structureStage.finishedAt
    && Date.now() - structureStage.finishedAt.getTime() >= FAILED_PIPELINE_RECOVERY_COOLDOWN_MS) {
    const structuredRows = await db
      .select({ confidence: structuredData.confidence })
      .from(structuredData)
      .where(eq(structuredData.tenderId, tenderId))
      .limit(1);
    if (shouldRetryLowConfidenceStructure({
      qualityStatus: tender.qualityStatus,
      rawText: tender.rawText,
      finishedAt: structureStage.finishedAt,
      confidence: structuredRows[0]?.confidence,
    })) {
      // A deterministic fallback can be persisted when the LLM cascade is
      // unavailable, but only retry while usable tender text remains.
      await queueTenderStage(JOB_STRUCTURE, tenderId, { pipeline_version: tender.version }, "recovery-low-confidence");
      return;
    }
  }

  for (const stage of [JOB_PARSE, JOB_STRUCTURE] as const) {
    const status = latestByStage.get(stage)?.status;
    // Do not keep requeuing structure for tenders whose listing and document
    // fetch produced no usable text. A later rediscovery can restart fetching.
    if (stage === JOB_STRUCTURE && !tender.rawText?.trim()) {
      await markTenderWithoutUsableContent(tenderId, { pipeline_version: tender.version });
      return;
    }
    if (!status) {
      await queueTenderStage(stage, tenderId, { pipeline_version: tender.version });
      return;
    }
    if (status === "failed") {
      if (shouldRecoverFailedPipelineStage(latestByStage.get(stage))) {
        await queueTenderStage(stage, tenderId, { pipeline_version: tender.version });
      }
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
    if (!tender.rawText?.trim()) {
      await markTenderWithoutUsableContent(tenderId, { pipeline_version: tender.version });
      return;
    }
    await queueTenderStage(JOB_STRUCTURE, tenderId, { pipeline_version: tender.version }, "recovery");
    return;
  }

  if (tender.qualityStatus !== "qualified") return;

  if (isScorableReadiness(tender.readinessStatus)) {
    const scoreStatus = latestByStage.get(JOB_SCORE)?.status;
    if (!scoreStatus) {
      await queueTenderStage(JOB_SCORE, tenderId, { pipeline_version: tender.version });
      return;
    }
    if (scoreStatus === "done") {
      const missingCompanyScore = await db
        .select({ companyId: companyProfiles.id })
        .from(companyProfiles)
        .leftJoin(scores, and(
          eq(scores.companyId, companyProfiles.id),
          eq(scores.tenderId, tenderId),
        ))
        .where(isNull(scores.id))
        .limit(1);
      if (missingCompanyScore.length > 0) {
        await queueTenderStage(JOB_SCORE, tenderId, { pipeline_version: tender.version }, "recovery-missing-scores");
        return;
      }
    }
    if (scoreStatus === "failed") {
      if (shouldRecoverFailedPipelineStage(latestByStage.get(JOB_SCORE))) {
        await queueTenderStage(JOB_SCORE, tenderId, { pipeline_version: tender.version });
      }
      return;
    }
    if (scoreStatus !== "done") return;
  }

  const cacheStage = latestByStage.get(JOB_CACHE_DETAIL);
  if (cacheStage?.status === "failed" && isTerminalCacheDetailFailure(cacheStage.lastError)) {
    return;
  }
  if (!cacheStage) {
    await queueTenderStage(JOB_CACHE_DETAIL, tenderId, { pipeline_version: tender.version });
  } else if (cacheStage.status === "failed" && shouldRecoverFailedPipelineStage(cacheStage)) {
    await queueTenderStage(JOB_CACHE_DETAIL, tenderId, { pipeline_version: tender.version });
  }
};

/** Recover newly completed tenders that were not rediscovered after analysis. */
export const recoverIncompleteTenderPipelines = async (limit = 50): Promise<number> => {
  const candidates = await db
    .select({ id: tenders.id })
    .from(tenders)
    .leftJoin(structuredData, eq(structuredData.tenderId, tenders.id))
    .where(and(
      or(eq(tenders.qualityStatus, "candidate"), eq(tenders.qualityStatus, "qualified")),
      sql`(
         NOT EXISTS (
           SELECT 1 FROM jobs active_stage
           WHERE active_stage.status IN ('pending', 'running')
             AND active_stage.type IN ('fetch_documents', 'parse_documents', 'structure_tender', 'score_tender', 'cache_detail')
             AND active_stage.payload ->> 'tender_id' = ${tenders.id}::text
             AND ${currentPipelineVersionSql("active_stage")}
          )
         AND NOT EXISTS (
           -- A recent, latest failure is already waiting for its cooldown.
           -- Do not let those rows occupy every limited recovery batch.
           SELECT 1 FROM jobs recent_failure
           WHERE recent_failure.status = 'failed'
             AND recent_failure.type IN ('fetch_documents', 'parse_documents', 'structure_tender', 'score_tender', 'cache_detail')
             AND recent_failure.finished_at > NOW() - (${FAILED_PIPELINE_RECOVERY_COOLDOWN_MS} * INTERVAL '1 millisecond')
             AND recent_failure.payload ->> 'tender_id' = ${tenders.id}::text
             AND ${currentPipelineVersionSql("recent_failure")}
             AND (recent_failure.type <> 'score_tender' OR ${tenders.readinessStatus} IN ('ready', 'partial'))
             AND NOT EXISTS (
               SELECT 1 FROM jobs newer_failure
               WHERE newer_failure.type = recent_failure.type
                 AND newer_failure.payload ->> 'tender_id' = recent_failure.payload ->> 'tender_id'
                 AND newer_failure.id > recent_failure.id
                 AND ${currentPipelineVersionSql("newer_failure")}
             )
         )
         AND NOT EXISTS (
           -- These cache errors are deliberately terminal until explicit
           -- reprocessing or a newer pipeline stage is created.
           SELECT 1 FROM jobs terminal_cache_failure
           WHERE terminal_cache_failure.type = 'cache_detail'
             AND terminal_cache_failure.status = 'failed'
              AND terminal_cache_failure.last_error ~* ${TERMINAL_CACHE_DETAIL_FAILURE_PATTERN}
             AND terminal_cache_failure.payload ->> 'tender_id' = ${tenders.id}::text
             AND ${currentPipelineVersionSql("terminal_cache_failure")}
             AND NOT EXISTS (
               SELECT 1 FROM jobs newer_cache_stage
               WHERE newer_cache_stage.type = terminal_cache_failure.type
                 AND newer_cache_stage.payload ->> 'tender_id' = terminal_cache_failure.payload ->> 'tender_id'
                 AND newer_cache_stage.id > terminal_cache_failure.id
                 AND ${currentPipelineVersionSql("newer_cache_stage")}
             )
         )
         AND (
        ${structuredData.tenderId} IS NULL
        AND (
          ${tenders.rawText} IS NOT NULL
          AND BTRIM(${tenders.rawText}) <> ''
          OR NOT EXISTS (
            SELECT 1 FROM jobs parse_job
            WHERE parse_job.type = 'parse_documents'
              AND parse_job.status = 'done'
              AND parse_job.payload ->> 'tender_id' = ${tenders.id}::text
              AND ${currentPipelineVersionSql("parse_job")}
          )
        )
        OR (
         ${structuredData.tenderId} IS NOT NULL
         AND
         ${tenders.qualityStatus} = 'qualified'
         AND ${tenders.rawText} IS NOT NULL
         AND BTRIM(${tenders.rawText}) <> ''
         AND (
             (
              ${tenders.readinessStatus} IN ('ready', 'partial')
              AND (
                NOT EXISTS (
                  SELECT 1 FROM jobs score_job
                  WHERE score_job.type = 'score_tender'
                    AND score_job.status = 'done'
                    AND score_job.payload ->> 'tender_id' = ${tenders.id}::text
                    AND ${currentPipelineVersionSql("score_job")}
                )
                OR EXISTS (
                  SELECT 1 FROM company_profiles missing_company
                  WHERE NOT EXISTS (
                    SELECT 1 FROM scores missing_score
                    WHERE missing_score.tender_id = ${tenders.id}
                      AND missing_score.company_id = missing_company.id
                  )
                )
              )
             )
            OR NOT EXISTS (
              SELECT 1 FROM jobs cache_job
              WHERE cache_job.type = 'cache_detail'
                AND cache_job.status = 'done'
                AND cache_job.payload ->> 'tender_id' = ${tenders.id}::text
                AND ${currentPipelineVersionSql("cache_job")}
            )
          )
        )
        OR (
          -- Completed but low-confidence structures are retried only after
          -- their recovery cooldown; without this branch the retry logic in
          -- recoverTenderProcessing is never reached for these tenders.
          ${structuredData.tenderId} IS NOT NULL
          AND ${tenders.rawText} IS NOT NULL
          AND BTRIM(${tenders.rawText}) <> ''
          AND COALESCE(${structuredData.confidence}, 0) < 0.35
          AND EXISTS (
            SELECT 1 FROM jobs low_confidence_structure
            WHERE low_confidence_structure.type = 'structure_tender'
              AND low_confidence_structure.status = 'done'
              AND low_confidence_structure.finished_at <= NOW() - (${FAILED_PIPELINE_RECOVERY_COOLDOWN_MS} * INTERVAL '1 millisecond')
              AND low_confidence_structure.payload ->> 'tender_id' = ${tenders.id}::text
              AND ${currentPipelineVersionSql("low_confidence_structure")}
              AND NOT EXISTS (
                SELECT 1 FROM jobs newer_structure
                WHERE newer_structure.type = low_confidence_structure.type
                  AND newer_structure.payload ->> 'tender_id' = low_confidence_structure.payload ->> 'tender_id'
                  AND newer_structure.id > low_confidence_structure.id
                  AND ${currentPipelineVersionSql("newer_structure")}
              )
          )
        )
        OR EXISTS (
          SELECT 1 FROM jobs failed_stage
          WHERE (
              failed_stage.type IN ('fetch_documents', 'parse_documents')
              OR (
                failed_stage.type = 'structure_tender'
                AND ${tenders.rawText} IS NOT NULL
                AND BTRIM(${tenders.rawText}) <> ''
              )
              OR (
                 ${structuredData.tenderId} IS NOT NULL
                 AND
                 ${tenders.qualityStatus} = 'qualified'
                 AND ${tenders.rawText} IS NOT NULL
                 AND BTRIM(${tenders.rawText}) <> ''
                 AND failed_stage.type IN ('score_tender', 'cache_detail')
              )
            )
            AND failed_stage.status = 'failed'
            AND failed_stage.finished_at IS NOT NULL
            AND failed_stage.finished_at <= NOW() - INTERVAL '1 hour'
            AND failed_stage.payload ->> 'tender_id' = ${tenders.id}::text
            AND ${currentPipelineVersionSql("failed_stage")}
            AND NOT EXISTS (
              SELECT 1 FROM jobs newer_stage
              WHERE newer_stage.type = failed_stage.type
                AND newer_stage.payload ->> 'tender_id' = failed_stage.payload ->> 'tender_id'
                AND newer_stage.id > failed_stage.id
                AND ${currentPipelineVersionSql("newer_stage")}
            )
        )
        OR (
          -- A refresh can leave an older ready/partial readiness state
          -- behind when the new pipeline version has no usable content.
          ${tenders.readinessStatus} IN ('pending', 'partial', 'ready')
          AND (${tenders.rawText} IS NULL OR BTRIM(${tenders.rawText}) = '')
          AND EXISTS (
            SELECT 1 FROM jobs parse_job
            WHERE parse_job.type = 'parse_documents'
              AND parse_job.status = 'done'
              AND parse_job.payload ->> 'tender_id' = ${tenders.id}::text
              AND ${currentPipelineVersionSql("parse_job")}
          )
        )
        )
      )`,
    ))
    .orderBy(asc(tenders.updatedAt), asc(tenders.id))
    .limit(Math.max(1, Math.min(limit, 100)));

  for (const candidate of candidates) {
    await recoverTenderProcessing(candidate.id);
  }
  return candidates.length;
};

const clearSourceFailureRetry = (cursor: PublicSourceCursor): PublicSourceCursor => {
  const cleanCursor = { ...cursor };
  delete cleanCursor.sourceFailureAttempts;
  delete cleanCursor.sourceFailureRetryAt;
  return cleanCursor;
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
    // Vergabe-ID aus dem Seiteninhalt – oder direkt aus der URL, wenn der Fetch
    // nur die 403-Fehlerseite (IP-Block) geliefert hat.
    const vergabeIdMatch = html.match(/Vergabe-?ID[:\s]*(\d{5,})/i)
      ?? baseUrl.match(/evergabe\.de\/unterlagen\/(\d{5,})/i);
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
        // evergabe.de blockiert Server-IPs (403) – Parallel-Extract als Rückfallebene
        if (links.length === 0) {
          try {
            const viaParallel = await fetchEvergabeDocumentsViaParallel(docsUrl);
            for (const doc of viaParallel) {
              addLink(doc.url, doc.filename ?? "");
            }
          } catch (parallelErr) {
            console.warn(`[pipeline] evergabe Parallel-Extract fehlgeschlagen:`, parallelErr);
          }
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

export const isPermanentResourceFailure = (message: string): boolean =>
  /\b(?:401|403|404)\b|not found|nicht gefunden|zugriffsblockierte seite|participation_required|dokument zu gr(?:oß|oss)/iu.test(message);

export const shouldUseRenderedResourceDiscovery = (
  candidates: ReadonlyArray<ResourceCandidateRecord>,
): boolean => !candidates.some(isFetchableResourceCandidate);

const isPersistableResourceCandidate = (candidate: ResourceCandidateRecord): boolean =>
  !isGenericPortalNavigationResource(candidate)
  && (isFetchableResourceCandidate(candidate) || ["api", "page", "unknown"].includes(candidate.resourceType));

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

  // Bayern tenders are sourced from the JSON listing API. Its generated
  // Dashboard_off URL is only a client-side shell and repeatedly times out;
  // do not spend a browser attempt when the API supplied no resource links.
  const isBayernApiShell = tender.sourceKey === "bayern-api"
    && (() => {
      try {
        return new URL(sourcePageUrl).hostname === "portal.deutsche-evergabe.de";
      } catch {
        return false;
      }
    })();

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
  // Static/metadata downloads are sufficient for the fetch stage. Rendered
  // discovery remains the fallback for portals that expose only pages or JS
  // links, avoiding a browser call for every ordinary tender.
  if (!isBayernApiShell && shouldUseRenderedResourceDiscovery(mergeResourceCandidates(metadataCandidates, pageCandidates))) {
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
  }

  const mergedBeforeSubpages = mergeResourceCandidates(metadataCandidates, pageCandidates)
    .filter(isPersistableResourceCandidate);
  const candidateSubpages = !isBayernApiShell && shouldUseRenderedResourceDiscovery(mergedBeforeSubpages)
    ? mergedBeforeSubpages
      .filter((candidate) => candidate.resourceType === "page" || candidate.resourceType === "unknown")
      .filter((candidate) => candidate.url !== sourcePageUrl && candidate.url !== staticPageUrl)
      .filter((candidate) => !isPortalActionUrl(candidate.url))
      .filter((candidate) => {
        try {
          return new URL(candidate.url).origin === new URL(sourcePageUrl).origin;
        } catch {
          return false;
        }
      })
      .slice(0, RESOURCE_MAX_SUBPAGES)
    : [];

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

const refreshTenderReadiness = async (
  tenderId: number,
  payload: Record<string, JsonValue>,
  accessBlocked = false,
) => {
  return withCurrentPipelineVersion(tenderId, payload, async (tx) => {
    const tenderRows = await tx
      .select({ qualityStatus: tenders.qualityStatus, rawText: tenders.rawText })
      .from(tenders)
      .where(eq(tenders.id, tenderId))
      .limit(1);
    const structuredRows = await tx
      .select({ confidence: structuredData.confidence })
      .from(structuredData)
      .where(eq(structuredData.tenderId, tenderId))
      .limit(1);
    const documentRows = await tx
      .select({
        id: documents.id,
        url: documents.url,
        contentType: documents.contentType,
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
    const analysis = buildDocumentAnalysis(documentRows.filter((document) =>
      !isPortalActionUrl(document.url) && !isHtmlContentType(document.contentType)) as AnalyzedDocument[]);
    const readiness = evaluateTenderReadiness({
      qualityStatus: tenderRows[0]?.qualityStatus ?? "candidate",
      rawText: tenderRows[0]?.rawText,
      structuredExists: structuredRows.length > 0,
      structuredConfidence: structuredRows[0]?.confidence ?? null,
      documentAnalysis: analysis,
      accessBlocked,
    });
    await tx.update(tenders).set({
      readinessStatus: readiness.status,
      readinessReason: readiness.reason,
      readinessUpdatedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tenders.id, tenderId));
    if (!isScorableReadiness(readiness.status)) {
      await tx.delete(insights).where(eq(insights.tenderId, tenderId));
      await tx.delete(scores).where(eq(scores.tenderId, tenderId));
    }
    return { readiness, analysis };
  });
};

const markTenderWithoutUsableContent = async (
  tenderId: number,
  payload: Record<string, JsonValue>,
): Promise<void> => {
  const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
    await tx.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
    await tx.delete(insights).where(eq(insights.tenderId, tenderId));
    await tx.delete(scores).where(eq(scores.tenderId, tenderId));
    await tx.update(tenders).set({
      qualityStatus: "candidate",
      qualityReason: "Keine verwertbaren Ausschreibungsdokumente oder Beschreibung vorhanden.",
      contentFingerprint: null,
      duplicateOfTenderId: null,
      contractValueMin: null,
      contractValueMax: null,
      contractDurationMonths: null,
      procedureType: null,
      readinessStatus: "manual_review",
      readinessReason: "Keine verwertbaren Ausschreibungsdokumente oder Beschreibung vorhanden.",
      readinessUpdatedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tenders.id, tenderId));
  });
  if (persisted.current) await markCatalogDirty();
};

const rejectBlockedTender = async (
  tenderId: number,
  detection: AccessPageDetection,
  payload: Record<string, JsonValue>,
): Promise<boolean> => {
  const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
    await tx.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
    await tx.delete(insights).where(eq(insights.tenderId, tenderId));
    await tx.delete(scores).where(eq(scores.tenderId, tenderId));
    await tx.update(tenders).set({
      qualityStatus: "rejected",
      qualityReason: `Zugriffsschutz erkannt: ${detection.reason ?? "unbekannt"}`,
      readinessStatus: "blocked",
      readinessReason: `Zugriffsschutz erkannt: ${detection.reason ?? "unbekannt"}`,
      readinessUpdatedAt: new Date(),
      rawText: null,
      contentFingerprint: null,
      duplicateOfTenderId: null,
      updatedAt: new Date(),
    }).where(eq(tenders.id, tenderId));
  });
  if (persisted.current) await markCatalogDirty();
  return persisted.current;
};

const retryBlockedDetail = async (
  tender: Tender,
  detection: AccessPageDetection,
  payload: Record<string, JsonValue>,
): Promise<boolean> => {
  if (!tender.deadlineAt || tender.deadlineAt.getTime() > Date.now()) {
    throw new Error(`Detailseite vorübergehend nicht verfügbar (${detection.reason ?? "unbekannt"})`);
  }
  if (!await rejectBlockedTender(tender.id, detection, payload)) return false;
  throw new Error(`Detailseite abgelaufen oder entfernt (${detection.reason ?? "unbekannt"})`);
};

const TERMINAL_CACHE_DETAIL_FAILURE_PATTERN = "(participation_required|login_required|navigation_page|403|404|not found|nicht gefunden)";
const TERMINAL_CACHE_DETAIL_FAILURE_REGEX = new RegExp(TERMINAL_CACHE_DETAIL_FAILURE_PATTERN, "iu");

export const isTerminalCacheDetailFailure = (lastError: string | null | undefined): boolean =>
  Boolean(lastError && TERMINAL_CACHE_DETAIL_FAILURE_REGEX.test(lastError));

export const getAccessLimitedCacheResult = (
  tender: Pick<Tender, "title" | "metadataJson" | "rawText">,
  detection: AccessPageDetection,
  structuredSource?: unknown,
): Record<string, JsonValue> | null => {
  const metadata = parseRecord(tender.metadataJson as string);
  const metadataDescription = pickPublicDescription(metadata.summary, metadata.description);
  const normalized = structuredSource
    ? normalizeStructured(structuredSource, tender.title ?? "", {
      summary: metadataDescription || null,
    })
    : null;
  const description = pickPublicDescription(
    normalized?.summary,
    metadata.summary,
    metadata.description,
  );

  const accessLimited = metadata.access_limited === true
    || detection.reason === "participation_required"
    || detection.reason === "login_required";
  if (!accessLimited) return null;
  if (!metadata.access_limited && description.length < 80) return null;

  const portalFacts = extractPublicPortalFacts(typeof metadata.description === "string" ? metadata.description : "");
  const accessDescription = buildPublicAccessLimitedDescription(tender.title ?? "", portalFacts);
  const descriptionMarkdown = buildPublicAccessLimitedDescriptionMarkdown(tender.title ?? "", portalFacts);
  const publicDescription = pickValidatedPublicCandidate(
    normalized?.summary,
    metadata.summary,
    metadata.description,
  ) || accessDescription;

  return {
    cached: true,
    detail_cached: false,
    access_limited: true,
    blocked: true,
    blocked_reason: detection.reason ?? "participation_required",
    summary: publicDescription,
    description: publicDescription,
    descriptionMarkdown,
  };
};

const persistAccessLimitedCacheResult = async (
  tenderId: number,
  result: Record<string, JsonValue>,
  payload: Record<string, JsonValue>,
): Promise<boolean> => {
  const descriptionMarkdown = typeof result.descriptionMarkdown === "string"
    ? result.descriptionMarkdown
    : "";
  if (!isCanonicalPublicDescriptionMarkdown(descriptionMarkdown)) return true;
  const summary = pickValidatedPublicCandidate(result.summary, result.description) || "";

  const jsonBlob = {
    title: result.title ?? "",
    summary,
    description: summary,
    descriptionMarkdown,
    access_limited: true,
    accessLimited: true,
    hard_facts: {},
    decision_relevant: {},
    procurement: {},
  };
  const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
    await tx
      .insert(structuredData)
      .values({ tenderId, jsonBlob, confidence: 0.2 })
      .onConflictDoUpdate({
        target: structuredData.tenderId,
        set: { jsonBlob, confidence: 0.2, updatedAt: new Date() },
      });
    });
  return persisted.current;
};

const evaluateTenderQuality = async (tender: Tender, structured: StructuredData) => {
  const assessment = assessTenderQuality(tender.title ?? "", tender.url, tender.rawText ?? "", structured);
  if (assessment.status === "rejected") {
    return { ...assessment, duplicateOfTenderId: null as number | null };
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
  const errors: string[] = [];
  for (const src of sources) {
    let items: Awaited<ReturnType<typeof discoverTendersFromSource>>;
    try {
      items = await discoverTendersFromSource(src);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannter Quellenfehler";
      errors.push(`${src.name ?? src.url}: ${message}`);
      console.error(`[pipeline] Crawl-Quelle fehlgeschlagen (${src.url}): ${message}`);
      continue;
    }
    for (const tender of items) {
      try {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "unbekannter Tenderfehler";
        errors.push(`${tender.url}: ${message}`);
        console.error(`[pipeline] Tender konnte nicht verarbeitet werden (${tender.url}): ${message}`);
      }
      discovered += 1;
    }
  }

  if (errors.length > 0) {
    throw new Error(`Crawl teilweise fehlgeschlagen: ${errors.slice(0, 10).join("; ")}`);
  }
  return { discovered, changed, unchanged, errors };
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

export const findHtmlResponseDocument = <T extends PipelineDocumentRow>(
  documents: readonly T[],
  candidateUrl: string,
  contentType: string | null,
): T | undefined => {
  const candidateIdentity = documentIdentityKey({ url: candidateUrl, contentType });
  return documents.find((document) => documentIdentityKey({
    url: document.url,
    contentType: document.contentType,
  }) === candidateIdentity);
};

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
  database: TenderPipelineDatabase = db,
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
      await database.update(documents).set({ updatedAt: new Date(), errorMessage: null }).where(eq(documents.id, existingByUrl.id));
      existingByUrl.updatedAt = new Date();
    }
    return { id: existingByHash?.id ?? existingByUrl?.id ?? null, saved: false };
  }

  if (action === "update" && existingByUrl) {
    await database.update(documents).set(values).where(eq(documents.id, existingByUrl.id));
    existingByUrl.sha256 = stored.sha256;
    existingByUrl.storagePath = storagePath;
    existingByUrl.contentType = stored.contentType;
    existingByUrl.filename = filename;
    existingByUrl.downloadStatus = "downloaded";
    existingByUrl.updatedAt = new Date();
    return { id: existingByUrl.id, saved: true };
  }

  const inserted = await database.insert(documents).values(values).onConflictDoNothing().returning({ id: documents.id });
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

  const existingHashRows = await database
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
  database: TenderPipelineDatabase = db,
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
    await database.update(documents).set(values).where(eq(documents.id, existing.id));
    existing.sha256 = values.sha256;
    existing.downloadStatus = "failed";
    return;
  }

  const inserted = await database.insert(documents).values(values).onConflictDoNothing().returning({ id: documents.id });
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

const upsertTenderResource = async (
  tenderId: number,
  candidate: ResourceCandidateRecord,
  database: TenderPipelineDatabase = db,
): Promise<{ id: number; status: string }> => {
  const rows = await database
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
        status: candidate.method === "GET" ? "pending" : "skipped",
        errorMessage: candidate.method === "GET" ? null : "Nur sichere GET-Ressourcen werden automatisch geladen.",
        updatedAt: new Date(),
      },
    })
    .returning({ id: tenderResources.id, status: tenderResources.status });
  return rows[0];
};

const discardHtmlDocumentResponse = async (
  resourceId: number,
  candidateUrl: string,
  stored: Awaited<ReturnType<typeof fetchAndStore>>,
  existingDocuments: PipelineDocumentRow[] = [],
  database: TenderPipelineDatabase = db,
): Promise<void> => {
  const message = "HTML-/Portalantwort statt Dokument";
  await database.update(tenderResources).set({
    url: sanitizeResourceUrl(stored.finalUrl) ?? candidateUrl,
    filename: stored.filename,
    contentType: stored.contentType,
    contentDisposition: stored.contentDisposition,
    status: "skipped",
    errorMessage: message,
     updatedAt: new Date(),
  }).where(eq(tenderResources.id, resourceId));
  const existingDocument = findHtmlResponseDocument(existingDocuments, candidateUrl, stored.contentType);
  if (existingDocument) {
    await database.update(documents).set({
      downloadStatus: "skipped",
      parseStatus: "empty",
      extractedText: null,
      errorMessage: message,
      updatedAt: new Date(),
    }).where(eq(documents.id, existingDocument.id));
    existingDocument.downloadStatus = "skipped";
  }
  await fs.promises.rm(objectAbsolutePath(stored.storagePath), { force: true });
};

const runFetchDocuments = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };

  const tender = await getTender(tenderId);

  const metadata = parseRecord(tender.metadataJson as string);
  const candidates = (await discoverTenderResources(tender, metadata))
    .filter((candidate) => !isGenericPortalNavigationResource(candidate));
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) {
    return { skipped: true, reason: "veraltete Tender-Version" };
  }
  const resourceRows = new Map<string, { id: number; status: string }>();
  for (const candidate of candidates) {
    if (!await ensureCurrentPipelineVersion(tenderId, payload)) {
      return { skipped: true, reason: "veraltete Tender-Version" };
    }
    const persistedResource = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
      const row = await upsertTenderResource(tenderId, candidate, tx);
      if (candidate.method !== "GET") {
        await tx.update(tenderResources).set({
          status: "skipped",
          errorMessage: "Nur sichere GET-Ressourcen werden automatisch geladen.",
          updatedAt: new Date(),
        }).where(eq(tenderResources.id, row.id));
        row.status = "skipped";
      }
      return row;
    });
    if (!persistedResource.current) return { skipped: true, reason: "veraltete Tender-Version" };
    const row = persistedResource.value;
    resourceRows.set(candidate.canonicalUrl, row);
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
    if (resource.status === "skipped") continue;
    if (existingByUrl?.downloadStatus === "downloaded" && !isDocumentRefreshDue(existingByUrl)) {
      const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
        await tx.update(tenderResources).set({ status: "downloaded", errorMessage: null, updatedAt: new Date() })
          .where(eq(tenderResources.id, resource.id));
      });
      if (!persisted.current) return { skipped: true, reason: "veraltete Tender-Version" };
      resource.status = "downloaded";
      continue;
    }

    if (!await ensureCurrentPipelineVersion(tenderId, payload)) {
      return { skipped: true, reason: "veraltete Tender-Version" };
    }
    attemptedResources += 1;
    const markedDownloading = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
      await tx.update(tenderResources).set({
        status: "downloading",
        attempts: sql`${tenderResources.attempts} + 1`,
        lastAttemptAt: new Date(),
        errorMessage: null,
        updatedAt: new Date(),
      }).where(eq(tenderResources.id, resource.id));
    });
    if (!markedDownloading.current) return { skipped: true, reason: "veraltete Tender-Version" };

    const baseName = suggestedFilename(candidate.url, `tender-${tenderId}-${attemptedResources}`);
    const relative = `tenders/${tenderId}/${baseName}`;
    try {
      const stored = await fetchAndStoreWithParallelFallback(candidate.url, relative, {
        referer: candidate.sourcePageUrl ?? tender.url,
        sessionPageUrl: candidate.sourcePageUrl ?? tender.url,
        userAgent: REALISTIC_USER_AGENT,
        headers: { Accept: RESOURCE_FETCH_ACCEPT },
      });
      if (!await ensureCurrentPipelineVersion(tenderId, payload)) {
        await fs.promises.rm(objectAbsolutePath(stored.storagePath), { force: true });
        await db.update(tenderResources).set({
          status: "discovered",
          errorMessage: null,
          updatedAt: new Date(),
        }).where(and(eq(tenderResources.id, resource.id), eq(tenderResources.status, "downloading")));
        return { skipped: true, reason: "veraltete Tender-Version" };
      }
      if (isHtmlContentType(stored.contentType)) {
        const discarded = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
          await discardHtmlDocumentResponse(resource.id, candidate.url, stored, existingDocuments, tx);
        });
        if (!discarded.current) {
          await fs.promises.rm(objectAbsolutePath(stored.storagePath), { force: true });
          return { skipped: true, reason: "veraltete Tender-Version" };
        }
        resource.status = "skipped";
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

      const persistedDocument = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
        const persisted = await upsertDownloadedDocument(
          tenderId,
          candidate,
          stored,
          classified,
          existingDocuments,
          normalizedPath,
          tx,
        );
        await tx.update(tenderResources).set({
          url: sanitizeResourceUrl(stored.finalUrl) ?? candidate.url,
          filename: stored.filename ?? candidate.filename,
          contentType: stored.contentType,
          contentDisposition: stored.contentDisposition ?? candidate.contentDisposition,
          status: "downloaded",
          errorMessage: null,
          updatedAt: new Date(),
        }).where(eq(tenderResources.id, resource.id));
        return persisted;
      });
      if (!persistedDocument.current) {
        await fs.promises.rm(objectAbsolutePath(normalizedPath), { force: true });
        return { skipped: true, reason: "veraltete Tender-Version" };
      }
      if (persistedDocument.value.saved) saved += 1;
      resource.status = "downloaded";
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannter Downloadfehler";
      const permanentUnavailable = isPermanentResourceFailure(message);
      if (!permanentUnavailable) failedResources += 1;
      const persistedFailure = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
        await upsertFailedDocument(tenderId, candidate, classified, message, existingDocuments, tx);
        await tx.update(tenderResources).set({
          status: permanentUnavailable ? "skipped" : "failed",
          errorMessage: message.slice(0, 500),
          updatedAt: new Date(),
        }).where(eq(tenderResources.id, resource.id));
      });
      if (!persistedFailure.current) return { skipped: true, reason: "veraltete Tender-Version" };
      resource.status = permanentUnavailable ? "skipped" : "failed";
      console.warn(`[pipeline] Ressourcen-Download fehlgeschlagen: ${candidate.url}`, error);
    }
  }

  if (!await ensureCurrentPipelineVersion(tenderId, payload)) {
    return { skipped: true, reason: "veraltete Tender-Version" };
  }
  const refreshed = await refreshTenderReadiness(tenderId, payload);
  if (!refreshed.current) {
    return { skipped: true, reason: "veraltete Tender-Version" };
  }
  await queueTenderStage(JOB_PARSE, tenderId, pipelineVersionPayload(payload));
  if (failedResources > 0) {
    throw new Error(`${failedResources} Ressourcen konnten nicht geladen werden`);
  }
  return {
    documents_saved: saved,
    resources_discovered: candidates.length,
    resources_attempted: attemptedResources,
    resources_failed: failedResources,
    resource_fingerprint: buildResourceFingerprint(tender.url, metadata),
  };
};

export const isStoredDocumentFileMissing = (filePath: string): boolean => {
  try {
    return !fs.statSync(filePath).isFile();
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    return code === "ENOENT" || code === "ENOTDIR";
  }
};

export const isMissingStoredDocumentError = (error: unknown): boolean => {
  if (error instanceof ColdStorageError) {
    return error.message.startsWith("Hydration abgeschlossen, Datei fehlt weiterhin:");
  }
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "NotFound" || error.code === "NoSuchKey";
};

const runParseDocuments = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };

  const tender = await getTender(tenderId);
  const allDocs = await db
    .select({
      id: documents.id,
      storagePath: documents.storagePath,
      downloadStatus: documents.downloadStatus,
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
    .orderBy(documents.id);
  const htmlDocuments = allDocs.filter((document) =>
    document.downloadStatus === "downloaded" && isHtmlContentType(document.contentType));
  if (htmlDocuments.length > 0) {
    const htmlDocumentIds = htmlDocuments.map((document) => document.id);
    const cleanedRawText = removeParsedDocumentSections(tender.rawText, htmlDocumentIds);
    const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
      await tx.update(documents).set({
        downloadStatus: "skipped",
        parseStatus: "empty",
        extractedText: null,
        errorMessage: "HTML-/Portalantwort statt Dokument",
        updatedAt: new Date(),
      }).where(inArray(documents.id, htmlDocumentIds));
      if (cleanedRawText !== (tender.rawText ?? "").trim()) {
        await tx.update(tenders).set({ rawText: cleanedRawText || null, updatedAt: new Date() })
          .where(eq(tenders.id, tenderId));
      }
      return cleanedRawText || null;
    });
    if (!persisted.current) return { skipped: true, reason: "veraltete Tender-Version" };
    tender.rawText = persisted.value;
  }

  const docs = allDocs.filter((document) =>
    document.downloadStatus === "downloaded"
    && !isPortalActionUrl(document.url)
    && !isHtmlContentType(document.contentType));
  const formBoilerplateDocumentIds = new Set(
    allDocs
      .filter((document) => isPdfFormBoilerplate(document.extractedText ?? "")
        && !isPopulatedTenderNotice(document.extractedText ?? ""))
      .map((document) => document.id),
  );
  const cleanedFormRawText = removeParsedDocumentSections(
    tender.rawText,
    [...formBoilerplateDocumentIds],
  );
  if (cleanedFormRawText !== (tender.rawText ?? "").trim()) {
    const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
      await tx.update(tenders).set({ rawText: cleanedFormRawText || null, updatedAt: new Date() })
        .where(eq(tenders.id, tenderId));
    });
    if (!persisted.current) return { skipped: true, reason: "veraltete Tender-Version" };
    tender.rawText = cleanedFormRawText || null;
  }

  if (docs.length === 0) {
    // No documents to parse. Only continue when the listing itself supplied
    // usable text; otherwise structure_tender can only fail deterministically.
    if (tender.rawText?.trim()) {
      const refreshed = await refreshTenderReadiness(tenderId, payload);
      if (!refreshed.current) return { skipped: true, reason: "veraltete Tender-Version" };
      await queueTenderStage(JOB_STRUCTURE, tenderId, pipelineVersionPayload(payload));
      return { chunks: 0, skipped: "keine Dokumente, raw_text bereits vorhanden" };
    }
    await markTenderWithoutUsableContent(tenderId, payload);
    return { chunks: 0, skipped: "keine Dokumente und kein verwertbarer raw_text" };
  }

  // Parse every document before applying the aggregate text budget. Otherwise
  // an early, unclassified attachment could hide a later Leistungsbeschreibung.
  const parsedDocumentCandidates: ParsedTenderDocument[] = [];
  let partial = false;
  let failedDocuments = 0;
  const missingStoredDocuments: number[] = [];

  for (const doc of docs) {
    let absPath: string;
    let missingStoredObject = false;
    try {
      try {
        absPath = await ensureLocalStored(doc.storagePath);
      } catch (error) {
        if (!isMissingStoredDocumentError(error)) throw error;
        missingStoredObject = true;
        throw new Error(`Stored document is missing: ${doc.storagePath}`);
      }
      missingStoredObject = isStoredDocumentFileMissing(absPath);
      if (missingStoredObject) throw new Error(`Stored document is missing: ${doc.storagePath}`);
      const extracted = await extractTextFromFile(absPath, doc.contentType);
      const pageText = formatExtractedDocumentText(extracted).replace(/\u0000/g, "");
      const bounded = pageText.length > MAX_DOCUMENT_TEXT_CHARS
        ? `${pageText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}\n[Text wegen Größenlimit gekürzt]`
        : pageText;

      // Refine weak filename/URL classifications with document content.
      let effectiveRoles = normalizeDocumentRoles(doc.roles, doc.role);
      let effectiveRole = primaryDocumentRole(effectiveRoles);
      let effectiveRoleSource = doc.roleSource ?? null;
      let effectiveRoleConfidence = doc.roleConfidence ?? 0;
      if (shouldRefineDocumentRole({
        role: doc.role,
        roleSource: doc.roleSource,
        confidence: effectiveRoleConfidence,
      })) {
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
      const isFormBoilerplate = isPdfFormBoilerplate(bounded) && !isPopulatedTenderNotice(bounded);
      if (isFormBoilerplate) formBoilerplateDocumentIds.add(doc.id);

      if (shouldIncludeParsedDocumentText(bounded)) {
        parsedDocumentCandidates.push({ id: doc.id, role: effectiveRole, roles: effectiveRoles, text: bounded });
      } else if (!isFormBoilerplate) {
        partial = true;
      }

      const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
        await tx.update(documents).set({
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
      });
      if (!persisted.current) return { skipped: true, reason: "veraltete Tender-Version" };
    } catch (error) {
      partial = true;
      if (missingStoredObject) missingStoredDocuments.push(doc.id);
      else failedDocuments += 1;
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : "unbekannter Parserfehler");
      // Store the error on the document row for debugging, but do NOT pollute
      // the tender's analytical rawText with error markers. A failed parse is a
      // document-level failure, not tender content.
      const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
        await tx.update(documents)
          .set({
            extractedText: doc.extractedText,
            ...(missingStoredObject ? { downloadStatus: "failed" as const } : {}),
            parseStatus: "failed",
            errorMessage: message,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, doc.id));
      });
      if (!persisted.current) return { skipped: true, reason: "veraltete Tender-Version" };
    }
  }

  if (missingStoredDocuments.length > 0) {
    if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };
    await queueTenderProcessing(tenderId, `missing-object-${missingStoredDocuments.join("-")}-${Date.now()}`);
    await markCatalogDirty();
    return { chunks: 0, documents_refetch_queued: missingStoredDocuments.length };
  }

  const corpusRawText = removeParsedDocumentSections(
    tender.rawText,
    [...formBoilerplateDocumentIds],
  );
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
  const mergedTenderText = mergeParsedTenderText(
    corpusRawText,
    merged,
    partial || formBoilerplateDocumentIds.size > 0,
  );
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };
  if (mergedTenderText !== (tender.rawText ?? "").trim()) {
    const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
      await tx.update(tenders)
        .set({ rawText: mergedTenderText, updatedAt: new Date() })
        .where(eq(tenders.id, tenderId));
    });
    if (!persisted.current) return { skipped: true, reason: "veraltete Tender-Version" };
  }
  await markCatalogDirty();
  // Do not enqueue a deterministic structure failure when every document is
  // empty/failed and the listing supplied no usable text. Recovery can retry
  // the parser when a failed document becomes available later.
  if (mergedTenderText) {
    await queueTenderStage(JOB_STRUCTURE, tenderId, pipelineVersionPayload(payload));
  }
  if (failedDocuments > 0) {
    throw new Error(`${failedDocuments} Dokumente konnten nicht geparst werden`);
  }
  const refreshedDocs = await db
    .select({
      id: documents.id,
      url: documents.url,
      contentType: documents.contentType,
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
  const analysis = buildDocumentAnalysis(refreshedDocs.filter((document) =>
    !isPortalActionUrl(document.url) && !isHtmlContentType(document.contentType)) as AnalyzedDocument[]);
  return {
    parsed_documents: docs.length,
    parsed_successfully: parsedDocs.length,
    text_length: merged.length,
    partial: partial || formBoilerplateDocumentIds.size > 0,
    missing_roles: analysis.coverage.missingRoles,
  };
};

const runStructureTender = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };

  const tender = await getTender(tenderId);
  if (!tender.rawText || tender.rawText.trim().length === 0) {
    throw new Error("kein Rohtext vorhanden");
  }

  const accessPage = detectAccessPage(tender.rawText, { title: tender.title ?? undefined, url: tender.url });
  if (accessPage.blocked) {
    console.warn(`[pipeline] Tender ${tenderId} blockierte Zugriffsseite (${accessPage.reason})`);
    if (!await rejectBlockedTender(tenderId, accessPage, payload)) {
      return { skipped: true, reason: "veraltete Tender-Version" };
    }
    return { blocked: true, blocked_reason: accessPage.reason ?? "unknown" };
  }

  const tenderMetadata = parseRecord(tender.metadataJson as string);
  const reference = typeof tenderMetadata.reference_number === "string"
    ? tenderMetadata.reference_number
    : typeof tenderMetadata.referenceNumber === "string"
      ? tenderMetadata.referenceNumber
      : null;
  const extractedStructured = await extractStructuredData(tender.title ?? "Unbenannte Ausschreibung", tender.rawText, {
    reference,
    // Relevance gate: non-IT tenders get the deterministic structuring only.
    useLLM: tender.llmRelevant !== false,
  });
  const publicMeta = readPublicTenderMeta(tender.metadataJson, {
    title: tender.title,
    source: tender.source,
    sourceUrl: tender.url,
  });
  const normalizedStructured = normalizeStructured(extractedStructured, tender.title ?? "", {
    buyer: publicMeta.client || null,
    procedure: publicMeta.procedure || pickValidatedPublicProcedure(tender.procedureType) || null,
    location: publicMeta.location || null,
    summary: publicMeta.description || null,
    scope: publicMeta.subject || null,
  });
  const structured = withCanonicalTenderDeadline(normalizedStructured, tender.deadlineAt);
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };

  const documentRows = await db
    .select({
      id: documents.id,
      url: documents.url,
      contentType: documents.contentType,
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
  const baseDocumentAnalysis = buildDocumentAnalysis(documentRows.filter((document) =>
    !isPortalActionUrl(document.url) && !isHtmlContentType(document.contentType)) as AnalyzedDocument[]);
  structured.document_analysis = withEvidenceValues(baseDocumentAnalysis, {
    deadline: structured.hard_facts.deadline,
    scope: structured.decision_relevant.scope.join(" ") || structured.summary,
    requirements: structured.decision_relevant.requirements.join(" ") || null,
    award_criteria: structured.decision_relevant.award_criteria.join(" ") || null,
  });

  const structuredDescriptionMarkdown = buildStructuredDescriptionMarkdown(structured, reference);
  structured.descriptionMarkdown = isCanonicalPublicDescriptionMarkdown(structuredDescriptionMarkdown)
    ? structuredDescriptionMarkdown
    : "";

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
  const procurement = structured.procurement;
  const persistence = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
    await tx
      .insert(structuredData)
      .values({ tenderId, jsonBlob: structured, confidence: structured.confidence })
      .onConflictDoUpdate({
        target: structuredData.tenderId,
        set: { jsonBlob: structured, confidence: structured.confidence, updatedAt: new Date() },
      });

    const currentTender = await tx
      .select({ rawText: tenders.rawText })
      .from(tenders)
      .where(eq(tenders.id, tenderId))
      .limit(1);
    const latestDocumentRows = await tx
      .select({
        id: documents.id,
        url: documents.url,
        contentType: documents.contentType,
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
    const documentAnalysis = buildDocumentAnalysis(latestDocumentRows.filter((document) =>
      !isPortalActionUrl(document.url) && !isHtmlContentType(document.contentType)) as AnalyzedDocument[]);
    const readiness = evaluateTenderReadiness({
      qualityStatus: quality.status,
      rawText: currentTender[0]?.rawText,
      structuredExists: true,
      structuredConfidence: structured.confidence,
      documentAnalysis,
    });

    await tx.update(tenders).set({
      ...qualityUpdate,
      contractValueMin: procurement?.contract_value?.min ?? null,
      contractValueMax: procurement?.contract_value?.max ?? null,
      contractDurationMonths: procurement?.contract_duration?.months ?? null,
      procedureType: procurement?.procedure_type ?? null,
      readinessStatus: readiness.status,
      readinessReason: readiness.reason,
      readinessUpdatedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tenders.id, tenderId));

    if (quality.status !== "qualified" || !isScorableReadiness(readiness.status)) {
      await tx.delete(insights).where(eq(insights.tenderId, tenderId));
      await tx.delete(scores).where(eq(scores.tenderId, tenderId));
    }
    return readiness;
  });
  if (!persistence.current) return { skipped: true, reason: "veraltete Tender-Version" };
  const readiness = persistence.value;
  await markCatalogDirty();
  await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });

  if (quality.status !== "qualified") {
    return {
      confidence: structured.confidence,
      quality_status: quality.status,
      quality_reason: quality.reason,
      duplicate_of_tender_id: quality.duplicateOfTenderId,
    };
  }

  if (isScorableReadiness(readiness.status)) {
    await queueTenderStage(JOB_SCORE, tenderId, pipelineVersionPayload(payload));
  }
  await queueTenderStage(JOB_CACHE_DETAIL, tenderId, pipelineVersionPayload(payload));
  return {
    confidence: structured.confidence,
    quality_status: quality.status,
    quality_reason: quality.reason,
    readiness_status: readiness.status,
  };
};

const DETAIL_CACHE_PROMPT = `Du bist ein Experte fuer oeffentliche Ausschreibungen in Deutschland.
Extrahiere aus dem folgenden Inhalt nur explizit belegte Fakten.

WICHTIG:
- Der Inhalt kann auf Deutsch ODER Englisch sein. Quellauszuege muessen in der Originalsprache bleiben.
- Erfinde keine Fakten und leite Auftraggeber niemals aus URL, Impressum oder Kontext ab.
- Beschreibung, Leistungsumfang und Anforderungen duerfen nur woertliche, zusammenhaengende Quellauszuege sein. Nicht paraphrasieren oder zusammenfassen; bei fehlendem Beleg leer/null.
- Eine Frist darf nur aus einem konkreten, auf der Seite genannten Datum uebernommen werden. Relative Angaben nicht berechnen.
- Bei Zuschlagskriterien: Lies die Zahlen EXAKT ab. "Zuschlagskriterium — Zahl: 100" = 100%.
- Gib fuer jeden fehlenden oder nicht eindeutig belegten Wert null, eine leere Zeichenkette oder ein leeres Array aus.

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
  "client": "Woertlich belegter Auftraggeber" oder null,
  "deadline": "2026-06-15" oder null,
  "description": "Quellverbatim-Auszug oder leer",
  "requirements": ["Anforderung 1"],
  "scope": "Quellverbatim-Auszug oder leer",
  "contact": "Kontaktdaten",
  "procedure": "Verfahrensart",
  "awardCriteria": ["Preis (100%)"],
  "duration": "Laufzeit",
  "location": "Ort",
  "referenceNumber": "Referenz",
  "pdfUrls": ["https://..."],
  "estimatedValue": "Schaetzwert" oder null
}`;

// Lazy relevance decision for tenders without a stored verdict (legacy rows,
// generic crawl ingest with title+URL only): decide once on the fetched
// content, persist it, and reuse it on every later pipeline stage.
const resolveTenderLlmRelevance = async (tender: Tender, content: string): Promise<boolean> => {
  if (tender.llmRelevant === true || tender.llmRelevant === false) return tender.llmRelevant;
  const decision = await classifyTenderRelevance({
    title: tender.title ?? "",
    url: tender.url,
    description: content,
    category: tender.category,
    cpvCodes: extractPublicCpvCodes(content),
  });
  await db.update(tenders).set({ llmRelevant: decision.relevant }).where(eq(tenders.id, tender.id));
  console.info(`[cache-detail] Relevanz entschieden: ${decision.relevant ? "relevant" : "nicht relevant"} (p=${decision.probability?.toFixed(2) ?? "n/a"}, ${decision.source}) fuer Tender ${tender.id}`);
  return decision.relevant;
};

const runCacheDetail = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };

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
      const accessLimitedResult = getAccessLimitedCacheResult(tender, cachedAccessPage, blob);
      if (accessLimitedResult) {
        console.info(`[cache-detail] Nutze vorhandene Zugangsbeschraenkungs-Zusammenfassung fuer Tender ${tenderId}`);
        if (!await persistAccessLimitedCacheResult(tenderId, accessLimitedResult, payload)) {
          return { skipped: true, reason: "veraltete Tender-Version" };
        }
        return accessLimitedResult;
      }
      const removed = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
        await tx.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
      });
      if (!removed.current) return { skipped: true, reason: "veraltete Tender-Version" };
      if (!await retryBlockedDetail(tender, cachedAccessPage, payload)) {
        return { skipped: true, reason: "veraltete Tender-Version" };
      }
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
      const cachedMetadata = parseRecord(tender.metadataJson as string);
      const normalizedCached = normalizeStructured(blob, tender.title ?? "", {
        summary: pickPublicTenderDescription({ metadata: cachedMetadata }) || null,
      });
      const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
        await tx.update(structuredData)
          .set({ jsonBlob: normalizedCached, updatedAt: new Date() })
          .where(eq(structuredData.tenderId, tenderId));
      });
      if (!persisted.current) return { skipped: true, reason: "veraltete Tender-Version" };
      return { cached: true, detail_cached: true };
    }
  }

  const meta = parseRecord(tender.metadataJson as string);
  const metadataPdfUrls = metadataArray(meta, ["pdf_urls", "pdfUrls"])
    .filter((value): value is string => typeof value === "string" && value.startsWith("http"));

  // Build detail from existing metadata (instant, no API calls)
  // raw_text remains an analysis corpus; only persisted/public fallback prose
  // comes from already extracted metadata.
  let description = pickPublicTenderDescription({ metadata: meta });
  let client = normalizePublicClient(meta.client);
  let location = pickValidatedPublicLocationForTender(tender.title, client, meta.location);

  // Only use LLM if we have substantial page content to extract from
  const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";
  let result: Record<string, unknown> | undefined;

  // Avoid an expensive browser round-trip when a substantial document was
  // already fetched and is not just a standard PDF form.
  const rawText = tender.rawText ?? "";
  const rawTextFormMarkers = [
    /VHB\s*-\s*Bund\s*-\s*Ausgabe/i,
    /Eigenerklärung\s+(?:zur\s+)?Eignung/i,
    /AI\s+Bietercockpit/i,
    /GAEB\s*-\s*Kalkulationssoftware/i,
    /Massnahmennummer\s+Vergabenummer\s+Vergabeart/i,
    /Baumassnahme\s+Leistung\s+Bewerber/i,
  ];
  const preferRawText = rawText.length > 5_000
    && rawTextFormMarkers.filter((marker) => marker.test(rawText)).length < 2;

  // Scrape the full page for best content unless raw_text is already richer.
  let fullContent = description;
  let sourceEvidence = "";
  if (preferRawText) {
    fullContent = rawText.slice(0, 30_000);
    sourceEvidence = fullContent;
  }
  const isSPA = /meinauftrag\.rib\.de/.test(sourceUrl);
  if (openrouterKey && !preferRawText) {
    try {
      // SPA pages need networkidle + extra wait to render content + body text extraction
      const page = await scrapeWebsite(sourceUrl, isSPA ? { waitUntil: "networkidle", waitMs: 5000, onlyMainContent: false, useBodyText: true } : undefined);
      const markdown = page.markdown ?? "";
      if (markdown) sourceEvidence = markdown.slice(0, 30_000);
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
        sourceEvidence = fullContent;
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
      sourceEvidence = fullContent;
    }
  }

  // Metadata can itself contain older LLM prose, so it is never evidence for
  // the current extraction. Keep it as a fallback only when source-verbatim.
  description = pickSourceBackedPublicCandidate(sourceEvidence, meta.summary, meta.description);
  client = isSourceBackedPublicValue(meta.client, sourceEvidence, "buyer")
    ? normalizePublicClient(meta.client)
    : "";
  location = isSourceBackedPublicValue(meta.location, sourceEvidence, "location")
    ? pickValidatedPublicLocationForTender(tender.title, client, meta.location)
    : "";
  const groundedMetadataPdfUrls = metadataPdfUrls.filter((url) => isSourceBackedPublicValue(url, sourceEvidence));
  const storedDeadline = tender.deadlineAt
    ? new Date(tender.deadlineAt).toISOString().split("T")[0]
    : null;
  const groundedStoredDeadline = isSourceBackedPublicValue(storedDeadline, sourceEvidence, "deadline")
    ? storedDeadline
    : null;
  const groundedProcedure = isSourceBackedPublicValue(tender.procedureType, sourceEvidence)
    ? tender.procedureType
    : "";
  const groundedDuration = tender.contractDurationMonths !== null && tender.contractDurationMonths !== undefined
    ? `${tender.contractDurationMonths} Monate`
    : "";
  const groundedStoredDuration = isSourceBackedPublicValue(groundedDuration, sourceEvidence) ? groundedDuration : "";
  const groundedValue = tender.contractValueMax !== null && tender.contractValueMax !== undefined
    ? `${tender.contractValueMax} EUR`
    : "";
  const groundedStoredValue = isSourceBackedPublicValue(groundedValue, sourceEvidence) ? groundedValue : null;
  const groundedReferenceNumber = isSourceBackedPublicValue(meta.reference_number, sourceEvidence)
    ? String(meta.reference_number)
    : null;

  const scrapedAccessPage = detectAccessPage(fullContent, { title: tender.title ?? undefined, url: sourceUrl });
  if (scrapedAccessPage.blocked) {
    console.warn(`[cache-detail] Blockierte Detailseite fuer Tender ${tenderId} (${scrapedAccessPage.reason})`);
    const accessLimitedResult = getAccessLimitedCacheResult(tender, scrapedAccessPage);
    if (accessLimitedResult) {
      console.info(`[cache-detail] Nutze vorhandene Zugangsbeschraenkungs-Zusammenfassung fuer Tender ${tenderId}`);
        if (!await persistAccessLimitedCacheResult(tenderId, accessLimitedResult, payload)) {
          return { skipped: true, reason: "veraltete Tender-Version" };
        }
        return accessLimitedResult;
      }
      if (!await retryBlockedDetail(tender, scrapedAccessPage, payload)) {
        return { skipped: true, reason: "veraltete Tender-Version" };
      }
  }

  // Relevance gate: non-IT tenders keep their deterministic fallbacks but no
  // longer reach the (expensive) LLM enrichment.
  const llmRelevant = await resolveTenderLlmRelevance(tender, fullContent);
  if (fullContent.length > 200 && openrouterKey && llmRelevant) {
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
          const grounded = groundPublicTenderFields(extracted, sourceEvidence);
          console.log(`[cache-detail] LLM: desc=${String(extracted.description ?? "").length} proc=${extracted.procedure ?? "nein"} scope=${String(extracted.scope ?? "").length}`);
          result = {
          title: String(tender.title ?? ""),
          client: typeof grounded.client === "string" && grounded.client ? grounded.client : client,
          deadline: typeof grounded.deadline === "string" ? grounded.deadline : groundedStoredDeadline,
           description: typeof grounded.description === "string" && grounded.description
             ? pickPublicDescription(grounded.description)
             : description,
          requirements: Array.isArray(grounded.requirements) ? grounded.requirements : [],
          scope: typeof grounded.scope === "string" ? grounded.scope : "",
          contact: typeof grounded.contact === "string" && isSourceBackedPublicValue(grounded.contact, sourceEvidence) ? grounded.contact : "",
          procedure: typeof grounded.procedure === "string" ? grounded.procedure : groundedProcedure,
          awardCriteria: Array.isArray(grounded.awardCriteria) ? grounded.awardCriteria : [],
          duration: typeof grounded.duration === "string" ? grounded.duration : groundedStoredDuration,
          location: typeof grounded.location === "string" ? grounded.location : location,
          referenceNumber: typeof grounded.referenceNumber === "string" ? grounded.referenceNumber : groundedReferenceNumber,
           pdfUrls: Array.isArray(grounded.pdfUrls) ? grounded.pdfUrls.filter((u): u is string => typeof u === "string" && u.startsWith("http")) : groundedMetadataPdfUrls,
          estimatedValue: typeof grounded.estimatedValue === "string" ? grounded.estimatedValue : groundedStoredValue,
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
      const oeffDetails = await enrichFromOeffentlicheVergabe(tender.title);

      if (oeffDetails) {
        console.log(`[cache-detail] oeffentlichevergabe.de Daten gefunden: value=${oeffDetails.estimatedValue ?? "nein"}, docs=${oeffDetails.evergabeDocumentUrls.length}`);

        // Merge enriched data into result
        if (!result) {
          result = {
            title: String(tender.title ?? ""),
            client: oeffDetails.buyer ?? client,
            deadline: groundedStoredDeadline,
             description: pickPublicDescription(oeffDetails.description, description),
            requirements: [],
            scope: oeffDetails.lotDescription ?? "",
            contact: oeffDetails.contact ?? "",
            procedure: oeffDetails.procedure ?? "",
            awardCriteria: [],
            duration: oeffDetails.duration ?? "",
            location,
            referenceNumber: groundedReferenceNumber,
             pdfUrls: oeffDetails.evergabeDocumentUrls.length > 0 ? oeffDetails.evergabeDocumentUrls : groundedMetadataPdfUrls,
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
           const enrichedDescription = pickPublicDescription(oeffDetails.description);
           if (enrichedDescription.length > 50 && (!result.description || (typeof result.description === "string" && result.description.length < 100))) {
             result.description = enrichedDescription;
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
        const portalUrl = oeffDetails.portalUrl;
        if (portalUrl) {
          console.log(`[cache-detail] Oeffentl. Portal-URL: ${portalUrl.slice(0, 80)}`);
          result.sourceUrl = portalUrl;
          try {
            const updated = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
              await tx.update(tenders).set({ url: portalUrl, updatedAt: new Date() })
                .where(eq(tenders.id, tenderId));
            });
            if (!updated.current) return { skipped: true, reason: "veraltete Tender-Version" };
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
      if (!await ensureCurrentPipelineVersion(tenderId, payload)) {
        return { skipped: true, reason: "veraltete Tender-Version" };
      }
      const resourceCandidate = resourceCandidateFromUrl(docUrl, sourceUrl, "", "cache_detail", "document");
      if (!resourceCandidate) continue;
      const baseName = suggestedFilename(docUrl, `tender-${tenderId}-evergabe-${docIndex + 1}`);
      const cleanFilename = baseName.replace(/^[0-9a-f]{12}-/, "");
      const initialRole = classifyDocumentRole({ filename: cleanFilename, url: docUrl });
      const resourceClassification = classifyResourceCandidate(resourceCandidate);
      let resourceRow: { id: number; status: string } | null = null;
      try {
        const resource = await withCurrentPipelineVersion(tenderId, payload, async (tx) =>
          upsertTenderResource(tenderId, resourceCandidate, tx));
        if (!resource.current) return { skipped: true, reason: "veraltete Tender-Version" };
        resourceRow = resource.value;
        if (existingUrls.has(docUrl)) {
          const marked = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
            await tx.update(tenderResources).set({ status: "downloaded", errorMessage: null, updatedAt: new Date() })
              .where(eq(tenderResources.id, resourceRow!.id));
          });
          if (!marked.current) return { skipped: true, reason: "veraltete Tender-Version" };
          continue;
        }
        const downloading = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
          await tx.update(tenderResources).set({
            status: "downloading",
            attempts: sql`${tenderResources.attempts} + 1`,
            lastAttemptAt: new Date(),
            errorMessage: null,
            updatedAt: new Date(),
          }).where(eq(tenderResources.id, resourceRow!.id));
        });
        if (!downloading.current) return { skipped: true, reason: "veraltete Tender-Version" };
        docIndex += 1;
        const relative = `tenders/${tenderId}/${baseName}`;
        const stored = await fetchAndStoreWithParallelFallback(docUrl, relative, {
          referer: sourceUrl,
          sessionPageUrl: sourceUrl,
          userAgent: REALISTIC_USER_AGENT,
          headers: { Accept: RESOURCE_FETCH_ACCEPT },
        });
        if (!await ensureCurrentPipelineVersion(tenderId, payload)) {
          await fs.promises.rm(objectAbsolutePath(stored.storagePath), { force: true });
          return { skipped: true, reason: "veraltete Tender-Version" };
        }
        if (isHtmlContentType(stored.contentType) && resourceRow) {
          const discarded = await withCurrentPipelineVersion(tenderId, payload, async (tx) =>
            discardHtmlDocumentResponse(resourceRow!.id, docUrl, stored, existingDocs, tx));
          if (!discarded.current) {
            await fs.promises.rm(objectAbsolutePath(stored.storagePath), { force: true });
            return { skipped: true, reason: "veraltete Tender-Version" };
          }
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

        const persistedDocument = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
          const persisted = await upsertDownloadedDocument(
            tenderId,
            resourceCandidate,
            stored,
            resourceClassification,
            existingDocs,
            normalizedPath,
            tx,
          );
          await tx.update(tenderResources).set({
            url: sanitizeResourceUrl(stored.finalUrl) ?? resourceCandidate.url,
            filename: stored.filename ?? resourceCandidate.filename,
            contentType: stored.contentType,
            contentDisposition: stored.contentDisposition ?? resourceCandidate.contentDisposition,
            status: "downloaded",
            errorMessage: null,
            updatedAt: new Date(),
          }).where(eq(tenderResources.id, resourceRow!.id));
          return persisted;
        });
        if (!persistedDocument.current) {
          await fs.promises.rm(objectAbsolutePath(normalizedPath), { force: true });
          return { skipped: true, reason: "veraltete Tender-Version" };
        }
        const persisted = persistedDocument.value;
        const documentId = persisted.id;

        // Parse XLSX/PDF and append to rawText
        try {
          const absPath = objectAbsolutePath(normalizedPath);
          const extracted = await extractTextFromFile(absPath, stored.contentType);
          const documentText = formatExtractedDocumentText(extracted);
          if (shouldIncludeParsedDocumentText(documentText)) {
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
            const parsed = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
              if (documentId) await tx.update(documents).set({
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
              const freshTender = await tx.select({ rawText: tenders.rawText })
                .from(tenders)
                .where(eq(tenders.id, tenderId))
                .limit(1);
              const currentRaw = freshTender[0]?.rawText ?? "";
              await tx.update(tenders).set({
                rawText: appendBoundedTenderText(currentRaw, `[ROLLEN: ${effectiveRoles.join(", ")}] [ROLLE: ${effectiveScalarRole}] [DOKUMENT-ID: ${documentId ?? "unbekannt"}]\n${documentText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}`),
                updatedAt: new Date(),
              }).where(eq(tenders.id, tenderId));
            });
            if (!parsed.current) return { skipped: true, reason: "veraltete Tender-Version" };
            console.log(`[cache-detail] evergabe Dokument geparst: ${normalizedPath} (${documentText.length} Zeichen)`);
          } else if (documentId) {
            const empty = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
              await tx.update(documents).set({ parseStatus: "empty", pageCount: extracted.pageCount, updatedAt: new Date() })
                .where(eq(documents.id, documentId));
            });
            if (!empty.current) return { skipped: true, reason: "veraltete Tender-Version" };
          }
        } catch (parseError) {
          const parseMsg = parseError instanceof Error ? parseError.message : "unbekannter Parserfehler";
          if (documentId) {
            const failed = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
              await tx.update(documents).set({ parseStatus: "failed", errorMessage: parseMsg, updatedAt: new Date() })
                .where(eq(documents.id, documentId));
            });
            if (!failed.current) return { skipped: true, reason: "veraltete Tender-Version" };
          }
          console.warn(`[cache-detail] evergabe Dokument Parsing fehlgeschlagen:`, parseError);
        }
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "unbekannter Downloadfehler";
        const failed = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
          await upsertFailedDocument(tenderId, resourceCandidate, resourceClassification, message, existingDocs, tx);
          if (resourceRow) await tx.update(tenderResources).set({
            status: "failed",
            errorMessage: message.slice(0, 500),
            updatedAt: new Date(),
          }).where(eq(tenderResources.id, resourceRow.id));
        });
        if (!failed.current) return { skipped: true, reason: "veraltete Tender-Version" };
        console.warn(`[cache-detail] evergabe Dokument Download fehlgeschlagen: ${docUrl}`, fetchError);
      }
    }

    // Re-run structuring if we got new document text
    const updatedTender = await getTender(tenderId);
    if (updatedTender.rawText && updatedTender.rawText.length > (tender.rawText?.length ?? 0) + 50) {
      console.log(`[cache-detail] Neuer Text von evergabe-Dokumenten, re-strukturiere...`);
      await queueTenderStage(JOB_STRUCTURE, tenderId, pipelineVersionPayload(payload));
    }
  }

  // Fallback: check if evergabe documents exist in DB with extracted_text but weren't appended to rawText
  const allDocs = await db
    .select({ url: documents.url, contentType: documents.contentType, extractedText: documents.extractedText })
    .from(documents)
    .where(eq(documents.tenderId, tenderId))
    .limit(settings.maxPdfLinksPerTender);
  const evergabeDocTexts = allDocs.filter(d => d.url && d.url.includes("evergabe.de") && d.url.includes("download")
    && !isHtmlContentType(d.contentType) && shouldIncludeParsedDocumentText(d.extractedText ?? ""));
  if (evergabeDocTexts.length > 0) {
    const freshTender = await getTender(tenderId);
    const currentRaw = freshTender.rawText ?? "";
    const textsToAppend = evergabeDocTexts.filter(d => !currentRaw.includes(d.extractedText!.slice(0, 100)));
    if (textsToAppend.length > 0) {
      const appended = textsToAppend
        .slice(0, settings.maxPdfLinksPerTender)
        .map(d => d.extractedText!.slice(0, MAX_DOCUMENT_TEXT_CHARS))
        .join("\n\n[Evergabe-Dokument]\n");
      const persisted = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
        const rows = await tx.select({ rawText: tenders.rawText })
          .from(tenders)
          .where(eq(tenders.id, tenderId))
          .limit(1);
        await tx.update(tenders).set({
          rawText: appendBoundedTenderText(rows[0]?.rawText ?? "", appended),
          updatedAt: new Date(),
        }).where(eq(tenders.id, tenderId));
      });
      if (!persisted.current) return { skipped: true, reason: "veraltete Tender-Version" };
      console.log(`[cache-detail] ${textsToAppend.length} Evergabe-Dokumente nachgetragen (${appended.length} Zeichen)`);
      await queueTenderStage(JOB_STRUCTURE, tenderId, pipelineVersionPayload(payload));
    }
  }

  // Fallback: build from metadata directly (no LLM call, instant)
  if (!result!) {
    result = {
      title: String(tender.title ?? ""),
      client,
      deadline: groundedStoredDeadline,
       description,
      requirements: [],
      scope: "",
      contact: "",
      procedure: groundedProcedure,
      awardCriteria: [],
      duration: groundedStoredDuration,
       location,
      referenceNumber: groundedReferenceNumber,
      pdfUrls: groundedMetadataPdfUrls,
      estimatedValue: groundedStoredValue,
      sourceUrl,
      cached: false,
      scrapedAt: new Date().toISOString(),
    };
  }

  result.client = normalizePublicClient(result.client, client) || client;
  result.location = pickValidatedPublicLocationForTender(
    tender.title,
    result.client,
    result.location,
    location,
  );
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
    if (!await retryBlockedDetail(tender, resultAccessPage, payload)) {
      return { skipped: true, reason: "veraltete Tender-Version" };
    }
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
      decisionRelevant.scope = mergePublicTextListWithFallback(decisionRelevant.scope, result.scope);
    }
    if (Array.isArray(result.awardCriteria) && result.awardCriteria.length > 0) {
      decisionRelevant.award_criteria = result.awardCriteria;
    }
    mergedBlob.decision_relevant = decisionRelevant;

    // Prefer the richer description (don't overwrite good existing data with thin LLM output)
    const existingDesc = pickPublicDescription(mergedBlob.description);
    const newDesc = pickPublicDescription(result.description);
    console.log(`[cache-detail] Merge: existingDesc=${existingDesc.length}, newDesc=${newDesc.length}`);
    if (newDesc.length > 20 && newDesc.length > existingDesc.length && newDesc.length < 5000) {
      mergedBlob.description = newDesc;
      console.log(`[cache-detail] Description updated to ${newDesc.length} chars`);
    } else if (existingDesc) {
      mergedBlob.description = existingDesc;
    }

    // Update summary only if cache_detail has substantially better content
    // Don't replace a good summary with raw text (which can be 10K+ chars from PDFs)
    const existingSummary = typeof mergedBlob.summary === "string" ? mergedBlob.summary : "";
    if (newDesc.length > 100 && newDesc.length < 5000 && newDesc.length > existingSummary.length + 50) {
      mergedBlob.summary = newDesc.slice(0, 3000);
    }

    const newDescriptionMarkdown = typeof result.descriptionMarkdown === "string"
      ? result.descriptionMarkdown
      : "";
     if (isCanonicalPublicDescriptionMarkdown(newDescriptionMarkdown)) {
       mergedBlob.descriptionMarkdown = newDescriptionMarkdown;
     } else if (isCanonicalPublicDescriptionMarkdown(mergedBlob.descriptionMarkdown)
       || isCanonicalPublicDescriptionMarkdown(mergedBlob.description_markdown)) {
       mergedBlob.descriptionMarkdown = isCanonicalPublicDescriptionMarkdown(mergedBlob.descriptionMarkdown)
         ? mergedBlob.descriptionMarkdown
         : mergedBlob.description_markdown;
     }
     if (isCanonicalPublicDescriptionMarkdown(mergedBlob.descriptionMarkdown)) delete mergedBlob.description_markdown;

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
        scope: normalizePublicTextList(result.scope),
        award_criteria: result.awardCriteria ?? [],
        mandatory_documents: [],
      },
      procurement: {
        contract_value: { min: null, max: null, currency: "EUR" },
        contract_duration: { months: null, renewal: false },
        award_criteria_detailed: [],
        participation_requirements: [],
        cpv_codes: [],
        procedure_type: result.procedure ?? "",
      },
       descriptionMarkdown: isCanonicalPublicDescriptionMarkdown(result.descriptionMarkdown)
         ? result.descriptionMarkdown
         : "",
    };
    mergedConfidence = 0.85;
  }

  const latestDocumentRows = await db
    .select({
      id: documents.id,
      url: documents.url,
      contentType: documents.contentType,
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
    buildDocumentAnalysis(latestDocumentRows.filter((document) =>
      !isPortalActionUrl(document.url) && !isHtmlContentType(document.contentType)) as AnalyzedDocument[]),
    {
      deadline: typeof result.deadline === "string" ? result.deadline : null,
      scope: typeof result.scope === "string" ? result.scope : null,
      requirements: Array.isArray(result.requirements) ? result.requirements.join(" ") : null,
      award_criteria: Array.isArray(result.awardCriteria) ? result.awardCriteria.join(" ") : null,
    },
  );

  // Normalize the complete cache result before persisting it. LLM and portal
  // fallbacks are untrusted input, including fields that are later reused by
  // public list/detail responses.
  const persistedBlob = normalizeStructured(mergedBlob, tender.title ?? "", {
    summary: description || null,
  });
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };

  const persistence = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
    await tx
      .insert(structuredData)
      .values({ tenderId, jsonBlob: persistedBlob, confidence: mergedConfidence })
      .onConflictDoUpdate({ target: structuredData.tenderId, set: { jsonBlob: persistedBlob, confidence: mergedConfidence, updatedAt: new Date() } });
    const currentTender = await tx
      .select({ rawText: tenders.rawText, qualityStatus: tenders.qualityStatus })
      .from(tenders)
      .where(eq(tenders.id, tenderId))
      .limit(1);
    const currentDocumentRows = await tx
      .select({
        id: documents.id,
        url: documents.url,
        contentType: documents.contentType,
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
    const documentAnalysis = buildDocumentAnalysis(currentDocumentRows.filter((document) =>
      !isPortalActionUrl(document.url) && !isHtmlContentType(document.contentType)) as AnalyzedDocument[]);
    const readiness = evaluateTenderReadiness({
      qualityStatus: currentTender[0]?.qualityStatus ?? "candidate",
      rawText: currentTender[0]?.rawText,
      structuredExists: true,
      structuredConfidence: mergedConfidence,
      documentAnalysis,
    });
    await tx.update(tenders).set({
      readinessStatus: readiness.status,
      readinessReason: readiness.reason,
      readinessUpdatedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tenders.id, tenderId));
    if (!isScorableReadiness(readiness.status)) {
      await tx.delete(insights).where(eq(insights.tenderId, tenderId));
      await tx.delete(scores).where(eq(scores.tenderId, tenderId));
    }
    return readiness;
  });
  if (!persistence.current) return { skipped: true, reason: "veraltete Tender-Version" };
  const readiness = persistence.value;
  // cache_detail can change indexed structured fields even when structure_tender
  // already completed, so make the catalog sync observe this write.
  await markCatalogDirty();
  await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, dedupeCompleted: false });
  if (scoringInputChanged && isScorableReadiness(readiness.status)) {
    // This distinct key queues a second score even if the initial score job is still running.
    await queueTenderStage(JOB_SCORE, tenderId, pipelineVersionPayload(payload), "cache-detail");
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

const runScoreTender = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }
  if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };

  const tender = await getTender(tenderId);
  if (tender.qualityStatus !== "qualified") {
    return {
      skipped: true,
      quality_status: tender.qualityStatus,
      quality_reason: tender.qualityReason ?? "Ausschreibung ist nicht fuer das Scoring freigegeben.",
    };
  }
  if (!isScorableReadiness(tender.readinessStatus)) {
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
    if (!await ensureCurrentPipelineVersion(tenderId, payload)) return { skipped: true, reason: "veraltete Tender-Version" };
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
    // Relevance gate: non-IT tenders are scored deterministically only.
    const llmScores = tender.llmRelevant !== false
      && locationEligibility.status === "match" && domainEligibility.status === "match"
      ? await llmBatchDomainMatch(capabilities, company.industry, regions, tenderBatchItem)
      : new Map<number, number>();
    const llmDomainScore = llmScores.get(tenderId);

    const result = computeScores(tender.title ?? "", structured, companyRow, llmDomainScore, tenderLocation);
    const persistence = await withCurrentPipelineVersion(tenderId, payload, async (tx) => {
      await tx
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

      const insight = generateInsight(result, structured);
      await tx
        .insert(insights)
        .values({
          tenderId,
          companyId: company.id,
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

      if (!result.kill_switch) {
        const existingAttribution = await tx
          .select({ id: attributionEvents.id })
          .from(attributionEvents)
          .where(and(
            eq(attributionEvents.tenderId, tenderId),
            eq(attributionEvents.companyId, company.id),
            eq(attributionEvents.eventType, "shown"),
          ))
          .limit(1);
        if (existingAttribution.length === 0) {
          await tx.insert(attributionEvents).values({
            tenderId,
            companyId: company.id,
            eventType: "shown",
            metadataJson: { stage: "notify_company", created_at: new Date().toISOString() },
            scoreSnapshotJson: {
              fit: result.fit,
              win_probability: result.win_probability,
              effort: result.effort,
              requirement_coverage: result.requirement_coverage,
              kill_switch: result.kill_switch,
              details: result.details,
            },
          });
        }
      }
    });
    if (!persistence.current) return { skipped: true, reason: "veraltete Tender-Version" };
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
  const persistenceErrorsBySource = new Map<string, string>();
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
      const deadline = parseDeadlineDate(tender.deadline);
      if (deadline && deadline.getTime() < Date.now()) {
        skipped += 1;
        continue;
      }

      try {
         const title = projectPublicDisplayFields({ title: tender.title }).title;
         if (!title) {
          skipped += 1;
          console.warn(`[public-scraper] Ueberspringe Ausschreibung ohne verwertbaren Titel (${tender.sourceUrl})`);
          continue;
        }
         const baseDisplay = projectPublicDisplayFields({
           title,
            client: tender.client,
          });
          const client = baseDisplay.client || "";
         const display = projectPublicDisplayFields({
           title,
           client,
           location: tender.location,
           summary: [tender.description, tender.scope],
         });
         const location = display.location || null;
         const description = tender.accessLimited
           ? buildPublicAccessLimitedDescription(title, extractPublicPortalFacts(tender.description))
           : display.description || "";
         const procedure = pickValidatedPublicProcedure(tender.procedure) || null;
        const referenceNumber = normalizePublicDisplayCandidate(tender.referenceNumber) ?? null;
        const scope = normalizePublicDisplayCandidate(tender.scope);
        const relevance = await classifyTenderRelevance({
          title,
          url: tender.sourceUrl,
          client,
          procedure: tender.procedure,
          description,
          scope,
          category: tender.category,
          cpvCodes: tender.cpvCodes,
        });
        if (!relevance.relevant) {
          console.info(`[public-scraper] Nicht IT-relevant (p=${relevance.probability?.toFixed(2) ?? "n/a"}, ${relevance.source}); Tender ohne LLM: ${title.slice(0, 80)}`);
        }
         const descriptionMarkdown = tender.accessLimited
           ? buildPublicAccessLimitedDescriptionMarkdown(title, extractPublicPortalFacts(tender.description))
           : buildTenderDescriptionMarkdown({
               client,
               procedure: tender.procedure,
               deadline: tender.deadline,
               location,
               value: tender.estimatedValue,
               duration: tender.duration,
               reference: referenceNumber,
               summary: description,
               scope,
               requirements: tender.requirements,
               awardCriteria: tender.awardCriteria,
               cpv: tender.cpvCodes,
             });
        const tenderMetadata: Record<string, JsonValue> = {
          client,
          description,
           ...(isCanonicalPublicDescriptionMarkdown(descriptionMarkdown) ? { descriptionMarkdown } : {}),
          ...(tender.accessLimited ? { access_limited: true } : {}),
          reference_number: referenceNumber,
          location,
          ...(procedure ? { procedure } : {}),
          ...(scope ? { subject: scope } : {}),
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
          title,
          metadata: tenderMetadata,
          externalId: tender.externalId ?? undefined,
          deadlineAt: deadline,
          category: tender.category,
          rawText: description,
          llmRelevant: relevance.relevant,
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
        persistenceErrorsBySource.set(sourceKey, persistenceErrorsBySource.get(sourceKey) ?? message);
        console.error(`[public-scraper] Upsert fehlgeschlagen fuer "${tender.title}": ${message}`);
      }
    }
    changesBySource.set(sourceKey, changes);
    }, sourceFilter, sourceCursors);

    const persistenceFailure = result.persistenceError ?? upsertPersistenceError;
    const globalPersistenceErrorAttributed = Boolean(
      result.persistenceError
      && result.sourceRuns.some((sourceRun) => sourceRun.errorMessage === result.persistenceError),
    );
    const continuationSources: string[] = [];
    await db.transaction(async (tx) => {
      for (const sourceRun of result.sourceRuns) {
        const expectedVersion = cursorVersions.get(sourceRun.sourceKey) ?? 0;
        // A callback failure can be reported globally without a source entry.
        // Never advance a cursor when persistence failed but its source is unknown.
        const sourcePersistenceError = resolvePublicSourcePersistenceError({
          sourceError: sourceRun.errorMessage,
          mappedSourceError: persistenceErrorsBySource.get(sourceRun.sourceKey),
          globalError: result.persistenceError,
          globalErrorAttributed: globalPersistenceErrorAttributed,
        });
        const shouldCommit = shouldCommitPublicCursor(sourceRun, sourcePersistenceError);
        const candidateCursor = clearSourceFailureRetry(sourceRun.cursorAfter ?? {});
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
          const errorMessage = sourcePersistenceError ?? sourceRun.errorMessage;
          const persistenceRetry = Boolean(sourcePersistenceError || sourceRun.errorMessage);
          const previousCursor = sourceRun.cursorBefore ?? {};
          const failureAttempts = cursorNumber(previousCursor, "sourceFailureAttempts", 0) + 1;
          const retryDelay = Math.min(6 * 60 * 60 * 1000, 5 * 60 * 1000 * 2 ** Math.min(failureAttempts - 1, 6));
          const failureCursor: PublicSourceCursor = {
            ...previousCursor,
            sourceFailureAttempts: failureAttempts,
            sourceFailureRetryAt: new Date(Date.now() + retryDelay).toISOString(),
          };
          sourceRun.cursorAfter = failureCursor;
          sourceRun.cursorAdvanced = false;
          sourceRun.cursorCommit = "hold";
          sourceRun.exhausted = persistenceRetry ? false : sourceRun.exhausted;
          sourceRun.continuationRequired = sourceRun.continuationRequired || persistenceRetry;
          if (persistenceRetry) {
            sourceRun.status = "failed";
            sourceRun.errorMessage = errorMessage;
          }
          if (!cursorVersions.has(sourceRun.sourceKey)) {
            await tx.insert(publicSourceCursors).values({
              sourceKey: sourceRun.sourceKey,
              cursorJson: failureCursor,
              cursorVersion: expectedVersion,
              exhausted: persistenceRetry ? false : sourceRun.exhausted,
              continuationRequired: sourceRun.continuationRequired || persistenceRetry,
              lastRunId: runId,
              lastStatus: persistenceRetry ? "failed" : sourceRun.status,
              lastError: errorMessage,
              updatedAt: new Date(),
            }).onConflictDoNothing();
          } else {
            const updatedCursor = await tx.update(publicSourceCursors).set({
              cursorJson: failureCursor,
              lastRunId: runId,
              lastStatus: persistenceRetry ? "failed" : sourceRun.status,
              lastError: errorMessage,
              exhausted: persistenceRetry ? false : sourceRun.exhausted,
              continuationRequired: sourceRun.continuationRequired || persistenceRetry,
              updatedAt: new Date(),
            }).where(and(
              eq(publicSourceCursors.sourceKey, sourceRun.sourceKey),
              eq(publicSourceCursors.cursorVersion, expectedVersion),
            )).returning({ cursorVersion: publicSourceCursors.cursorVersion });
            if (updatedCursor.length === 0) {
              sourceRun.status = "partial";
              sourceRun.errorMessage = "Cursor-Konflikt: Quelle wurde parallel fortgeschrieben.";
              sourceRun.cursorAfter = sourceRun.cursorBefore;
              sourceRun.cursorAdvanced = false;
              sourceRun.cursorCommit = "hold";
              sourceRun.exhausted = false;
              sourceRun.continuationRequired = true;
              continuationSources.push(sourceRun.sourceKey);
            } else {
              versionAfter = updatedCursor[0].cursorVersion;
            }
          }
        }

        if (
          sourceRun.continuationRequired
          && !sourcePersistenceError
          && !continuationSources.includes(sourceRun.sourceKey)
          && shouldSchedulePublicContinuation(
            sourceRun.cursorAfter ?? sourceRun.cursorBefore ?? null,
            sourceRun.exhausted,
            sourceRun.continuationRequired,
            sourceRun.status,
            sourceRun.errorMessage,
          )
        ) {
          continuationSources.push(sourceRun.sourceKey);
        }
        sourceRun.cursorVersionBefore = expectedVersion;
        sourceRun.cursorVersionAfter = versionAfter;
      }

      await tx.insert(publicSourceRuns).values(result.sourceRuns.map((sourceRun) => {
        const changes = changesBySource.get(sourceRun.sourceKey) ?? { accepted: 0, inserted: 0, updated: 0 };
        sourceRun.acceptedCount = changes.accepted;
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
          acceptedCount: changes.accepted,
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
            // The current continuation is still running here. A source-only
            // key would dedupe this enqueue back to the current job and lose
            // the next page/detail batch when no scheduler is running.
            jobKey: buildPublicContinuationJobKey(sourceKey, runId),
            groupKey: "public-scrape",
            priority: PUBLIC_CONTINUATION_PRIORITY,
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

const isUsDocumentRefreshDue = (document: Pick<UsDocumentPipelineRow, "updatedAt">, now = Date.now()): boolean =>
  !Number.isFinite(document.updatedAt.getTime())
  || now - document.updatedAt.getTime() >= settings.documentRefreshHours * 60 * 60 * 1000;

export const shouldSkipUsDocumentProcessing = (
  document: Pick<UsDocumentPipelineRow, "downloadStatus" | "parseStatus" | "updatedAt">,
  now = Date.now(),
): boolean => document.downloadStatus === "downloaded"
  && document.parseStatus !== "failed"
  && !isUsDocumentRefreshDue(document, now);

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
  let parseFailures = 0;

  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    const existing = documentRows.find((document) => document.url === attachment.url);
    if (existing && shouldSkipUsDocumentProcessing(existing)) {
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
      parseFailures += 1;
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
  if (parseFailures > 0) {
    throw new Error(`${parseFailures} US-Dokumente konnten nicht geparst werden`);
  }
  return { us_documents_saved: saved, attachments_discovered: attachments.length, download_failures: 0 };
};

const runScrapeUsTenders = async (_payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const startedAt = new Date();
  const result = await scrapeAllUsTenders();
  let inserted = 0;
  let updated = 0;
  const persistenceErrors: string[] = [];
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
        const message = error instanceof Error ? error.message : "Unknown error";
        persistenceErrors.push(`Dokumentjob ${upserted.id}: ${message}`);
        console.error(`[us-scraper] Dokumentjob konnte nicht eingeplant werden (${upserted.id}): ${message}`);
      }
      changesBySource.set(tender.source, changes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      persistenceErrors.push(`Upsert ${tender.title}: ${message}`);
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

  if (persistenceErrors.length > 0) {
    throw new Error(`${persistenceErrors.length} US-Ausschreibungen konnten nicht vollständig verarbeitet werden: ${persistenceErrors.slice(0, 3).join("; ")}`);
  }

  const sourceErrors = Object.entries(result.errors);
  if (sourceErrors.length > 0) {
    throw new Error(`${sourceErrors.length} US-Quellen konnten nicht verarbeitet werden: ${sourceErrors.slice(0, 3).map(([source, message]) => `${source}: ${message}`).join("; ")}`);
  }

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

const runSmallVendorDeepDive = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  const force = payload.force === true;
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige small_vendor_deep_dive Nutzdaten");
  }
  await runDeepDiveAnalysis(tenderId, force);
  return { tender_id: tenderId, force };
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
  [JOB_SMALL_VENDOR_DEEP_DIVE]: runSmallVendorDeepDive,
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
  const job = await claimNextJob(attemptWorkerId, {
    lane: options.lane,
    typeOrder: options.typeOrder,
    enforceRuntimeTimeout: options.terminateOnTimeout ?? false,
  });
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
    const handlerPromise = handler(payload);
    // A Promise.race cannot cancel the handler. Only use the watchdog when the
    // caller will terminate the process after a timeout; otherwise requeueing
    // here could run a second attempt while the first handler still mutates DB.
    const timeout = options.terminateOnTimeout
      ? new Promise<never>((_, reject) => {
          watchdog = setTimeout(() => {
            timedOut = true;
            reject(new Error(`Job #${job.id} (${jobType}) überschritt die maximale Laufzeit von ${Math.round(maxRuntimeMs / 60_000)} Minuten.`));
          }, maxRuntimeMs);
          watchdog.unref();
        })
      : null;
    const result = timeout
      ? await Promise.race([handlerPromise, timeout])
      : await handlerPromise;
    if (watchdog) clearTimeout(watchdog);
    clearInterval(heartbeat);
    await markDone(job.id, attemptWorkerId);
    if (jobType === JOB_SYNC_MEILI) {
      try {
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
      } catch (error) {
        console.warn("[pipeline] Katalogstatus nach erfolgreichem Sync konnte nicht geprüft werden:", error);
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
    await db.transaction(async (tx) => {
      // A tender delete cascades its data, but queue rows have no foreign key.
      // Remove only pending work for deleted tenders; running jobs and history
      // remain available for stale-job handling and auditing.
      await tx.delete(jobs).where(and(
        eq(jobs.status, "pending"),
        inArray(sql`${jobs.payload} ->> 'tender_id'`, ids.map(String)),
      ));
      await tx.delete(tenders).where(inArray(tenders.id, ids));
    });
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
    await db.transaction(async (tx) => {
      // US document jobs reference the tender through JSON payload rather than
      // a database foreign key, so clean pending work before the cascade.
      await tx.delete(jobs).where(and(
        eq(jobs.status, "pending"),
        inArray(sql`${jobs.payload} ->> 'us_tender_id'`, ids.map(String)),
      ));
      await tx.delete(usTenders).where(inArray(usTenders.id, ids));
    });
    deleted += ids.length;
  }

  return { deleted };
};
