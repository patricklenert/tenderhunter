import type { JsonValue } from "@/lib/types";

export type PublicSourceCursor = Record<string, JsonValue>;

export type PublicCursorCommit = "commit" | "hold" | "none";

export type PublicDetailReference = {
  key: string;
  url: string;
  externalId?: string;
  attempts: number;
  nextAttemptAt?: string;
  blocked?: boolean;
};

export interface PublicSourceCursorV2 {
  version: 2;
  pendingDetails: PublicDetailReference[];
  position: JsonValue;
  strategy: string;
  exhausted: boolean;
  [key: string]: JsonValue;
}

export interface PublicSourceScrapeResult<T> {
  tenders: T[];
  nextCursor?: PublicSourceCursor | null;
  cursorAdvanced?: boolean;
  pagesFetched?: number;
  exhausted?: boolean;
  paginationStrategy?: string;
  cursorCommit: PublicCursorCommit;
  listingComplete: boolean;
  continuationRequired: boolean;
  listedCount: number;
  detailAttempted: number;
  detailFailed: number;
  pendingCount: number;
}

const isJsonObject = (value: JsonValue): value is { [key: string]: JsonValue } => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

export const publicDetailReference = (
  key: string,
  url: string,
  externalId?: string,
): PublicDetailReference => ({
  key,
  url,
  ...(externalId ? { externalId } : {}),
  attempts: 0,
});

export const cursorPendingDetails = (
  cursor: PublicSourceCursor | null | undefined,
): PublicDetailReference[] => {
  const value = cursor?.pendingDetails;
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isJsonObject(entry)) return [];
    const key = entry.key;
    const url = entry.url;
    const attempts = entry.attempts;
    if (typeof key !== "string" || typeof url !== "string" || typeof attempts !== "number") return [];

    return [{
      key,
      url,
      ...(typeof entry.externalId === "string" ? { externalId: entry.externalId } : {}),
      attempts: Number.isFinite(attempts) && attempts >= 0 ? attempts : 0,
      ...(typeof entry.nextAttemptAt === "string" ? { nextAttemptAt: entry.nextAttemptAt } : {}),
      ...(entry.blocked === true ? { blocked: true } : {}),
    }];
  });
};

export const isPublicSourceCursorV2 = (
  cursor: PublicSourceCursor | null | undefined,
): cursor is PublicSourceCursorV2 => (
  cursor?.version === 2
  && typeof cursor.strategy === "string"
  && cursor.position !== undefined
  && Array.isArray(cursor.pendingDetails)
);

export const cursorPosition = (
  cursor: PublicSourceCursor | null | undefined,
): JsonValue | null => cursor?.position ?? null;

export const cursorStrategy = (
  cursor: PublicSourceCursor | null | undefined,
): string | null => cursorString(cursor, "strategy");

export const createPublicSourceCursorV2 = (
  strategy: string,
  position: JsonValue,
  exhausted: boolean,
  pendingDetails: PublicDetailReference[] = [],
  extra: Record<string, JsonValue> = {},
): PublicSourceCursorV2 => ({
  ...extra,
  version: 2,
  pendingDetails,
  position,
  strategy,
  exhausted,
});

const cursorValue = (
  cursor: PublicSourceCursor | null | undefined,
  key: string,
): JsonValue | undefined => {
  const direct = cursor?.[key];
  if (direct !== undefined) return direct;
  const position = cursor?.position;
  return position !== undefined && isJsonObject(position) ? position[key] : undefined;
};

export const cursorNumber = (
  cursor: PublicSourceCursor | null | undefined,
  key: string,
  fallback: number,
): number => {
  const value = cursorValue(cursor, key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

export const cursorString = (
  cursor: PublicSourceCursor | null | undefined,
  key: string,
): string | null => {
  const value = cursorValue(cursor, key);
  return typeof value === "string" && value.length > 0 ? value : null;
};

export const cursorBoolean = (
  cursor: PublicSourceCursor | null | undefined,
  key: string,
): boolean => cursorValue(cursor, key) === true;

export const encodeDtvpSearchHash = (pageNumber: number): string => {
  const search = {
    cpvCodes: [],
    contractingRules: ["VOL", "VOB", "VSVGV", "SEKTVO", "OTHER"],
    publicationTypes: ["ExAnte", "Tender", "ExPost"],
    location: {},
    order: 0,
    pageNumber,
    searchText: "",
    sortField: "PROJECT_PUBLICATION_DATE_LNG",
  };

  return Buffer.from(JSON.stringify(search)).toString("base64url");
};

export const sourceResult = <T>(
  tenders: T[],
  pagination: Partial<Omit<PublicSourceScrapeResult<T>, "tenders">> = {},
): PublicSourceScrapeResult<T> => {
  const cursorCommit = pagination.cursorCommit ?? (pagination.nextCursor ? "commit" : "none");
  const listingComplete = pagination.listingComplete ?? cursorCommit !== "hold";
  const pendingCount = pagination.pendingCount
    ?? cursorPendingDetails(pagination.nextCursor ?? null).length;
  const continuationRequired = pagination.continuationRequired
    ?? (cursorCommit === "hold" || !listingComplete || pendingCount > 0);

  return {
    tenders,
    ...pagination,
    cursorCommit,
    cursorAdvanced: pagination.cursorAdvanced ?? cursorCommit === "commit",
    listingComplete,
    continuationRequired,
    listedCount: pagination.listedCount ?? tenders.length,
    detailAttempted: pagination.detailAttempted ?? 0,
    detailFailed: pagination.detailFailed ?? 0,
    pendingCount,
  };
};
