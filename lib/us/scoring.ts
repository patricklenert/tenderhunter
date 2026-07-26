import type { CompanyProfile, UsTender } from "@/lib/schema";
import { parseStringArray } from "@/lib/us/types";

const toLowerStrings = (value: unknown): string[] => parseStringArray(value).map((item) => item.toLowerCase());

type UsTenderForPursuit = Pick<UsTender, "title" | "description" | "naicsCodesJson" | "setAside" | "deadlineAt">;
type CompanyProfileForPursuit = Pick<CompanyProfile, "naicsCodesJson" | "capabilitiesJson" | "socioEconomicJson" | "uei" | "cageCode">;

const REQUIRED_STATUS: Array<{ pattern: RegExp; status: string; label: string }> = [
  { pattern: /8\(a\)/i, status: "8a", label: "8(a) Business Development" },
  { pattern: /hubzone/i, status: "hubzone", label: "HUBZone" },
  { pattern: /service-disabled|sdvosb/i, status: "sdvosb", label: "Service-Disabled Veteran-Owned Small Business" },
  { pattern: /women-owned|wosb/i, status: "wosb", label: "Women-Owned Small Business" },
  { pattern: /small business/i, status: "small_business", label: "Small Business" },
];

export interface UsTenderFit {
  score: number;
  naicsMatch: boolean;
  capabilityMatch: boolean;
  eligibleForSetAside: boolean | null;
  requiredSetAside: string | null;
  registrationReady: boolean;
  reasons: string[];
}

export const getRequiredSetAside = (setAside: string | null): { status: string; label: string } | null => {
  if (!setAside) return null;
  return REQUIRED_STATUS.find((item) => item.pattern.test(setAside)) ?? null;
};

export function scoreUsTender(tender: UsTenderForPursuit, company: CompanyProfileForPursuit): UsTenderFit {
  const tenderNaics = new Set(parseStringArray(tender.naicsCodesJson));
  const companyNaics = parseStringArray(company.naicsCodesJson);
  const naicsMatch = companyNaics.some((code) => tenderNaics.has(code));
  const text = `${tender.title} ${tender.description ?? ""}`.toLowerCase();
  const capabilityMatch = toLowerStrings(company.capabilitiesJson).some((capability) => capability.length > 2 && text.includes(capability));
  const required = getRequiredSetAside(tender.setAside);
  const statuses = new Set(toLowerStrings(company.socioEconomicJson));
  const eligibleForSetAside = required ? statuses.has(required.status) : null;
  const registrationReady = Boolean(company.uei?.trim());
  const score = Math.min(100,
    (naicsMatch ? 55 : 0) +
    (capabilityMatch ? 30 : 0) +
    (registrationReady ? 10 : 0) +
    (!required || eligibleForSetAside ? 5 : 0),
  );
  const reasons = [
    ...(naicsMatch ? ["Your NAICS code matches this opportunity."] : ["No exact NAICS match is configured for your company."]),
    ...(capabilityMatch ? ["Your stated capabilities appear in the requirement."] : []),
    ...(required && !eligibleForSetAside ? [`This is restricted to ${required.label}; pursue it through an eligible prime unless you qualify.`] : []),
    ...(!registrationReady ? ["Your company is not yet SAM registration-ready (UEI missing). Teaming outreach can start now; direct bidding cannot."] : []),
  ];
  return { score, naicsMatch, capabilityMatch, eligibleForSetAside, requiredSetAside: required?.label ?? null, registrationReady, reasons };
}

export interface UsPursuitChecklistItem {
  id: string;
  label: string;
  status: "complete" | "action_required" | "not_applicable";
  detail: string;
}

export const buildUsPursuitChecklist = (tender: UsTenderForPursuit, company: CompanyProfileForPursuit | null): UsPursuitChecklistItem[] => {
  const required = getRequiredSetAside(tender.setAside);
  const hasUei = Boolean(company?.uei?.trim());
  const hasCage = Boolean(company?.cageCode?.trim());
  const hasCapabilities = parseStringArray(company?.capabilitiesJson).length > 0;
  const statuses = new Set(toLowerStrings(company?.socioEconomicJson));
  const setAsideMet = !required || statuses.has(required.status);

  return [
    {
      id: "uei",
      label: "Get a Unique Entity ID (UEI) and complete SAM.gov registration",
      status: hasUei ? "complete" : "action_required",
      detail: hasUei ? "UEI is saved in your Tenderhunter profile." : "Required before submitting a direct federal offer. Registration is free at SAM.gov.",
    },
    {
      id: "cage",
      label: "Confirm your CAGE code",
      status: hasCage ? "complete" : "action_required",
      detail: hasCage ? "CAGE code is saved in your Tenderhunter profile." : "SAM registration generally triggers CAGE assignment for U.S. entities.",
    },
    {
      id: "set-aside",
      label: required ? `Confirm ${required.label} eligibility` : "Review set-aside eligibility",
      status: required ? (setAsideMet ? "complete" : "action_required") : "not_applicable",
      detail: required
        ? (setAsideMet ? "Your recorded socio-economic status matches this restriction." : "Do not submit directly until this status is verified; contact primes for subcontracting instead.")
        : "This opportunity does not state a restrictive set-aside in the source data.",
    },
    {
      id: "capability-statement",
      label: "Prepare a one-page capability statement",
      status: hasCapabilities ? "complete" : "action_required",
      detail: hasCapabilities ? "Use your saved capabilities and NAICS codes to tailor it to this requirement." : "Add capabilities and NAICS codes to your profile before outreach.",
    },
    {
      id: "review-solicitation",
      label: "Review the solicitation and attachments",
      status: "action_required",
      detail: tender.deadlineAt ? `Confirm all instructions before the response deadline: ${tender.deadlineAt.toISOString()}.` : "The source does not publish a response deadline; confirm it with the contracting point of contact.",
    },
    {
      id: "teaming",
      label: "Contact relevant prime contractors for teaming",
      status: "action_required",
      detail: "Use the comparable recent awards below to identify primes already active in this NAICS and agency space.",
    },
  ];
};
