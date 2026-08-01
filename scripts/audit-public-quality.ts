import { getMeiliClient } from "@/lib/meilisearch";
import { getPublicCatalogQualitySummary, getPublicScrapeMonitoring } from "@/lib/public-monitoring";

async function main(): Promise<void> {
  const [quality, monitoring] = await Promise.all([
    getPublicCatalogQualitySummary(),
    getPublicScrapeMonitoring(),
  ]);

  let indexedDocuments: number | null = null;
  try {
    const stats = await getMeiliClient().index("tenders").getStats();
    indexedDocuments = stats.numberOfDocuments;
  } catch (error) {
    console.warn(`[public-quality] Meilisearch-Statistik nicht verfügbar: ${error instanceof Error ? error.message : String(error)}`);
  }

  const report = {
    quality,
    monitoring,
    index: {
      expectedDocuments: quality.indexable,
      indexedDocuments,
      gap: indexedDocuments === null ? null : quality.indexable - indexedDocuments,
    },
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[public-quality] Katalog: ${quality.total} gesamt, ${quality.active} aktiv, ${quality.indexable} indexierbar`);
    console.log(`[public-quality] Status: ${JSON.stringify(quality.byStatus)}`);
    console.log(`[public-quality] RLP: ${JSON.stringify(quality.bySource.rlp ?? {})}`);
    console.log(`[public-quality] Rhein-Neckar: ${JSON.stringify(quality.bySource["net-rhein-neckar"] ?? {})}`);
    console.log(`[public-quality] Vollständigkeit qualifizierter Tender: ${JSON.stringify(quality.qualifiedCompleteness)}`);
    console.log(`[public-quality] Meilisearch: ${indexedDocuments ?? "nicht erreichbar"} Dokumente`);
    console.log(`[public-quality] Monitoring: letzter Lauf ${monitoring.lastCompletedAt?.toISOString() ?? "nie"}, ${monitoring.issues.length} Problem(e)`);
    for (const issue of monitoring.issues) console.warn(`  - ${issue}`);
    if (monitoring.emptySources.length > 0) {
      console.warn(`  - Quellen ohne Treffer: ${monitoring.emptySources.join(", ")}`);
    }
  }

  if (monitoring.issues.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[public-quality] Audit fehlgeschlagen:", error);
  process.exitCode = 1;
});
