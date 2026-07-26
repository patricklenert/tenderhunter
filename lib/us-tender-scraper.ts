import { fetchSamOpportunities } from "@/lib/us/sam-gov";
import { fetchSbaSubcontractingOpportunities } from "@/lib/us/sba-subcontracting";
import { fetchTexasEsbdOpportunities } from "@/lib/us/texas-esbd";
import { fetchCaliforniaEprocureOpportunities, fetchDcOcpOpportunities, fetchVirginiaEvaOpportunities } from "@/lib/us/rendered-portals";
import { fetchGeorgiaGprOpportunities } from "@/lib/us/georgia-gpr";
import { fetchNewYorkOgsOpportunities } from "@/lib/us/new-york-ogs";
import { type UsExtractedTender, type UsTenderSource } from "@/lib/us/types";

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

export async function scrapeAllUsTenders(): Promise<UsScrapeResult> {
  const sources: Array<[UsTenderSource, () => Promise<UsExtractedTender[]>]> = [
    ["sam_gov", fetchSamOpportunities],
    ["sba_subcontracting", fetchSbaSubcontractingOpportunities],
    ["texas_esbd", fetchTexasEsbdOpportunities],
    ["virginia_eva", fetchVirginiaEvaOpportunities],
    ["dc_ocp", fetchDcOcpOpportunities],
    ["california_eprocure", fetchCaliforniaEprocureOpportunities],
    ["georgia_gpr", fetchGeorgiaGprOpportunities],
    ["new_york_ogs", fetchNewYorkOgsOpportunities],
  ];
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
    const activeTenders = result.value.filter((tender) => {
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
