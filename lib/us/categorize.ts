import { parseStringArray } from "@/lib/us/types";

export const US_CATEGORIES = [
  "Construction & Infrastructure",
  "IT & Software",
  "Professional Services",
  "Healthcare & Social Services",
  "Facilities & Maintenance",
  "Equipment & Supplies",
  "Transportation",
  "Education & Training",
  "Other",
] as const;

export type UsCategory = (typeof US_CATEGORIES)[number];

const NAICS_SECTOR_MAP: Record<string, UsCategory> = {
  "23": "Construction & Infrastructure",
  "31": "Equipment & Supplies",
  "32": "Equipment & Supplies",
  "33": "Equipment & Supplies",
  "42": "Equipment & Supplies",
  "48": "Transportation",
  "49": "Transportation",
  "51": "IT & Software",
  "54": "Professional Services",
  "56": "Facilities & Maintenance",
  "61": "Education & Training",
  "62": "Healthcare & Social Services",
};

const KEYWORD_PATTERNS: Array<{ pattern: RegExp; category: UsCategory }> = [
  { pattern: /software|cloud|cyber|information technology|\bIT\b services|computer|network security|data center|managed service|web development|\bAPI\b|SaaS|DevOps|help desk/i, category: "IT & Software" },
  { pattern: /construction|building|highway|road|bridge|infrastructure|paving|excavat|concrete|asphalt|utility|pipeline|sewer|water treatment/i, category: "Construction & Infrastructure" },
  { pattern: /HVAC|cleaning|janitorial|landscaping|ground.?keeping|maintenance|security service|facility|custodial|pest control|waste|recycling/i, category: "Facilities & Maintenance" },
  { pattern: /health|medical|dental|clinic|nursing|patient|hospital|pharmaceutical|therapy|wellness|behavioral/i, category: "Healthcare & Social Services" },
  { pattern: /supply|equipment|purchase|procure|furniture|vehicle.?purchase|hardware|material|uniform|food service/i, category: "Equipment & Supplies" },
  { pattern: /transport|transit|fleet|fuel|logistics|shipping|freight|bus service|parking/i, category: "Transportation" },
  { pattern: /training|education|learning|instruction|tutoring|curriculum|vocational/i, category: "Education & Training" },
  { pattern: /consulting|professional service|legal|accounting|engineering|architect|survey|planning|research|marketing|advertis/i, category: "Professional Services" },
];

export function categorizeUsTender(params: {
  naicsCodesJson: unknown;
  title: string;
  description: string | null;
}): UsCategory {
  const naicsCodes = parseStringArray(params.naicsCodesJson);

  // Primary signal: NAICS sector (first 2 digits)
  for (const code of naicsCodes) {
    const sector = code.slice(0, 2);
    // Special case: 5415x = Computer Systems Design → IT & Software
    if (code.startsWith("5415")) return "IT & Software";
    if (NAICS_SECTOR_MAP[sector]) return NAICS_SECTOR_MAP[sector];
  }

  // Fallback: keyword matching on title + description
  const haystack = `${params.title} ${params.description ?? ""}`;
  for (const { pattern, category } of KEYWORD_PATTERNS) {
    if (pattern.test(haystack)) return category;
  }

  return "Other";
}
