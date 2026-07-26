import * as cheerio from "cheerio";
import { settings } from "@/lib/config";
import { normalizeUsDate, normalizeUsState, type UsContact, type UsExtractedTender } from "@/lib/us/types";

const SBA_LIST_URL = "https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting/subcontracting-opportunities";

const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();

export async function fetchSbaSubcontractingOpportunities(): Promise<UsExtractedTender[]> {
  const opportunities: UsExtractedTender[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < settings.usPortalMaxPages; page += 1) {
    const url = new URL(SBA_LIST_URL);
    url.searchParams.set("state", "All");
    if (page > 0) url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers: { "User-Agent": "Tenderhunter/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`SBA subcontracting request failed with HTTP ${response.status}`);
    const $ = cheerio.load(await response.text());
    let pageCount = 0;

    $("a[href^='/opportunity/']").each((_, element) => {
      const title = cleanText($(element).text());
      const href = $(element).attr("href");
      if (!href || !title || seen.has(href)) return;
      seen.add(href);
      const row = $(element).closest("tr");
      if (!row.length) return;
      const fields = row.find("td");
      const cellClone = fields.eq(0).clone();
      cellClone.find("a").remove();
      cellClone.find(".subnet_title").remove();
      const description = cleanText(cellClone.text()) || cleanText(fields.eq(0).text());
      const closing = cleanText(fields.eq(1).text());
      const performanceStart = cleanText(fields.eq(2).text());
      const state = normalizeUsState(cleanText(fields.eq(3).text()));
      const naicsCodes = [...cleanText(fields.eq(4).text()).matchAll(/\b(\d{6})\b/g)].map((match) => match[1]);
      const contacts: UsContact[] = [];
      fields.eq(5).find("a[href^='mailto:']").each((__, contact) => {
        const email = $(contact).attr("href")?.replace(/^mailto:/i, "").split("?")[0];
        if (email) contacts.push({ name: cleanText($(contact).text()) || undefined, email });
      });
      fields.eq(5).find("a[href^='tel:']").each((__, contact) => {
        const phone = $(contact).attr("href")?.replace(/^tel:/i, "");
        if (phone) contacts.push({ phone });
      });
      opportunities.push({
        source: "sba_subcontracting",
        sourceKey: "sba_subcontracting",
        url: new URL(href, SBA_LIST_URL).href,
        externalId: href,
        title,
        description,
        buyer: null,
        location: state,
        state,
        solicitationNumber: null,
        naicsCodes,
        pscCodes: [],
        setAside: null,
        contractType: "Subcontracting opportunity",
        deadlineAt: normalizeUsDate(closing),
        contacts,
        attachments: [],
        metadata: { subcontracting: true, source_listing: SBA_LIST_URL, performance_start: performanceStart || null },
      });
      pageCount += 1;
    });

    if (pageCount === 0) break;
  }

  return opportunities;
}
