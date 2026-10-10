import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, tenderDeepDives, tenderResources, tenders, type DeepDiveStatus, type DocumentRole } from "@/lib/schema";
import { callSmallVendorLLM } from "@/lib/llm";
import { extractTextFromFile } from "@/lib/parser";
import { ensureExtension, fetchAndStore, objectAbsolutePath } from "@/lib/storage";
import { isHtmlContentType } from "@/lib/document-identity";
import { isPortalActionUrl } from "@/lib/resource-url";
import { classifyDocumentRole } from "@/lib/document-classifier";
import { scrapeWebsite } from "@/lib/firecrawl";

// The deep dive is a premium manual feature: a bounded retry keeps a broken
// portal from eating the whole job runtime.
const MAX_RETRY_DOCUMENTS = 12;
const MAX_CORPUS_CHARS = 120_000;
const MAX_DOCUMENT_CHARS = 40_000;
const MIN_USABLE_CHARS = 400;

const ROLE_PRIORITY: Record<string, number> = {
  bekanntmachung: 0,
  leistungsbeschreibung: 1,
  leistungsverzeichnis: 2,
  zuschlagskriterien: 3,
  eignung: 4,
  vertragsbedingungen: 5,
  anlage: 6,
  formblatt: 7,
  nachtrag: 8,
  other: 9,
};

export interface DeepDiveQuelle {
  dokument: string;
  seite: number | null;
}

export interface DeepDiveResult {
  zusammenfassung: string;
  zielAuftraggeber: string;
  wasWirdGekauft: string[];
  umfang: string;
  anforderungen: string[];
  hindernisse: string[];
  budgetLaufzeit: string;
  verfahrenFristen: string;
  einschaetzung: string;
  offenePunkte: string[];
  quellen: DeepDiveQuelle[];
}

export interface DeepDiveCorpusStats {
  dokumenteGesamt: number;
  dokumenteVerwertbar: number;
  zeichen: number;
  retryVersucht: number;
  retryErfolgreich: number;
  verbleibendBlockiert: number;
}

interface CorpusDocument {
  id: number;
  filename: string | null;
  role: string | null;
  roles: string[] | null;
  extractedText: string | null;
  parseStatus: string | null;
  downloadStatus: string | null;
}

export interface DeepDiveCorpus {
  fakten: string;
  dokumentTexte: string;
  zeichen: number;
  verwertbar: number;
}

const compact = (value: string): string => value.split(/\s+/).join(" ").trim();

const asString = (value: unknown): string =>
  typeof value === "string" ? compact(value) : typeof value === "number" ? String(value) : "";

const asStringList = (value: unknown, max: number, maxItemLength = 400): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(asString)
    .filter((value) => value.length > 0)
    .slice(0, max)
    .map((value) => value.length > maxItemLength ? value.slice(0, maxItemLength).replace(/\s+\S*$/, "").trim() : value);
};

/** Pure: builds the LLM corpus from a tender row and its parsed documents. */
export const buildDeepDiveCorpus = (
  tender: { title: string | null; url: string | null; rawText: string | null; deadlineAt: Date | null; source: string | null; category: string | null },
  docs: CorpusDocument[],
): DeepDiveCorpus => {
  const deadline = tender.deadlineAt ? tender.deadlineAt.toISOString().slice(0, 10) : "unbekannt";
  const fakten = [
    `Titel: ${compact(tender.title ?? "")}`,
    `Quelle: ${tender.source ?? "unbekannt"}`,
    `Kategorie: ${tender.category ?? "unbekannt"}`,
    `Angebotsfrist: ${deadline}`,
    `Original-URL: ${tender.url ?? "unbekannt"}`,
  ].join("\n");

  const primaryRole = (doc: CorpusDocument): string => {
    const roles = [...(doc.roles ?? []), ...(doc.role ? [doc.role] : [])];
    const known = roles.map((role) => ROLE_PRIORITY[role] ?? 9);
    return known.length > 0 ? String(Math.min(...known)) : "9";
  };

  const usable = docs
    .filter((doc) => doc.parseStatus === "parsed" && typeof doc.extractedText === "string" && doc.extractedText.trim().length >= 20)
    .sort((a, b) => {
      const roleDiff = Number(primaryRole(a)) - Number(primaryRole(b));
      return roleDiff !== 0 ? roleDiff : a.id - b.id;
    });

  let budget = MAX_CORPUS_CHARS;
  const parts: string[] = [];
  for (const doc of usable) {
    if (budget <= 200) break;
    const text = (doc.extractedText ?? "").trim();
    const clipped = text.length > MAX_DOCUMENT_CHARS
      ? `${text.slice(0, Math.min(MAX_DOCUMENT_CHARS, budget))}\n[Text gekürzt]`
      : text;
    if (clipped.length > budget) {
      parts.push(`[Dokument ${doc.id}: ${doc.filename ?? "ohne Name"} | Rolle: ${doc.role ?? "other"}]\n${clipped.slice(0, budget)}\n[Text gekürzt]`);
      budget = 0;
      break;
    }
    parts.push(`[Dokument ${doc.id}: ${doc.filename ?? "ohne Name"} | Rolle: ${doc.role ?? "other"}]\n${clipped}`);
    budget -= clipped.length;
  }

  const rawText = (tender.rawText ?? "").trim();
  const dokumentTexte = parts.join("\n\n");
  const korpus = [dokumentTexte, rawText && dokumentTexte.length < MAX_CORPUS_CHARS / 2 ? `[Portal-Text]\n${rawText.slice(0, Math.max(0, MAX_CORPUS_CHARS - dokumentTexte.length))}` : ""]
    .filter(Boolean)
    .join("\n\n");

  return { fakten, dokumentTexte: korpus, zeichen: korpus.length, verwertbar: usable.length };
};

