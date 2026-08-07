import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { scrapeWebsite } from "@/lib/firecrawl";
import { dedupeUsAttachments, normalizeUsDate, type UsExtractedTender } from "@/lib/us/types";

const NC_EVP_URL = "https://evp.nc.gov/solicitations/?status=0";
const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();
const NC_ATTACHMENT_HINT = /(?:\/_entity\/annotation\/|attachment|download|document|file|addendum|\.pdf(?:$|[?#])|\.docx?(?:$|[?#])|\.xlsx?(?:$|[?#])|\.zip(?:$|[?#]))/i;

export interface NorthCarolinaEvpListing {
  externalId: string;
  solicitationNumber: string | null;
  title: string;
  description: string;
  buyer: string | null;
  status: string | null;
  url: string;
  deadlineAt: Date | null;
  naicsCodes: string[];
}

const fieldText = ($row: cheerio.Cheerio<AnyNode>, attribute: string): string | null => {
  const field = $row.find(`[data-attribute="${attribute}"]`).first();
  if (!field.length) return null;
  return cleanText(field.attr("aria-label") ?? field.attr("data-value") ?? field.text()) || null;
};

const fieldDate = ($row: cheerio.Cheerio<AnyNode>, attribute: string): string | null => {
  const field = $row.find(`[data-attribute="${attribute}"]`).first();
  return cleanText(field.find("time[datetime]").first().attr("datetime") ?? field.attr("aria-label") ?? field.attr("data-value") ?? field.text()) || null;
};

export const parseNorthCarolinaEvpListingHtml = (html: string, baseUrl = NC_EVP_URL): NorthCarolinaEvpListing[] => {
  const $ = cheerio.load(html);
  const listings: NorthCarolinaEvpListing[] = [];

  $("tr[data-entity='evp_solicitation'], tr[data-id]").each((_, row) => {
    const $row = $(row);
    const detailHref = $row.find("a[href*='/solicitations/details']").first().attr("href");
    const title = cleanText($row.attr("data-name") ?? fieldText($row, "evp_name") ?? $row.find("td").eq(1).text());
    const solicitationNumber = fieldText($row, "evp_solicitationnbr") ?? (cleanText($row.find("td").first().text()) || null);
    const externalId = cleanText($row.attr("data-id") ?? solicitationNumber ?? detailHref ?? "");
    if (!detailHref || !title || !externalId) return;

    let url: string;
    try {
      url = new URL(detailHref, baseUrl).href;
    } catch {
      return;
    }

    const status = fieldText($row, "statuscode");
    if (status && /cancel|closed|awarded/i.test(status)) return;

    const description = fieldText($row, "evp_description") ?? title;
    const buyer = fieldText($row, "owningbusinessunit");
    const deadlineAt = normalizeUsDate(fieldDate($row, "evp_opendate"));
    const naicsCodes = [...cleanText($row.text()).matchAll(/\b(\d{6})\b/g)].map((match) => match[1]);
    listings.push({ externalId, solicitationNumber, title, description, buyer, status, url, deadlineAt, naicsCodes });
  });

  return listings;
};

export const parseNorthCarolinaEvpDetailAttachments = (html: string, baseUrl: string): Array<{ name: string; url: string }> => {
  const $ = cheerio.load(html);
  const candidates = $("a[href]").toArray().flatMap((element) => {
    const href = $(element).attr("href")?.trim();
    const name = cleanText($(element).text()) || cleanText($(element).attr("title") ?? "") || "Attachment";
    return href && NC_ATTACHMENT_HINT.test(`${href} ${name}`) ? [{ name, url: href }] : [];
  });
  return dedupeUsAttachments(candidates, baseUrl);
};

export async function fetchNorthCarolinaEvpOpportunities(): Promise<UsExtractedTender[]> {
  const page = await scrapeWebsite(NC_EVP_URL, { onlyMainContent: false, waitMs: 2_000 });
  const listings = parseNorthCarolinaEvpListingHtml(page.html, page.url);
  const detailAttachments = new Map<string, Array<{ name: string; url: string }>>();

  for (let index = 0; index < listings.length; index += 4) {
    const details = await Promise.allSettled(listings.slice(index, index + 4).map(async (listing) => {
      const detail = await scrapeWebsite(listing.url, { onlyMainContent: false, waitMs: 1_000 });
      return { url: listing.url, attachments: parseNorthCarolinaEvpDetailAttachments(detail.html, detail.url) };
    }));
    for (const detail of details) {
      if (detail.status === "fulfilled") detailAttachments.set(detail.value.url, detail.value.attachments);
    }
  }

  return listings.map((listing) => ({
    source: "north_carolina_evp",
    sourceKey: "north_carolina_evp",
    url: listing.url,
    externalId: listing.externalId,
    title: listing.title,
    description: listing.description,
    buyer: listing.buyer,
    location: "North Carolina",
    state: "NC",
    solicitationNumber: listing.solicitationNumber,
    naicsCodes: listing.naicsCodes,
    pscCodes: [],
    setAside: null,
    contractType: listing.status ?? "State and local opportunity",
    deadlineAt: listing.deadlineAt,
    contacts: [],
    attachments: dedupeUsAttachments(detailAttachments.get(listing.url) ?? [], listing.url),
    metadata: { opportunity_kind: "state_local", source_listing: NC_EVP_URL, status: listing.status },
  }));
}
