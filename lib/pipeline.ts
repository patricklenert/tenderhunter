import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, asc, eq, ne, isNotNull, lt, inArray, or, sql } from "drizzle-orm";
import { settings } from "@/lib/config";
import { discoverTendersFromSource } from "@/lib/crawler";
import { db } from "@/lib/db";
import {
  tenders,
  usTenders,
  usSourceRuns,
  documents,
  structuredData,
  companyProfiles,
  scores,
  insights,
  attributionEvents,
  jobs,
  publicScrapeRuns,
  publicSourceRuns,
  type Tender,
  type Document as DocumentType,
  type StructuredData as StructuredDataType,
  type CompanyProfile as CompanyProfileType,
} from "@/lib/schema";
import { generateInsight } from "@/lib/insights";
import { extractTextFromFile } from "@/lib/parser";
import { claimNextJob, enqueueJob, heartbeatJob, markDone, markFailed } from "@/lib/queue";
import { buildTenderMatchDocument, computeScores, getDomainEligibility, getLocationEligibility, llmBatchDomainMatch, type CompanyRow } from "@/lib/scoring";
import { ensureExtension, fetchAndStore, objectAbsolutePath, suggestedFilename } from "@/lib/storage";
import { extractStructuredData, normalizeStructured, type StructuredData } from "@/lib/structurer";
import { assessTenderQuality } from "@/lib/tender-quality";
import { resolveSourceItem } from "@/lib/tender-sources";
import { canonicalPublicSourceKey, scrapeAllPublicTenders, type ExtractedTender } from "@/lib/public-tender-scraper";
import { scrapeAllUsTenders, type UsExtractedTender } from "@/lib/us-tender-scraper";
import { categorizeUsTender } from "@/lib/us/categorize";
import { processUsAlerts } from "@/lib/us/alerts";
import { enrichFromOeffentlicheVergabe, cleanPublicDescription, type OeffentlicheVergabeDetails } from "@/lib/public-tender-scraper";
import { generateTenderSlug } from "@/lib/tender-slug";
import { scoreKnownTenders } from "@/lib/discovery";
import { configureMeiliIndex, syncTendersToMeili } from "@/lib/meilisearch";
import { scrapeWebsite } from "@/lib/firecrawl";
import OpenAI from "openai";
import { callLLM } from "@/lib/llm";
import { detectAccessPage, type AccessPageDetection } from "@/lib/access-page-detector";
import { processCompanyUrlPreview } from "@/lib/preview";
import { markCatalogDirty } from "@/lib/catalog";
import { classifyDocumentRole, rolePriority } from "@/lib/document-classifier";
import { buildDocumentAnalysis, withEvidenceValues, type AnalyzedDocument } from "@/lib/document-analysis";
import { evaluateTenderReadiness } from "@/lib/tender-readiness";
import { runApiAnalysisJob } from "@/app/api/v1/analyze/route";
import {
  JOB_CRAWL,
  JOB_FETCH_DOCUMENTS,
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
        .where(and(eq(tenders.source, source), eq(tenders.externalId, externalId)))
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
    { jobKey: `${jobType}:${tenderId}${keySuffix ? `:${keySuffix}` : ""}` },
  );
};

const queueTenderProcessing = async (tenderId: number): Promise<void> => {
  await queueTenderStage(JOB_FETCH_DOCUMENTS, tenderId);
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

export interface DiscoveredLink {
  url: string;
  linkText: string;
}

const findPdfLinks = async (baseUrl: string): Promise<DiscoveredLink[]> => {
  const response = await fetch(baseUrl, { redirect: "follow" });
  if (!response.ok) {
    return [];
  }
  const html = await response.text();
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
        const docsResp = await fetch(docsUrl, { redirect: "follow" });
        if (docsResp.ok) {
          const docsHtml = await docsResp.text();
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
        const subResponse = await fetch(docsUrl, { redirect: "follow" });
        if (!subResponse.ok) continue;
        const subHtml = await subResponse.text();
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
      role: documents.role,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
      roleConfidence: documents.roleConfidence,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  const analysis = buildDocumentAnalysis(documentRows as AnalyzedDocument[]);
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
        unchanged += 1;
      }
      discovered += 1;
    }
  }

  return { discovered, changed, unchanged };
};

