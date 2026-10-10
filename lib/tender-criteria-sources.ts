import { and, eq, sql } from "drizzle-orm";
import { documents, tenders } from "@/lib/schema";
import type { CriteriaSource } from "@/lib/tender-criteria";

export const MAX_SOURCE_TEXT_CHARS = 400_000;

const MIN_DOCUMENT_TEXT_CHARS = 20;
const PAGE_MARKER = /\[Seite\s+(\d+)\]/g;
const DOCUMENT_SECTION_START = /(?:^|\n)(?:\[Dokument\]\n|\[ROLLEN:|\[Evergabe-Dokument\]\n)/;

export const splitPageMarkedText = (text: string): Array<{ page: number | null; text: string }> => {
  const markers = [...text.matchAll(PAGE_MARKER)];
  if (markers.length === 0) return [{ page: null, text: text.trim() }];

  const segments: Array<{ page: number | null; text: string }> = [];
  const leading = text.slice(0, markers[0].index).trim();
  if (leading) segments.push({ page: null, text: leading });
  markers.forEach((marker, index) => {
    const start = marker.index + marker[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index : text.length;
    segments.push({ page: Number(marker[1]), text: text.slice(start, end).trim() });
  });
  return segments;
};

// tenders.rawText holds document sections too (often starting with the bekanntmachung document); those are read from documents.
export const extractNoticeText = (rawText: string | null | undefined): string => {
  const text = rawText ?? "";
  const section = DOCUMENT_SECTION_START.exec(text);
  return (section ? text.slice(0, section.index) : text).trim();
};

const capAtLineBreak = (text: string): string => {
  if (text.length <= MAX_SOURCE_TEXT_CHARS) return text;
  const lineBreak = text.lastIndexOf("\n", MAX_SOURCE_TEXT_CHARS);
  return text.slice(0, lineBreak > 0 ? lineBreak : MAX_SOURCE_TEXT_CHARS);
};

const sourcesFromText = (
  text: string,
  origin: CriteriaSource["origin"],
  documentId: number | null,
  filename: string | null,
): CriteriaSource[] =>
  splitPageMarkedText(capAtLineBreak(text))
    .filter((segment) => segment.text.length > 0)
    .map((segment) => ({ documentId, filename, origin, page: segment.page, text: segment.text }));

export const loadTenderCriteriaSources = async (tenderId: number): Promise<CriteriaSource[]> => {
  // Loaded lazily so the pure helpers above can be imported without opening a database connection.
  const { db } = await import("@/lib/db");
  const [tender] = await db
    .select({ rawText: tenders.rawText })
    .from(tenders)
    .where(eq(tenders.id, tenderId))
    .limit(1);
  const rows = await db
    .select({ id: documents.id, filename: documents.filename, extractedText: documents.extractedText })
    .from(documents)
    .where(and(eq(documents.tenderId, tenderId), sql`length(${documents.extractedText}) >= ${MIN_DOCUMENT_TEXT_CHARS}`))
    .orderBy(documents.id);

  return [
    ...sourcesFromText(extractNoticeText(tender?.rawText), "notice", null, null),
    ...rows.flatMap((row) => sourcesFromText(row.extractedText ?? "", "document", row.id, row.filename)),
  ];
};
