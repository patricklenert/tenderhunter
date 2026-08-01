import { readFile } from "node:fs/promises";
import { parseNetServerPaginationUrls, parseNetServerRows } from "../lib/public-tender-scraper";

async function main() {
  const fixture = await readFile(new URL("./fixtures/mv-publications.html", import.meta.url), "utf8");
  const rows = parseNetServerRows(fixture);

  if (rows.length !== 2) {
    throw new Error(`Erwartet: 2 eindeutige M-V-Zeilen, gefunden: ${rows.length}`);
  }

  if (rows[0].oid !== "mv-001" || rows[0].title !== "Analyse von Wasserproben") {
    throw new Error("Die erste M-V-Zeile wurde nicht korrekt extrahiert.");
  }

  if (rows[1].client !== "StALU Mecklenburgische Seenplatte" || rows[1].deadline !== "14.08.2026 09:30") {
    throw new Error("Die Metadaten der zweiten M-V-Zeile wurden nicht korrekt extrahiert.");
  }

  const paginationUrls = parseNetServerPaginationUrls(
    fixture,
    "https://vergabe.mv-regierung.de",
    "https://vergabe.mv-regierung.de/NetServer/PublicationSearchControllerServlet?Start=0",
  );

  if (paginationUrls.length !== 1 || !paginationUrls[0].includes("/NetServer/PublicationSearchControllerServlet") || !paginationUrls[0].includes("Start=100")) {
    throw new Error("Die M-V-Pagination wurde nicht korrekt erkannt.");
  }

  if (process.argv.includes("--live")) {
    const response = await fetch(
      "https://vergabe.mv-regierung.de/NetServer/PublicationSearchControllerServlet?function=SearchPublications&Gesetzesgrundlage=All&Category=InvitationToTender&thContext=publications&Max=100",
      { headers: { "User-Agent": "Tenderhunter/1.0 (public tender index)" } },
    );
    const liveHtml = await response.text();
    const liveRows = parseNetServerRows(liveHtml);

    if (!response.ok || liveRows.length === 0) {
      throw new Error(`Der Live-Abruf des M-V-Portals lieferte keine Zeilen (HTTP ${response.status}).`);
    }

    console.log(`M-V Live-Listenabruf: ${liveRows.length} Bekanntmachungen erkannt.`);

    const detailResponse = await fetch("https://vergabe.mv-regierung.de/NetServer/DataProvider", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Tenderhunter/1.0 (public tender index)",
      },
      body: new URLSearchParams({
        param: "Redirect",
        OID: liveRows[0].oid,
        function: "Detail",
        category: "InvitationToTender",
      }),
    });
    const detailPath = (await detailResponse.text()).trim();
    if (!detailResponse.ok || !detailPath.includes("PublicationControllerServlet")) {
      throw new Error(`Der M-V-Detail-Redirect schlug fehl (HTTP ${detailResponse.status}).`);
    }

    console.log(`M-V Live-Detail-Redirect: ${detailPath}`);
  }

  console.log("M-V-Scraper-Parser-Test: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
