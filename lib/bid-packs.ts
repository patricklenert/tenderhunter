import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bidPackRequirements,
  bidPackTasks,
  bidPacks,
  companyEvidence,
  companyEvidenceFiles,
  companyProfiles,
  insights,
  scores,
  structuredData,
  tenders,
  trackedTenders,
  requirementEvidenceMatches,
  userCompanies,
} from "@/lib/schema";
import type {
  BidPackDecisionStatus,
  BidPackRequirementStatus,
  BidPackTaskStatus,
} from "@/lib/bid-pack-types";
import type { JsonValue } from "@/lib/types";

export class BidPackError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BidPackError";
  }
}

interface RequirementSeed {
  source: string;
  title: string;
  sourceQuote: string | null;
  isMandatory: boolean;
}

interface BidPackBaseRow {
  id: number;
  trackedTenderId: number;
  decisionStatus: BidPackDecisionStatus;
  decisionNote: string | null;
  snapshotJson: unknown;
  snapshotVersion: number;
  packCreatedAt: Date;
  packUpdatedAt: Date;
  companyId: number;
  companyName: string | null;
  tenderId: number;
  title: string | null;
  source: string | null;
  url: string | null;
  tenderDeadlineAt: Date | null;
  workflowStatus: string;
  workflowDeadlineAt: Date | null;
  fit: number | null;
  winProbability: number | null;
  effort: number | null;
  requirementCoverage: number | null;
  killSwitch: boolean | null;
  scoreDetails: unknown;
  explanation: string | null;
  actions: unknown;
  missingItems: unknown;
  structured: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : String(item ?? "").trim()).filter(Boolean)
    : [];

const normalizedKey = (value: string): string => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const getRequirementSeeds = (structured: unknown, missingItems: unknown): RequirementSeed[] => {
  const structuredRecord = asRecord(structured);
  const decisionRelevant = asRecord(structuredRecord.decision_relevant);
  const procurement = asRecord(structuredRecord.procurement);
  const seeds: RequirementSeed[] = [];
  const seen = new Set<string>();

  const add = (source: string, value: unknown, isMandatory: boolean) => {
    for (const title of stringList(value)) {
      const key = normalizedKey(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      seeds.push({ source, title, sourceQuote: null, isMandatory });
    }
  };

  add("Anforderung", decisionRelevant.requirements, false);
  add("Pflichtunterlage", decisionRelevant.mandatory_documents, true);
  add("Teilnahmevoraussetzung", procurement.participation_requirements, true);
  add("Fehlender Nachweis", missingItems, true);

  return seeds;
};

const getActionTitles = (actions: unknown): string[] => {
  const values = Array.isArray(actions) ? actions : [];
  return values
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const record = asRecord(item);
      return typeof record.title === "string" ? record.title.trim() : "";
    })
    .filter(Boolean);
};

const basePackQuery = (userId: string) =>
  db
    .select({
      id: bidPacks.id,
      trackedTenderId: bidPacks.trackedTenderId,
      decisionStatus: bidPacks.decisionStatus,
      decisionNote: bidPacks.decisionNote,
      snapshotJson: bidPacks.snapshotJson,
      snapshotVersion: bidPacks.snapshotVersion,
      packCreatedAt: bidPacks.createdAt,
      packUpdatedAt: bidPacks.updatedAt,
      companyId: trackedTenders.companyId,
      companyName: companyProfiles.name,
      tenderId: trackedTenders.tenderId,
      title: tenders.title,
      source: tenders.source,
      url: tenders.url,
      tenderDeadlineAt: tenders.deadlineAt,
      workflowStatus: trackedTenders.status,
      workflowDeadlineAt: trackedTenders.deadlineAt,
      fit: scores.fit,
      winProbability: scores.winProbability,
      effort: scores.effort,
      requirementCoverage: scores.requirementCoverage,
      killSwitch: scores.killSwitch,
      scoreDetails: scores.detailsJson,
      explanation: insights.explanation,
      actions: insights.actionsJson,
      missingItems: insights.missingItemsJson,
      structured: structuredData.jsonBlob,
    })
    .from(bidPacks)
    .innerJoin(trackedTenders, eq(trackedTenders.id, bidPacks.trackedTenderId))
    .innerJoin(
      userCompanies,
      and(eq(userCompanies.companyId, trackedTenders.companyId), eq(userCompanies.userId, userId)),
    )
    .leftJoin(companyProfiles, eq(companyProfiles.id, trackedTenders.companyId))
    .leftJoin(tenders, eq(tenders.id, trackedTenders.tenderId))
    .leftJoin(scores, and(eq(scores.tenderId, trackedTenders.tenderId), eq(scores.companyId, trackedTenders.companyId)))
    .leftJoin(insights, and(eq(insights.tenderId, trackedTenders.tenderId), eq(insights.companyId, trackedTenders.companyId)))
    .leftJoin(structuredData, eq(structuredData.tenderId, trackedTenders.tenderId));

