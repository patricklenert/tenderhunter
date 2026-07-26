import { deriveBundesland, deriveCity, normalizeBundesland, type Bundesland } from "@/lib/bundesland";

const NATIONWIDE_REGIONS = new Set([
  "deutschland",
  "deutschlandweit",
  "bundesweit",
  "germany",
  "dach",
  "d a ch",
]);

const toText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const normalizeText = (value: string): string =>
  value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export type LocationSource = "tender_bundesland" | "tender_city" | "metadata" | "structured" | "unknown";

export interface TenderLocationInput {
  bundesland?: unknown;
  city?: unknown;
  metadataLocation?: unknown;
  structuredLocation?: unknown;
}

export interface NormalizedTenderLocation {
  bundesland: Bundesland | null;
  city: string | null;
  label: string | null;
  source: LocationSource;
}

export interface OperatingArea {
  nationwide: boolean;
  bundeslaender: Bundesland[];
  unresolvedRegions: string[];
}

export type LocationEligibilityStatus =
  | "match"
  | "mismatch"
  | "tender_location_unknown"
  | "company_location_unknown";

export interface LocationEligibility {
  status: LocationEligibilityStatus;
  reason: string;
  tender: NormalizedTenderLocation;
  operatingArea: OperatingArea;
}

export function normalizeOperatingArea(regions: string[]): OperatingArea {
  const bundeslaender = new Set<Bundesland>();
  const unresolvedRegions: string[] = [];
  let nationwide = false;

  for (const rawRegion of regions) {
    const region = rawRegion.trim();
    if (!region) continue;

    if (NATIONWIDE_REGIONS.has(normalizeText(region))) {
      nationwide = true;
      continue;
    }

    const bundesland = normalizeBundesland(region) ?? deriveBundesland(region);
    if (bundesland) {
      bundeslaender.add(bundesland);
    } else {
      unresolvedRegions.push(region);
    }
  }

  return {
    nationwide,
    bundeslaender: [...bundeslaender],
    unresolvedRegions,
  };
}

export function normalizeTenderLocation(input: TenderLocationInput): NormalizedTenderLocation {
  const candidates: Array<{ source: Exclude<LocationSource, "unknown">; value: string | null }> = [
    { source: "tender_bundesland", value: toText(input.bundesland) },
    { source: "tender_city", value: toText(input.city) },
    { source: "metadata", value: toText(input.metadataLocation) },
    { source: "structured", value: toText(input.structuredLocation) },
  ];

  let city: string | null = null;
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    city ??= deriveCity(candidate.value);

    const bundesland = normalizeBundesland(candidate.value) ?? deriveBundesland(candidate.value);
    if (bundesland) {
      return {
        bundesland,
        city,
        label: city ? `${city}, ${bundesland}` : bundesland,
        source: candidate.source,
      };
    }
  }

  return { bundesland: null, city, label: city, source: "unknown" };
}

export function assessLocationEligibility(regions: string[], input: TenderLocationInput): LocationEligibility {
  const operatingArea = normalizeOperatingArea(regions);
  const tender = normalizeTenderLocation(input);

  if (operatingArea.nationwide) {
    return {
      status: "match",
      reason: "Das Firmenprofil erlaubt bundesweite Einsätze.",
      tender,
      operatingArea,
    };
  }

  if (operatingArea.bundeslaender.length === 0) {
    return {
      status: "company_location_unknown",
      reason: "Das Einsatzgebiet im Firmenprofil ist nicht eindeutig einem Bundesland zugeordnet.",
      tender,
      operatingArea,
    };
  }

  if (!tender.bundesland) {
    return {
      status: "tender_location_unknown",
      reason: "Der Ausführungsort der Ausschreibung ist nicht eindeutig erkannt.",
      tender,
      operatingArea,
    };
  }

  if (operatingArea.bundeslaender.includes(tender.bundesland)) {
    return {
      status: "match",
      reason: `Der Ausführungsort liegt im Einsatzgebiet (${tender.bundesland}).`,
      tender,
      operatingArea,
    };
  }

  return {
    status: "mismatch",
    reason: `${tender.bundesland} liegt außerhalb des hinterlegten Einsatzgebiets.`,
    tender,
    operatingArea,
  };
}
