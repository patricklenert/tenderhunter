import "dotenv/config";
import { scrapeBerlinHtml, scrapeNetPortal } from "../lib/public-tender-scraper";

async function main() {
  console.log("=== Test: Berlin HTML Scrape ===");
  try {
    const htmlTenders = await scrapeBerlinHtml();
    console.log(`Berlin HTML: ${htmlTenders.length} Tenders gefunden`);
    for (const t of htmlTenders.slice(0, 5)) {
      console.log(`  - ${t.title} (${t.client ?? "?"}) deadline=${t.deadline ?? "none"}`);
    }
    if (htmlTenders.length > 5) console.log(`  ... und ${htmlTenders.length - 5} weitere`);
  } catch (err) {
    console.error("Berlin HTML Fehler:", err);
  }

  console.log("\n=== Test: Berlin NetServer ===");
  try {
    const netTenders = await scrapeNetPortal({
      name: "berlin",
      baseUrl: "https://vergabekooperation.berlin",
      searchPath: "/NetServer/PublicationSearchControllerServlet?Max=100&Category=InvitationToTender&function=SearchPublications&thContext=publications",
      limit: 10,
    });
    console.log(`Berlin NetServer: ${netTenders.length} Tenders gefunden`);
    for (const t of netTenders.slice(0, 5)) {
      console.log(`  - ${t.title} (${t.client ?? "?"}) deadline=${t.deadline ?? "none"}`);
    }
    if (netTenders.length > 5) console.log(`  ... und ${netTenders.length - 5} weitere`);
  } catch (err) {
    console.error("Berlin NetServer Fehler:", err);
  }
}

main().catch(console.error);
