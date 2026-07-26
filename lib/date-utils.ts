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
