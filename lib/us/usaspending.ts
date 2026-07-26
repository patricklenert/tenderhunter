import type { UsPrimeContractor } from "@/lib/us/types";

const USASPENDING_AWARDS_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

type Award = Record<string, unknown>;

const asString = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const asNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

export async function findUsPrimeContractors(naicsCodes: string[], limit = 8): Promise<UsPrimeContractor[]> {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const response = await fetch(USASPENDING_AWARDS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      filters: {
        time_period: [{ start_date: startDate, end_date: endDate }],
        ...(naicsCodes.length > 0 ? { naics_codes: naicsCodes } : {}),
        award_type_codes: ["A", "B", "C", "D"],
      },
      fields: ["Award ID", "Recipient Name", "Recipient UEI", "Award Amount", "Awarding Agency", "Start Date", "End Date", "Description"],
      page: 1,
      limit: Math.min(Math.max(limit, 1), 20),
      order: "desc",
      sort: "Award Amount",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`USASpending award search failed with HTTP ${response.status}`);

  const payload = await response.json() as { results?: unknown[] };
  const seen = new Set<string>();
  return (Array.isArray(payload.results) ? payload.results : []).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const award = value as Award;
    const name = asString(award["Recipient Name"]) ?? asString(award.recipient_name);
    if (!name || seen.has(name.toLowerCase())) return [];
    seen.add(name.toLowerCase());
    const awardId = asString(award["Award ID"]) ?? asString(award.award_id);
    return [{
      name,
      uei: asString(award["Recipient UEI"]) ?? asString(award.recipient_uei),
      awardId,
      agency: asString(award["Awarding Agency"]) ?? asString(award.awarding_agency),
      amount: asNumber(award["Award Amount"]) ?? asNumber(award.award_amount),
      description: asString(award.Description) ?? asString(award.description),
      startDate: asString(award["Start Date"]) ?? asString(award.start_date),
      endDate: asString(award["End Date"]) ?? asString(award.end_date),
      usaspendingUrl: awardId ? `https://www.usaspending.gov/award/${encodeURIComponent(awardId)}` : null,
    }];
  });
}