const getPackBase = async (userId: string, packId: number): Promise<BidPackBaseRow | null> => {
  const rows = await basePackQuery(userId)
    .where(eq(bidPacks.id, packId))
    .limit(1);

  return rows[0] ?? null;
};

const mapPack = async (base: BidPackBaseRow) => {
  const [requirements, tasks, evidenceMatches] = await Promise.all([
    db
      .select()
      .from(bidPackRequirements)
      .where(eq(bidPackRequirements.bidPackId, base.id))
      .orderBy(asc(bidPackRequirements.sortOrder), asc(bidPackRequirements.id)),
    db
      .select()
      .from(bidPackTasks)
      .where(eq(bidPackTasks.bidPackId, base.id))
      .orderBy(asc(bidPackTasks.sortOrder), asc(bidPackTasks.id)),
    db
      .select({
        requirementId: requirementEvidenceMatches.requirementId,
        evidence: companyEvidence,
        evidenceFile: companyEvidenceFiles,
        evidenceFileId: requirementEvidenceMatches.evidenceFileId,
        evidenceSnapshot: requirementEvidenceMatches.evidenceSnapshotJson,
        matchStatus: requirementEvidenceMatches.matchStatus,
        rationale: requirementEvidenceMatches.rationale,
      })
      .from(requirementEvidenceMatches)
      .innerJoin(companyEvidence, eq(companyEvidence.id, requirementEvidenceMatches.evidenceId))
      .leftJoin(companyEvidenceFiles, eq(companyEvidenceFiles.id, requirementEvidenceMatches.evidenceFileId))
      .innerJoin(bidPackRequirements, eq(bidPackRequirements.id, requirementEvidenceMatches.requirementId))
      .where(eq(bidPackRequirements.bidPackId, base.id)),
  ]);

  const evidenceByRequirement = new Map<number, Array<{
    id: number;
    evidenceType: string;
    title: string;
    description: string | null;
    issuer: string | null;
    expiresAt: string | null;
    status: string;
    matchStatus: string;
    rationale: string | null;
    evidenceFile: { id: number; filename: string; sha256: string } | null;
  }>>();
  for (const match of evidenceMatches) {
    const current = evidenceByRequirement.get(match.requirementId) ?? [];
    current.push({
      id: match.evidence.id,
      evidenceType: match.evidence.evidenceType,
      title: match.evidence.title,
      description: match.evidence.description,
      issuer: match.evidence.issuer,
      expiresAt: toIso(match.evidence.expiresAt),
      status: match.evidence.status,
      matchStatus: match.matchStatus,
      rationale: match.rationale,
      evidenceFile: match.evidenceFile && !match.evidenceFile.deletedAt ? {
        id: match.evidenceFile.id,
        filename: match.evidenceFile.originalFilename,
        sha256: match.evidenceFile.sha256,
      } : null,
    });
    evidenceByRequirement.set(match.requirementId, current);
  }

  const snapshot = asRecord(base.snapshotJson);
  const snapshotTender = asRecord(snapshot.tender);
  const snapshotScore = asRecord(snapshot.score);
  const snapshotInsight = asRecord(snapshot.insight);
  const snapshotStructured = snapshot.structured ?? base.structured;

  return {
    id: base.id,
    trackedTenderId: base.trackedTenderId,
    companyId: base.companyId,
    companyName: base.companyName ?? `Firma #${base.companyId}`,
    tenderId: base.tenderId,
    title: typeof snapshotTender.title === "string" ? snapshotTender.title : base.title ?? `Ausschreibung #${base.tenderId}`,
    source: typeof snapshotTender.source === "string" ? snapshotTender.source : base.source ?? "Unbekannte Quelle",
    url: typeof snapshotTender.url === "string" ? snapshotTender.url : base.url,
    decisionStatus: base.decisionStatus,
    decisionNote: base.decisionNote,
    workflowStatus: base.workflowStatus,
    submissionDeadlineAt: typeof snapshotTender.deadlineAt === "string"
      ? snapshotTender.deadlineAt
      : toIso(base.tenderDeadlineAt ?? base.workflowDeadlineAt),
    createdAt: base.packCreatedAt.toISOString(),
    updatedAt: base.packUpdatedAt.toISOString(),
    analysis: {
      fit: numberOr(snapshotScore.fit, base.fit ?? 0),
      winProbability: numberOr(snapshotScore.winProbability, base.winProbability ?? 0),
      effort: numberOr(snapshotScore.effort, base.effort ?? 0),
      requirementCoverage: numberOr(snapshotScore.requirementCoverage, base.requirementCoverage ?? 0),
      killSwitch: typeof snapshotScore.killSwitch === "boolean" ? snapshotScore.killSwitch : base.killSwitch ?? false,
      details: snapshotScore.details ?? base.scoreDetails,
      explanation: typeof snapshotInsight.explanation === "string" ? snapshotInsight.explanation : base.explanation,
      actions: stringList(snapshotInsight.actions ?? base.actions),
      missingItems: stringList(snapshotInsight.missingItems ?? base.missingItems),
      structured: snapshotStructured,
    },
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      source: requirement.source,
      title: requirement.title,
      sourceQuote: requirement.sourceQuote,
      isMandatory: requirement.isMandatory,
      status: requirement.status,
      sortOrder: requirement.sortOrder,
      createdAt: requirement.createdAt.toISOString(),
      updatedAt: requirement.updatedAt.toISOString(),
      evidence: evidenceByRequirement.get(requirement.id) ?? [],
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      requirementId: task.requirementId,
      source: task.source,
      title: task.title,
      status: task.status,
      assignee: task.assignee,
      dueAt: toIso(task.dueAt),
      sortOrder: task.sortOrder,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    snapshotVersion: base.snapshotVersion,
  };
};

