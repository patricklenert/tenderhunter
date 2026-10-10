import type { CriteriaResult } from "@/lib/tender-criteria";
import type { TenderMatchResult } from "@/lib/profile-match";
import { extractNoticeText, MAX_SOURCE_TEXT_CHARS, splitPageMarkedText } from "@/lib/tender-criteria-sources";

export const RESOURCE_LOAD_LIMIT = 200;

const MAX_STATUS_DETAIL_CHARS = 200;
const MAX_RESOURCE_ITEMS = 50;
const MAX_CHANGE_NOTICES = 25;
const QUOTE_CONTEXT_CHARS = 170;
const PAGE_MARKER_PRESENT = /\[Seite\s+\d+\]/;
const DEADLINE_PATTERN = /(?:Angebotsfrist|Teilnahmefrist|Bewerbungsfrist|Abgabefrist|Eingangsfrist)[^\n]{0,120}?(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[^\n]{0,40}?(\d{1,2}:\d{2}))?/i;
const LOT_PATTERN = /\bLos(?:e)?\s+\d+|\bLosen\b|\bLose\b|Losaufteilung|Teillos/i;
const CHANGE_NOTICE_PATTERNS: ReadonlyArray<{ type: ChangeNoticeType; pattern: RegExp }> = [
  { type: "berichtigung", pattern: /Berichtigung|Änderungsbekanntmachung|Änderungsmitteilung/gi },
  { type: "aufhebung", pattern: /Aufhebung|aufgehoben|Verfahren wurde beendet/gi },
  { type: "vergabe", pattern: /Zuschlag erteilt|Vergabe(?:bekanntmachung)? erfolgt|Auftrag wurde vergeben|bereits vergeben/gi },
];

export type RetrievalStatus =
  | "erfolgreich"
  | "leer"
  | "parsen_ausstehend"
  | "parsen_fehlgeschlagen"
  | "download_fehlgeschlagen"
  | "uebersprungen"
  | "blockiert"
  | "anmeldung_noetig"
  | "berechtigung_fehlt"
  | "link_abgelaufen"
  | "nicht_gefunden"
  | "ocr_fehlgeschlagen"
  | "unbekannt";

export type ChangeNoticeType = "berichtigung" | "aufhebung" | "vergabe";

export interface DossierZipEntry {
  name: string;
  size: number;
  supported: boolean;
}

