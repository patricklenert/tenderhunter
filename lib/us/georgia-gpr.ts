import * as cheerio from "cheerio";
import { scrapeWebsite } from "@/lib/firecrawl";
import { normalizeUsDate, type UsExtractedTender } from "@/lib/us/types";

const GPR_URL = "https://ssl.doas.state.ga.us/gpr/index";
const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();

export async function fetchGeorgiaGprOpportunities(): Promise<UsExtractedTender[]> {
  const page = await scrapeWebsite(GPR_URL, { onlyMainContent: false, waitMs: 3_000 });
  const $ = cheerio.load(page.html);
  const opportunities: UsExtractedTender[] = [];
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

    opportunities.push({
      source: "georgia_gpr",
      sourceKey: "georgia_gpr",
      url,
      externalId: eventId,
      title,
      description: `${title} — ${entity}`,
      buyer: entity || null,
      location: "Georgia",
      state: "GA",
      solicitationNumber: eventId,
      naicsCodes: [],
      pscCodes: [],
      setAside: null,
      contractType: null,
      deadlineAt,
      contacts: [],
      attachments: [],
      metadata: { opportunity_kind: "state_local", source_listing: GPR_URL },
    });
  });

  return opportunities;
}