const runFetchDocuments = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }

  const tender = await getTender(tenderId);

  // 1. Use PDF URLs from scraper metadata (set by public-tender-scraper)
  const meta = parseRecord(tender.metadataJson as string);
  const scrapedPdfUrls: DiscoveredLink[] = [];
  if (Array.isArray(meta.pdf_urls)) {
    for (const u of meta.pdf_urls) {
      if (typeof u === "string" && u.startsWith("http")) {
        scrapedPdfUrls.push({ url: u, linkText: "" });
      }
    }
  }

  // 2. Discover page links as well. Metadata URLs and page links are merged
  // because either source can contain a document role missing from the other.
  const isSPA = /meinauftrag\.rib\.de|auftraege\.bayern/.test(tender.url ?? "");
  const pageLinks = isSPA ? [] : await findPdfLinks(tender.url);

  const allLinks: DiscoveredLink[] = [];
  const seenUrls = new Set<string>();
  for (const link of [...scrapedPdfUrls, ...pageLinks]) {
    if (!link.url || seenUrls.has(link.url)) continue;
    seenUrls.add(link.url);
    allLinks.push(link);
  }

  // If no PDFs found and URL is an SPA, skip storing the page (SPA shell has no useful content)
  if (allLinks.length === 0 && isSPA) {
    await queueTenderStage(JOB_PARSE, tenderId);
    return { documents_saved: 0, skipped: "SPA-URL ohne PDFs" };
  }

  const candidates = allLinks.length > 0 ? allLinks : [{ url: tender.url ?? "", linkText: "" }];
  const classifiedCandidates = candidates.map((link) => ({
    ...link,
    role: classifyDocumentRole({ url: link.url, linkText: link.linkText }),
  }));
  const reservedRoles = new Set<string>();
  const sortedCandidates = [...classifiedCandidates].sort(
    (a, b) => rolePriority(a.role.role) - rolePriority(b.role.role),
  );
  const prioritizedLinks = sortedCandidates.filter((candidate) => {
    if (candidate.role.role === "other" || reservedRoles.has(candidate.role.role)) return false;
    reservedRoles.add(candidate.role.role);
    return true;
  });
  const remainingLinks = sortedCandidates.filter((candidate) => !prioritizedLinks.includes(candidate));
  const finalLinks = [...prioritizedLinks, ...remainingLinks]
    .slice(0, settings.maxPdfLinksPerTender);

  let saved = 0;
  for (const link of finalLinks) {
    const url = link.url;
    if (!url) continue;
    const baseName = suggestedFilename(url, `tender-${tenderId}-${saved + 1}`);
    const cleanFilename = baseName.replace(/^[0-9a-f]{12}-/, "");
    const roleResult = classifyDocumentRole({
      filename: cleanFilename,
      url,
      linkText: link.linkText,
    });

    try {
      const relative = `tenders/${tenderId}/${baseName}`;
      const stored = await fetchAndStore(url, relative);
      const normalizedPath = ensureExtension(stored.storagePath, stored.contentType);

      if (normalizedPath !== stored.storagePath) {
        const original = objectAbsolutePath(stored.storagePath);
        const target = objectAbsolutePath(normalizedPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(original, target);
        fs.unlinkSync(original);
      }

      const inserted = await db
        .insert(documents)
        .values({
          tenderId,
          url,
          storagePath: normalizedPath,
          sha256: stored.sha256,
          contentType: stored.contentType,
          filename: cleanFilename,
          downloadStatus: "downloaded",
          parseStatus: "pending",
          role: roleResult.role,
          roleSource: roleResult.source,
          roleConfidence: roleResult.confidence,
        })
        .onConflictDoNothing()
        .returning({ id: documents.id });
      if (inserted.length > 0) saved += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannter Downloadfehler";
      const urlHash = createHash("sha256").update(url).digest("hex");
      await db
        .insert(documents)
        .values({
          tenderId,
          url,
          storagePath: `tenders/${tenderId}/failed-${urlHash}.download`,
          sha256: `failed:${urlHash}`,
          filename: cleanFilename,
          downloadStatus: "failed",
          parseStatus: "pending",
          errorMessage: message.slice(0, 500),
          role: roleResult.role,
          roleSource: roleResult.source,
          roleConfidence: roleResult.confidence,
        })
        .onConflictDoNothing();
      console.warn(`[pipeline] Dokument-Download fehlgeschlagen: ${url}`, error);
    }
  }

  await refreshTenderReadiness(tenderId);
  await queueTenderStage(JOB_PARSE, tenderId);
  return { documents_saved: saved };
};

