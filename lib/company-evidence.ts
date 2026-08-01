import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { and, asc, eq, exists, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { companyEvidence, companyEvidenceEvents, companyEvidenceFiles, companyProfiles, userCompanies } from "@/lib/schema";
import { objectAbsolutePath, saveBytes } from "@/lib/storage";
import { ALLOWED_EVIDENCE_TYPES, EVIDENCE_MAX_FILE_BYTES, evidenceUsable, evidenceValidity } from "@/lib/evidence-types";

export class CompanyEvidenceError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "CompanyEvidenceError";
  }
}

const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;
const safeFilename = (value: string): string => {
  const normalized = value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 160);
  return normalized || "nachweis";
};
const membership = (userId: string, companyId: number) => db.select({ id: userCompanies.id }).from(userCompanies)
  .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)));

const assertMembership = async (userId: string, companyId: number): Promise<void> => {
  const rows = await membership(userId, companyId);
  if (!rows[0]) throw new CompanyEvidenceError("Kein Zugriff auf dieses Unternehmen.", 404, "COMPANY_NOT_FOUND");
};

const fileMap = (file: typeof companyEvidenceFiles.$inferSelect) => ({
  id: file.id,
  filename: file.originalFilename,
  contentType: file.contentType,
  sizeBytes: file.sizeBytes,
  sha256: file.sha256,
  uploadStatus: file.uploadStatus,
  scanStatus: file.scanStatus,
  uploadedBy: file.uploadedByUserId,
  uploadedAt: file.uploadedAt.toISOString(),
});

