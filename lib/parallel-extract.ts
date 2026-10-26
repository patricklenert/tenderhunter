import { fetchAndStore, saveBytes, type FetchAndStoreOptions, type StoredObject } from "@/lib/storage";
import { isHtmlContentType } from "@/lib/document-identity";

/**
 * Parallel Web Systems Extract-API (https://api.parallel.ai).
 *
 * evergabe.de blockiert die Server-IP komplett (403 auf alle Ressourcen, auch
 * über den Obscura-Browser). Die Extract-API läuft über Cloud-IPs und umgeht
 * den Block nachweislich – sowohl für die Unterlagenseite als auch für die
 * PDF-Downloads (dort liefert sie den extrahierten Volltext statt der Binärdatei).
 */

const PARALLEL_API_BASE = process.env.PARALLEL_API_BASE ?? "https://api.parallel.ai";
const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY ?? "";
const PARALLEL_TIMEOUT_MS = Number(process.env.PARALLEL_TIMEOUT_MS ?? 90_000);
/** Tägliches Budget für Extract-Aufrufe (Schutz vor Kostenausreißern). */
const PARALLEL_DAILY_BUDGET = Number(process.env.PARALLEL_DAILY_EXTRACT_BUDGET ?? 500);
const PARALLEL_MAX_RETRIES = 2;

export interface ParallelExtractResult {
  url: string;
  title: string | null;
  /** Vollinhalt (Markdown) wenn full_content angefragt wurde, sonst null. */
  fullContent: string | null;
  excerpts: string[];
  links: string[];
}

export interface EvergabeDocumentLink {
  url: string;
  filename: string | null;
}

const todayKey = (): string => new Date().toISOString().slice(0, 10);

const budget = { day: todayKey(), used: 0, logged: false };

export const parallelBudgetState = (): { day: string; used: number; limit: number } => {
  if (budget.day !== todayKey()) {
    budget.day = todayKey();
    budget.used = 0;
    budget.logged = false;
  }
  return { day: budget.day, used: budget.used, limit: PARALLEL_DAILY_BUDGET };
};

const consumeBudget = (): void => {
  const state = parallelBudgetState();
  if (state.used >= state.limit) {
    if (!budget.logged) {
      console.warn(`[parallel-extract] Tagesbudget erschöpft (${state.used}/${state.limit}), weitere Aufrufe werden abgelehnt.`);
      budget.logged = true;
    }
    throw new Error("Parallel-Extract-Tagesbudget erschöpft");
  }
  budget.used += 1;
};

export const isEvergabeUrl = (url: string): boolean => {
  try {
    return /(^|\.)evergabe\.de$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const extractViaParallel = async (
  url: string,
  options?: { fullContent?: boolean; objective?: string },
): Promise<ParallelExtractResult> => {
  if (!PARALLEL_API_KEY) {
    throw new Error("PARALLEL_API_KEY ist nicht gesetzt");
  }
  consumeBudget();
  const fullContent = options?.fullContent ?? false;
  const body: Record<string, unknown> = {
    urls: [url],
    format: "markdown",
    full_content: fullContent,
  };
  if (options?.objective) body.objective = options.objective;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= PARALLEL_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${PARALLEL_API_BASE}/v1beta/extract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PARALLEL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PARALLEL_TIMEOUT_MS),
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Parallel Extract HTTP ${response.status}`);
        if (attempt < PARALLEL_MAX_RETRIES) {
          await sleep(2_000 * (attempt + 1));
          continue;
        }
        throw lastError;
      }
      if (!response.ok) {
        throw new Error(`Parallel Extract HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
      const payload = (await response.json()) as {
        results?: Array<{
          url?: string;
          title?: string | null;
          full_content?: string | null;
          excerpts?: string[] | null;
        }>;
        errors?: Array<{ message?: string }>;
      };
      const apiErrors = payload.errors ?? [];
      if (apiErrors.length > 0) {
        throw new Error(`Parallel Extract Fehler: ${apiErrors.map((e) => e.message ?? "unbekannt").join("; ")}`.slice(0, 300));
      }
      const result = payload.results?.[0];
      if (!result) {
        throw new Error("Parallel Extract lieferte kein Ergebnis");
      }
      return {
        url,
        title: result.title ?? null,
        fullContent: result.full_content ?? null,
        excerpts: result.excerpts ?? [],
        links: [],
      };
    } catch (error) {
      lastError = error;
      if (attempt < PARALLEL_MAX_RETRIES && !String(lastError).includes("Tagesbudget")) {
        await sleep(2_000 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Parallel Extract fehlgeschlagen");
};

/**
 * Parst die Unterlagen-Tabelle einer evergabe.de-/unterlagen/-Seite.
 * Zeilenformat: `|1 |21.10.2026 20:04 Uhr |datei.pdf |[Datei herunterladen](https://www.evergabe.de/unterlagen/<id>/download/<n>...) |`
 */
export const parseEvergabeDocumentLinks = (markdown: string): EvergabeDocumentLink[] => {
  const links: EvergabeDocumentLink[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split("\n")) {
    const linkMatch = line.match(/\[[^\]]*\]\((https:\/\/www\.evergabe\.de\/unterlagen\/\d+\/download\/\d+[^)]*)\)/i);
    if (!linkMatch) continue;
    const url = linkMatch[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const filenameMatch = line.match(/\|\s*([^|]*?\.(?:pdf|zip|xlsx|docx?|xlsx?))\s*\|/i);
    const filename = filenameMatch ? filenameMatch[1].trim() : null;
    links.push({ url, filename });
  }
  return links;
};

const normalizeEvergabeUnterlagenUrl = (url: string): string =>
  url.replace(/\/zustellweg-auswaehlen.*$/i, "").replace(/\/$/, "");

/** Lädt die Unterlagenliste einer evergabe.de-Vergabe über die Parallel-Extract-API. */
export const fetchEvergabeDocumentsViaParallel = async (unterlagenUrl: string): Promise<EvergabeDocumentLink[]> => {
  const page = await fetchEvergabeUnterlagenPageViaParallel(unterlagenUrl);
  return page.documents;
};

export interface EvergabeUnterlagenPage {
  documents: EvergabeDocumentLink[];
  markdown: string;
  title: string | null;
}

/**
 * Lädt die Unterlagenseite und liefert Dokumentlinks plus Seiteninhalt.
 * Der Titelzeile ("## Teilnahmewettbewerbsunterlage …") entnimmt man den
 * offiziellen Ausschreibungstitel.
 */
export const fetchEvergabeUnterlagenPageViaParallel = async (unterlagenUrl: string): Promise<EvergabeUnterlagenPage> => {
  const normalized = normalizeEvergabeUnterlagenUrl(unterlagenUrl);
  const result = await extractViaParallel(normalized, {
    fullContent: true,
    objective: "Liste aller Vergabeunterlagen mit Dateinamen und Download-Links",
  });
  const markdown = result.fullContent ?? result.excerpts.join("\n");
  const documents = parseEvergabeDocumentLinks(markdown);
  console.log(`[parallel-extract] evergabe Unterlagenseite: ${documents.length} Dokumente gefunden (${normalized.slice(0, 80)})`);
  return { documents, markdown, title: result.title };
};

export interface EvergabeDocumentText {
  text: string;
  title: string | null;
  pageCount: number | null;
}

/** Lädt ein evergabe.de-Dokument (PDF u. a.) und gibt den extrahierten Volltext zurück. */
export const extractEvergabeDocumentText = async (documentUrl: string): Promise<EvergabeDocumentText> => {
  const result = await extractViaParallel(documentUrl, { fullContent: true });
  const text = (result.fullContent ?? result.excerpts.join("\n")).trim();
  if (!text) {
    throw new Error("Parallel Extract lieferte keinen Dokumenttext");
  }
  let pageCount: number | null = null;
  for (const match of text.matchAll(/Seite \d+ von (\d+)/gi)) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) pageCount = parsed;
  }
  return { text, title: result.title, pageCount };
};