const touchBidPack = async (packId: number) => {
  await db.update(bidPacks).set({ updatedAt: new Date() }).where(eq(bidPacks.id, packId));
};

const getPackOrThrow = async (userId: string, packId: number): Promise<BidPackBaseRow> => {
  const pack = await getPackBase(userId, packId);
  if (!pack) {
    throw new BidPackError("Bid Pack nicht gefunden.", 404, "BID_PACK_NOT_FOUND");
  }
  return pack;
};

export async function getBidPackForUser(userId: string, packId: number) {
  return mapPack(await getPackOrThrow(userId, packId));
}

export async function listBidPacksForUser(userId: string, options: { companyId?: number; trackedTenderId?: number } = {}) {
  const filters = [eq(userCompanies.userId, userId)];
  if (options.companyId !== undefined) filters.push(eq(trackedTenders.companyId, options.companyId));
  if (options.trackedTenderId !== undefined) filters.push(eq(bidPacks.trackedTenderId, options.trackedTenderId));

  const rows = await basePackQuery(userId)
    .where(and(...filters))
    .orderBy(desc(bidPacks.updatedAt));

  return Promise.all(rows.map(mapPack));
}

export async function createBidPack(input: {
  userId: string;
  trackedTenderId: number;
  decisionStatus?: BidPackDecisionStatus;
  decisionNote?: string | null;
}) {
  let packId: number | null = null;

  await db.transaction(async (tx) => {
    const ownedRows = await tx
      .select({
        trackedTenderId: trackedTenders.id,
        companyId: trackedTenders.companyId,
        tenderId: trackedTenders.tenderId,
        workflowStatus: trackedTenders.status,
        workflowDeadlineAt: trackedTenders.deadlineAt,
        title: tenders.title,
        source: tenders.source,
        url: tenders.url,
        tenderDeadlineAt: tenders.deadlineAt,
        structured: structuredData.jsonBlob,
        score: scores,
        insight: insights,
      })
      .from(trackedTenders)
      .innerJoin(
        userCompanies,
        and(eq(userCompanies.companyId, trackedTenders.companyId), eq(userCompanies.userId, input.userId)),
      )
      .leftJoin(tenders, eq(tenders.id, trackedTenders.tenderId))
      .leftJoin(structuredData, eq(structuredData.tenderId, trackedTenders.tenderId))
      .leftJoin(scores, and(eq(scores.tenderId, trackedTenders.tenderId), eq(scores.companyId, trackedTenders.companyId)))
      .leftJoin(insights, and(eq(insights.tenderId, trackedTenders.tenderId), eq(insights.companyId, trackedTenders.companyId)))
      .where(eq(trackedTenders.id, input.trackedTenderId))
      .limit(1);

    const owned = ownedRows[0];
    if (!owned) {
      throw new BidPackError("Kein Zugriff auf diese Ausschreibung.", 404, "TRACKED_TENDER_NOT_FOUND");
    }

    const existing = await tx
      .select({ id: bidPacks.id })
      .from(bidPacks)
      .where(eq(bidPacks.trackedTenderId, input.trackedTenderId))
      .limit(1);
    if (existing[0]) {
      packId = existing[0].id;
      return;
    }

    if (!owned.structured || !owned.score || !owned.insight) {
      throw new BidPackError(
        "Die Ausschreibungsanalyse ist noch nicht vollständig. Bitte warte, bis Struktur, Scoring und nächste Schritte vorliegen.",
        409,
        "BID_PACK_NOT_READY",
      );
    }

    const missingItems = owned.insight.missingItemsJson;
    const requirements = getRequirementSeeds(owned.structured, missingItems);
    const actions = getActionTitles(owned.insight.actionsJson);
    const snapshot = {
      tender: {
        id: owned.tenderId,
        title: owned.title,
        source: owned.source,
        url: owned.url,
        deadlineAt: toIso(owned.tenderDeadlineAt ?? owned.workflowDeadlineAt),
      },
      structured: owned.structured as JsonValue,
      score: {
        fit: owned.score.fit,
        winProbability: owned.score.winProbability,
        effort: owned.score.effort,
        requirementCoverage: owned.score.requirementCoverage,
        killSwitch: owned.score.killSwitch,
        details: owned.score.detailsJson as JsonValue,
      },
      insight: {
        explanation: owned.insight.explanation,
        actions: owned.insight.actionsJson as JsonValue,
        missingItems: owned.insight.missingItemsJson as JsonValue,
      },
    } satisfies JsonValue;

    const inserted = await tx
      .insert(bidPacks)
      .values({
        trackedTenderId: input.trackedTenderId,
        decisionStatus: input.decisionStatus ?? "undecided",
        decisionNote: input.decisionNote ?? null,
        snapshotJson: snapshot,
        snapshotVersion: 1,
      })
      .onConflictDoNothing({ target: bidPacks.trackedTenderId })
      .returning({ id: bidPacks.id });

    packId = inserted[0]?.id ?? null;
    if (!packId) {
      const concurrent = await tx
        .select({ id: bidPacks.id })
        .from(bidPacks)
        .where(eq(bidPacks.trackedTenderId, input.trackedTenderId))
        .limit(1);
      packId = concurrent[0]?.id ?? null;
      return;
    }

    if (requirements.length > 0) {
      await tx.insert(bidPackRequirements).values(
        requirements.map((requirement, index) => ({
          bidPackId: packId as number,
          source: requirement.source,
          title: requirement.title,
          sourceQuote: requirement.sourceQuote,
          isMandatory: requirement.isMandatory,
          sortOrder: index,
        })),
      );
    }

    if (actions.length > 0) {
      await tx.insert(bidPackTasks).values(
        actions.map((title, index) => ({
          bidPackId: packId as number,
          source: "analysis",
          title,
          sortOrder: index,
        })),
      );
    }
  });

  if (!packId) {
    throw new BidPackError("Bid Pack konnte nicht angelegt werden.", 500, "BID_PACK_CREATE_FAILED");
  }

  return getBidPackForUser(input.userId, packId);
}

