import * as cheerio from "cheerio";
import { scrapeWebsite } from "@/lib/firecrawl";
import { dedupeUsAttachments, normalizeUsDate, type UsExtractedTender, type UsTenderSource } from "@/lib/us/types";

type PortalDefinition = {
  source: Extract<UsTenderSource, "virginia_eva" | "dc_ocp" | "california_eprocure">;
  sourceKey: string;
  url: string;
  state: "VA" | "DC" | "CA";
};

const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();
const ATTACHMENT_HINT = /(?:attachment|download|document|file|addendum|exhibit|appendix|specification|bid[ -]?package|\.pdf(?:$|[?#])|\.docx?(?:$|[?#])|\.xlsx?(?:$|[?#])|\.zip(?:$|[?#]))/i;
const DETAIL_BATCH_SIZE = 4;

export const parseRenderedPortalAttachments = (html: string, baseUrl: string): Array<{ name: string; url: string }> => {
  const $ = cheerio.load(html);
  const candidates = $("a[href]").toArray().flatMap((element) => {
    const href = $(element).attr("href")?.trim();
    const name = cleanText($(element).text()) || cleanText($(element).attr("title") ?? "") || "Attachment";
    return href && ATTACHMENT_HINT.test(`${href} ${name}`) ? [{ name, url: href }] : [];
  });
  return dedupeUsAttachments(candidates, baseUrl);
};

async function fetchRenderedPortal(definition: PortalDefinition): Promise<UsExtractedTender[]> {
  const page = await scrapeWebsite(definition.url, { onlyMainContent: false, useBodyText: true, waitMs: 2_000 });
  const $ = cheerio.load(page.html);
  const candidates: Array<{ url: string; title: string; description: string; deadlineAt: Date | null; naicsCodes: string[] }> = [];
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
    candidates.push({
      url,
      title: link.title,
      description: text,
      deadlineAt: normalizeUsDate(deadlineMatch[0]),
      naicsCodes: [...text.matchAll(/\b(\d{6})\b/g)].map((match) => match[1]),
    });
  });

  const detailAttachments = new Map<string, Array<{ name: string; url: string }>>();
  for (let index = 0; index < candidates.length; index += DETAIL_BATCH_SIZE) {
    const batch = candidates.slice(index, index + DETAIL_BATCH_SIZE);
    const details = await Promise.allSettled(batch.map(async (candidate) => {
      const detail = await scrapeWebsite(candidate.url, { onlyMainContent: false, waitMs: 1_000 });
      return { url: candidate.url, attachments: parseRenderedPortalAttachments(detail.html, detail.url) };
    }));
    for (const detail of details) {
      if (detail.status === "fulfilled") detailAttachments.set(detail.value.url, detail.value.attachments);
    }
  }

  return candidates.map((candidate) => ({
    source: definition.source,
    sourceKey: definition.sourceKey,
    url: candidate.url,
    externalId: candidate.url,
    title: candidate.title,
    description: candidate.description,
    buyer: null,
    location: definition.state,
    state: definition.state,
    solicitationNumber: null,
    naicsCodes: candidate.naicsCodes,
    pscCodes: [],
    setAside: null,
    contractType: "State and local opportunity",
    deadlineAt: candidate.deadlineAt,
    contacts: [],
    attachments: dedupeUsAttachments(detailAttachments.get(candidate.url) ?? [], candidate.url),
    metadata: { opportunity_kind: "state_local", rendered_portal: true, source_listing: definition.url },
  }));
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