const SYSTEM_PROMPT = `Du bist ein Experte für öffentliche Beschaffung in Deutschland. Deine Aufgabe: Eine Ausschreibung so aufbereiten, dass ein kleines Software-/KI-Unternehmen sofort versteht, was der Auftraggeber wirklich will.

Antworte AUSSCHLIESSLICH als JSON-Objekt mit genau diesen Feldern:
{
  "zusammenfassung": string (2-3 Sätze in einfacher Sprache: Worum geht es overall?),
  "zielAuftraggeber": string (1-3 Sätze: Was will der Auftraggeber am Ende erreichen? Welches Problem löst er?),
  "wasWirdGekauft": string[] (3-8 Stichpunkte: konkret zu liefernde Produkte/Dienstleistungen),
  "umfang": string (1-3 Sätze: Größenordnung des Aufwands, Lose, Laufzeit, Vertragsart),
  "anforderungen": string[] (3-8 Stichpunkte: harte Teilnahme-/Eignungsanforderungen, Zertifikate, Referenzen),
  "hindernisse": string[] (0-6 Stichpunkte: was speziell für KLEINE Anbieter schwierig sein könnte - Ü2/Ü3, Mindestumsatz, Mindestreferenzen, Versicherungssummen, Präsenz vor Ort),
  "budgetLaufzeit": string (Budget/Auftragswert und Laufzeit, oder "Nicht angegeben"),
  "verfahrenFristen": string (Vergabeverfahren, Fristen, kommende Schritte),
  "einschaetzung": string (2-3 Sätze ehrliche Einschätzung: lohnt sich eine Angebotsabgabe für ein kleines spezialisiertes Software-Unternehmen?),
  "offenePunkte": string[] (0-6 Stichpunkte: wichtige Fragen, die in den Unterlagen NICHT beantwortet werden),
  "quellen": [{"dokument": string (Dateiname oder Dokument-ID), "seite": number|null}] (max 6 Belegstellen)
}

Regeln:
- EINFACHE SPRACHE: kurze Sätze, keine Behörden-Floskeln, Fachbegriffe kurz erklären.
- Erfinde NICHTS. Steht etwas in den Unterlagen nicht, sage es in "offenePunkte" oder schreibe "Nicht angegeben".
- Nutze nur die bereitgestellten Dokumente und Texte als Wissensbasis.
- Antworte auf Deutsch.`;

/** Pure: builds the chat messages for the deep-dive LLM call. */
export const buildDeepDiveMessages = (corpus: DeepDiveCorpus) => [
  { role: "system" as const, content: SYSTEM_PROMPT },
  {
    role: "user" as const,
    content: `Ausschreibungsdaten:\n${corpus.fakten}\n\nDokumente und Texte:\n${corpus.dokumentTexte}`,
  },
];

const parseJsonLoose = (raw: string): unknown => {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("LLM-Antwort ist kein gültiges JSON");
  }
};