const safeFilenameBase = (filename: string | null | undefined, fallback: string): string => {
  const base = (filename ?? "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return base || fallback;
};

/**
 * Speichert den per Parallel extrahierten Dokumenttext als Textdatei im Object Store.
 * Rückgabe kompatibel zu `fetchAndStore` (contentType text/plain), damit die
 * bestehende Dokument-Persistenz und Textparsung unverändert funktionieren.
 */
export const fetchAndStoreEvergabeText = async (
  documentUrl: string,
  relativePath: string,
  options?: { filename?: string | null },
): Promise<StoredObject> => {
  const { text, title } = await extractEvergabeDocumentText(documentUrl);
  const textPath = relativePath.replace(/\.[a-z0-9]{1,5}$/i, "") + ".txt";
  const stored = saveBytes(textPath, Buffer.from(text, "utf8"), "text/plain");
  const originalName = options?.filename ?? null;
  console.log(`[parallel-extract] Dokumenttext gespeichert: ${stored.storagePath} (${text.length} Zeichen)${title ? ` – ${title.slice(0, 80)}` : ""}`);
  return {
    ...stored,
    finalUrl: documentUrl,
    filename: originalName ?? safeFilenameBase(title, safeFilenameBase(null, "evergabe-dokument")),
  };
};

/**
 * `fetchAndStore` mit Parallel-Fallback für evergabe.de:
 * Direkter Fetch schlägt dort mit 403 (nginx, IP-Block) fehl oder liefert die
 * HTML-Fehlerseite – in beiden Fällen wird auf den Parallel-Textextrakt ausgewichen.
 */
export const fetchAndStoreWithParallelFallback = async (
  url: string,
  relativePath: string,
  options?: FetchAndStoreOptions & { parallelFilename?: string | null },
): Promise<StoredObject> => {
  if (!isEvergabeUrl(url)) {
    return fetchAndStore(url, relativePath, options);
  }
  try {
    const stored = await fetchAndStore(url, relativePath, options);
    if (!isHtmlContentType(stored.contentType)) {
      return stored;
    }
    console.log(`[parallel-extract] evergabe lieferte HTML statt Dokument, weiche auf Parallel-Extract aus: ${url.slice(0, 100)}`);
  } catch (error) {
    console.log(`[parallel-extract] Direkter evergabe-Download fehlgeschlagen (${error instanceof Error ? error.message : "unbekannt"}), weiche auf Parallel-Extract aus: ${url.slice(0, 100)}`);
  }
  return fetchAndStoreEvergabeText(url, relativePath, { filename: options?.parallelFilename ?? null });
};
