import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { closeTrackedBrowserContext, createTrackedBrowserContext, readStablePageContent } from "@/lib/firecrawl";
import { dedupeUsAttachments, normalizeUsDate, type UsContact, type UsExtractedTender } from "@/lib/us/types";

const MFMP_URL = "https://vendor.myfloridamarketplace.com/search/bids";
const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();
const MFMP_ATTACHMENT_HINT = /(?:attachment|download|document|file|addendum|exhibit|appendix|\.pdf(?:$|[?#])|\.docx?(?:$|[?#])|\.xlsx?(?:$|[?#])|\.zip(?:$|[?#]))/i;

export interface FloridaMfmpListing {
  externalId: string;
  adNumber: string;
  agencyAdvertisementNumber: string | null;
  title: string;
  organization: string | null;
  adType: string | null;
  status: string | null;
  startDate: Date | null;
  endDate: Date | null;
  url: string;
}

export interface FloridaMfmpDetail {
  description: string;
  contacts: UsContact[];
}

const cellTexts = ($: cheerio.CheerioAPI, $row: cheerio.Cheerio<AnyNode>): string[] =>
  $row.find("td").toArray().map((cell) => cleanText($(cell).text()));

export const parseFloridaMfmpListingHtml = (html: string, baseUrl = MFMP_URL): FloridaMfmpListing[] => {
  const $ = cheerio.load(html);
  const listings: FloridaMfmpListing[] = [];

  $("table tr").each((_, row) => {
    const cells = cellTexts($, $(row));
    if (cells.length < 9 || /^title$/i.test(cells[0])) return;
    const adNumber = cells[1].match(/\b[A-Z]{1,8}-\d+\b/i)?.[0] ?? "";
    const numericId = adNumber.match(/(\d+)$/)?.[1];
    const title = cells[0];
    if (!adNumber || !numericId || !title) return;

    let url: string;
    try {
      url = new URL(`/search/bids/detail/${numericId}`, baseUrl).href;
    } catch {
      return;
    }

    listings.push({
      externalId: adNumber,
      adNumber,
      agencyAdvertisementNumber: cells[2] || null,
      title,
      organization: cells[4] || null,
      adType: cells[5] || null,
      status: cells[8] || null,
      startDate: normalizeUsDate(cells[6]),
      endDate: normalizeUsDate(cells[7]),
      url,
    });
  });

  return listings;
};

export const parseFloridaMfmpDetailHtml = (html: string): FloridaMfmpDetail => {
  const $ = cheerio.load(html);
  const contacts: UsContact[] = [];
  const name = cleanText($("#mainSection").text()).match(/Name:\s*([^\n]+?)(?=\s+Phone:|\s+Address:|\s+Email:|$)/i)?.[1]?.trim();
  const phone = cleanText($("#mainSection").text()).match(/Phone:\s*([^\n]+?)(?=\s+Address:|\s+Email:|$)/i)?.[1]?.trim();
  const email = $("a[href^='mailto:']").first().attr("href")?.replace(/^mailto:/i, "").split("?")[0].trim();
  if (name || phone || email) contacts.push({ ...(name ? { name } : {}), ...(phone ? { phone } : {}), ...(email ? { email } : {}) });

  return {
    description: cleanText($("#mainSection").text()),
    contacts,
  };
};

export const parseFloridaMfmpDetailAttachments = (html: string, baseUrl: string): Array<{ name: string; url: string }> => {
  const $ = cheerio.load(html);
  const candidates = $("a[href]").toArray().flatMap((element) => {
    const href = $(element).attr("href")?.trim();
    const name = cleanText($(element).text()) || cleanText($(element).attr("title") ?? "") || "Attachment";
    return href && MFMP_ATTACHMENT_HINT.test(`${href} ${name}`) ? [{ name, url: href }] : [];
  });
  return dedupeUsAttachments(candidates, baseUrl);
};

const captureFloridaDetail = async (
  listing: FloridaMfmpListing,
): Promise<{ detail: FloridaMfmpDetail; attachments: Array<{ name: string; url: string }> }> => {
  const context = await createTrackedBrowserContext();
  const attachmentNames = new Map<string, string>();
  let activeDocumentName = "Attachment";

  try {
    const page = await context.newPage();
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (/\/mfmp\/bids\/detail\/attachment\/download(?:\?|\/)/i.test(url)) {
        attachmentNames.set(url, activeDocumentName);
        await route.abort();
        return;
      }
      await route.continue();
    });

    await page.goto(listing.url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(500);
    const html = await readStablePageContent(page);
    const domAttachments = parseFloridaMfmpDetailAttachments(html, page.url());
    const documentLinks = page.locator("a.document-link");
    for (let index = 0; index < await documentLinks.count(); index += 1) {
      const link = documentLinks.nth(index);
      activeDocumentName = cleanText(await link.innerText()) || cleanText((await link.getAttribute("title")) ?? "") || "Attachment";
      await link.click({ noWaitAfter: true }).catch(() => {});
      await page.waitForTimeout(100);
    }
    const capturedAttachments = [...attachmentNames].map(([url, name]) => ({ name, url }));
    return {
      detail: parseFloridaMfmpDetailHtml(html),
      attachments: dedupeUsAttachments([...domAttachments, ...capturedAttachments], listing.url),
    };
  } finally {
    await closeTrackedBrowserContext(context);
  }
};

export async function fetchFloridaMfmpOpportunities(): Promise<UsExtractedTender[]> {
  const context = await createTrackedBrowserContext();

  try {
    const page = await context.newPage();
    await page.goto(MFMP_URL, { waitUntil: "networkidle", timeout: 30_000 });
    const statusPanel = page.locator("mat-expansion-panel-header", { hasText: "Ad Status" }).first();
    if (await statusPanel.count()) {
      await statusPanel.click();
      const openOption = page.getByRole("option", { name: "OPEN", exact: true });
      if (await openOption.count()) await openOption.click();
    }
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForTimeout(1_500);
    const listings = parseFloridaMfmpListingHtml(await readStablePageContent(page), page.url());
    const enriched = new Map<string, { detail: FloridaMfmpDetail; attachments: Array<{ name: string; url: string }> }>();

    for (const listing of listings) {
      try {
        enriched.set(listing.externalId, await captureFloridaDetail(listing));
      } catch {
        // Keep the public listing when an individual detail page is unavailable.
      }
    }

    return listings.map((listing) => {
      const detail = enriched.get(listing.externalId);
      return {
        source: "florida_mfmp",
        sourceKey: "florida_mfmp",
        url: listing.url,
        externalId: listing.externalId,
        title: listing.title,
        description: detail?.detail.description || listing.title,
        buyer: listing.organization,
        location: "Florida",
        state: "FL",
        solicitationNumber: listing.agencyAdvertisementNumber,
        naicsCodes: [],
        pscCodes: [],
        setAside: null,
        contractType: listing.adType,
        deadlineAt: listing.endDate,
        contacts: detail?.detail.contacts ?? [],
        attachments: dedupeUsAttachments(detail?.attachments ?? [], listing.url),
        metadata: {
          opportunity_kind: "state_local",
          source_listing: MFMP_URL,
          ad_number: listing.adNumber,
          status: listing.status,
        },
      } satisfies UsExtractedTender;
    });
  } finally {
    await closeTrackedBrowserContext(context);
  }
}
