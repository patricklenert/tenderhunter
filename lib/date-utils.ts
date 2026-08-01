export function formatDeadlineDE(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((target - start) / (24 * 60 * 60 * 1000));
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
