import { fetchSamOpportunities } from "@/lib/us/sam-gov";
import { fetchSbaSubcontractingOpportunities } from "@/lib/us/sba-subcontracting";
import { fetchSbaSubnetOpportunities } from "@/lib/us/sba-subnet";
import { fetchTexasEsbdOpportunities } from "@/lib/us/texas-esbd";
import { fetchCaliforniaEprocureOpportunities, fetchDcOcpOpportunities, fetchVirginiaEvaOpportunities } from "@/lib/us/rendered-portals";
import { fetchGeorgiaGprOpportunities } from "@/lib/us/georgia-gpr";
import { fetchNewYorkOgsOpportunities } from "@/lib/us/new-york-ogs";
import { fetchNorthCarolinaEvpOpportunities } from "@/lib/us/north-carolina-evp";
import { fetchFloridaMfmpOpportunities } from "@/lib/us/florida-mfmp";
import { fetchNewYorkContractReporterOpportunities } from "@/lib/us/new-york-contract-reporter";
import { dedupeUsAttachments, type UsExtractedTender, type UsTenderSource } from "@/lib/us/types";

export type { UsExtractedTender } from "@/lib/us/types";

export interface UsScrapeResult {
  tenders: UsExtractedTender[];
  bySource: Record<UsTenderSource, number>;
  errors: Partial<Record<UsTenderSource, string>>;
  sourceRuns: Array<{
    source: UsTenderSource;
    status: "success" | "failed";
    discoveredCount: number;
    acceptedCount: number;
    errorMessage: string | null;
  }>;
}

export const US_TENDER_SOURCE_ADAPTERS: Array<[UsTenderSource, () => Promise<UsExtractedTender[]>]> = [
  ["sam_gov", fetchSamOpportunities],
  ["sba_subnet", fetchSbaSubnetOpportunities],
  ["sba_subcontracting", fetchSbaSubcontractingOpportunities],
  ["texas_esbd", fetchTexasEsbdOpportunities],
  ["virginia_eva", fetchVirginiaEvaOpportunities],
  ["dc_ocp", fetchDcOcpOpportunities],
  ["california_eprocure", fetchCaliforniaEprocureOpportunities],
  ["georgia_gpr", fetchGeorgiaGprOpportunities],
  ["new_york_ogs", fetchNewYorkOgsOpportunities],
  ["north_carolina_evp", fetchNorthCarolinaEvpOpportunities],
  ["florida_mfmp", fetchFloridaMfmpOpportunities],
  ["new_york_contract_reporter", fetchNewYorkContractReporterOpportunities],
];

export async function scrapeAllUsTenders(): Promise<UsScrapeResult> {
  const sources = US_TENDER_SOURCE_ADAPTERS;
  const settled = await Promise.allSettled(sources.map(([, scrape]) => scrape()));
  const bySource = Object.fromEntries(sources.map(([source]) => [source, 0])) as Record<UsTenderSource, number>;
  const errors: Partial<Record<UsTenderSource, string>> = {};
  const sourceRuns: UsScrapeResult["sourceRuns"] = [];
  const byIdentity = new Map<string, UsExtractedTender>();

  settled.forEach((result, index) => {
    const source = sources[index][0];
    if (result.status === "rejected") {
      const message = result.reason instanceof Error ? result.reason.message : "Unknown source error";
      errors[source] = message;
      sourceRuns.push({ source, status: "failed", discoveredCount: 0, acceptedCount: 0, errorMessage: message });
      console.warn(`[us-scraper] ${source}: ${message}`);
      return;
    }
    const normalizedTenders = result.value.map((tender) => ({
      ...tender,
      attachments: dedupeUsAttachments(tender.attachments, tender.url),
    }));
    const activeTenders = normalizedTenders.filter((tender) => {
      if (tender.deadlineAt && tender.deadlineAt.getTime() <= Date.now()) return false;
      return true;
    });
    bySource[source] = activeTenders.length;
    sourceRuns.push({ source, status: "success", discoveredCount: result.value.length, acceptedCount: activeTenders.length, errorMessage: null });
    for (const tender of activeTenders) {
      byIdentity.set(`${tender.source}:${tender.externalId}`, tender);
    }
  });

  return { tenders: [...byIdentity.values()], bySource, errors, sourceRuns };
}
