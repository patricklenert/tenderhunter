import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluateTenderFit, type MatchProfile } from "@/lib/profile-match";
import { documents, structuredData, tenderResources, tenders } from "@/lib/schema";
import { objectAbsolutePath } from "@/lib/storage";
import { extractTenderCriteria } from "@/lib/tender-criteria";
import { loadTenderCriteriaSources, splitPageMarkedText } from "@/lib/tender-criteria-sources";
import {
  buildTenderDossier,
  isStoredZipDocument,
  RESOURCE_LOAD_LIMIT,
  type DossierZipEntry,
  type TenderDossier,
} from "@/lib/tender-dossier";

const MAX_CHUNK_CHARS = 12_000;
const SUPPORTED_ZIP_EXTENSIONS = new Set([".pdf", ".xlsx", ".xls", ".html", ".htm", ".txt", ".csv", ".docx", ".doc"]);

export interface DocumentTextChunk {
  documentId: number;
  filename: string | null;
  page: number | null;
  offset: number;
  limit: number;
  totalChars: number;
  pagesAvailable: number[];
  text: string;
  nextOffset: number | null;
  note: string | null;
}

type ZipArchive = new (file: string) => {
  getEntries: () => Array<{ entryName: string; isDirectory: boolean; header: { size: number } }>;
};

const listZipEntries = (storagePath: string): DossierZipEntry[] | null => {
  const localPath = objectAbsolutePath(storagePath);
  if (!fs.existsSync(localPath)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AdmZip: ZipArchive = require("adm-zip");
    const archive = new AdmZip(localPath);
    return archive
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .map((entry) => ({
        name: entry.entryName,
        size: entry.header.size,
        supported: SUPPORTED_ZIP_EXTENSIONS.has(path.extname(entry.entryName).toLowerCase()),
      }));
  } catch {
    return null;
  }
};

export const loadTenderDossier = async (
  tenderId: number,
  options?: { profile?: MatchProfile | null; now?: Date },
): Promise<TenderDossier | null> => {
  const now = options?.now ?? new Date();
  const [tender] = await db.select().from(tenders).where(eq(tenders.id, tenderId)).limit(1);
  if (!tender) return null;

  const [documentRows, resourceRows, structuredRows, criteriaSources] = await Promise.all([
    db.select().from(documents).where(eq(documents.tenderId, tenderId)).orderBy(documents.id),
    db
      .select()
      .from(tenderResources)
      .where(eq(tenderResources.tenderId, tenderId))
      .orderBy(tenderResources.id)
      .limit(RESOURCE_LOAD_LIMIT),
    db.select({ jsonBlob: structuredData.jsonBlob }).from(structuredData).where(eq(structuredData.tenderId, tenderId)).limit(1),
    loadTenderCriteriaSources(tenderId),
  ]);

  const criteria = extractTenderCriteria(criteriaSources);
  const match = options?.profile ? evaluateTenderFit(criteria, options.profile, now) : null;

  const zipEntries = new Map<number, DossierZipEntry[] | null>();
  for (const doc of documentRows) {
    if (isStoredZipDocument(doc)) zipEntries.set(doc.id, listZipEntries(doc.storagePath));
  }

  return buildTenderDossier({
    tender,
    documents: documentRows.map((doc) => ({ ...doc, zipEntries: zipEntries.get(doc.id) })),
    resources: resourceRows,
    structured: structuredRows[0]?.jsonBlob ?? null,
    criteria,
    match,
    now,
  });
};

export const loadTenderDocumentText = async (
  documentId: number,
  options?: { page?: number | null; offset?: number; limit?: number },
): Promise<DocumentTextChunk | null> => {
  const [doc] = await db
    .select({ id: documents.id, filename: documents.filename, extractedText: documents.extractedText })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) return null;

  const fullText = doc.extractedText ?? "";
  const segments = splitPageMarkedText(fullText);
  const pagesAvailable = segments.flatMap((segment) => (segment.page === null ? [] : [segment.page]));
  const page = options?.page ?? null;
  let scope = fullText;
  let note: string | null = null;
  if (page !== null) {
    const segment = segments.find((item) => item.page === page);
    scope = segment?.text ?? "";
    if (!segment) note = pagesAvailable.length === 0 ? "Dokument ohne Seitenmarker: Seitenangabe nicht verfügbar" : `Seite ${page} nicht vorhanden`;
  }

  const limit = Math.min(Math.max(1, options?.limit ?? MAX_CHUNK_CHARS), MAX_CHUNK_CHARS);
  const offset = Math.max(0, options?.offset ?? 0);
  return {
    documentId: doc.id,
    filename: doc.filename,
    page,
    offset,
    limit,
    totalChars: scope.length,
    pagesAvailable,
    text: scope.slice(offset, offset + limit),
    nextOffset: offset + limit < scope.length ? offset + limit : null,
    note,
  };
};
