import type { DeadlineState } from "@/lib/date-utils";

export interface ProfileTender {
  id: number;
  title: string;
  description: string;
  location: string | null;
  volume: string | null;
  deadlineAt: string | null;
  deadlineDays: number | null;
  deadlineState: DeadlineState;
  fit: number;
  winProbability: number;
  slug: string;
}

export interface ProfileSummary {
  currentCount: number;
  expiredCount: number;
  fitDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  resultRegions: Array<{ label: string; count: number }>;
  relevantCapabilities: string[];
}

// Profile pages are public sitemap targets. Keep their fallback scoring bounded
// so one SSR request cannot scan and score the whole tender catalog.
export const PUBLIC_PROFILE_FALLBACK_CANDIDATE_LIMIT = 250;

const cleanLabel = (value: string): string => value.replace(/\s+/g, " ").trim();

export function truncateProfileText(value: string, maxLength = 240): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const shortened = normalized.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return `${shortened || normalized.slice(0, maxLength).trim()}…`;
}

export function sortProfileTenders(tenders: ProfileTender[]): ProfileTender[] {
  return [...tenders].sort((a, b) => {
    const aCurrent = a.deadlineState === "expired" ? 1 : 0;
    const bCurrent = b.deadlineState === "expired" ? 1 : 0;
    if (aCurrent !== bCurrent) return aCurrent - bCurrent;
    if (a.fit !== b.fit) return b.fit - a.fit;
    if (a.winProbability !== b.winProbability) return b.winProbability - a.winProbability;
    if (a.deadlineAt === null && b.deadlineAt !== null) return 1;
    if (a.deadlineAt !== null && b.deadlineAt === null) return -1;
    return (a.deadlineAt ?? "").localeCompare(b.deadlineAt ?? "");
  });
}

export function buildProfileSummary(
  tenders: ProfileTender[],
  capabilities: string[],
  fallbackRegions: string[] = [],
): ProfileSummary {
  const currentTenders = tenders.filter((tender) => tender.deadlineState !== "expired");
  const expiredCount = tenders.length - currentTenders.length;
  const resultRegions = new Map<string, number>();

  for (const tender of currentTenders) {
    const label = tender.location ? cleanLabel(tender.location) : "Region nicht angegeben";
    resultRegions.set(label, (resultRegions.get(label) ?? 0) + 1);
  }

  const regions = resultRegions.size > 0
    ? [...resultRegions.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }))
    : fallbackRegions
      .map(cleanLabel)
      .filter(Boolean)
      .slice(0, 3)
      .map((label) => ({ label, count: 0 }));

  const fitDistribution = currentTenders.reduce(
    (distribution, tender) => {
      if (tender.fit >= 70) distribution.high += 1;
      else if (tender.fit >= 40) distribution.medium += 1;
      else distribution.low += 1;
      return distribution;
    },
    { high: 0, medium: 0, low: 0 },
  );

  return {
    currentCount: currentTenders.length,
    expiredCount,
    fitDistribution,
    resultRegions: regions,
    relevantCapabilities: [...new Set(capabilities.map(cleanLabel).filter(Boolean))].slice(0, 5),
  };
}
