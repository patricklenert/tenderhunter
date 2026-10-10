import type { JsonValue } from "@/lib/types";

export type PublicSourceCursor = Record<string, JsonValue>;

export type PublicCursorCommit = "commit" | "hold" | "none";

export const shouldCommitPublicCursor = (input: {
  cursorCommit: PublicCursorCommit;
  cursorAdvanced: boolean;
  errorMessage?: string | null;
}, persistenceError?: string | null): boolean => (
  !persistenceError
  && !input.errorMessage
  && input.cursorCommit === "commit"
  && input.cursorAdvanced
);

/**
 * Keep persistence failures scoped to the source whose batch failed. The
 * scraper also exposes a legacy global error field; only use that fallback
 * when it cannot be attributed to one of the source runs.
 */
export const resolvePublicSourcePersistenceError = (input: {
  sourceError?: string | null;
  mappedSourceError?: string | null;
  globalError?: string | null;
  globalErrorAttributed: boolean;
}): string | null => (
  input.mappedSourceError
  ?? input.sourceError
  ?? (input.globalErrorAttributed ? null : input.globalError ?? null)
);

export const PUBLIC_FULL_RUN_FAILURE_RETRY_MS = 5 * 60 * 1000;

export const buildPublicContinuationJobKey = (sourceKey: string, generation?: string | number): string =>
  `public-continuation:${sourceKey}${generation === undefined ? "" : `:run-${generation}`}`;

export const shouldRetryFailedPublicFullRun = (
  finishedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!finishedAt) return true;
  const finishedAtMs = finishedAt.getTime();
  return !Number.isFinite(finishedAtMs)
    || now.getTime() - finishedAtMs >= PUBLIC_FULL_RUN_FAILURE_RETRY_MS;
};

export const isUnexpectedEmptyPublicSourceResult = (input: {
  emptyAllowed: boolean;
  tenderCount: number;
  exhausted: boolean;
  pendingCount: number;
}): boolean => (
  !input.emptyAllowed
  && input.tenderCount === 0
  && input.exhausted
  && input.pendingCount === 0
);

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

export const isPermanentPublicSourceError = (error: string | null | undefined): boolean =>
  Boolean(error && /\b(?:403|404)\b|not found|nicht gefunden/iu.test(error));

/** A pending detail reference is due when it is neither blocked nor backoff-deferred. */
const isDueDetailReference = (reference: PublicDetailReference, nowMs: number): boolean => {
  if (reference.blocked === true) return false;
  if (!reference.nextAttemptAt) return true;
  const nextAttemptAt = Date.parse(reference.nextAttemptAt);
  return !Number.isFinite(nextAttemptAt) || nextAttemptAt <= nowMs;
};

/**
 * Continuations must only be scheduled when the source can actually make
 * progress in the next run: a retryable detail is due now, or the listing
 * itself is still incomplete after a clean run. Backoff-deferred retries,
 * blocked-only queues, permanent errors and no-progress error loops must not
 * requeue work every scheduler tick.
 */
export const shouldSchedulePublicContinuation = (
  cursor: PublicSourceCursor | null | undefined,
  exhausted: boolean,
  continuationRequired: boolean,
  lastStatus: string | null | undefined,
  lastError: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!continuationRequired) return false;
  const nowMs = now.getTime();
  const sourceFailureRetryAt = cursorString(cursor, "sourceFailureRetryAt");
  // A source-level failure parks the whole source, including pending detail
  // references, until the source backoff expires.
  if ((lastStatus === "failed" || (lastStatus === "partial" && lastError)) && sourceFailureRetryAt) {
    const retryAt = Date.parse(sourceFailureRetryAt);
    if (Number.isFinite(retryAt) && retryAt > nowMs) return false;
  }
  if (isPermanentPublicSourceError(lastError)) return false;
  const pendingDetails = cursorPendingDetails(cursor);
  if (pendingDetails.some((reference) => isDueDetailReference(reference, nowMs))) return true;
  // Older failed cursors predate persisted source backoff metadata. Retry them
  // once so a fixed scraper is not permanently stranded by stale state.
  if (lastStatus === "failed" && !sourceFailureRetryAt) return true;
  if ((lastStatus === "failed" || (lastStatus === "partial" && lastError)) && sourceFailureRetryAt) {
    const retryAt = Date.parse(sourceFailureRetryAt);
    return !Number.isFinite(retryAt) || retryAt <= nowMs;
  }
  // Blocked detail URLs are terminal, but they must not strand listing pages
  // that the source has not visited yet. The scraper can skip these refs and
  // continue pagination; only park a blocked-only queue once listing is done.
  if (
    !exhausted
    && cursor?.listingComplete === false
    && pendingDetails.length > 0
    && pendingDetails.every((reference) => reference.blocked)
    && !lastError
    && (lastStatus === "success" || lastStatus === "partial")
  ) return true;
  if (exhausted) return false;
  // A source reports "partial" when the listing has more pages to visit. It
  // is safe to continue that clean pagination run when no source error was
  // recorded; failed/errored partial runs must stay parked.
  return pendingDetails.length === 0
    && (lastStatus === "success" || (lastStatus === "partial" && !lastError));
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