export async function updateBidPack(
  userId: string,
  packId: number,
  patch: { decisionStatus?: BidPackDecisionStatus; decisionNote?: string | null },
) {
  await getPackOrThrow(userId, packId);

  const updates: {
    decisionStatus?: BidPackDecisionStatus;
    decisionNote?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (patch.decisionStatus !== undefined) updates.decisionStatus = patch.decisionStatus;
  if (patch.decisionNote !== undefined) updates.decisionNote = patch.decisionNote;

  await db
    .update(bidPacks)
    .set(updates)
    .where(eq(bidPacks.id, packId));

  return getBidPackForUser(userId, packId);
}

export async function updateBidPackRequirement(
  userId: string,
  packId: number,
  requirementId: number,
  status: BidPackRequirementStatus,
) {
  await getPackOrThrow(userId, packId);

  const rows = await db
    .update(bidPackRequirements)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(bidPackRequirements.id, requirementId), eq(bidPackRequirements.bidPackId, packId)))
    .returning({ id: bidPackRequirements.id });

  if (!rows[0]) {
    throw new BidPackError("Anforderung nicht gefunden.", 404, "BID_PACK_REQUIREMENT_NOT_FOUND");
  }

  await touchBidPack(packId);

  return getBidPackForUser(userId, packId);
}

