import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { scrapeWebsite } from "@/lib/firecrawl";
import { settings } from "@/lib/config";
import { normalizeUsDate, type UsExtractedTender } from "@/lib/us/types";

export const NY_CONTRACT_REPORTER_URL = "https://www.nyscr.ny.gov/Ads/Search";
const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();

export interface NewYorkContractReporterListing {
  externalId: string;
  title: string;
  agency: string | null;
  category: string | null;
  adType: string | null;
  url: string;
  description: string;
  deadlineAt: Date | null;
}

const valueFor = ($: cheerio.CheerioAPI, $row: cheerio.Cheerio<AnyNode>, label: string): string | null => {
  for (const element of $row.find(".d-flex").toArray()) {
    const $group = $(element);
    const key = cleanText($group.find(".fw-bold").first().text()).replace(/:$/, "").toLowerCase();
    if (key !== label.toLowerCase()) continue;
    const values = $group.find(".px-2").toArray().map((value) => cleanText($(value).text())).filter(Boolean);
    return values.at(-1) ?? null;
  }
  return null;
};

export const parseNewYorkContractReporterHtml = (html: string, baseUrl = NY_CONTRACT_REPORTER_URL): NewYorkContractReporterListing[] => {
  const $ = cheerio.load(html);
  const listings: NewYorkContractReporterListing[] = [];

  $(".opp-list-item").each((_, row) => {
    const $row = $(row);
    const titleNode = $row.find("[title^='Full Title:']").first();
    const title = cleanText(titleNode.attr("title")?.replace(/^Full Title:\s*/i, "") ?? titleNode.text());
    const crNumber = valueFor($, $row, "cr#") ?? cleanText($row.attr("data-ad-id") ?? "");
    if (!title || !crNumber || /cancelled/i.test(cleanText($row.text()))) return;

    const url = new URL(baseUrl);
    url.searchParams.set("Status", "Open");
    url.searchParams.set("Keyword", crNumber);
    listings.push({
      externalId: crNumber,
      title,
      agency: valueFor($, $row, "agency"),
      category: valueFor($, $row, "category"),
      adType: valueFor($, $row, "ad type"),
      url: url.href,
      description: cleanText($row.text()),
      deadlineAt: normalizeUsDate(valueFor($, $row, "due date")),
    });
  });

  return listings;
};

export async function fetchNewYorkContractReporterOpportunities(): Promise<UsExtractedTender[]> {
  const listings = new Map<string, NewYorkContractReporterListing>();
  const pageSize = 25;

  for (let pageNumber = 0; pageNumber < settings.usPortalMaxPages; pageNumber += 1) {
    const url = new URL(NY_CONTRACT_REPORTER_URL);
    url.searchParams.set("Status", "Open");
    if (pageNumber > 0) url.searchParams.set("Skip", String(pageNumber * pageSize));
    const page = await scrapeWebsite(url.href, { onlyMainContent: false, waitMs: 1_000 });
    const pageListings = parseNewYorkContractReporterHtml(page.html, page.url);
    for (const listing of pageListings) listings.set(listing.externalId, listing);
    if (pageListings.length < pageSize) break;
  }

  return [...listings.values()].map((listing) => ({
    source: "new_york_contract_reporter",
    sourceKey: "new_york_contract_reporter",
    url: listing.url,
    externalId: listing.externalId,
    title: listing.title,
    description: listing.description,
    buyer: listing.agency,
    location: "New York",
    state: "NY",
    solicitationNumber: listing.externalId,
    naicsCodes: [],
    pscCodes: [],
    setAside: null,
    contractType: listing.adType,
    deadlineAt: listing.deadlineAt,
    contacts: [],
    attachments: [],
    metadata: {
      opportunity_kind: "state_local",
      source_listing: NY_CONTRACT_REPORTER_URL,
      category: listing.category,
      detail_access: "public listing; opportunity detail requires NYSCR account",
    },
  }));
}