export interface DossierTenderInput {
  id: number;
  title: string | null;
  source: string;
  url: string;
  externalId: string | null;
  rawText: string | null;
  deadlineAt: Date | null;
  qualityStatus: string;
  readinessStatus: string;
  readinessReason: string | null;
  contractValueMin: number | null;
  contractValueMax: number | null;
  contractDurationMonths: number | null;
  procedureType: string | null;
  version: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface DossierDocumentInput {
  id: number;
  filename: string | null;
  url: string | null;
  sha256: string;
  contentType: string | null;
  extractedText: string | null;
  downloadStatus: string | null;
  parseStatus: string | null;
  errorMessage: string | null;
  pageCount: number | null;
  role: string | null;
  roles: string[] | null;
  updatedAt: Date;
  /** Omitted when the archive was not listed; null when the stored archive could not be read. */
  zipEntries?: DossierZipEntry[] | null;
}

export interface DossierResourceInput {
  url: string;
  label: string;
  resourceType: string;
  status: string;
  errorMessage: string | null;
  sourcePageUrl: string | null;
  attempts: number;
}

export interface DossierBuildInput {
  tender: DossierTenderInput;
  documents: DossierDocumentInput[];
  resources: DossierResourceInput[];
  /** structured_data.json_blob, or null when no structured data exists. */
  structured: unknown;
  criteria: CriteriaResult;
  match: TenderMatchResult | null;
  now: Date;
}

export interface DossierDeadline {
  iso: string | null;
  originalText: string | null;
  timezoneAssumed: "Europe/Berlin" | null;
  timezoneNote: string | null;
}

export interface DossierDocument {
  documentId: number;
  filename: string | null;
  role: string | null;
  roles: string[] | null;
  contentType: string | null;
  url: string | null;
  sha256: string;
  status: RetrievalStatus;
  statusDetail: string;
  pageCount: number | null;
  pagesDetected: boolean;
  textChars: number;
  updatedAt: string;
  zipEntries?: DossierZipEntry[] | null;
}

export interface DossierResource {
  url: string;
  label: string;
  resourceType: string;
  status: string;
  errorMessage: string | null;
  sourcePageUrl: string | null;
  attempts: number;
}

export interface DossierChangeNotice {
  type: ChangeNoticeType;
  quote: string;
  source: { documentId: number | null; filename: string | null; page: number | null };
}

export interface TenderDossier {
  retrievedAt: string;
  tender: {
    id: number;
    title: string | null;
    source: string;
    sourceUrl: string;
    externalId: string | null;
    status: {
      qualityStatus: string;
      readinessStatus: string;
      readinessReason: string | null;
      opportunityStatus: OpportunityStatus;
      opportunityBasis: string;
    };
    deadline: DossierDeadline;
    contract: {
      valueMin: number | null;
      valueMax: number | null;
      currency: "EUR";
      durationMonths: number | null;
      procedureType: string | null;
    };
    cpvCodes: string[];
    lots: { mentioned: boolean; quote: string | null };
    version: number;
    firstSeenAt: string;
    lastSeenAt: string;
  };
  documents: DossierDocument[];
  resources: { total: number; byStatus: Record<string, number>; items: DossierResource[] };
  access: { blocked: boolean; notes: string[] };
  changeNotices: DossierChangeNotice[];
  criteria: CriteriaResult;
  match: TenderMatchResult | null;
  limitations: string[];
}

const STATUS_REASONS: Record<RetrievalStatus, string> = {
  erfolgreich: "Text extrahiert.",
  leer: "Kein auswertbarer Text im Dokument.",
  parsen_ausstehend: "Textextraktion steht noch aus.",
  parsen_fehlgeschlagen: "Textextraktion fehlgeschlagen.",
  download_fehlgeschlagen: "Download fehlgeschlagen.",
  uebersprungen: "Absichtlich übersprungen.",
  blockiert: "Abruf vom Portal blockiert.",
  anmeldung_noetig: "Portal verlangt eine Anmeldung.",
  berechtigung_fehlt: "Zugriff verweigert, Berechtigung fehlt.",
  link_abgelaufen: "Download-Link abgelaufen oder ungültig signiert.",
  nicht_gefunden: "Dokument auf dem Portal nicht gefunden.",
  ocr_fehlgeschlagen: "OCR-Texterkennung fehlgeschlagen.",
  unbekannt: "Status nicht eindeutig zuordenbar.",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pad = (value: number): string => String(value).padStart(2, "0");

const failureStatus = (errorMessage: string | null): RetrievalStatus | null => {
  if (!errorMessage) return null;
  if (/\b404\b|not found|nicht gefunden/i.test(errorMessage)) return "nicht_gefunden";
  if (/\b401\b|login|anmeld|unauthori[sz]ed/i.test(errorMessage)) return "anmeldung_noetig";
  if (/\b403\b|forbidden|berechtigung|access denied/i.test(errorMessage)) return "berechtigung_fehlt";
  if (/\b410\b|expired|abgelaufen|signature|signatur/i.test(errorMessage)) return "link_abgelaufen";
  if (/zugriffsblockierte seite/i.test(errorMessage)) return "blockiert";
  return null;
};

export const mapRetrievalStatus = (doc: {
  downloadStatus: string | null;
  parseStatus: string | null;
  errorMessage: string | null;
}): RetrievalStatus => {
  if (doc.downloadStatus === "blocked") {
    const reason = failureStatus(doc.errorMessage);
    return reason === "anmeldung_noetig" || reason === "berechtigung_fehlt" ? reason : "blockiert";
  }
  if (doc.downloadStatus === "failed") return failureStatus(doc.errorMessage) ?? "download_fehlgeschlagen";
  if (doc.downloadStatus === "skipped") return "uebersprungen";
  if (doc.parseStatus === "failed") {
    return /\bocr\b/i.test(doc.errorMessage ?? "") ? "ocr_fehlgeschlagen" : "parsen_fehlgeschlagen";
  }
  if (doc.parseStatus === "empty") return "leer";
  if (doc.parseStatus === "pending") return "parsen_ausstehend";
  if (doc.parseStatus === "parsed") return "erfolgreich";
  return "unbekannt";
};

export const isStoredZipDocument = (doc: {
  downloadStatus: string | null;
  contentType: string | null;
  filename: string | null;
}): boolean =>
  doc.downloadStatus === "downloaded" && (/zip/i.test(doc.contentType ?? "") || /\.zip$/i.test(doc.filename ?? ""));

const isoDateTime = (day: string, month: string, year: string, time: string | undefined): string | null => {
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  const probe = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (probe.getUTCFullYear() !== yearNumber || probe.getUTCMonth() !== monthNumber - 1 || probe.getUTCDate() !== dayNumber) {
    return null;
  }
  const date = `${yearNumber}-${pad(monthNumber)}-${pad(dayNumber)}`;
  if (!time) return date;
  const [hours, minutes] = time.split(":").map(Number);
  return hours <= 23 && minutes <= 59 ? `${date}T${pad(hours)}:${pad(minutes)}` : date;
};

const lastSentenceBreakEnd = (value: string): number => {
  let end = 0;
  for (const match of value.matchAll(/[.!?]\s|\n/g)) end = match.index + match[0].length;
  return end;
};

const quoteAround = (text: string, index: number, length: number): string => {
  const end = index + length;
  const windowStart = Math.max(0, index - QUOTE_CONTEXT_CHARS);
  const windowEnd = Math.min(text.length, end + QUOTE_CONTEXT_CHARS);
  const sentenceStart = windowStart + lastSentenceBreakEnd(text.slice(windowStart, index));
  const stop = /[.!?](?=\s)|\n/.exec(text.slice(end, windowEnd));
  const sentenceEnd = stop ? end + stop.index + (stop[0] === "\n" ? 0 : 1) : windowEnd;
  return text.slice(sentenceStart, sentenceEnd).trim();
};

const findChangeNotices = (text: string): Array<{ type: ChangeNoticeType; quote: string }> =>
  CHANGE_NOTICE_PATTERNS.flatMap(({ type, pattern }) =>
    [...text.matchAll(pattern)].map((match) => ({ type, index: match.index, length: match[0].length })),
  )
    .sort((a, b) => a.index - b.index)
    .map(({ type, index, length }) => ({ type, quote: quoteAround(text, index, length) }));

const buildChangeNotices = (
  tender: DossierTenderInput,
  documentInputs: DossierDocumentInput[],
): { notices: DossierChangeNotice[]; truncated: boolean } => {
  const notices: DossierChangeNotice[] = [];
  const seen = new Set<string>();
  let truncated = false;
  const collect = (text: string, source: DossierChangeNotice["source"]): void => {
    for (const hit of findChangeNotices(text)) {
      const key = JSON.stringify([hit.type, hit.quote]);
      if (seen.has(key)) continue;
      if (notices.length === MAX_CHANGE_NOTICES) {
        truncated = true;
        return;
      }
      seen.add(key);
      notices.push({ type: hit.type, quote: hit.quote, source });
    }
  };

  collect(extractNoticeText(tender.rawText), { documentId: null, filename: null, page: null });
  for (const doc of documentInputs) {
    for (const segment of splitPageMarkedText(doc.extractedText ?? "")) {
      collect(segment.text, { documentId: doc.id, filename: doc.filename, page: segment.page });
    }
  }
  return { notices, truncated };
};

const buildDeadline = (rawText: string | null, deadlineAt: Date | null): DossierDeadline => {
  const match = DEADLINE_PATTERN.exec(rawText ?? "");
  const iso = match ? isoDateTime(match[1], match[2], match[3], match[4]) : null;
  if (match && iso) {
    return {
      iso,
      originalText: match[0],
      timezoneAssumed: "Europe/Berlin",
      timezoneNote: "angenommen: deutsche Vergabestelle, nicht aus der Quelle",
    };
  }
  if (deadlineAt) {
    return { iso: deadlineAt.toISOString(), originalText: null, timezoneAssumed: null, timezoneNote: "UTC aus Datenbank" };
  }
  return { iso: null, originalText: null, timezoneAssumed: null, timezoneNote: null };
};

const buildLots = (rawText: string | null): TenderDossier["tender"]["lots"] => {
  const text = rawText ?? "";
  const match = LOT_PATTERN.exec(text);
  return match
    ? { mentioned: true, quote: quoteAround(text, match.index, match[0].length) }
    : { mentioned: false, quote: null };
};

const cpvCodesOf = (structured: unknown): string[] => {
  const procurement = isRecord(structured) ? structured.procurement : undefined;
  const codes = isRecord(procurement) ? procurement.cpv_codes : undefined;
  return Array.isArray(codes) ? codes.filter((code): code is string => typeof code === "string") : [];
};

// Storage errors carry server paths; the reader only needs to know the file is missing.
const statusDetailOf = (errorMessage: string | null, status: RetrievalStatus): string => {
  if (status === "erfolgreich" || !errorMessage) return STATUS_REASONS[status];
  if (/ENOENT/.test(errorMessage)) return "Datei nicht im Speicher vorhanden.";
  return errorMessage.slice(0, MAX_STATUS_DETAIL_CHARS);
};

const buildDocument = (doc: DossierDocumentInput): DossierDocument => {
  const status = mapRetrievalStatus(doc);
  const text = doc.extractedText ?? "";
  return {
    documentId: doc.id,
    filename: doc.filename,
    role: doc.role,
    roles: doc.roles,
    contentType: doc.contentType,
    url: doc.url,
    sha256: doc.sha256,
    status,
    statusDetail: statusDetailOf(doc.errorMessage, status),
    pageCount: doc.pageCount,
    pagesDetected: PAGE_MARKER_PRESENT.test(text),
    textChars: text.length,
    updatedAt: doc.updatedAt.toISOString(),
    zipEntries: doc.zipEntries,
  };
};

const buildResources = (resources: DossierResourceInput[]): TenderDossier["resources"] => {
  const byStatus: Record<string, number> = {};
  for (const resource of resources) byStatus[resource.status] = (byStatus[resource.status] ?? 0) + 1;
  return {
    total: resources.length,
    byStatus,
    items: resources.slice(0, MAX_RESOURCE_ITEMS).map((resource) => ({
      url: resource.url,
      label: resource.label,
      resourceType: resource.resourceType,
      status: resource.status,
      errorMessage: resource.errorMessage?.slice(0, MAX_STATUS_DETAIL_CHARS) ?? null,
      sourcePageUrl: resource.sourcePageUrl,
      attempts: resource.attempts,
    })),
  };
};

const accessNote = (status: RetrievalStatus, label: string): string | null => {
  if (status === "anmeldung_noetig") return `Anmeldung nötig laut Abruf von ${label}`;
  if (status === "berechtigung_fehlt") return `Berechtigung fehlt laut Abruf von ${label}`;
  if (status === "blockiert") return `Abruf blockiert: ${label}`;
  return null;
};

const buildAccess = (
  tender: DossierTenderInput,
  documents: DossierDocument[],
  resources: DossierResourceInput[],
): TenderDossier["access"] => {
  const notes: string[] = [];
  if (tender.readinessStatus === "blocked") notes.push(tender.readinessReason ?? "Bereitschaft ist blockiert.");
  for (const doc of documents) {
    const note = accessNote(doc.status, doc.filename ?? `Dokument ${doc.documentId}`);
    if (note) notes.push(note);
  }
  for (const resource of resources) {
    const reason = resource.status === "failed" ? failureStatus(resource.errorMessage) : null;
    const note = reason ? accessNote(reason, resource.label || resource.url) : null;
    if (note) notes.push(note);
  }
  return { blocked: notes.length > 0, notes };
};

const buildLimitations = (
  input: DossierBuildInput,
  documents: DossierDocument[],
  changeNoticesTruncated: boolean,
): string[] => {
  const limitations = [
    "Änderungsverlauf nicht gespeichert: nur aktueller Stand und version-Feld.",
    "Seitenangaben nur bei Dokumenten mit [Seite n]-Markern.",
    "Dokumente ohne Status erfolgreich liefern keinen Kriterienbeleg.",
  ];

  const incomplete = documents.filter((doc) => doc.status !== "erfolgreich").length;
  if (documents.length === 0) {
    limitations.push("Keine Dokumente gespeichert; die Prüfung beschränkt sich auf die Bekanntmachung.");
  } else if (incomplete > 0) {
    limitations.push(`${incomplete} von ${documents.length} Dokumenten nicht erfolgreich verarbeitet; ihr Inhalt fehlt in der Prüfung.`);
  }

  const zipDocuments = input.documents.filter(isStoredZipDocument);
  for (const doc of zipDocuments.filter((item) => item.zipEntries === null)) {
    limitations.push(`ZIP-Inhalt nicht lesbar: ${doc.filename ?? `Dokument ${doc.id}`}`);
  }
  const unlisted = zipDocuments.filter((item) => item.zipEntries === undefined).length;
  if (unlisted > 0) limitations.push(`${unlisted} ZIP-Archiv(e) ohne Inhaltsliste; deren Dateien wurden nicht geprüft.`);

  if (input.resources.length >= RESOURCE_LOAD_LIMIT) {
    limitations.push(`Ressourcenliste auf ${RESOURCE_LOAD_LIMIT} Einträge begrenzt; Zählwerte können unvollständig sein.`);
  }
  if (changeNoticesTruncated) limitations.push(`Änderungshinweise auf ${MAX_CHANGE_NOTICES} begrenzt.`);
  if (input.documents.some((doc) => (doc.extractedText?.length ?? 0) > MAX_SOURCE_TEXT_CHARS)) {
    limitations.push(`Kriterienprüfung liest je Dokument nur die ersten ${MAX_SOURCE_TEXT_CHARS} Zeichen.`);
  }
  return limitations;
};

export type OpportunityStatus = "offen" | "aufgehoben" | "vergeben" | "geändert" | "unklar";

export const deriveOpportunityStatus = (
  notices: Array<{ type: string }>,
  deadlineIso: string | null,
  now: Date,
): { status: OpportunityStatus; basis: string } => {
  const has = (type: string): boolean => notices.some((notice) => notice.type === type);
  if (has("aufhebung")) return { status: "aufgehoben", basis: "Aufhebungshinweis im Text (siehe changeNotices)" };
  if (has("vergabe")) return { status: "vergeben", basis: "Vergabehinweis im Text (siehe changeNotices)" };
  if (has("berichtigung")) return { status: "geändert", basis: "Berichtigungshinweis im Text (siehe changeNotices)" };
  if (deadlineIso === null) return { status: "unklar", basis: "Keine Frist erkannt und kein Vergabe- oder Aufhebungshinweis" };
  if (deadlineIso.slice(0, 10) >= now.toISOString().slice(0, 10)) {
    return { status: "offen", basis: `Frist ${deadlineIso.slice(0, 10)} nicht abgelaufen, kein Vergabe- oder Aufhebungshinweis` };
  }
  return { status: "unklar", basis: `Frist ${deadlineIso.slice(0, 10)} abgelaufen, kein Vergabe- oder Aufhebungshinweis im Text` };
};

export const buildTenderDossier = (input: DossierBuildInput): TenderDossier => {
  const { tender } = input;
  const documents = input.documents.map(buildDocument);
  const changeNotices = buildChangeNotices(tender, input.documents);
  const deadline = buildDeadline(tender.rawText, tender.deadlineAt);
  const opportunity = deriveOpportunityStatus(changeNotices.notices, deadline.iso, input.now);

  return {
    retrievedAt: input.now.toISOString(),
    tender: {
      id: tender.id,
      title: tender.title,
      source: tender.source,
      sourceUrl: tender.url,
      externalId: tender.externalId,
      status: {
        qualityStatus: tender.qualityStatus,
        readinessStatus: tender.readinessStatus,
        readinessReason: tender.readinessReason,
        opportunityStatus: opportunity.status,
        opportunityBasis: opportunity.basis,
      },
      deadline,
      contract: {
        valueMin: tender.contractValueMin,
        valueMax: tender.contractValueMax,
        currency: "EUR",
        durationMonths: tender.contractDurationMonths,
        procedureType: tender.procedureType,
      },
      cpvCodes: cpvCodesOf(input.structured),
      lots: buildLots(tender.rawText),
      version: tender.version,
      firstSeenAt: tender.firstSeenAt.toISOString(),
      lastSeenAt: tender.lastSeenAt.toISOString(),
    },
    documents,
    resources: buildResources(input.resources),
    access: buildAccess(tender, documents, input.resources),
    changeNotices: changeNotices.notices,
    criteria: input.criteria,
    match: input.match,
    limitations: buildLimitations(input, documents, changeNotices.truncated),
  };
};
