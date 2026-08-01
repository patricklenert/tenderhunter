import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attributionEvents, companyProfiles, insights, scores, tenders, trackedTenders, userCompanies } from "@/lib/schema";
import {
  ACTIVE_TRACKED_TENDER_STATUSES,
  mapTrackedStatusToTrackingEvent,
  type TrackedTenderStatus,
} from "@/lib/tracked-tender-types";
import type { JsonValue } from "@/lib/types";

const toStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

const toRoundedPercent = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
};

const toRoundedScore = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
};

const normalizeScoreDetails = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const details = value as Record<string, unknown>;
  return {
    domainMatch: toRoundedPercent(details.domain_match),
    requirementCoverage: toRoundedPercent(details.requirement_coverage),
    regionMatch: toRoundedPercent(details.region_match),
    sizeMatch: toRoundedPercent(details.size_match),
    complexity: toRoundedPercent(details.complexity),
  };
};

const STATUS_ORDER = sql<number>`
  CASE ${trackedTenders.status}
    WHEN 'tracked' THEN 0
    WHEN 'reviewing' THEN 1
    WHEN 'submitted' THEN 2
    WHEN 'won' THEN 3
    WHEN 'lost' THEN 4
    ELSE 5
  END
`;

export interface TrackedTenderListItem {
  trackedId: number;
  tenderId: number;
  companyId: number;
  companyName: string;
  title: string;
  source: string;
  url: string | null;
  externalId: string | null;
  status: TrackedTenderStatus;
  owner: string | null;
  deadlineAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  fit: number;
  winProbability: number;
  effort: number;
  requirementCoverage: number;
  killSwitch: boolean;
  explanation: string | null;
  actions: string[];
  missingItems: string[];
  details: {
    domainMatch: number;
    requirementCoverage: number;
    regionMatch: number;
    sizeMatch: number;
    complexity: number;
  } | null;
  qualityStatus: string;
  qualityReason: string | null;
}

export interface TrackedTenderSummary {
  total: number;
  active: number;
  tracked: number;
  reviewing: number;
  submitted: number;
  won: number;
  lost: number;
  dueSoon: number;
}

export interface TrackedTenderCompanyOption {
  id: number;
  name: string;
  count: number;
}

export interface ListTrackedTendersResult {
  items: TrackedTenderListItem[];
  summary: TrackedTenderSummary;
  companies: TrackedTenderCompanyOption[];
}

interface ListTrackedTendersOptions {
  userId: string;
  companyId?: number;
  status?: "all" | "active" | TrackedTenderStatus;
  search?: string;
}

const mapRowToItem = (row: {
  trackedId: number;
  tenderId: number;
  companyId: number;
  companyName: string | null;
  title: string | null;
  source: string | null;
  url: string | null;
  externalId: string | null;
  status: string;
  owner: string | null;
  deadlineAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  fit: number | null;
  winProbability: number | null;
  effort: number | null;
  requirementCoverage: number | null;
  killSwitch: boolean | null;
  explanation: string | null;
  actionsJson: unknown;
  missingItemsJson: unknown;
  detailsJson: unknown;
  qualityStatus: string | null;
  qualityReason: string | null;
}): TrackedTenderListItem => ({
  trackedId: row.trackedId,
  tenderId: row.tenderId,
  companyId: row.companyId,
  companyName: row.companyName ?? `Firma #${row.companyId}`,
  title: row.title ?? `Ausschreibung #${row.tenderId}`,
  source: row.source ?? "Unbekannte Quelle",
  url: row.url ?? null,
  externalId: row.externalId,
  status: (row.status as TrackedTenderStatus) ?? "tracked",
  owner: row.owner,
  deadlineAt: row.deadlineAt?.toISOString() ?? null,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  fit: toRoundedScore(row.fit),
  winProbability: toRoundedScore(row.winProbability),
  effort: toRoundedScore(row.effort),
  requirementCoverage: toRoundedPercent(row.requirementCoverage),
  killSwitch: row.killSwitch ?? false,
  explanation: row.explanation,
  actions: toStringList(row.actionsJson),
  missingItems: toStringList(row.missingItemsJson),
  details: normalizeScoreDetails(row.detailsJson),
  qualityStatus: row.qualityStatus ?? "candidate",
  qualityReason: row.qualityReason,
});

