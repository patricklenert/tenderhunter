import * as cheerio from "cheerio";
import { settings } from "@/lib/config";
import { normalizeUsDate, type UsContact, type UsExtractedTender } from "@/lib/us/types";

const TEXAS_ESBD_URL = "https://www.txsmartbuy.gov/esbd";
const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();
const labelValue = (text: string, label: string, next: string): string | null =>
  text.match(new RegExp(`${label}:\\s*(.+?)(?=\\s*(?:${next}):|$)`, "i"))?.[1]?.trim() ?? null;

export async function fetchTexasEsbdOpportunities(): Promise<UsExtractedTender[]> {
  const candidates = new Map<string, { title: string; url: string }>();
  for (let page = 1; page <= settings.usPortalMaxPages; page += 1) {
    const url = new URL(TEXAS_ESBD_URL);
    if (page > 1) url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers: { "User-Agent": "Tenderhunter/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Texas ESBD request failed with HTTP ${response.status}`);
    const $ = cheerio.load(await response.text());
    $("a[href^='/esbd/']").each((_, element) => {
      const href = $(element).attr("href");
      const title = cleanText($(element).text());
      if (href && title) candidates.set(href, { title, url: new URL(href, TEXAS_ESBD_URL).href });
    });
  }

  const opportunities: UsExtractedTender[] = [];
  for (const candidate of candidates.values()) {
    const response = await fetch(candidate.url, { headers: { "User-Agent": "Tenderhunter/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) continue;
    const $ = cheerio.load(await response.text());
    const text = cleanText($("main, #main, body").first().text());
    const description = labelValue(text, "Solicitation Description", "Attachments") ?? candidate.title;
    const contactName = labelValue(text, "Contact Name", "Contact Number|Contact Email|Bid Response Email|Response Due Date");
    const contactPhone = labelValue(text, "Contact Number", "Contact Email|Bid Response Email|Response Due Date");
    const contactEmail = labelValue(text, "Contact Email", "Bid Response Email|Response Due Date");
    const responseEmail = labelValue(text, "Bid Response Email", "Response Due Date");
    const contacts: UsContact[] = [
      ...(contactName || contactPhone || contactEmail ? [{ ...(contactName ? { name: contactName } : {}), ...(contactPhone ? { phone: contactPhone } : {}), ...(contactEmail ? { email: contactEmail } : {}) }] : []),
      ...(responseEmail ? [{ email: responseEmail }] : []),
    ];
    const solicitationNumber = candidate.url.split("/").pop() ?? null;
    const dueDate = labelValue(text, "Response Due Date", "Response Due Time|Agency/Texas SmartBuy Member Number");
    opportunities.push({
      source: "texas_esbd",
      sourceKey: "texas_esbd",
      url: candidate.url,
      externalId: solicitationNumber ?? candidate.url,
      title: candidate.title,
      description,
      buyer: labelValue(text, "Agency/Texas SmartBuy Member Number", "Posting Requirement|State Agency Procurement|Solicitation Posting Date|Last Modified|Class/Item|Highway"),
      location: "Texas",
      state: "TX",
      solicitationNumber,
      naicsCodes: [...text.matchAll(/\b(\d{6})\b/g)].map((match) => match[1]),
      pscCodes: [],
      setAside: null,
      contractType: labelValue(text, "Status", "Contact Name|Contact Number|Contact Email"),
      deadlineAt: normalizeUsDate(dueDate),
      contacts,
      attachments: $("a[href]").toArray().flatMap((element) => {
        const href = $(element).attr("href");
        const name = cleanText($(element).text());
        return href && /attachment|download|document|pdf/i.test(`${href} ${name}`) ? [{ name: name || "Attachment", url: new URL(href, candidate.url).href }] : [];
      }),
      metadata: { opportunity_kind: "state_local", source_listing: TEXAS_ESBD_URL },
    });
  }
  return opportunities;
}
