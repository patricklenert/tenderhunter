import * as cheerio from "cheerio";
import { scrapeWebsite } from "@/lib/firecrawl";
import { dedupeUsAttachments, normalizeUsDate, type UsExtractedTender } from "@/lib/us/types";

const GPR_URL = "https://ssl.doas.state.ga.us/gpr/index";
const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();
const GPR_ATTACHMENT_HINT = /(?:downloadAttachment|attachment|document|download|\.pdf(?:$|[?#])|\.docx?(?:$|[?#])|\.xlsx?(?:$|[?#])|\.zip(?:$|[?#]))/i;

export const parseGeorgiaGprDetailAttachments = (html: string, baseUrl: string): Array<{ name: string; url: string }> => {
  const $ = cheerio.load(html);
  const candidates = $("a[href]").toArray().flatMap((element) => {
    const href = $(element).attr("href")?.trim();
    const name = cleanText($(element).text()) || cleanText($(element).attr("title") ?? "") || "Attachment";
    return href && GPR_ATTACHMENT_HINT.test(`${href} ${name}`) ? [{ name, url: href }] : [];
  });
  return dedupeUsAttachments(candidates, baseUrl);
};

export async function fetchGeorgiaGprOpportunities(): Promise<UsExtractedTender[]> {
  const page = await scrapeWebsite(GPR_URL, { onlyMainContent: false, waitMs: 3_000 });
  const $ = cheerio.load(page.html);
  const candidates: Array<{
    eventId: string;
    title: string;
    entity: string;
    url: string;
    deadlineAt: Date | null;
  }> = [];
  const seen = new Set<string>();

  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return;

    const eventId = cleanText(cells.eq(1).text());
    const title = cleanText(cells.eq(2).text());
    const entity = cleanText(cells.eq(3).text());
    const endDateRaw = cleanText(cells.eq(5).text());
    const link = $(row).find(`a[href*="eventDetails"]`).first().attr("href");

    if (!eventId || !title || seen.has(eventId)) return;
    seen.add(eventId);

    const url = link ? new URL(link, GPR_URL).href : `${GPR_URL}?eSourceNumber=${encodeURIComponent(eventId)}`;
    const deadlineAt = normalizeUsDate(endDateRaw.replace(/\s*@\s*/, " "));

    candidates.push({ eventId, title, entity, url, deadlineAt });
  });

  const detailAttachments = new Map<string, Array<{ name: string; url: string }>>();
  for (let index = 0; index < candidates.length; index += 4) {
    const details = await Promise.allSettled(candidates.slice(index, index + 4).map(async (candidate) => {
      const detail = await scrapeWebsite(candidate.url, { onlyMainContent: false, waitMs: 1_000 });
      return { url: candidate.url, attachments: parseGeorgiaGprDetailAttachments(detail.html, detail.url) };
    }));
    for (const detail of details) {
      if (detail.status === "fulfilled") detailAttachments.set(detail.value.url, detail.value.attachments);
    }
  }

  return candidates.map((candidate) => ({
    source: "georgia_gpr",
    sourceKey: "georgia_gpr",
    url: candidate.url,
    externalId: candidate.eventId,
    title: candidate.title,
    description: `${candidate.title} — ${candidate.entity}`,
    buyer: candidate.entity || null,
    location: "Georgia",
    state: "GA",
    solicitationNumber: candidate.eventId,
    naicsCodes: [],
    pscCodes: [],
    setAside: null,
    contractType: null,
    deadlineAt: candidate.deadlineAt,
    contacts: [],
    attachments: dedupeUsAttachments(detailAttachments.get(candidate.url) ?? [], candidate.url),
    metadata: { opportunity_kind: "state_local", source_listing: GPR_URL },
  }));
}
