import { configureMeiliIndex, syncTendersToMeili } from "@/lib/meilisearch";

async function main(): Promise<void> {
  console.log("[sync-meili] Konfiguriere Index (setzt maxTotalHits hoch) ...");
  await configureMeiliIndex();
  console.log("[sync-meili] Starte komplette Synchronisation ...");
  const result = await syncTendersToMeili();
  console.log(
    `[sync-meili] Fertig: ${result.indexed} indiziert, ${result.skipped} übersprungen`,
  );
}

main().catch((err) => {
  console.error("[sync-meili] Fehler:", err);
  process.exit(1);
});