const runParseDocuments = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }

  const tender = await getTender(tenderId);
  const docs = await db
    .select({
      id: documents.id,
      storagePath: documents.storagePath,
      contentType: documents.contentType,
      filename: documents.filename,
      url: documents.url,
      role: documents.role,
      roleSource: documents.roleSource,
      roleConfidence: documents.roleConfidence,
      extractedText: documents.extractedText,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId))
    .orderBy(documents.id);

  if (docs.length === 0) {
    // No documents to parse — raw_text may already be set (e.g. from RSS description)
    await refreshTenderReadiness(tenderId);
    await queueTenderStage(JOB_STRUCTURE, tenderId);
    return { chunks: 0, skipped: "keine Dokumente, raw_text bereits vorhanden" };
  }

  // Parse every document before applying the aggregate text budget. Otherwise
  // an early, unclassified attachment could hide a later Leistungsbeschreibung.
  const parsedDocs: Array<{ id: number; role: string; text: string }> = [];
  let partial = false;

  for (const doc of docs) {
    const absPath = objectAbsolutePath(doc.storagePath);
    try {
      const extracted = await extractTextFromFile(absPath, doc.contentType);
      const pageText = extracted.pages.length > 0
        ? extracted.pages
          .map((page, index) => `[Seite ${index + 1}]\n${page}`)
          .join("\n\n")
        : extracted.text;
      const bounded = pageText.length > MAX_DOCUMENT_TEXT_CHARS
        ? `${pageText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}\n[Text wegen Größenlimit gekürzt]`
        : pageText;

      // Refine weak filename/URL classifications with document content.
      let effectiveRole = doc.role ?? "other";
      let effectiveRoleSource = doc.roleSource ?? null;
      let effectiveRoleConfidence = doc.roleConfidence ?? 0;
      if (!doc.role || doc.role === "other" || effectiveRoleConfidence < 0.75) {
        const refined = classifyDocumentRole({
          filename: doc.filename,
          url: doc.url,
          textSample: bounded.slice(0, 3000),
        });
        if (refined.role !== "other" && (!doc.role || doc.role === "other" || refined.confidence >= effectiveRoleConfidence)) {
          effectiveRole = refined.role;
          effectiveRoleSource = refined.source;
          effectiveRoleConfidence = refined.confidence;
        }
      }

      if (bounded.trim().length >= 20) {
        parsedDocs.push({ id: doc.id, role: effectiveRole, text: bounded });
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
          roleSource: effectiveRoleSource,
          roleConfidence: effectiveRoleConfidence || null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id));
    } catch (error) {
      partial = true;
      const message = error instanceof Error ? error.message : "unbekannter Parserfehler";
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
  parsedDocs.sort((a, b) => rolePriority(a.role) - rolePriority(b.role) || a.id - b.id);
  let remainingText = MAX_TENDER_TEXT_CHARS;
  const mergedParts: string[] = [];
  for (const document of parsedDocs) {
    if (remainingText <= 0) break;
    const text = document.text.slice(0, remainingText);
    if (!text.trim()) continue;
    mergedParts.push(`[ROLLE: ${document.role}] [DOKUMENT-ID: ${document.id}]\n${text}`);
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
      role: documents.role,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
      roleConfidence: documents.roleConfidence,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  const analysis = buildDocumentAnalysis(refreshedDocs as AnalyzedDocument[]);
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

  const structured = await extractStructuredData(tender.title ?? "Unbenannte Ausschreibung", tender.rawText);

  const documentRows = await db
    .select({
      id: documents.id,
      role: documents.role,
      parseStatus: documents.parseStatus,
      downloadStatus: documents.downloadStatus,
      errorMessage: documents.errorMessage,
      extractedText: documents.extractedText,
      pageCount: documents.pageCount,
      roleConfidence: documents.roleConfidence,
    })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  const baseDocumentAnalysis = buildDocumentAnalysis(documentRows as AnalyzedDocument[]);
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
  await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI });

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
    const blob = existing[0].jsonBlob as Record<string, unknown>;
    const cachedAccessPage = detectAccessPage(JSON.stringify(blob), { title: tender.title ?? undefined, url: sourceUrl });
    if (cachedAccessPage.blocked) {
      console.warn(`[cache-detail] Entferne blockierten Cache fuer Tender ${tenderId} (${cachedAccessPage.reason})`);
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
      return { cached: true, detail_cached: true };
    }
  }

  const meta = typeof tender.metadataJson === "object" && tender.metadataJson !== null
    ? tender.metadataJson as Record<string, unknown>
    : {};

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
  if (rawText.length > fullContent.length + 500) {
    console.log(`[cache-detail] Nutze raw_text (${rawText.length} Zeichen) statt gescrapter Seite (${fullContent.length} Zeichen)`);
    fullContent = rawText.slice(0, 30000);
  }

  const scrapedAccessPage = detectAccessPage(fullContent, { title: tender.title ?? undefined, url: sourceUrl });
  if (scrapedAccessPage.blocked) {
    console.warn(`[cache-detail] Blockierte Detailseite fuer Tender ${tenderId} (${scrapedAccessPage.reason})`);
    await retryBlockedDetail(tender, scrapedAccessPage);
  }

  if (fullContent.length > 200 && openrouterKey) {
    // We have good content — use LLM to structure it
    const llmClient = new OpenAI({ apiKey: openrouterKey, baseURL: "https://openrouter.ai/api/v1" });
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
      .select({ url: documents.url, downloadStatus: documents.downloadStatus })
      .from(documents)
      .where(eq(documents.tenderId, tenderId));
    const existingUrls = new Set(existingDocs.filter((d) => d.downloadStatus === "downloaded").map((d) => d.url));
    let docIndex = 0;

    for (const docUrl of evergabeUrls) {
      if (existingUrls.has(docUrl)) continue;
      const baseName = suggestedFilename(docUrl, `tender-${tenderId}-evergabe-${docIndex + 1}`);
      const cleanFilename = baseName.replace(/^[0-9a-f]{12}-/, "");
      const initialRole = classifyDocumentRole({ filename: cleanFilename, url: docUrl });
      try {
        docIndex += 1;
        const relative = `tenders/${tenderId}/${baseName}`;
        const stored = await fetchAndStore(docUrl, relative);
        const normalizedPath = ensureExtension(stored.storagePath, stored.contentType);

        if (normalizedPath !== stored.storagePath) {
          const original = objectAbsolutePath(stored.storagePath);
          const target = objectAbsolutePath(normalizedPath);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(original, target);
          fs.unlinkSync(original);
        }

        const insertedDocuments = await db.insert(documents).values({
          tenderId,
          url: docUrl,
          storagePath: normalizedPath,
          sha256: stored.sha256,
          contentType: stored.contentType,
          filename: cleanFilename,
          downloadStatus: "downloaded",
          parseStatus: "pending",
          role: initialRole.role,
          roleSource: initialRole.source,
          roleConfidence: initialRole.confidence,
        }).onConflictDoNothing().returning({ id: documents.id });
        const documentId = insertedDocuments[0]?.id ?? (
          await db.select({ id: documents.id })
            .from(documents)
            .where(and(eq(documents.tenderId, tenderId), eq(documents.url, docUrl)))
            .limit(1)
        )[0]?.id;

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
            const effectiveRole = contentRole.role !== "other" && contentRole.confidence >= initialRole.confidence
              ? contentRole
              : initialRole;
            if (documentId) {
              await db.update(documents).set({
                extractedText: documentText,
                parseStatus: "parsed",
                errorMessage: null,
                pageCount: extracted.pageCount,
                role: effectiveRole.role,
                roleSource: effectiveRole.source,
                roleConfidence: effectiveRole.confidence,
                updatedAt: new Date(),
              }).where(eq(documents.id, documentId));
            }
            // Re-fetch rawText to avoid lost-update when multiple docs are processed
            const freshTender = await getTender(tenderId);
            const currentRaw = freshTender.rawText ?? "";
            await db.update(tenders).set({
              rawText: appendBoundedTenderText(currentRaw, `[ROLLE: ${effectiveRole.role}] [DOKUMENT-ID: ${documentId ?? "unbekannt"}]\n${documentText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}`),
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
        const urlHash = createHash("sha256").update(docUrl).digest("hex");
        await db.insert(documents).values({
          tenderId,
          url: docUrl,
          storagePath: `tenders/${tenderId}/failed-${urlHash}.download`,
          sha256: `failed:${urlHash}`,
          filename: cleanFilename,
          downloadStatus: "failed",
          parseStatus: "pending",
          errorMessage: message.slice(0, 500),
          role: initialRole.role,
          roleSource: initialRole.source,
          roleConfidence: initialRole.confidence,
        }).onConflictDoNothing();
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
    const existing = existingStructured[0].jsonBlob as Record<string, unknown>;
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
    };
    mergedConfidence = 0.85;
  }

  const latestDocumentRows = await db
    .select({
      id: documents.id,
      role: documents.role,
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
    buildDocumentAnalysis(latestDocumentRows as AnalyzedDocument[]),
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

    await queueTenderStage(JOB_INSIGHT, tenderId, { company_id: company.id }, String(company.id));
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
    throw new Error("Score oder strukturierte Daten fehlen");
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

  await queueTenderStage(JOB_NOTIFY, tenderId, { company_id: companyId }, String(companyId));
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

  await db.insert(attributionEvents).values({
    tenderId,
    companyId,
    eventType: "shown",
    metadataJson: { stage: "notify_company", created_at: new Date().toISOString() },
    scoreSnapshotJson: score
      ? {
          fit: score.fit,
          win_probability: score.winProbability,
          effort: score.effort,
          requirement_coverage: score.requirementCoverage,
          kill_switch: score.killSwitch,
          details: parseRecord(score.detailsJson as string)
        }
      : null,
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
  const scrapeRun = await db.insert(publicScrapeRuns).values({ jobId, status: "running" }).returning({ id: publicScrapeRuns.id });
  const runId = scrapeRun[0].id;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let upsertPersistenceError: string | null = null;
  const changesBySource = new Map<string, { accepted: number; inserted: number; updated: number }>();

  try {
    const sourceFilter = typeof payload.source === "string" && payload.source.trim() ? payload.source.trim() : undefined;
    const result = await scrapeAllPublicTenders(async (sourceKey, tenders) => {
      const changes = changesBySource.get(sourceKey) ?? { accepted: 0, inserted: 0, updated: 0 };
    for (const tender of tenders) {
      const deadline = parseDeadline(tender.deadline);
      if (deadline && deadline.getTime() < Date.now()) {
        skipped += 1;
        continue;
      }

      try {
        const upserted = await upsertTender({
          source: tender.source,
          sourceKey: canonicalPublicSourceKey(tender.sourceKey ?? sourceKey),
          url: tender.sourceUrl,
          title: tender.title,
          metadata: {
            client: tender.client,
            description: tender.description,
            reference_number: tender.referenceNumber,
            location: tender.location,
            pdf_urls: tender.pdfUrls ?? [],
            discovered_at: new Date().toISOString(),
            scraper: "public_tender_scraper",
          },
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
        }
        changes.accepted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unbekannt";
        upsertPersistenceError ??= message;
        console.error(`[public-scraper] Upsert fehlgeschlagen fuer "${tender.title}": ${message}`);
      }
    }
    changesBySource.set(sourceKey, changes);
    }, sourceFilter);

    await db.insert(publicSourceRuns).values(result.sourceRuns.map((sourceRun) => {
      const changes = changesBySource.get(sourceRun.sourceKey) ?? { accepted: sourceRun.acceptedCount, inserted: 0, updated: 0 };
      return {
        runId,
        sourceKey: sourceRun.sourceKey,
        status: sourceRun.status,
        discoveredCount: sourceRun.discoveredCount,
        acceptedCount: changes.accepted || sourceRun.acceptedCount,
        insertedCount: changes.inserted,
        updatedCount: changes.updated,
        errorMessage: sourceRun.errorMessage,
        startedAt: new Date(Date.now() - sourceRun.durationMs),
        finishedAt: new Date(),
      };
    }));

    if (result.persistenceError) throw new Error(result.persistenceError);
    if (upsertPersistenceError) throw new Error(upsertPersistenceError);
    await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, priority: 130 });
    const hasFailures = result.sourceRuns.some((sourceRun) => ["failed", "timed_out", "partial"].includes(sourceRun.status));
    await db.update(publicScrapeRuns).set({
      status: hasFailures ? "partial" : "success",
      totalFound: result.totalFound,
      afterDedup: result.afterDedup,
      acceptedCount: result.sourceRuns.reduce((sum, sourceRun) => sum + sourceRun.acceptedCount, 0),
      insertedCount: inserted,
      updatedCount: updated,
      skippedExpired: skipped,
      finishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(publicScrapeRuns.id, runId));
    return { total_found: result.totalFound, after_dedup: result.afterDedup, inserted, updated, skipped_expired: skipped, by_source: result.bySource };
  } catch (error) {
    await db.update(publicScrapeRuns).set({ status: "failed", errorMessage: error instanceof Error ? error.message : "Public-Scrape fehlgeschlagen", insertedCount: inserted, updatedCount: updated, skippedExpired: skipped, finishedAt: new Date(), updatedAt: new Date() }).where(eq(publicScrapeRuns.id, runId));
    throw error;
  }
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
  await configureMeiliIndex().catch((err) => {
    console.warn("[pipeline] Meilisearch Index-Config fehlgeschlagen:", err);
  });
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
  const apiJobId = Number(payload.api_job_id ?? 0);
  const url = typeof payload.url === "string" ? payload.url : "";
  const mode = payload.mode === "rescore" ? "rescore" : "full";
  const companyId = payload.company_id === undefined ? undefined : Number(payload.company_id);
  const profileSlug = typeof payload.profile_slug === "string" ? payload.profile_slug : undefined;

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

export const processNextJob = async (workerId: string): Promise<JobProcessResult | null> => {
  const job = await claimNextJob(workerId);
  if (!job) {
    return null;
  }

  const jobType = job.type as JobType;
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    void heartbeatJob(job.id, workerId).catch((error) => {
      console.warn(`[queue] Heartbeat für Job #${job.id} fehlgeschlagen:`, error);
    });
  }, 30_000);

  try {
    const handler = handlers[jobType];
    if (!handler) {
      throw new Error(`Kein Handler fuer Job-Typ ${jobType}`);
    }

    const payload = { ...parseRecord(job.payload as string), __job_id: job.id };
    const result = await handler(payload);
    clearInterval(heartbeat);
    await markDone(job.id, workerId);
    return {
      job_id: job.id,
      job_type: jobType,
      status: "done",
      queue_latency_ms: job.queueLatencyMs ?? Math.max(0, startedAt - job.createdAt.getTime()),
      duration_ms: Date.now() - startedAt,
      result
    };
  } catch (error) {
    clearInterval(heartbeat);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    await markFailed(job.id, workerId, message);
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
     await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI, priority: 130 });
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