export async function linkBidPackEvidence(
  userId: string,
  packId: number,
  requirementId: number,
  evidenceId: number,
  rationale?: string | null,
) {
  const pack = await getPackOrThrow(userId, packId);
  const requirement = await db
    .select({ id: bidPackRequirements.id })
    .from(bidPackRequirements)
    .where(and(eq(bidPackRequirements.id, requirementId), eq(bidPackRequirements.bidPackId, packId)))
    .limit(1);
  if (!requirement[0]) {
    throw new BidPackError("Anforderung nicht gefunden.", 404, "BID_PACK_REQUIREMENT_NOT_FOUND");
  }

  const evidence = await db
    .select({ evidence: companyEvidence, file: companyEvidenceFiles })
    .from(companyEvidence)
    .leftJoin(companyEvidenceFiles, and(
      eq(companyEvidenceFiles.evidenceId, companyEvidence.id),
      eq(companyEvidenceFiles.uploadStatus, "available"),
      eq(companyEvidenceFiles.scanStatus, "clean"),
      isNull(companyEvidenceFiles.deletedAt),
    ))
    .where(and(
      eq(companyEvidence.id, evidenceId),
      eq(companyEvidence.companyId, pack.companyId),
      eq(companyEvidence.status, "active"),
      eq(companyEvidence.verificationStatus, "verified"),
      or(isNull(companyEvidence.expiresAt), gt(companyEvidence.expiresAt, new Date())),
    ))
    .limit(1);
  if (!evidence[0]) {
    throw new BidPackError("Nachweis gehört nicht zum Unternehmen dieses Bid Packs.", 422, "INVALID_EVIDENCE_REFERENCE");
  }

  const selectedFile = evidence[0].file;
  await db.insert(requirementEvidenceMatches).values({
    requirementId,
    evidenceId,
    evidenceFileId: selectedFile?.id ?? null,
    linkedByUserId: userId,
    evidenceSnapshotJson: {
      evidenceId,
      evidenceTitle: evidence[0].evidence.title,
      verificationStatus: evidence[0].evidence.verificationStatus,
      expiresAt: evidence[0].evidence.expiresAt?.toISOString() ?? null,
      fileId: selectedFile?.id ?? null,
      filename: selectedFile?.originalFilename ?? null,
      sha256: selectedFile?.sha256 ?? null,
    },
    matchStatus: "accepted",
    rationale: rationale ?? null,
  }).onConflictDoUpdate({
    target: [requirementEvidenceMatches.requirementId, requirementEvidenceMatches.evidenceId],
    set: {
      matchStatus: "accepted",
      rationale: rationale ?? null,
      evidenceFileId: selectedFile?.id ?? null,
      linkedByUserId: userId,
      evidenceSnapshotJson: {
        evidenceId,
        evidenceTitle: evidence[0].evidence.title,
        verificationStatus: evidence[0].evidence.verificationStatus,
        expiresAt: evidence[0].evidence.expiresAt?.toISOString() ?? null,
        fileId: selectedFile?.id ?? null,
        filename: selectedFile?.originalFilename ?? null,
        sha256: selectedFile?.sha256 ?? null,
      },
      updatedAt: new Date(),
    },
  });
  await touchBidPack(packId);
  return getBidPackForUser(userId, packId);
}

