import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";
import { and, asc, eq, ne, isNotNull, lt, inArray, sql } from "drizzle-orm";
import { settings } from "@/lib/config";
import { discoverTendersFromSource } from "@/lib/crawler";
import { db } from "@/lib/db";
import {
  tenders,
  documents,
  structuredData,
  companyProfiles,
  scores,
  insights,
  attributionEvents,
  jobs,
  type Tender,
  type Document as DocumentType,
  type StructuredData as StructuredDataType,
  type CompanyProfile as CompanyProfileType,
} from "@/lib/schema";
import { generateInsight } from "@/lib/insights";
import { extractTextFromFile } from "@/lib/parser";
import { claimNextJob, enqueueJob, heartbeatJob, markDone, markFailed } from "@/lib/queue";
import { computeScores, llmBatchDomainMatch, type CompanyRow } from "@/lib/scoring";
import { ensureExtension, fetchAndStore, objectAbsolutePath, suggestedFilename } from "@/lib/storage";
import { extractStructuredData, normalizeStructured, type StructuredData } from "@/lib/structurer";
import { assessTenderQuality } from "@/lib/tender-quality";
import { resolveSourceItem } from "@/lib/tender-sources";
import { scrapeAllPublicTenders, type ExtractedTender } from "@/lib/public-tender-scraper";
import { enrichFromOeffentlicheVergabe, type OeffentlicheVergabeDetails } from "@/lib/public-tender-scraper";
import { generateTenderSlug } from "@/lib/tender-slug";
import { scoreKnownTenders } from "@/lib/discovery";
import { configureMeiliIndex, syncTendersToMeili } from "@/lib/meilisearch";
import { scrapeWebsite } from "@/lib/firecrawl";
import OpenAI from "openai";
import { callLLM } from "@/lib/llm";
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

