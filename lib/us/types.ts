export const US_IT_NAICS_CODES = [
  "518210",
  "541511",
  "541512",
  "541513",
  "541514",
  "541519",
  "541715",
] as const;

export const US_IT_PSC_CODES = ["D301", "D302", "D303", "D304", "D305", "D306", "D307", "D308", "D309", "D310", "D399", "R425", "AC11"] as const;

export const US_IT_KEYWORDS = [
  "software",
  "cloud",
  "cyber",
  "information technology",
  "technology",
  "computer",
  "data",
  "application",
  "network",
  "digital",
  "automation",
  "analytics",
  "it support",
  "systems development",
] as const;

export type UsTenderSource = "sam_gov" | "sba_subnet" | "sba_subcontracting" | "texas_esbd" | "virginia_eva" | "dc_ocp" | "california_eprocure" | "georgia_gpr" | "new_york_ogs" | "north_carolina_evp" | "florida_mfmp" | "new_york_contract_reporter";

export interface UsContact {
  name?: string;
  email?: string;
  phone?: string;
}

export interface UsExtractedTender {
  source: UsTenderSource;
  sourceKey: string;
  url: string;
  externalId: string;
  title: string;
  description: string;
  buyer: string | null;
  location: string | null;
  state: string | null;
  solicitationNumber: string | null;
  naicsCodes: string[];
  pscCodes: string[];
  setAside: string | null;
  contractType: string | null;
  deadlineAt: Date | null;
  contacts: UsContact[];
  attachments: Array<{ name: string; url: string }>;
  metadata: Record<string, unknown>;
}

export interface UsPrimeContractor {
  name: string;
  uei: string | null;
  awardId: string | null;
  agency: string | null;
  amount: number | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  usaspendingUrl: string | null;
}

export const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const normalizeUsAttachmentUrl = (value: unknown, baseUrl?: string): string | null => {
  if (typeof value !== "string" || !value.trim() || /^(?:#|javascript:|mailto:|tel:|data:|blob:)/i.test(value.trim())) return null;

  try {
    const url = new URL(value.trim(), baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
};

export const dedupeUsAttachments = (
  attachments: ReadonlyArray<{ name?: unknown; url?: unknown }>,
  baseUrl?: string,
): Array<{ name: string; url: string }> => {
  const seen = new Set<string>();
  return attachments.flatMap((attachment) => {
    const url = normalizeUsAttachmentUrl(attachment.url, baseUrl);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const name = typeof attachment.name === "string" ? attachment.name.replace(/\s+/g, " ").trim() : "";
    return [{ name: name || "Attachment", url }];
  });
};

const US_STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC", "washington dc": "DC",
};

export const normalizeUsState = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(normalized)) return normalized.toUpperCase();
  return US_STATE_CODES[normalized] ?? null;
};

const createUtcDate = (year: number, month: number, day: number, hour = 23, minute = 59): Date | null => {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 59, 999));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    ? date
    : null;
};

export const normalizeUsDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return createUtcDate(Number(year), Number(month), Number(day));
  }
  const usDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?$/i);
  if (usDate) {
    const [, month, day, year, hours = "23", minutes = "59", suffix] = usDate;
    let hour = Number(hours);
    if (suffix?.toUpperCase() === "PM" && hour < 12) hour += 12;
    if (suffix?.toUpperCase() === "AM" && hour === 12) hour = 0;
    return createUtcDate(Number(year), Number(month), Number(day), hour, Number(minutes));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isUsItOpportunity = (item: Pick<UsExtractedTender, "title" | "description" | "naicsCodes" | "pscCodes">): boolean => {
  if (item.naicsCodes.some((code) => US_IT_NAICS_CODES.includes(code as (typeof US_IT_NAICS_CODES)[number]))) return true;
  if (item.pscCodes.some((code) => US_IT_PSC_CODES.includes(code.toUpperCase() as (typeof US_IT_PSC_CODES)[number]))) return true;
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  return US_IT_KEYWORDS.some((keyword) => haystack.includes(keyword));
};