const buildSummary = (items: TrackedTenderListItem[]): TrackedTenderSummary => {
  const now = Date.now();
  const dueSoonLimit = now + 7 * 24 * 60 * 60 * 1000;

  return {
    total: items.length,
    active: items.filter((item) => ACTIVE_TRACKED_TENDER_STATUSES.includes(item.status)).length,
    tracked: items.filter((item) => item.status === "tracked").length,
    reviewing: items.filter((item) => item.status === "reviewing").length,
    submitted: items.filter((item) => item.status === "submitted").length,
    won: items.filter((item) => item.status === "won").length,
    lost: items.filter((item) => item.status === "lost").length,
    dueSoon: items.filter((item) => {
      if (!item.deadlineAt || !ACTIVE_TRACKED_TENDER_STATUSES.includes(item.status)) {
        return false;
      }
      const deadline = new Date(item.deadlineAt).getTime();
      return Number.isFinite(deadline) && deadline >= now && deadline <= dueSoonLimit;
    }).length,
  };
};

const buildCompanyOptions = (items: TrackedTenderListItem[]): TrackedTenderCompanyOption[] =>
  Array.from(
    items.reduce((map, item) => {
      const current = map.get(item.companyId);
      map.set(item.companyId, {
        id: item.companyId,
        name: item.companyName,
        count: (current?.count ?? 0) + 1,
      });
      return map;
    }, new Map<number, TrackedTenderCompanyOption>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => left.name.localeCompare(right.name, "de"));

const baseTrackedTenderQuery = (userId: string) =>
  db
    .select({
      trackedId: trackedTenders.id,
      tenderId: trackedTenders.tenderId,
      companyId: trackedTenders.companyId,
      companyName: companyProfiles.name,
      title: tenders.title,
      source: tenders.source,
      url: tenders.url,
      externalId: tenders.externalId,
      status: trackedTenders.status,
      owner: trackedTenders.owner,
      deadlineAt: trackedTenders.deadlineAt,
      notes: trackedTenders.notes,
      createdAt: trackedTenders.createdAt,
      updatedAt: trackedTenders.updatedAt,
      fit: scores.fit,
      winProbability: scores.winProbability,
      effort: scores.effort,
      requirementCoverage: scores.requirementCoverage,
      killSwitch: scores.killSwitch,
      explanation: insights.explanation,
      actionsJson: insights.actionsJson,
      missingItemsJson: insights.missingItemsJson,
      detailsJson: scores.detailsJson,
      qualityStatus: tenders.qualityStatus,
      qualityReason: tenders.qualityReason,
    })
    .from(trackedTenders)
    .innerJoin(
      userCompanies,
      and(eq(userCompanies.companyId, trackedTenders.companyId), eq(userCompanies.userId, userId)),
    )
    .leftJoin(tenders, eq(trackedTenders.tenderId, tenders.id))
    .leftJoin(companyProfiles, eq(trackedTenders.companyId, companyProfiles.id))
    .leftJoin(scores, and(eq(scores.tenderId, trackedTenders.tenderId), eq(scores.companyId, trackedTenders.companyId)))
    .leftJoin(insights, and(eq(insights.tenderId, trackedTenders.tenderId), eq(insights.companyId, trackedTenders.companyId)));

const getScoreSnapshot = async (companyId: number, tenderId: number) => {
  const rows = await db
    .select({
      fit: scores.fit,
      winProbability: scores.winProbability,
      effort: scores.effort,
      requirementCoverage: scores.requirementCoverage,
      killSwitch: scores.killSwitch,
      detailsJson: scores.detailsJson,
    })
    .from(scores)
    .where(and(eq(scores.companyId, companyId), eq(scores.tenderId, tenderId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    fit: row.fit,
    win_probability: row.winProbability,
    effort: row.effort,
    requirement_coverage: row.requirementCoverage,
    kill_switch: row.killSwitch,
    details: row.detailsJson,
  };
};

const normalizeOwner = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeNotes = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return value.trim();
};

const parseDeadline = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return new Date(value);
};

export const listTrackedTenders = async (options: ListTrackedTendersOptions): Promise<ListTrackedTendersResult> => {
  const filters = [];

  if (options.companyId) {
    filters.push(eq(trackedTenders.companyId, options.companyId));
  }

  if (options.status === "active") {
    filters.push(inArray(trackedTenders.status, [...ACTIVE_TRACKED_TENDER_STATUSES]));
  } else if (options.status && options.status !== "all") {
    filters.push(eq(trackedTenders.status, options.status));
  }

  const search = options.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    filters.push(
      or(
        ilike(tenders.title, pattern),
        ilike(tenders.source, pattern),
        ilike(companyProfiles.name, pattern),
        ilike(trackedTenders.owner, pattern),
        ilike(trackedTenders.notes, pattern),
      ),
    );
  }

  const rows = await baseTrackedTenderQuery(options.userId)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      STATUS_ORDER,
      sql`CASE WHEN ${trackedTenders.deadlineAt} IS NULL THEN 1 ELSE 0 END`,
      asc(trackedTenders.deadlineAt),
      desc(scores.winProbability),
      desc(trackedTenders.updatedAt),
    );

  const items = rows.map(mapRowToItem);

  return {
    items,
    summary: buildSummary(items),
    companies: buildCompanyOptions(items),
  };
};