const mapEvidence = (
  item: typeof companyEvidence.$inferSelect,
  files: Array<typeof companyEvidenceFiles.$inferSelect> = [],
  now = new Date(),
) => {
  const validityStatus = evidenceValidity(item.expiresAt, now);
  const cleanFile = files.some((file) => file.uploadStatus === "available" && file.scanStatus === "clean" && !file.deletedAt);
  return {
    id: item.id,
    companyId: item.companyId,
    evidenceType: item.evidenceType,
    title: item.title,
    description: item.description,
    issuer: item.issuer,
    issuedAt: toIso(item.issuedAt),
    expiresAt: toIso(item.expiresAt),
    sourceUrl: item.sourceUrl,
    tags: Array.isArray(item.tagsJson) ? item.tagsJson : [],
    status: item.status,
    sourceType: item.sourceType,
    verificationStatus: item.verificationStatus,
    verificationNote: item.verificationNote,
    verifiedAt: toIso(item.verifiedAt),
    validityStatus,
    usable: evidenceUsable(item.verificationStatus, validityStatus, cleanFile, item.sourceUrl),
    files: files.filter((file) => !file.deletedAt).map(fileMap),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
};

const getFiles = async (evidenceId: number) => db.select().from(companyEvidenceFiles)
  .where(and(eq(companyEvidenceFiles.evidenceId, evidenceId), isNull(companyEvidenceFiles.deletedAt)))
  .orderBy(asc(companyEvidenceFiles.createdAt));

const ensureProfileEvidence = async (companyId: number): Promise<void> => {
  const profile = await db.select({ capabilities: companyProfiles.capabilitiesJson, certifications: companyProfiles.certificationsJson })
    .from(companyProfiles).where(eq(companyProfiles.id, companyId)).limit(1);
  if (!profile[0]) return;
  const existing = await db.select({ title: companyEvidence.title, evidenceType: companyEvidence.evidenceType })
    .from(companyEvidence).where(and(eq(companyEvidence.companyId, companyId), eq(companyEvidence.sourceType, "profile_seed")));
  const known = new Set(existing.map((item) => `${item.evidenceType}:${item.title.trim().toLowerCase()}`));
  const values = [
    ...((Array.isArray(profile[0].certifications) ? profile[0].certifications : []) as unknown[]).filter((item): item is string => typeof item === "string").map((title) => ({ evidenceType: "certificate", title })),
    ...((Array.isArray(profile[0].capabilities) ? profile[0].capabilities : []) as unknown[]).filter((item): item is string => typeof item === "string").map((title) => ({ evidenceType: "capability", title })),
  ].filter((item) => item.title.trim() && !known.has(`${item.evidenceType}:${item.title.trim().toLowerCase()}`));
  if (values.length > 0) {
    await db.insert(companyEvidence).values(values.map((item) => ({ companyId, evidenceType: item.evidenceType, title: item.title.trim(), sourceType: "profile_seed", createdByUserId: null })));
  }
};

const appendEvent = async (evidenceId: number, actorUserId: string | null, eventType: string, metadata: Record<string, unknown>, fileId?: number) => {
  await db.insert(companyEvidenceEvents).values({
    evidenceId,
    fileId: fileId ?? null,
    actorUserId,
    eventType,
    metadataJson: metadata,
  });
};

export async function listCompanyEvidence(userId: string, companyId: number) {
  await assertMembership(userId, companyId);
  await ensureProfileEvidence(companyId);
  const rows = await db.select().from(companyEvidence)
    .innerJoin(userCompanies, and(eq(userCompanies.companyId, companyEvidence.companyId), eq(userCompanies.userId, userId)))
    .where(and(eq(companyEvidence.companyId, companyId), eq(companyEvidence.status, "active")))
    .orderBy(companyEvidence.title);
  const now = new Date();
  return Promise.all(rows.map(async (row) => mapEvidence(row.company_evidence, await getFiles(row.company_evidence.id), now)));
}

export async function createCompanyEvidence(userId: string, companyId: number, input: {
  evidenceType: string;
  title: string;
  description?: string | null;
  issuer?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
}) {
  await assertMembership(userId, companyId);
  const issuedAt = input.issuedAt ? new Date(input.issuedAt) : null;
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (issuedAt && expiresAt && expiresAt <= issuedAt) {
    throw new CompanyEvidenceError("Das Ablaufdatum muss nach dem Ausstellungsdatum liegen.", 422, "INVALID_EVIDENCE_DATES");
  }
  const rows = await db.insert(companyEvidence).values({
    companyId,
    evidenceType: input.evidenceType,
    title: input.title,
    description: input.description ?? null,
    issuer: input.issuer ?? null,
    issuedAt,
    expiresAt,
    sourceUrl: input.sourceUrl ?? null,
    tagsJson: input.tags ?? [],
    sourceType: input.sourceUrl ? "external_url" : "manual",
    createdByUserId: userId,
  }).returning();
  await appendEvent(rows[0].id, userId, "created", { sourceType: input.sourceUrl ? "external_url" : "manual" });
  return mapEvidence(rows[0]);
}

export async function updateCompanyEvidence(userId: string, companyId: number, evidenceId: number, patch: {
  evidenceType?: string;
  title?: string;
  description?: string | null;
  issuer?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
}) {
  await assertMembership(userId, companyId);
  const current = await db.select().from(companyEvidence).where(and(eq(companyEvidence.id, evidenceId), eq(companyEvidence.companyId, companyId), eq(companyEvidence.status, "active"))).limit(1);
  if (!current[0]) throw new CompanyEvidenceError("Nachweis nicht gefunden.", 404, "EVIDENCE_NOT_FOUND");
  const nextIssued = patch.issuedAt === undefined ? current[0].issuedAt : patch.issuedAt ? new Date(patch.issuedAt) : null;
  const nextExpires = patch.expiresAt === undefined ? current[0].expiresAt : patch.expiresAt ? new Date(patch.expiresAt) : null;
  if (nextIssued && nextExpires && nextExpires <= nextIssued) throw new CompanyEvidenceError("Das Ablaufdatum muss nach dem Ausstellungsdatum liegen.", 422, "INVALID_EVIDENCE_DATES");
  const materialChange = [patch.title, patch.description, patch.issuer, patch.issuedAt, patch.expiresAt, patch.sourceUrl].some((value) => value !== undefined);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.evidenceType !== undefined) updates.evidenceType = patch.evidenceType;
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.issuer !== undefined) updates.issuer = patch.issuer;
  if (patch.issuedAt !== undefined) updates.issuedAt = nextIssued;
  if (patch.expiresAt !== undefined) updates.expiresAt = nextExpires;
  if (patch.sourceUrl !== undefined) { updates.sourceUrl = patch.sourceUrl; updates.sourceType = patch.sourceUrl ? "external_url" : "manual"; }
  if (patch.tags !== undefined) updates.tagsJson = patch.tags;
  if (materialChange) {
    updates.verificationStatus = "unverified";
    updates.verifiedAt = null;
    updates.verifiedByUserId = null;
  }
  const rows = await db.update(companyEvidence).set(updates).where(and(eq(companyEvidence.id, evidenceId), eq(companyEvidence.companyId, companyId), exists(membership(userId, companyId)))).returning();
  if (!rows[0]) throw new CompanyEvidenceError("Nachweis nicht gefunden.", 404, "EVIDENCE_NOT_FOUND");
  await appendEvent(evidenceId, userId, materialChange ? "updated_and_unverified" : "updated", { fields: Object.keys(patch) });
  return mapEvidence(rows[0], await getFiles(evidenceId));
}

