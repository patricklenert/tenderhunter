import * as cheerio from "cheerio";
import { scrapeWebsite } from "@/lib/firecrawl";
import { normalizeUsDate, type UsExtractedTender, type UsTenderSource } from "@/lib/us/types";

type PortalDefinition = {
  source: Extract<UsTenderSource, "virginia_eva" | "dc_ocp" | "california_eprocure">;
  sourceKey: string;
  url: string;
  state: "VA" | "DC" | "CA";
};

const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();

async function fetchRenderedPortal(definition: PortalDefinition): Promise<UsExtractedTender[]> {
  const page = await scrapeWebsite(definition.url, { onlyMainContent: false, useBodyText: true, waitMs: 2_000 });
  const $ = cheerio.load(page.html);
  const tenders: UsExtractedTender[] = [];
  const seen = new Set<string>();

  $("tr").each((_, row) => {
    const text = cleanText($(row).text());
    const deadlineMatch = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?\b/i) ?? text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (!deadlineMatch) return;
    const link = $(row).find("a[href]").toArray().map((element) => ({ href: $(element).attr("href"), title: cleanText($(element).text()) })).find((item) => item.href && !item.href.startsWith("#") && !item.href.startsWith("javascript:") && item.title.length > 4);
    if (!link?.href || !link.title) return;
    const url = new URL(link.href, definition.url).href;
    if (seen.has(url)) return;
    seen.add(url);
    tenders.push({
      source: definition.source,
      sourceKey: definition.sourceKey,
      url,
      externalId: url,
      title: link.title,
      description: text,
      buyer: null,
      location: definition.state,
      state: definition.state,
      solicitationNumber: null,
      naicsCodes: [...text.matchAll(/\b(\d{6})\b/g)].map((match) => match[1]),
      pscCodes: [],
      setAside: null,
      contractType: "State and local opportunity",
      deadlineAt: normalizeUsDate(deadlineMatch[0]),
      contacts: [],
      attachments: [],
      metadata: { opportunity_kind: "state_local", rendered_portal: true, source_listing: definition.url },
    });
  });

  return tenders;
}

export const fetchVirginiaEvaOpportunities = (): Promise<UsExtractedTender[]> => fetchRenderedPortal({
  source: "virginia_eva",
  sourceKey: "virginia_eva",
  url: "https://mvendor.cgieva.com/Vendor/public/AllOpportunities.jsp?status=Open",
  state: "VA",
});

export const fetchDcOcpOpportunities = (): Promise<UsExtractedTender[]> => fetchRenderedPortal({
  source: "dc_ocp",
  sourceKey: "dc_ocp",
  url: "https://contracts.ocp.dc.gov/solicitations/search",
  state: "DC",
});

export const fetchCaliforniaEprocureOpportunities = (): Promise<UsExtractedTender[]> => fetchRenderedPortal({
  source: "california_eprocure",
  sourceKey: "california_eprocure",
  url: "https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx",
  state: "CA",
});
