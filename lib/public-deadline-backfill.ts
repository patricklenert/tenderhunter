import { parseDeadlineDate } from "@/lib/date-utils";

/**
 * Return a corrected Berlin deadline only when the stored value exactly
 * matches the old UTC-server parse of the same German wall-clock deadline.
 */
export const resolvePublicDeadlineRepair = (
  sourceDeadlineText: string,
  storedDeadlineAt: Date | string | null,
): Date | null => {
  const sourceDeadlineAt = parseDeadlineDate(sourceDeadlineText);
  const match = sourceDeadlineText.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/,
  );
  if (!sourceDeadlineAt || !match || !storedDeadlineAt) return null;

  const [, day, month, year, hour, minute] = match;
  const legacyUtcWallClock = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour ? Number(hour) : 23,
    minute ? Number(minute) : 59,
  ));
  const stored = parseDeadlineDate(storedDeadlineAt);
  if (!stored || stored.getTime() !== legacyUtcWallClock.getTime()) return null;
  return sourceDeadlineAt.getTime() === stored.getTime() ? null : sourceDeadlineAt;
};
