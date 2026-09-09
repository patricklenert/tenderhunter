const BERLIN_TIME_ZONE = "Europe/Berlin";
const berlinDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TIME_ZONE,
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getBerlinDateTimeParts(value: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Map(
    berlinDateTimeFormatter.formatToParts(value).map(({ type, value: partValue }) => [type, partValue]),
  );
  return {
    year: Number(parts.get("year")),
    month: Number(parts.get("month")),
    day: Number(parts.get("day")),
    hour: Number(parts.get("hour")),
    minute: Number(parts.get("minute")),
    second: Number(parts.get("second")),
  };
}

function getBerlinOffsetMilliseconds(utcMilliseconds: number): number {
  const local = getBerlinDateTimeParts(new Date(utcMilliseconds));
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return localAsUtc - utcMilliseconds;
}

function dateFromBerlinParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date | null {
  if (month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }

  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > maxDay) return null;

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcMilliseconds = localAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nextUtcMilliseconds = localAsUtc - getBerlinOffsetMilliseconds(utcMilliseconds);
    if (nextUtcMilliseconds === utcMilliseconds) break;
    utcMilliseconds = nextUtcMilliseconds;
  }

  return new Date(utcMilliseconds);
}

export type DeadlineState = "current" | "expired" | "missing";

/** Parses stored deadlines, including German portal dates, in Berlin time. */
export function parseDeadlineDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());

  const text = value.trim();
  if (!text) return null;

  const germanMatch = text.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?(?:\s*Uhr)?$/i,
  );
  if (germanMatch) {
    const [, day, month, year, hour, minute] = germanMatch;
    return dateFromBerlinParts(
      Number(year),
      Number(month),
      Number(day),
      hour ? Number(hour) : 23,
      minute ? Number(minute) : 59,
      hour ? 0 : 59,
    );
  }

  const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    return dateFromBerlinParts(Number(year), Number(month), Number(day), 23, 59, 59);
  }

  const isoLocal = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?$/,
  );
  if (isoLocal) {
    const [, year, month, day, hour, minute, second = "0"] = isoLocal;
    return dateFromBerlinParts(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDeadlineState(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): DeadlineState {
  const deadline = parseDeadlineDate(value);
  if (!deadline) return "missing";
  return deadline.getTime() <= now.getTime() ? "expired" : "current";
}

export function formatDeadlineDE(value: string | Date | null | undefined): string {
  const date = parseDeadlineDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getBerlinMidnightUnixSeconds(year: number, month: number, day: number): number {
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let utcMilliseconds = localMidnightAsUtc;

  // Recalculate with the offset at the candidate instant so DST transitions are handled correctly.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nextUtcMilliseconds = localMidnightAsUtc - getBerlinOffsetMilliseconds(utcMilliseconds);
    if (nextUtcMilliseconds === utcMilliseconds) break;
    utcMilliseconds = nextUtcMilliseconds;
  }

  return Math.floor(utcMilliseconds / 1000);
}

export function getGermanLastThreeDaysUnixRange(now: Date = new Date()): { from: number; to: number } {
  const current = getBerlinDateTimeParts(now);
  const start = new Date(Date.UTC(current.year, current.month - 1, current.day - 2));
  const next = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));

  return {
    from: getBerlinMidnightUnixSeconds(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()),
    to: getBerlinMidnightUnixSeconds(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
  };
}

export const TENDER_DEADLINE_FILTERS = [
  "all",
  "minimum3",
  "minimum7",
  "minimum14",
  "next7",
  "next30",
  "custom",
  "missing",
] as const;

export type TenderDeadlineFilter = (typeof TENDER_DEADLINE_FILTERS)[number];

export interface TenderDeadlineSearchBounds {
  hasDeadline?: boolean;
  deadlineAtFrom?: number;
  deadlineAtTo?: number;
}

export function isTenderDeadlineFilter(value: string | null | undefined): value is TenderDeadlineFilter {
  return typeof value === "string" && TENDER_DEADLINE_FILTERS.includes(value as TenderDeadlineFilter);
}

/** Returns the UTC timestamp range for one calendar day in Europe/Berlin. */
export function getBerlinCalendarDayRange(
  offsetDays = 0,
  now: Date = new Date(),
): { from: number; to: number } {
  const current = getBerlinDateTimeParts(now);
  const start = new Date(Date.UTC(current.year, current.month - 1, current.day + offsetDays));
  const next = new Date(Date.UTC(current.year, current.month - 1, current.day + offsetDays + 1));

  return {
    from: getBerlinMidnightUnixSeconds(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()),
    to: getBerlinMidnightUnixSeconds(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
  };
}

/** Parses an HTML date input and returns an inclusive Berlin calendar-day range. */
export function getBerlinDateInputRange(value: string): { from: number; to: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > maxDay) return null;

  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    from: getBerlinMidnightUnixSeconds(year, month, day),
    to: getBerlinMidnightUnixSeconds(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
  };
}

export function resolveTenderDeadlineFilter(
  filter: TenderDeadlineFilter,
  fromInput?: string | null,
  toInput?: string | null,
  now: Date = new Date(),
): TenderDeadlineSearchBounds {
  if (filter === "all") return {};
  if (filter === "missing") return { hasDeadline: false };

  if (filter === "minimum3" || filter === "minimum7" || filter === "minimum14") {
    const minimumDays = filter === "minimum3" ? 3 : filter === "minimum7" ? 7 : 14;
    return {
      hasDeadline: true,
      deadlineAtFrom: getBerlinCalendarDayRange(minimumDays, now).from,
    };
  }

  if (filter === "next7" || filter === "next30") {
    const maximumDays = filter === "next7" ? 7 : 30;
    return {
      hasDeadline: true,
      deadlineAtFrom: Math.floor(now.getTime() / 1000),
      deadlineAtTo: getBerlinCalendarDayRange(maximumDays, now).to,
    };
  }

  const from = fromInput ? getBerlinDateInputRange(fromInput) : null;
  const to = toInput ? getBerlinDateInputRange(toInput) : null;
  if (fromInput && !from) throw new Error("Ungültiges Startdatum für den Fristenfilter");
  if (toInput && !to) throw new Error("Ungültiges Enddatum für den Fristenfilter");

  const deadlineAtFrom = from?.from ?? Math.floor(now.getTime() / 1000);
  if (to && to.to <= deadlineAtFrom) {
    throw new Error("Das Enddatum des Fristenfilters muss nach dem Startdatum liegen");
  }

  return {
    hasDeadline: true,
    deadlineAtFrom,
    deadlineAtTo: to?.to,
  };
}

export function daysUntil(value: string | Date | null | undefined, now: Date = new Date()): number | null {
  const date = parseDeadlineDate(value);
  if (!date) return null;
  const today = getBerlinDateTimeParts(now);
  const target = getBerlinDateTimeParts(date);
  const start = getBerlinMidnightUnixSeconds(today.year, today.month, today.day);
  const targetDay = getBerlinMidnightUnixSeconds(target.year, target.month, target.day);
  return Math.round((targetDay - start) / (24 * 60 * 60));
}

export function deadlineLabel(value: string | Date | null | undefined): string | null {
  const distance = daysUntil(value);
  if (distance === null) return null;
  if (distance < 0) return `abgelaufen vor ${Math.abs(distance)} Tagen`;
  if (distance === 0) return "heute";
  if (distance === 1) return "morgen";
  if (distance === 2) return "übermorgen";
  return `in ${distance} Tagen`;
}

export function deadlineColor(value: string | Date | null | undefined): "error" | "warning" | "success" | "text.secondary" {
  const distance = daysUntil(value);
  if (distance === null) return "text.secondary";
  if (distance < 0) return "error";
  if (distance <= 7) return "warning";
  return "success";
}

export function cleanPdfFilename(url: string): string {
  const lastPart = url.split("/").pop() ?? url;
  // Strip jsessionid and query params
  const cleaned = lastPart.split(";")[0].split("?")[0];
  // Decode URL encoding
  try {
    return decodeURIComponent(cleaned);
  } catch {
    return cleaned;
  }
}

const PAYWALL_PATTERN = /\/\/(?:www\.)?evergabe\.de\//;

export function sanitizeTenderUrl(tenderUrl: string | null | undefined, sourceUrl?: string | null): string | null {
  if (!tenderUrl) return null;
  if (!PAYWALL_PATTERN.test(tenderUrl)) return tenderUrl;
  if (sourceUrl && !PAYWALL_PATTERN.test(sourceUrl)) return sourceUrl;
  return null;
}
