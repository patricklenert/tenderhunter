import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { llmSpendDays } from "@/lib/schema";

const DAYS = 14;

async function main(): Promise<void> {
  console.log(`[llm-spend] Lese Ausgaben der letzten ${DAYS} Tage ...`);

  const rows = await db
    .select()
    .from(llmSpendDays)
    .orderBy(desc(llmSpendDays.day))
    .limit(DAYS);

  if (rows.length === 0) {
    console.log("[llm-spend] Keine bezahlten LLM-Aufrufe erfasst.");
    return;
  }

  let sumMicroEur = 0;
  let sumCalls = 0;
  for (const row of rows) {
    sumMicroEur += row.microEur;
    sumCalls += row.paidCalls;
    const eur = (row.microEur / 1_000_000).toFixed(4);
    console.log(`[llm-spend] ${row.day}  ${eur} €  (${row.paidCalls} Calls)`);
  }

  const sumEur = (sumMicroEur / 1_000_000).toFixed(4);
  const avgEur = (sumMicroEur / 1_000_000 / DAYS).toFixed(4);
  console.log(
    `[llm-spend] Summe (${DAYS} Tage): ${sumEur} €  (${sumCalls} Calls)`,
  );
  console.log(`[llm-spend] Durchschnitt pro Tag: ${avgEur} €`);
}

main().catch((err) => {
  console.error("[llm-spend] Fehler:", err);
  process.exit(1);
});