export async function archiveCompanyEvidence(userId: string, companyId: number, evidenceId: number) {
  await assertMembership(userId, companyId);
  const rows = await db.update(companyEvidence).set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(companyEvidence.id, evidenceId), eq(companyEvidence.companyId, companyId), eq(companyEvidence.status, "active"))).returning({ id: companyEvidence.id });
  if (!rows[0]) throw new CompanyEvidenceError("Nachweis nicht gefunden.", 404, "EVIDENCE_NOT_FOUND");
  await appendEvent(evidenceId, userId, "archived", {});
}

export const deleteCompanyEvidence = archiveCompanyEvidence;

const validateMagic = (contentType: string, bytes: Buffer, filename: string): boolean => {
  const lower = filename.toLowerCase();
  if (contentType === "application/pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (contentType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/jpeg") return bytes.subarray(0, 2).equals(Buffer.from([255, 216]));
  if (contentType === "text/plain") return !bytes.subarray(0, 4096).includes(0);
  if (contentType.includes("openxml")) return lower.endsWith(ALLOWED_EVIDENCE_TYPES[contentType]) && bytes.subarray(0, 2).toString() === "PK";
  return false;
};

export async function uploadCompanyEvidenceFile(userId: string, companyId: number, evidenceId: number, file: File) {
  await assertMembership(userId, companyId);
  if (!ALLOWED_EVIDENCE_TYPES[file.type]) throw new CompanyEvidenceError("Dateityp nicht unterstützt.", 422, "UNSUPPORTED_FILE_TYPE");
  if (file.size <= 0 || file.size > EVIDENCE_MAX_FILE_BYTES) throw new CompanyEvidenceError("Datei zu groß oder leer.", 422, "FILE_SIZE_INVALID");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !validateMagic(file.type, bytes, file.name)) throw new CompanyEvidenceError("Dateiinhalt passt nicht zum angegebenen Dateityp.", 422, "FILE_SIGNATURE_INVALID");
  const evidence = await db.select({ id: companyEvidence.id }).from(companyEvidence).where(and(eq(companyEvidence.id, evidenceId), eq(companyEvidence.companyId, companyId), eq(companyEvidence.status, "active"))).limit(1);
  if (!evidence[0]) throw new CompanyEvidenceError("Nachweis nicht gefunden.", 404, "EVIDENCE_NOT_FOUND");
  const storagePath = path.posix.join("evidence", String(companyId), String(evidenceId), `${crypto.randomUUID()}-${safeFilename(file.name)}`);
  const stored = saveBytes(storagePath, bytes, file.type);
  try {
    const rows = await db.insert(companyEvidenceFiles).values({
      evidenceId,
      storagePath: stored.storagePath,
      originalFilename: safeFilename(file.name),
      contentType: stored.contentType,
      sizeBytes: bytes.length,
      sha256: stored.sha256,
      uploadStatus: "available",
      scanStatus: "clean",
      uploadedByUserId: userId,
      availableAt: new Date(),
    }).returning();
    await db.update(companyEvidence).set({ sourceType: "upload", updatedAt: new Date() }).where(eq(companyEvidence.id, evidenceId));
    await appendEvent(evidenceId, userId, "file_uploaded", { filename: rows[0].originalFilename, sha256: rows[0].sha256, sizeBytes: rows[0].sizeBytes }, rows[0].id);
    return fileMap(rows[0]);
  } catch (error) {
    await fs.rm(objectAbsolutePath(stored.storagePath), { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function verifyCompanyEvidence(userId: string, companyId: number, evidenceId: number, status: "unverified" | "verified" | "rejected", note?: string | null) {
  await assertMembership(userId, companyId);
  const current = await db.select().from(companyEvidence).where(and(eq(companyEvidence.id, evidenceId), eq(companyEvidence.companyId, companyId), eq(companyEvidence.status, "active"))).limit(1);
  if (!current[0]) throw new CompanyEvidenceError("Nachweis nicht gefunden.", 404, "EVIDENCE_NOT_FOUND");
  const files = await getFiles(evidenceId);
  const validity = evidenceValidity(current[0].expiresAt);
  const cleanFile = files.some((file) => file.uploadStatus === "available" && file.scanStatus === "clean");
  if (status === "verified" && (validity === "expired" || (!cleanFile && !current[0].sourceUrl))) {
    throw new CompanyEvidenceError("Ein Nachweis muss eine gültige Quelle oder eine saubere Datei haben und darf nicht abgelaufen sein.", 422, "EVIDENCE_NOT_VERIFIABLE");
  }
  const rows = await db.update(companyEvidence).set({ verificationStatus: status, verificationNote: note ?? null, verifiedAt: status === "verified" ? new Date() : null, verifiedByUserId: status === "verified" ? userId : null, updatedAt: new Date() }).where(and(eq(companyEvidence.id, evidenceId), eq(companyEvidence.companyId, companyId))).returning();
  await appendEvent(evidenceId, userId, `verification_${status}`, { note: note ?? null });
  return mapEvidence(rows[0], files);
}

export async function deleteCompanyEvidenceFile(userId: string, companyId: number, evidenceId: number, fileId: number) {
  await assertMembership(userId, companyId);
  const rows = await db.select({ file: companyEvidenceFiles }).from(companyEvidenceFiles)
    .innerJoin(companyEvidence, eq(companyEvidence.id, companyEvidenceFiles.evidenceId))
    .where(and(eq(companyEvidenceFiles.id, fileId), eq(companyEvidenceFiles.evidenceId, evidenceId), eq(companyEvidence.companyId, companyId), isNull(companyEvidenceFiles.deletedAt))).limit(1);
  if (!rows[0]) throw new CompanyEvidenceError("Datei nicht gefunden.", 404, "FILE_NOT_FOUND");
  await db.update(companyEvidenceFiles).set({ deletedAt: new Date(), uploadStatus: "deleted", updatedAt: new Date() }).where(eq(companyEvidenceFiles.id, fileId));
  await fs.rm(objectAbsolutePath(rows[0].file.storagePath), { force: true }).catch(() => undefined);
  await appendEvent(evidenceId, userId, "file_deleted", { fileId }, fileId);
}

export async function getCompanyEvidenceFile(userId: string, companyId: number, evidenceId: number, fileId: number) {
  await assertMembership(userId, companyId);
  const rows = await db.select({ file: companyEvidenceFiles }).from(companyEvidenceFiles)
    .innerJoin(companyEvidence, eq(companyEvidence.id, companyEvidenceFiles.evidenceId))
    .where(and(eq(companyEvidenceFiles.id, fileId), eq(companyEvidenceFiles.evidenceId, evidenceId), eq(companyEvidence.companyId, companyId), eq(companyEvidenceFiles.uploadStatus, "available"), eq(companyEvidenceFiles.scanStatus, "clean"), isNull(companyEvidenceFiles.deletedAt))).limit(1);
  if (!rows[0]) throw new CompanyEvidenceError("Datei nicht gefunden.", 404, "FILE_NOT_FOUND");
  const absolutePath = objectAbsolutePath(rows[0].file.storagePath);
  try { await fs.access(absolutePath); } catch { throw new CompanyEvidenceError("Datei ist nicht verfügbar.", 404, "FILE_NOT_FOUND"); }
  return { path: absolutePath, filename: rows[0].file.originalFilename, contentType: rows[0].file.contentType, sizeBytes: rows[0].file.sizeBytes };
}
