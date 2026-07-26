import * as cheerio from "cheerio";
import { normalizeUsDate, type UsExtractedTender } from "@/lib/us/types";

const NY_OGS_URL = "https://ogs.ny.gov/procurement/bid-opportunities";
const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();

export async function fetchNewYorkOgsOpportunities(): Promise<UsExtractedTender[]> {
  const response = await fetch(NY_OGS_URL, { headers: { "User-Agent": "Tenderhunter/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`New York OGS request failed with HTTP ${response.status}`);

  const $ = cheerio.load(await response.text());
  const opportunities: UsExtractedTender[] = [];
  const seen = new Set<string>();

  $("table tbody tr, .view-content .views-row").each((_, row) => {
    const $row = $(row);
    const link = $row.find("a[href]").toArray().map((a) => ({ text: cleanText($(a).text()), href: $(a).attr("href") ?? "" })).find((l) => l.text.length > 5 && l.href);
    if (!link) return;

    const text = cleanText($row.text());
    const bidNumber = link.href.match(/(\d{3,6})/)?.[1] ?? null;
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    const deadlineAt = dateMatch ? normalizeUsDate(dateMatch[1]) : null;

    if (/cancelled/i.test(text)) return;

    const externalId = bidNumber ?? link.href;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    opportunities.push({
      source: "new_york_ogs",
      sourceKey: "new_york_ogs",
      url: new URL(link.href, NY_OGS_URL).href,
      externalId,
      title: link.text,
      description: link.text,
      buyer: "New York OGS",
      location: "New York",
      state: "NY",
      solicitationNumber: bidNumber,
      naicsCodes: [],
      pscCodes: [],
      setAside: null,
      contractType: null,
      deadlineAt,
      contacts: [],
      attachments: [],
      metadata: { opportunity_kind: "state_local", source_listing: NY_OGS_URL },
    });
  });

  return opportunities;
}