export const getTrackedTender = async (userId: string, companyId: number, tenderId: number): Promise<TrackedTenderListItem | null> => {
  const rows = await baseTrackedTenderQuery(userId)
    .where(and(eq(trackedTenders.companyId, companyId), eq(trackedTenders.tenderId, tenderId)))
    .limit(1);

  return rows[0] ? mapRowToItem(rows[0]) : null;
};

export const recordTrackedTenderEvent = async (
  companyId: number,
  tenderId: number,
  status: TrackedTenderStatus,
  metadata?: Record<string, JsonValue>,
) => {
  await db.insert(attributionEvents).values({
    companyId,
    tenderId,
    eventType: mapTrackedStatusToTrackingEvent(status),
    metadataJson: {
      workflow_status: status,
      ...(metadata ?? {}),
    },
    scoreSnapshotJson: await getScoreSnapshot(companyId, tenderId),
  });
};

export const createOrUpdateTrackedTender = async (input: {
  userId: string;
  companyId: number;
  tenderId: number;
  status: TrackedTenderStatus;
  owner?: string;
  deadlineAt?: string | null;
  notes?: string;
  metadata?: Record<string, JsonValue>;
}) => {
  const now = new Date();

  await db
    .insert(trackedTenders)
    .values({
      companyId: input.companyId,
      tenderId: input.tenderId,
      status: input.status,
      owner: normalizeOwner(input.owner),
      deadlineAt: parseDeadline(input.deadlineAt),
      notes: normalizeNotes(input.notes) ?? "",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [trackedTenders.companyId, trackedTenders.tenderId],
      set: {
        status: input.status,
        owner: input.owner === undefined ? trackedTenders.owner : normalizeOwner(input.owner),
        deadlineAt: input.deadlineAt === undefined ? trackedTenders.deadlineAt : parseDeadline(input.deadlineAt),
        notes: normalizeNotes(input.notes) ?? trackedTenders.notes,
        updatedAt: now,
      },
    });

  await recordTrackedTenderEvent(input.companyId, input.tenderId, input.status, input.metadata);

  const item = await getTrackedTender(input.userId, input.companyId, input.tenderId);
  if (!item) {
    throw new Error("Verfolgte Ausschreibung konnte nicht geladen werden.");
  }
  return item;
};

export const updateTrackedTender = async (
  userId: string,
  companyId: number,
  tenderId: number,
  patch: {
    status?: TrackedTenderStatus;
    owner?: string | null;
    deadlineAt?: string | null;
    notes?: string;
  },
) => {
  const current = await getTrackedTender(userId, companyId, tenderId);
  if (!current) {
    return null;
  }

  const nextStatus = patch.status ?? current.status;
  const nextOwner = patch.owner === undefined ? current.owner : normalizeOwner(patch.owner);
  const nextDeadline = patch.deadlineAt === undefined ? current.deadlineAt : patch.deadlineAt;
  const nextNotes = patch.notes === undefined ? current.notes : normalizeNotes(patch.notes) ?? "";

  const updates: {
    status?: TrackedTenderStatus;
    owner?: string | null;
    deadlineAt?: Date | null;
    notes?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.owner !== undefined) updates.owner = nextOwner;
  if (patch.deadlineAt !== undefined) updates.deadlineAt = nextDeadline ? new Date(nextDeadline) : null;
  if (patch.notes !== undefined) updates.notes = nextNotes;

  const membership = db
    .select({ id: userCompanies.id })
    .from(userCompanies)
    .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)));

  const updated = await db
    .update(trackedTenders)
    .set(updates)
    .where(and(eq(trackedTenders.companyId, companyId), eq(trackedTenders.tenderId, tenderId), exists(membership)))
    .returning({ id: trackedTenders.id });

  if (!updated[0]) {
    return null;
  }

  await recordTrackedTenderEvent(companyId, tenderId, nextStatus, {
    previous_status: current.status,
    owner: nextOwner,
    deadline_at: nextDeadline,
  });

  return getTrackedTender(userId, companyId, tenderId);
};