/** Pure: coerces a raw LLM JSON payload into a validated DeepDiveResult. */
export const normalizeDeepDiveResult = (raw: unknown): DeepDiveResult => {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const quellenRaw = Array.isArray(record.quellen) ? record.quellen : [];
  const quellen = quellenRaw
    .map((entry) => {
      const source = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      const dokument = asString(source.dokument) || asString(source.dokumentId) || "Dokument";
      const seiteValue = source.seite ?? source.page;
      const seite = typeof seiteValue === "number" && Number.isFinite(seiteValue) && seiteValue > 0 ? Math.floor(seiteValue) : null;
      return { dokument, seite };
    })
    .slice(0, 6);

  const result: DeepDiveResult = {
    zusammenfassung: asString(record.zusammenfassung),
    zielAuftraggeber: asString(record.zielAuftraggeber) || asString(record.ziel_auftraggeber),
    wasWirdGekauft: asStringList(record.wasWirdGekauft ?? record.was_wird_gekauft, 8),
    umfang: asString(record.umfang),
    anforderungen: asStringList(record.anforderungen, 8),
    hindernisse: asStringList(record.hindernisse, 6),
    budgetLaufzeit: asString(record.budgetLaufzeit) || asString(record.budget_laufzeit) || "Nicht angegeben",
    verfahrenFristen: asString(record.verfahrenFristen) || asString(record.verfahren_fristen),
    einschaetzung: asString(record.einschaetzung),
    offenePunkte: asStringList(record.offenePunkte ?? record.offene_punkte, 6),
    quellen,
  };

  if (!result.zusammenfassung && !result.zielAuftraggeber && result.wasWirdGekauft.length === 0) {
    throw new Error("Tiefenanalyse enthielt keine verwertbaren Felder");
  }
  return result;
};

export interface DownloadRetryStats {
  versucht: number;
  erfolgreich: number;
}

const parseStoredDocument = async (
  tenderId: number,
  docId: number | null,
  docUrl: string,
  stored: Awaited<ReturnType<typeof fetchAndStore>>,
): Promise<{ hasText: boolean }> => {
  if (isHtmlContentType(stored.contentType)) {
    throw new Error("HTML-/Portalantwort statt Dokument");
  }
  const normalizedPath = ensureExtension(stored.storagePath, stored.contentType);
  const extracted = await extractTextFromFile(objectAbsolutePath(normalizedPath), stored.contentType);
  const pageText = (extracted.pages.length > 0
    ? extracted.pages
      .map((page, index) => `[Seite ${index + 1}]\n${page}`)
      .join("\n\n")
    : extracted.text).replace(/\u0000/g, "");
  const hasText = pageText.trim().length >= 20;

  const classify = classifyDocumentRole({
    filename: stored.filename,
    url: stored.finalUrl || docUrl,
    textSample: pageText.slice(0, 3000),
  });
  const roles: DocumentRole[] = classify.role !== "other"
    ? [classify.role]
    : ["other"];
  const filename = stored.filename ?? undefined;
  const finalUrl = stored.finalUrl || docUrl;

  if (docId !== null) {
    await db.update(documents).set({
      url: finalUrl,
      storagePath: normalizedPath,
      sha256: stored.sha256,
      contentType: stored.contentType,
      filename,
      downloadStatus: "downloaded",
      parseStatus: hasText ? "parsed" : "empty",
      errorMessage: null,
      pageCount: extracted.pageCount,
      extractedText: hasText ? pageText : null,
      role: roles[0],
      roles,
      roleSource: "deep_dive",
      updatedAt: new Date(),
    }).where(eq(documents.id, docId));
  } else {
    await db.insert(documents).values({
      tenderId,
      url: finalUrl,
      storagePath: normalizedPath,
      sha256: stored.sha256,
      contentType: stored.contentType,
      filename,
      downloadStatus: "downloaded",
      parseStatus: hasText ? "parsed" : "empty",
      errorMessage: null,
      pageCount: extracted.pageCount,
      extractedText: hasText ? pageText : null,
      role: roles[0],
      roles,
      roleSource: "deep_dive",
      roleConfidence: classify.confidence,
    }).onConflictDoNothing();
  }
  await db.update(tenderResources).set({
    status: "downloaded",
    errorMessage: null,
    contentType: stored.contentType,
    updatedAt: new Date(),
  }).where(and(eq(tenderResources.tenderId, tenderId), eq(tenderResources.url, docUrl)));
  return { hasText };
};

/**
 * Deep-dive download recovery:
 * 1. Re-attempts failed/blocked document downloads.
 * 2. Downloads resources that were discovered but never fetched (a common
 *    state for tenders whose regular fetch stage never ran or aged out).
 */
