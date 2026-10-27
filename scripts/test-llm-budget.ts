import {
  PAID_MODEL_PRICING_EUR_PER_1M,
  estimateCostMicroEur,
  isPaidModel,
  isWithinBudget,
  paidDailyBudgetMicroEur,
  todayUtcKey,
} from "@/lib/llm-spend";

let total = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean): void => {
  total += 1;
  if (condition) {
    console.log(`  OK  ${name}`);
  } else {
    failures.push(name);
    console.error(`FAIL  ${name}`);
  }
};

async function main(): Promise<void> {
  const budgetEnv = "LLM_PAID_DAILY_BUDGET_EUR";

  // paidDailyBudgetMicroEur
  delete process.env[budgetEnv];
  check(
    "paidDailyBudgetMicroEur: Env unset liefert Default 100000 micro EUR (0.1 EUR)",
    paidDailyBudgetMicroEur() === 100000,
  );

  process.env[budgetEnv] = "0.25";
  check(
    "paidDailyBudgetMicroEur: 0.25 EUR liefert 250000 micro EUR",
    paidDailyBudgetMicroEur() === 250000,
  );
  delete process.env[budgetEnv];

  process.env[budgetEnv] = "abc";
  check(
    "paidDailyBudgetMicroEur: NaN ('abc') faellt auf Default 100000 zurueck",
    paidDailyBudgetMicroEur() === 100000,
  );
  delete process.env[budgetEnv];

  process.env[budgetEnv] = "-1";
  check(
    "paidDailyBudgetMicroEur: negativer Wert (-1) wird auf 0 geklemmt",
    paidDailyBudgetMicroEur() === 0,
  );
  delete process.env[budgetEnv];

  // todayUtcKey
  check(
    'todayUtcKey: "2026-09-25T23:59:59Z" ergibt "2026-09-25" (UTC)',
    todayUtcKey(new Date("2026-09-25T23:59:59Z")) === "2026-09-25",
  );
  check(
    'todayUtcKey: "2026-01-01T00:00:00Z" ergibt "2026-01-01" (UTC)',
    todayUtcKey(new Date("2026-01-01T00:00:00Z")) === "2026-01-01",
  );
  check(
    "todayUtcKey: aktuelles Datum hat Format YYYY-MM-DD",
    /^\d{4}-\d{2}-\d{2}$/.test(todayUtcKey()),
  );

  // isPaidModel
  check(
    'isPaidModel: "inclusionai/ling-3.0-flash" ist paid',
    isPaidModel("inclusionai/ling-3.0-flash") === true,
  );
  check(
    'isPaidModel: "meta/muse-spark-1.3-contributor" ist paid',
    isPaidModel("meta/muse-spark-1.3-contributor") === true,
  );
  check(
    'isPaidModel: "poolside/laguna-s-2.1:free" ist nicht paid',
    isPaidModel("poolside/laguna-s-2.1:free") === false,
  );
  check(
    'isPaidModel: "inclusionai/ling-3.1-flash" ist paid (wurde nachtraeglich kostenpflichtig)',
    isPaidModel("inclusionai/ling-3.1-flash") === true,
  );
  check(
    'isPaidModel: "glm-4.7-flash" ist nicht paid (Z.AI-Modelle sind nie paid)',
    isPaidModel("glm-4.7-flash") === false,
  );

  const ling = PAID_MODEL_PRICING_EUR_PER_1M["inclusionai/ling-3.0-flash"];
  const ling31 = PAID_MODEL_PRICING_EUR_PER_1M["inclusionai/ling-3.1-flash"];
  const muse = PAID_MODEL_PRICING_EUR_PER_1M["meta/muse-spark-1.3-contributor"];

  // estimateCostMicroEur
  check(
    "estimateCostMicroEur: ling mit 1M Prompt-Tokens kostet 1e6 * Prompt-Preis micro EUR",
    estimateCostMicroEur("inclusionai/ling-3.0-flash", {
      promptTokens: 1000000,
      completionTokens: 0,
    }) === Math.round(1000000 * ling.prompt),
  );
  check(
    "estimateCostMicroEur: ling mit 30000/3000 Tokens wird aus der Preistabelle berechnet",
    estimateCostMicroEur("inclusionai/ling-3.0-flash", {
      promptTokens: 30000,
      completionTokens: 3000,
    }) === Math.round(30000 * ling.prompt + 3000 * ling.completion),
  );
  check(
    "estimateCostMicroEur: muse mit 1M/1M Tokens kostet 1e6 * (Prompt + Completion) micro EUR",
    estimateCostMicroEur("meta/muse-spark-1.3-contributor", {
      promptTokens: 1000000,
      completionTokens: 1000000,
    }) === Math.round(1000000 * (muse.prompt + muse.completion)),
  );
  check(
    "Preis-Anker: muse Prompt-Preis liegt bei 0.092 EUR +/- 0.01 pro 1M Tokens",
    Math.abs(muse.prompt - 0.092) <= 0.01,
  );
  check(
    "Preis-Anker: ling-3.1-flash liegt bei 0.069/0.207 EUR pro 1M Tokens (OpenRouter 0.075/0.225 USD x 0.92)",
    Math.abs(ling31.prompt - 0.069) <= 0.005 && Math.abs(ling31.completion - 0.207) <= 0.005,
  );
  check(
    'estimateCostMicroEur: unbekanntes Modell ("unbekannt/modell") ergibt 0',
    estimateCostMicroEur("unbekannt/modell", {
      promptTokens: 1000000,
      completionTokens: 1000000,
    }) === 0,
  );
  check(
    "estimateCostMicroEur: leere Usage ergibt 0",
    estimateCostMicroEur("inclusionai/ling-3.0-flash", {
      promptTokens: 0,
      completionTokens: 0,
    }) === 0,
  );

  // isWithinBudget
  check(
    "isWithinBudget: 99000 < 100000 ist true",
    isWithinBudget(99000, 100000) === true,
  );
  check(
    "isWithinBudget: 100000 < 100000 ist false (Budget erreicht)",
    isWithinBudget(100000, 100000) === false,
  );
  check(
    "isWithinBudget: 100001 < 100000 ist false (Budget ueberschritten)",
    isWithinBudget(100001, 100000) === false,
  );
  check(
    "isWithinBudget: Budget 0 sperrt alles (0 < 0 ist false)",
    isWithinBudget(0, 0) === false,
  );

  if (failures.length === 0) {
    console.log(`[test-llm-budget] ALLE ${total} CHECKS BESTANDEN`);
  } else {
    console.error(
      `[test-llm-budget] ${failures.length} von ${total} Checks fehlgeschlagen:`,
    );
    for (const failure of failures) {
      console.error(`[test-llm-budget]   - ${failure}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[test-llm-budget] Fehler:", err);
  process.exit(1);
});