export async function unlinkBidPackEvidence(
  userId: string,
  packId: number,
  requirementId: number,
  evidenceId: number,
) {
  await getPackOrThrow(userId, packId);
  const requirement = await db
    .select({ id: bidPackRequirements.id })
    .from(bidPackRequirements)
    .where(and(eq(bidPackRequirements.id, requirementId), eq(bidPackRequirements.bidPackId, packId)))
    .limit(1);
  if (!requirement[0]) {
    throw new BidPackError("Anforderung nicht gefunden.", 404, "BID_PACK_REQUIREMENT_NOT_FOUND");
  }
  const rows = await db.delete(requirementEvidenceMatches).where(and(
    eq(requirementEvidenceMatches.requirementId, requirementId),
    eq(requirementEvidenceMatches.evidenceId, evidenceId),
  )).returning({ id: requirementEvidenceMatches.id });
  if (!rows[0]) throw new BidPackError("Nachweisverknüpfung nicht gefunden.", 404, "EVIDENCE_MATCH_NOT_FOUND");
  await touchBidPack(packId);
  return getBidPackForUser(userId, packId);
}

export async function createBidPackTask(
  userId: string,
  packId: number,
  input: { title: string; requirementId?: number | null; assignee?: string | null; dueAt?: string | null },
) {
  await getPackOrThrow(userId, packId);

  if (input.requirementId !== undefined && input.requirementId !== null) {
    const requirement = await db
      .select({ id: bidPackRequirements.id })
      .from(bidPackRequirements)
      .where(and(eq(bidPackRequirements.id, input.requirementId), eq(bidPackRequirements.bidPackId, packId)))
      .limit(1);
    if (!requirement[0]) {
      throw new BidPackError("Die verknüpfte Anforderung gehört nicht zu diesem Bid Pack.", 422, "INVALID_REQUIREMENT_REFERENCE");
    }
  }

  await db.insert(bidPackTasks).values({
    bidPackId: packId,
    requirementId: input.requirementId ?? null,
    source: "manual",
    title: input.title,
    assignee: input.assignee ?? null,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
  });
  await touchBidPack(packId);

  return getBidPackForUser(userId, packId);
}

export async function updateBidPackTask(
  userId: string,
  packId: number,
  taskId: number,
  patch: {
    title?: string;
    status?: BidPackTaskStatus;
    requirementId?: number | null;
    assignee?: string | null;
    dueAt?: string | null;
  },
) {
  await getPackOrThrow(userId, packId);

  if (patch.requirementId !== undefined && patch.requirementId !== null) {
    const requirement = await db
      .select({ id: bidPackRequirements.id })
      .from(bidPackRequirements)
      .where(and(eq(bidPackRequirements.id, patch.requirementId), eq(bidPackRequirements.bidPackId, packId)))
      .limit(1);
    if (!requirement[0]) {
      throw new BidPackError("Die verknüpfte Anforderung gehört nicht zu diesem Bid Pack.", 422, "INVALID_REQUIREMENT_REFERENCE");
    }
  }

  const updates: {
    title?: string;
    status?: BidPackTaskStatus;
    requirementId?: number | null;
    assignee?: string | null;
    dueAt?: Date | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.requirementId !== undefined) updates.requirementId = patch.requirementId;
  if (patch.assignee !== undefined) updates.assignee = patch.assignee;
  if (patch.dueAt !== undefined) updates.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;

  const rows = await db
    .update(bidPackTasks)
    .set(updates)
    .where(and(eq(bidPackTasks.id, taskId), eq(bidPackTasks.bidPackId, packId)))
    .returning({ id: bidPackTasks.id });

  if (!rows[0]) {
    throw new BidPackError("Aufgabe nicht gefunden.", 404, "BID_PACK_TASK_NOT_FOUND");
  }

  await touchBidPack(packId);

  return getBidPackForUser(userId, packId);
}