export const retryFailedDocumentDownloads = async (tenderId: number): Promise<DownloadRetryStats> => {
  const tenderRows = await db.select({ url: tenders.url }).from(tenders).where(eq(tenders.id, tenderId)).limit(1);
  const tenderUrl = tenderRows[0]?.url ?? null;
  if (!tenderUrl) return { versucht: 0, erfolgreich: 0 };

  let budget = MAX_RETRY_DOCUMENTS;
  let versucht = 0;
  let erfolgreich = 0;

  const attempt = async (docId: number | null, docUrl: string, referer: string | null): Promise<boolean> => {
    if (budget <= 0) return false;
    budget -= 1;
    versucht += 1;
    try {
      const stored = await fetchAndStore(docUrl, `tenders/${tenderId}/deepdive-${docId ?? "new"}-${Date.now()}`, {
        referer: referer ?? undefined,
        sessionPageUrl: referer ?? tenderUrl,
      });
      const { hasText } = await parseStoredDocument(tenderId, docId, docUrl, stored);
      if (hasText) {
        erfolgreich += 1;
        return true;
      }
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannter Downloadfehler";
      if (docId !== null) {
        await db.update(documents).set({
          downloadStatus: "blocked",
          errorMessage: `Tiefenanalyse: ${message}`.slice(0, 500),
          updatedAt: new Date(),
        }).where(eq(documents.id, docId));
      }
      return false;
    }
  };

  // 1) Previously downloaded-but-failed documents.
  const failedDocs = (await db
    .select({
      id: documents.id,
      url: documents.url,
      downloadStatus: documents.downloadStatus,
    })
    .from(documents)
    .where(and(
      eq(documents.tenderId, tenderId),
      inArray(documents.downloadStatus, ["failed", "blocked"]),
    )))
    .filter((doc) => doc.url && !isPortalActionUrl(doc.url));

  for (const doc of failedDocs) {
    if (budget <= 0) break;
    await attempt(doc.id, doc.url as string, tenderUrl);
  }

  const existingDocs = await db
    .select({ url: documents.url, downloadStatus: documents.downloadStatus })
    .from(documents)
    .where(eq(documents.tenderId, tenderId));
  const downloadedUrls = new Set(
    existingDocs.filter((doc) => doc.downloadStatus === "downloaded").map((doc) => doc.url ?? ""),
  );
  const attemptedUrls = new Set(failedDocs.map((doc) => doc.url as string));

  // 1.5) Crawl the tender landing page once for direct document links. Many
  // portals (VMP, cosinex) only expose PDFs from the rendered detail page,
  // so the crawl renders JavaScript and also inspects network resources.
  if (budget > 0) {
    try {
      const landing = await scrapeWebsite(tenderUrl, { useBodyText: false, onlyMainContent: false, waitMs: 1500 });
      const landingUrl = landing.url || tenderUrl;
      const landingLinks = [
        ...landing.resources,
        ...landing.links,
      ]
        .filter((link) => {
          if (!link.url || isPortalActionUrl(link.url)) return false;
          if (attemptedUrls.has(link.url) || downloadedUrls.has(link.url)) return false;
          const type = link.resourceType ?? link.type ?? "";
          const contentType = link.contentType ?? "";
          return ["document", "download"].includes(type)
            || /\.pdf(?:[?#]|$)/i.test(link.url)
            || contentType.includes("pdf");
        });
      const seen = new Set<string>();
      for (const link of landingLinks) {
        if (budget <= 0) break;
        if (seen.has(link.url)) continue;
        seen.add(link.url);
        await attempt(null, link.url, landingUrl);
      }
    } catch {
      // Landing-page crawl is best-effort; the resource-based steps still run.
    }
  }

  // 2) Resources that were discovered but never turned into documents.
  const pendingResources = (await db
    .select({
      id: tenderResources.id,
      url: tenderResources.url,
      canonicalUrl: tenderResources.canonicalUrl,
      sourcePageUrl: tenderResources.sourcePageUrl,
      resourceType: tenderResources.resourceType,
      contentType: tenderResources.contentType,
      status: tenderResources.status,
    })
    .from(tenderResources)
    .where(and(
      eq(tenderResources.tenderId, tenderId),
      inArray(tenderResources.status, ["discovered", "failed", "blocked"]),
    )))
    .filter((resource) => {
      const url = resource.canonicalUrl ?? resource.url;
      if (!url || isPortalActionUrl(url)) return false;
      if (attemptedUrls.has(url) || downloadedUrls.has(url) || downloadedUrls.has(resource.url ?? "")) return false;
      const type = resource.resourceType ?? "";
      const contentType = resource.contentType ?? "";
      return ["document", "download"].includes(type) || contentType.includes("pdf");
    });

  for (const resource of pendingResources) {
    if (budget <= 0) break;
    const url = resource.canonicalUrl ?? resource.url;
    const referer = resource.sourcePageUrl ?? tenderUrl;
    await attempt(null, url as string, referer);
  }

  return { versucht, erfolgreich };
};

const setDeepDiveStatus = async (
  tenderId: number,
  status: DeepDiveStatus,
  extra?: { model?: string; resultJson?: DeepDiveResult; corpusStats?: DeepDiveCorpusStats; error?: string },
): Promise<void> => {
  await db
    .insert(tenderDeepDives)
    .values({
      tenderId,
      status,
      model: extra?.model,
      resultJson: extra?.resultJson,
      corpusStats: extra?.corpusStats,
      error: extra?.error,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tenderDeepDives.tenderId,
      set: {
        status,
        ...(extra?.model !== undefined ? { model: extra.model } : {}),
        ...(extra?.resultJson !== undefined ? { resultJson: extra.resultJson } : {}),
        ...(extra?.corpusStats !== undefined ? { corpusStats: extra.corpusStats } : {}),
        ...(extra?.error !== undefined ? { error: extra.error } : {}),
        updatedAt: new Date(),
      },
    });
};

/**
 * Full deep-dive run: download retry → corpus → GLM analysis → persistence.
 * Throws on failure (the job wrapper marks the deep dive as failed).
 */
export const runDeepDiveAnalysis = async (tenderId: number, force = false): Promise<DeepDiveResult> => {
  if (!force) {
    const existing = await db
      .select({ status: tenderDeepDives.status })
      .from(tenderDeepDives)
      .where(eq(tenderDeepDives.tenderId, tenderId))
      .limit(1);
    if (existing[0]?.status === "ready") {
      const row = await db
        .select({ resultJson: tenderDeepDives.resultJson })
        .from(tenderDeepDives)
        .where(eq(tenderDeepDives.tenderId, tenderId))
        .limit(1);
      if (row[0]?.resultJson) return normalizeDeepDiveResult(row[0].resultJson);
    }
  }

  await setDeepDiveStatus(tenderId, "running");

  try {
    const retry = await retryFailedDocumentDownloads(tenderId);

    const tenderRows = await db
      .select({
        title: tenders.title,
        url: tenders.url,
        rawText: tenders.rawText,
        deadlineAt: tenders.deadlineAt,
        source: tenders.source,
        category: tenders.category,
      })
      .from(tenders)
      .where(eq(tenders.id, tenderId))
      .limit(1);
    const tender = tenderRows[0];
    if (!tender) throw new Error("Ausschreibung nicht gefunden");

    const docRows = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        role: documents.role,
        roles: documents.roles,
        extractedText: documents.extractedText,
        parseStatus: documents.parseStatus,
        downloadStatus: documents.downloadStatus,
      })
      .from(documents)
      .where(eq(documents.tenderId, tenderId));

    const corpus = buildDeepDiveCorpus(tender, docRows);
    if (corpus.zeichen < MIN_USABLE_CHARS) {
      throw new Error("Zu wenig Textmaterial: Die Dokumente konnten nicht geladen werden (ggf. Login-/Teilnahmeportal).");
    }

    const { content, model } = await callSmallVendorLLM({
      messages: buildDeepDiveMessages(corpus),
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });
    const result = normalizeDeepDiveResult(parseJsonLoose(content));

    const stats: DeepDiveCorpusStats = {
      dokumenteGesamt: docRows.length,
      dokumenteVerwertbar: corpus.verwertbar,
      zeichen: corpus.zeichen,
      retryVersucht: retry.versucht,
      retryErfolgreich: retry.erfolgreich,
      verbleibendBlockiert: docRows.filter((doc) => doc.downloadStatus === "failed" || doc.downloadStatus === "blocked").length,
    };
    await setDeepDiveStatus(tenderId, "ready", { model, resultJson: result, corpusStats: stats });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler bei der Tiefenanalyse";
    await setDeepDiveStatus(tenderId, "failed", { error: message.slice(0, 500) });
    throw error;
  }
};