const upsertTender = async ({ source, sourceKey, url, title, externalId, metadata, deadlineAt, category, rawText }: UpsertTenderInput): Promise<UpsertTenderResult> => {
  const boundedRawText = rawText === undefined || rawText === null
    ? rawText
    : rawText.slice(0, MAX_TENDER_TEXT_CHARS);
  const byExternalId = externalId
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

  const existing =
    byExternalId.length > 0
      ? byExternalId
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
    const changed =
      (sourceKey !== undefined && current.sourceKey !== sourceKey) ||
      current.url !== url ||
      current.title !== title ||
      (externalId !== undefined && current.externalId !== externalId) ||
      (metadata !== undefined && !sameValue(current.metadataJson, metadata)) ||
      (deadlineAt !== undefined && !sameDate(current.deadlineAt, deadlineAt)) ||
      (category !== undefined && current.category !== category) ||
      (boundedRawText !== undefined && current.rawText !== boundedRawText);

    const updateData: Record<string, unknown> = { lastSeenAt: new Date() };
    if (changed) {
      updateData.updatedAt = new Date();
      updateData.version = sql`${tenders.version} + 1`;
      if (sourceKey !== undefined) updateData.sourceKey = sourceKey;
      updateData.url = url;
      updateData.title = title;
      if (externalId !== undefined) updateData.externalId = externalId;
      if (metadata !== undefined) updateData.metadataJson = metadata;
      if (deadlineAt !== undefined) updateData.deadlineAt = deadlineAt;
      if (category !== undefined) updateData.category = category;
      if (boundedRawText !== undefined) updateData.rawText = boundedRawText;
    }
    await db
      .update(tenders)
      .set(updateData)
      .where(eq(tenders.id, current.id));
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

  return { id: result[0].id, changed: true, inserted: true };
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

const findPdfLinks = async (baseUrl: string): Promise<string[]> => {
  const response = await fetch(baseUrl, { redirect: "follow" });
  if (!response.ok) {
    return [];
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const links: string[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const absolute = cleanUrl(new URL(href, baseUrl).toString());
    if (!absolute.toLowerCase().includes(".pdf")) return;
    if (seen.has(absolute)) return;
    seen.add(absolute);
    links.push(absolute);
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
            const absolute = cleanUrl(new URL(href, "https://www.evergabe.de").toString());
            if (seen.has(absolute)) return;
            seen.add(absolute);
            links.push(absolute);
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
        const absolute = cleanUrl(new URL(href, baseUrl).toString());
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
        const absolute = cleanUrl(new URL(href, baseUrl).toString());
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
          const absolute = cleanUrl(new URL(href, docsUrl).toString());
          if (!absolute.toLowerCase().includes(".pdf") && !absolute.includes("/download/")) return;
          if (seen.has(absolute)) return;
          seen.add(absolute);
          links.push(absolute);
        });
      } catch {
        // ignore fetch errors on subpages
      }
    }
  }

  return links.slice(0, settings.maxPdfLinksPerTender);
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
  const scrapedPdfUrls: string[] = [];
  if (Array.isArray(meta.pdf_urls)) {
    for (const u of meta.pdf_urls) {
      if (typeof u === "string" && u.startsWith("http")) {
        scrapedPdfUrls.push(u);
      }
    }
  }

  // 2. Fall back to finding PDF links on the page (skip for SPA pages)
  const isSPA = /meinauftrag\.rib\.de|auftraege\.bayern/.test(tender.url ?? "");
  const pageLinks = (scrapedPdfUrls.length > 0 || isSPA) ? [] : await findPdfLinks(tender.url);

  // 3. If still nothing, store the page itself
  const urls = [...scrapedPdfUrls, ...pageLinks];

  // If no PDFs found and URL is an SPA, skip storing the page (SPA shell has no useful content)
  if (urls.length === 0 && isSPA) {
    await queueTenderStage(JOB_PARSE, tenderId);
    return { documents_saved: 0, skipped: "SPA-URL ohne PDFs" };
  }

  const finalUrls = [...new Set(urls.length > 0 ? urls : [tender.url])]
    .slice(0, settings.maxPdfLinksPerTender);

  let saved = 0;
  for (const url of finalUrls) {
    const baseName = suggestedFilename(url, `tender-${tenderId}-${saved + 1}`);
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

    await db
      .insert(documents)
      .values({
        tenderId,
        url,
        storagePath: normalizedPath,
        sha256: stored.sha256,
        contentType: stored.contentType,
      })
      .onConflictDoNothing();
    saved += 1;
  }

  await queueTenderStage(JOB_PARSE, tenderId);
  return { documents_saved: saved };
};

