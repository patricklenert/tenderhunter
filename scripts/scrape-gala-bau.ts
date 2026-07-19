import "dotenv/config";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const GALA_BAU_CPV = [
  "77300000-3",
  "77310000-6",
  "77314000-8",
  "45112700-2",
  "45112710-5",
];

const PORTALS = [
  { name: "metropoleruhr", baseUrl: "https://www.vergabe.metropoleruhr.de", prefix: "/VMPSatellite" },
  { name: "vmp-rheinland", baseUrl: "https://www.vmp-rheinland.de", prefix: "/VMPSatellite" },
  { name: "blb-nrw", baseUrl: "https://evergabe.blb.nrw.de", prefix: "/Vergabe" },
  { name: "westfalen", baseUrl: "https://www.vergabe-westfalen.de", prefix: "/VMPSatellite" },
  { name: "wirtschaftsregion-aachen", baseUrl: "https://www.vergaben-wirtschaftsregion-aachen.de", prefix: "/VMPSatellite" },
];

interface ScrapedTender {
  source: string;
  url: string;
  title: string;
  client: string;
  deadline: string | null;
  description: string;
  location: string;
  pdfUrls: string[];
}

async function scrapeDetail(url: string, portalName: string): Promise<ScrapedTender | null> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) return null;

    const html = await resp.text();
    const finalUrl = resp.url;

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : "";
    title = title.replace(/\s+/g, " ");
    if (title.length < 5 || title.toLowerCase().includes("fehler") || title.toLowerCase().includes("not found")) return null;

    // Extract text content
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, .cookie, .consent").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();

    // Extract client (Vergabestelle/Auftraggeber)
    let client = "";
    const clientMatch = bodyText.match(/(?:Vergabestelle|Auftraggeber|Name und Anschrift)[:\s]*([^\.]{10,100})/i);
    if (clientMatch) client = clientMatch[1].trim();

    // Extract deadline (Bietfrist/Angebotsfrist)
    let deadline: string | null = null;
    const deadlineMatch = bodyText.match(/(?:Bietfrist|Angebotsfrist|Abgabefrist|Eingangsfrist)[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (deadlineMatch) {
      const parts = deadlineMatch[1].split(".");
      deadline = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }

    // Extract location
    let location = "";
    const locMatch = bodyText.match(/(?:Ort der Ausführung|Ausführungsort|Einsatzort|PLZ\/Ort)[:\s]*([^\.]{5,80})/i);
    if (locMatch) location = locMatch[1].trim();

    // Extract PDF links
    const pdfUrls: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes(".pdf") || href.includes("download") || href.includes("announcements/")) {
        try {
          const fullUrl = new URL(href, finalUrl).href;
          if (!pdfUrls.includes(fullUrl)) pdfUrls.push(fullUrl);
        } catch {}
      }
    });

    // Description from first 500 chars of body text
    const descClean = bodyText.replace(/\s+/g, " ").slice(0, 800);

    return {
      source: `nrw-${portalName}`,
      url: finalUrl,
      title,
      client,
      deadline,
      description: descClean,
      location,
      pdfUrls,
    };
  } catch (e) {
    console.warn(`[scrape-gala-bau] Detail-Fehler ${url}:`, e);
    return null;
  }
}

async function main() {
  console.log("[scrape-gala-bau] Starte GaLa Bau Tendersuche auf NRW-Portalen...");

  const allPids: { pid: string; portal: typeof PORTALS[0]; cpv: string }[] = [];

  for (const portal of PORTALS) {
    for (const cpv of GALA_BAU_CPV) {
      try {
        const tableUrl = `${portal.baseUrl}${portal.prefix}/company/announcements/categoryOverview.do?method=showTable&cpvCode=${cpv}`;
        const resp = await fetch(tableUrl, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(15000),
        });
        const html = await resp.text();
        const pidRegex = /projectForwarding\.do\?pid=(\d+)/g;
        let m;
        const seen = new Set(allPids.map(p => p.pid));
        while ((m = pidRegex.exec(html)) !== null) {
          if (!seen.has(m[1])) {
            seen.add(m[1]);
            allPids.push({ pid: m[1], portal, cpv });
          }
        }
      } catch (e) {
        console.warn(`[scrape-gala-bau] ${portal.name} CPV ${cpv} Fehler:`, e);
      }
    }
    console.log(`[scrape-gala-bau] ${portal.name}: ${allPids.filter(p => p.portal === portal).length} PIDs`);
  }

  console.log(`[scrape-gala-bau] Gesamt: ${allPids.length} einzigartige PIDs`);

  // Scrape details (limit to 30 to avoid timeout)
  const toProcess = allPids.slice(0, 30);
  const tendersToInsert: ScrapedTender[] = [];

  for (const { pid, portal } of toProcess) {
    const detailUrl = `${portal.baseUrl}${portal.prefix}/public/company/projectForwarding.do?pid=${pid}`;
    console.log(`[scrape-gala-bau] Scrape PID ${pid} (${portal.name})...`);
    const tender = await scrapeDetail(detailUrl, portal.name);
    if (tender) {
      tendersToInsert.push(tender);
      console.log(`  -> ${tender.title.slice(0, 60)}... | Deadline: ${tender.deadline ?? "?"} | ${tender.location || "?"}`);
    }
  }

  console.log(`\n[scrape-gala-bau] ${tendersToInsert.length} Tenders gescrapt. Fuege in DB ein...`);

  // Insert into DB
  let inserted = 0;
  let skipped = 0;
  for (const t of tendersToInsert) {
    // Check if already exists
    const existing = await db.select({ id: tenders.id }).from(tenders).where(eq(tenders.url, t.url)).limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const deadlineDate = t.deadline ? new Date(t.deadline + "T23:59:59+02:00") : null;

    const [row] = await db.insert(tenders).values({
      source: t.source,
      sourceKey: t.source.replace("nrw-", ""),
      url: t.url,
      title: t.title,
      metadataJson: {
        client: t.client,
        description: t.description,
        location: t.location,
        pdf_urls: t.pdfUrls,
        scraper: "scrape-gala-bau",
        discovered_at: new Date().toISOString(),
      },
      deadlineAt: deadlineDate,
      category: "Gartenarbeiten",
      qualityStatus: "candidate",
    }).returning({ id: tenders.id });

    if (row) {
      inserted++;
      console.log(`  [DB] Inserted ID ${row.id}: ${t.title.slice(0, 50)}...`);
    }
  }

  console.log(`\n[scrape-gala-bau] Fertig: ${inserted} inserted, ${skipped} skipped (already exist)`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[scrape-gala-bau] Fatal:", e);
  process.exit(1);
});
