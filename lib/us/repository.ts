import { and, desc, eq, gt, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { usDocuments, usTenders, type UsTender } from "@/lib/schema";
import { parseStringArray } from "@/lib/us/types";

const toMetadata = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export interface UsTenderSearchParams {
  query?: string;
  state?: string;
  source?: string;
  category?: string;
  subcontracting?: boolean;
  limit?: number;
  page?: number;
}

export const getUsTenderMetadata = (tender: UsTender): Record<string, unknown> => toMetadata(tender.metadataJson);

export const isActiveUsTender = (tender: UsTender): boolean =>
  tender.qualityStatus === "qualified" && (!tender.deadlineAt || tender.deadlineAt.getTime() > Date.now());

export const serializeUsTender = (tender: UsTender, includeDescription = false) => {
  const metadata = getUsTenderMetadata(tender);
  return {
    id: tender.id,
    title: tender.title,
    source: tender.source,
    sourceUrl: tender.url,
    buyer: tender.buyer,
    location: tender.location,
    state: tender.state,
    solicitationNumber: tender.solicitationNumber,
    naicsCodes: parseStringArray(tender.naicsCodesJson),
    pscCodes: parseStringArray(tender.pscCodesJson),
    setAside: tender.setAside,
    contractType: tender.contractType,
    category: tender.category,
    currency: tender.currency,
    deadlineISO: tender.deadlineAt?.toISOString() ?? null,
    deadline: tender.deadlineAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(tender.deadlineAt) : null,
    postedAt: typeof metadata.posted_at === "string" ? metadata.posted_at : null,
    contacts: Array.isArray(metadata.contacts) ? metadata.contacts : [],
    attachments: Array.isArray(metadata.attachments) ? metadata.attachments : [],
    subcontracting: metadata.subcontracting === true,
    ...(includeDescription ? { description: tender.description ?? "", metadata } : {}),
  };
};

export async function searchUsTenders(params: UsTenderSearchParams): Promise<{ items: UsTender[]; total: number }> {
  const query = params.query?.trim() ?? "";
  const state = params.state?.trim().toUpperCase() ?? "";
  const source = params.source?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const subcontracting = params.subcontracting;
  const limit = Math.min(Math.max(params.limit ?? 24, 1), 50);
  const page = Math.max(params.page ?? 1, 1);
  const conditions = [eq(usTenders.qualityStatus, "qualified"), or(isNull(usTenders.deadlineAt), gt(usTenders.deadlineAt, new Date()))];

  if (state) conditions.push(eq(usTenders.state, state));
  if (source) conditions.push(eq(usTenders.source, source));
  if (category) conditions.push(eq(usTenders.category, category));
  if (subcontracting === true) conditions.push(sql `${usTenders.metadataJson}->>'subcontracting' = 'true'`);
  if (subcontracting === false) conditions.push(sql `(${usTenders.metadataJson}->>'subcontracting' IS NULL OR ${usTenders.metadataJson}->>'subcontracting' != 'true')`);
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(ilike(usTenders.title, pattern), ilike(usTenders.description, pattern), ilike(usTenders.buyer, pattern)));
  }
  const where = and(...conditions);
  const [items, count] = await Promise.all([
    db.select().from(usTenders).where(where).orderBy(desc(usTenders.deadlineAt), desc(usTenders.createdAt)).limit(limit).offset((page - 1) * limit),
    db.select({ value: sql<number>`count(*)` }).from(usTenders).where(where),
  ]);
  return { items, total: Number(count[0]?.value ?? 0) };
}

export async function getUsTenderById(id: number): Promise<UsTender | null> {
  const rows = await db.select().from(usTenders).where(eq(usTenders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUsTenderDocuments(usTenderId: number) {
  const rows = await db
    .select({
      id: usDocuments.id,
      url: usDocuments.url,
      filename: usDocuments.filename,
      contentType: usDocuments.contentType,
      downloadStatus: usDocuments.downloadStatus,
      parseStatus: usDocuments.parseStatus,
      errorMessage: usDocuments.errorMessage,
      pageCount: usDocuments.pageCount,
      role: usDocuments.role,
      roleConfidence: usDocuments.roleConfidence,
      extractedText: usDocuments.extractedText,
      updatedAt: usDocuments.updatedAt,
    })
    .from(usDocuments)
    .where(eq(usDocuments.usTenderId, usTenderId))
    .orderBy(desc(usDocuments.updatedAt), usDocuments.id);

  return rows.map(({ extractedText, ...document }) => ({
    ...document,
    textPreview: extractedText?.slice(0, 5_000) ?? null,
  }));
}
