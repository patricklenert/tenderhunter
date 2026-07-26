import * as cheerio from "cheerio";
import { normalizeUsDate, type UsExtractedTender } from "@/lib/us/types";

const DEFAULT_SBA_SUBNET_URL = "https://subnet.sba.gov/client/dsp_Landing.cfm";

const absoluteUrl = (href: string, baseUrl: string): string | null => {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
};

const extractDeadline = (text: string): Date | null => {
  const match = text.match(/(?:due(?:\s+date)?|response\s+date|deadline)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  return normalizeUsDate(match?.[1]);
};

const extractNaics = (text: string): string[] => [...text.matchAll(/\b(\d{6})\b/g)].map((match) => match[1]);

/**
 * SUB-Net does not offer a stable public API. This parser deliberately accepts
 * both the legacy SBA listing table and linked opportunity cards.
 */
export async function fetchSbaSubnetOpportunities(): Promise<UsExtractedTender[]> {
  const sourceUrl = process.env.SBA_SUBNET_URL?.trim() || DEFAULT_SBA_SUBNET_URL;
  const sourceHost = new URL(sourceUrl).hostname;
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "Tenderhunter/1.0 (+https://tenderhunter.us)", Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`SBA SUB-Net request failed with HTTP ${response.status}`);
  if (new URL(response.url).hostname !== sourceHost) {
    console.warn("[us/sba-subnet] SUB-Net redirected to a different SBA site; no subcontracting listings were ingested.");
    return [];
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const tenders: UsExtractedTender[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    const title = $(element).text().replace(/\s+/g, " ").trim();
    const href = $(element).attr("href");
    if (!href || title.length < 12) return;
    const url = absoluteUrl(href, sourceUrl);
    if (!url || !/subnet|opportun|solicitation|detail/i.test(url)) return;
    const containerText = $(element).closest("tr, article, li, div").text().replace(/\s+/g, " ").trim();
    const deadlineAt = extractDeadline(containerText);
    const naicsCodes = extractNaics(containerText);
    if (!deadlineAt && naicsCodes.length === 0) return;
    const fingerprint = `${title}:${url}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    tenders.push({
      source: "sba_subnet",
      sourceKey: "sba_subnet",
      url,
      externalId: url,
      title,
      description: containerText,
      buyer: null,
      location: null,
      state: null,
      solicitationNumber: null,
      naicsCodes,
      pscCodes: [],
      setAside: null,
      contractType: "Subcontracting opportunity",
      deadlineAt,
      contacts: [],
      attachments: [],
      metadata: { subcontracting: true, listing_url: sourceUrl },
    });
  });

  return tenders;
}