const runParseDocuments = async (payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  const tenderId = Number(payload.tender_id ?? 0);
  if (!Number.isFinite(tenderId) || tenderId <= 0) {
    throw new Error("ungueltige tender_id");
  }

  const docs = await db
    .select({ id: documents.id, storagePath: documents.storagePath, contentType: documents.contentType })
    .from(documents)
    .where(eq(documents.tenderId, tenderId))
    .orderBy(documents.id);

  if (docs.length === 0) {
    // No documents to parse — raw_text may already be set (e.g. from RSS description)
    await queueTenderStage(JOB_STRUCTURE, tenderId);
    return { chunks: 0, skipped: "keine Dokumente, raw_text bereits vorhanden" };
  }

  const mergedParts: string[] = [];
  let mergedLength = 0;
  for (const doc of docs) {
    const absPath = objectAbsolutePath(doc.storagePath);
    try {
      const extracted = await extractTextFromFile(absPath, doc.contentType);
      const bounded = extracted.length > MAX_DOCUMENT_TEXT_CHARS
        ? `${extracted.slice(0, MAX_DOCUMENT_TEXT_CHARS)}\n[Text wegen Größenlimit gekürzt]`
        : extracted;
      const remaining = Math.max(0, MAX_TENDER_TEXT_CHARS - mergedLength);
      if (remaining > 0) {
        const part = bounded.slice(0, remaining);
        mergedParts.push(part);
        mergedLength += part.length;
      }
      await db
        .update(documents)
        .set({ extractedText: bounded, updatedAt: new Date() })
        .where(eq(documents.id, doc.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannter Parserfehler";
      const fallback = `[parse_error] ${message}`;
      if (mergedLength < MAX_TENDER_TEXT_CHARS) {
        const part = fallback.slice(0, MAX_TENDER_TEXT_CHARS - mergedLength);
        mergedParts.push(part);
        mergedLength += part.length;
      }
      await db
        .update(documents)
        .set({ extractedText: fallback, updatedAt: new Date() })
        .where(eq(documents.id, doc.id));
    }
  }

  const merged = mergedParts.join("\n\n").slice(0, MAX_TENDER_TEXT_CHARS).trim();
  await db
    .update(tenders)
    .set({ rawText: merged, updatedAt: new Date() })
    .where(eq(tenders.id, tenderId));
  await queueTenderStage(JOB_STRUCTURE, tenderId);
  return { parsed_documents: docs.length, text_length: merged.length };
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

  const structured = await extractStructuredData(tender.title ?? "Unbenannte Ausschreibung", tender.rawText);

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
  await db
    .update(tenders)
    .set({
      qualityStatus: quality.status,
      qualityReason: quality.reason,
      contentFingerprint: quality.fingerprint,
      duplicateOfTenderId: quality.duplicateOfTenderId,
      updatedAt: new Date(),
    })
    .where(eq(tenders.id, tenderId));

  if (quality.status !== "qualified") {
    await clearTenderScoring(tenderId);
    return {
      confidence: structured.confidence,
      quality_status: quality.status,
      quality_reason: quality.reason,
      duplicate_of_tender_id: quality.duplicateOfTenderId,
    };
  }

   await queueTenderStage(JOB_SCORE, tenderId);
   await queueTenderStage(JOB_CACHE_DETAIL, tenderId);
  return {
    confidence: structured.confidence,
    quality_status: quality.status,
    quality_reason: quality.reason,
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

    // Check flat format (from cache_detail)
    const hasFlatDescription = blob.description && typeof blob.description === "string" && blob.description.length > 200;
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
  const description = String(meta.description ?? "");
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
          description: String(extracted.description ?? description),
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
            description: oeffDetails.description ?? description,
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
            result.description = oeffDetails.description;
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
    const existingDocs = await db.select({ url: documents.url }).from(documents).where(eq(documents.tenderId, tenderId));
    const existingUrls = new Set(existingDocs.map(d => d.url));
    let docIndex = 0;

    for (const docUrl of evergabeUrls) {
      if (existingUrls.has(docUrl)) continue;
      try {
        const baseName = suggestedFilename(docUrl, `tender-${tenderId}-evergabe-${++docIndex}`);
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

        await db.insert(documents).values({
          tenderId,
          url: docUrl,
          storagePath: normalizedPath,
          sha256: stored.sha256,
          contentType: stored.contentType,
        }).onConflictDoNothing();

        // Parse XLSX/PDF and append to rawText
        try {
          const absPath = objectAbsolutePath(normalizedPath);
          const extracted = await extractTextFromFile(absPath, stored.contentType);
          if (extracted && extracted.length > 20) {
            await db.update(documents).set({ extractedText: extracted, updatedAt: new Date() }).where(eq(documents.url, docUrl));
            // Re-fetch rawText to avoid lost-update when multiple docs are processed
            const freshTender = await getTender(tenderId);
            const currentRaw = freshTender.rawText ?? "";
            await db.update(tenders).set({
              rawText: appendBoundedTenderText(currentRaw, extracted.slice(0, MAX_DOCUMENT_TEXT_CHARS)),
              updatedAt: new Date(),
            }).where(eq(tenders.id, tenderId));
            console.log(`[cache-detail] evergabe Dokument geparst: ${normalizedPath} (${extracted.length} Zeichen)`);
          }
        } catch (parseError) {
          console.warn(`[cache-detail] evergabe Dokument Parsing fehlgeschlagen:`, parseError);
        }
      } catch (fetchError) {
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

  await db
    .insert(structuredData)
    .values({ tenderId, jsonBlob: mergedBlob, confidence: mergedConfidence })
    .onConflictDoUpdate({ target: structuredData.tenderId, set: { jsonBlob: mergedBlob, confidence: mergedConfidence, updatedAt: new Date() } });

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

  const structuredRows = await db
    .select({ jsonBlob: structuredData.jsonBlob })
    .from(structuredData)
    .where(eq(structuredData.tenderId, tenderId))
    .limit(1);

  if (structuredRows.length === 0) {
    throw new Error("strukturierte Daten fehlen");
  }

  const structured = parseStructured(structuredRows[0].jsonBlob as string, tender.title ?? "");
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

  // Build tender batch item for LLM scoring
  const scopeText = Array.isArray(structured.decision_relevant?.scope)
    ? structured.decision_relevant.scope.join(" ")
    : "";
  const tenderBatchItem = [{
    id: tenderId,
    title: tender.title ?? "",
    scope: scopeText,
    description: structured.summary ?? "",
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

    // Use LLM for domain scoring (handles German compounds, synonyms)
    const capabilities = Array.isArray(company.capabilitiesJson) ? company.capabilitiesJson as string[] : [];
    const regions = Array.isArray(company.regionsJson) ? company.regionsJson as string[] : [];
    const llmScores = await llmBatchDomainMatch(capabilities, company.industry, regions, tenderBatchItem);
    const llmDomainScore = llmScores.get(tenderId);

    const result = computeScores(tender.title ?? "", structured, companyRow, llmDomainScore);
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
    const location = structured.hard_facts?.location ?? undefined;
    const slug = generateTenderSlug(tender.title ?? "", typeof location === "string" ? location : undefined);
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
  const insight = generateInsight(
    {
      fit: scoreRow.fit,
      win_probability: scoreRow.winProbability,
      effort: scoreRow.effort,
      requirement_coverage: scoreRow.requirementCoverage,
      kill_switch: scoreRow.killSwitch,
      details: {
        domain_match: 0,
        requirement_coverage: scoreRow.requirementCoverage,
        region_match: 0,
        size_match: 0,
        complexity: 0
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

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const runScrapePublicTenders = async (_payload: Record<string, JsonValue>): Promise<Record<string, JsonValue>> => {
  let inserted = 0;
  let skipped = 0;

  const result = await scrapeAllPublicTenders(async (_source, tenders) => {
    for (const tender of tenders) {
      const deadline = parseDeadline(tender.deadline);
      if (deadline && deadline.getTime() < Date.now()) {
        skipped += 1;
        continue;
      }

      try {
        const upserted = await upsertTender({
          source: tender.source,
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
          deadlineAt: deadline,
          category: tender.category,
          rawText: tender.description || undefined,
        });
        if (upserted.changed) {
          await queueTenderProcessing(upserted.id);
          inserted += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unbekannt";
        console.error(`[public-scraper] Upsert fehlgeschlagen fuer "${tender.title}": ${message}`);
      }
    }
  });

  if (inserted > 0) {
    await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI }).catch((err) => {
      console.warn("[pipeline] Meilisearch-Sync konnte nicht eingereiht werden:", err);
    });
  }

  return {
    total_found: result.totalFound,
    after_dedup: result.afterDedup,
    inserted,
    skipped_expired: skipped,
    by_source: result.bySource,
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

  const payload = parseRecord(row.payload as string);
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

    const payload = parseRecord(job.payload as string);
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

  // Enqueue a full Meilisearch sync to ensure orphaned documents are removed
  try {
     await enqueueJob(JOB_SYNC_MEILI, {}, { jobKey: JOB_SYNC_MEILI });
     console.log(`[cleanup] sync_meilisearch Job eingereiht nach ${deleted} Löschungen.`);
  } catch (err) {
    console.warn("[cleanup] Konnte sync_meilisearch nicht einreihen:", err);
  }

  return { deleted };
};
