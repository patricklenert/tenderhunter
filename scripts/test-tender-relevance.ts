import {
  classifyTenderRelevance,
  DEFAULT_DECIDER_MODEL,
  DEFAULT_RELEVANCE_THRESHOLD,
  isRelevanceGateEnabled,
  relevanceThreshold,
  resetTenderRelevanceCacheForTests,
} from "@/lib/tender-relevance";

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

const jsonResponse = (noul: number): Response => new Response(JSON.stringify({
  model: DEFAULT_DECIDER_MODEL,
  answers: { it_relevant: { type: "noul", noul } },
  usage: { input_tokens: 120, output_tokens: 3 },
}), { status: 200, headers: { "Content-Type": "application/json" } });

const installFetchMock = (mock: (input: string | URL, init?: RequestInit) => Promise<Response>): {
  calls: () => number;
  bodies: () => unknown[];
  restore: () => void;
} => {
  const original = globalThis.fetch;
  const bodies: unknown[] = [];
  let calls = 0;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    calls += 1;
    bodies.push(init?.body ? JSON.parse(String(init.body)) : null);
    return mock(input, init);
  }) as typeof fetch;
  return {
    calls: () => calls,
    bodies: () => bodies,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

const withEnv = (values: Record<string, string | undefined>, run: () => Promise<void> | void): Promise<void> | void => {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
};

async function main(): Promise<void> {
  // Threshold + kill switch defaults
  check("relevanceThreshold: Default ist 0.5", relevanceThreshold() === DEFAULT_RELEVANCE_THRESHOLD);
  check("isRelevanceGateEnabled: Default ist an", isRelevanceGateEnabled());

  await withEnv({ TENDER_RELEVANCE_THRESHOLD: "abc" }, async () => {
    check("relevanceThreshold: nicht-numerischer Wert faellt auf 0.5 zurueck", relevanceThreshold() === 0.5);
  });
  await withEnv({ TENDER_RELEVANCE_THRESHOLD: "2" }, async () => {
    check("relevanceThreshold: Werte > 1 werden auf 1 geklemmt", relevanceThreshold() === 1);
  });

  // Kill switch: gate off answers relevant without any network call
  await withEnv({ OPENROUTER_API_KEY: "test-key", TENDER_RELEVANCE_GATE: "off" }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.reject(new Error("darf nicht aufgerufen werden")));
    try {
      const decision = await classifyTenderRelevance({ title: "Lieferung von Kopierpapier" });
      check("Kill-Switch: Gate aus => relevant", decision.relevant === true);
      check("Kill-Switch: Quelle ist gate-disabled", decision.source === "gate-disabled");
      check("Kill-Switch: kein Netzaufruf", handle.calls() === 0);
    } finally {
      handle.restore();
    }
  });

  // CPV fast path: IT CPV codes decide without the decider
  await withEnv({ OPENROUTER_API_KEY: "test-key" }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.reject(new Error("darf nicht aufgerufen werden")));
    try {
      const decision = await classifyTenderRelevance({
        title: "Rahmenvertrag Gartenpflege",
        description: "Pflege von Gruenflaechen",
        cpvCodes: ["72262000-6", "90900000"],
      });
      check("CPV-Fastpath: 72xxxxxx => relevant ohne Decider", decision.relevant && decision.source === "cpv-fastpath");
      check("CPV-Fastpath: kein Netzaufruf", handle.calls() === 0);
    } finally {
      handle.restore();
    }
  });

  // Decider above and below threshold
  await withEnv({ OPENROUTER_API_KEY: "test-key" }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.resolve(jsonResponse(0.9)));
    try {
      const decision = await classifyTenderRelevance({
        title: "Weiterentwicklung einer Webanwendung",
        description: "Ausschreibung von IT-Dienstleistungen fuer ein Fachverfahren",
      });
      check("Decider: p=0.9 => relevant", decision.relevant === true);
      check("Decider: Quelle ist decider", decision.source === "decider");
      check("Decider: Wahrscheinlichkeit wird durchgereicht", decision.probability === 0.9);
      const body = handle.bodies()[0] as { model?: string; questions?: Record<string, { type?: string }> };
      check("Decider: Request nutzt pplx-decider-v1.2", body.model === DEFAULT_DECIDER_MODEL);
      check("Decider: Frage ist noul", body.questions?.it_relevant?.type === "noul");
    } finally {
      handle.restore();
    }

    resetTenderRelevanceCacheForTests();
    const belowHandle = installFetchMock(() => Promise.resolve(jsonResponse(0.2)));
    try {
      const decision = await classifyTenderRelevance({
        title: "Lieferung von Kopierpapier",
        description: "Rahmenvertrag ueber Buerobedarf und Reinigungsmittel",
      });
      check("Decider: p=0.2 => nicht relevant", decision.relevant === false && decision.source === "decider");
    } finally {
      belowHandle.restore();
    }
  });

  // Cache: identical state is answered from the cache
  await withEnv({ OPENROUTER_API_KEY: "test-key" }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.resolve(jsonResponse(0.9)));
    try {
      const input = { title: "Rahmenvertrag Softwarepflege", description: "Wartung und Weiterentwicklung einer Fachanwendung" };
      await classifyTenderRelevance(input);
      const cached = await classifyTenderRelevance(input);
      check("Cache: zweiter identischer Call kommt aus dem Cache", cached.source === "decider" && cached.probability === 0.9);
      check("Cache: nur ein Netzaufruf", handle.calls() === 1);
    } finally {
      handle.restore();
    }
  });

  // Threshold override
  await withEnv({ OPENROUTER_API_KEY: "test-key", TENDER_RELEVANCE_THRESHOLD: "0.3" }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.resolve(jsonResponse(0.35)));
    try {
      const decision = await classifyTenderRelevance({ title: "Digitalisierung der Verwaltungsprozesse", description: "Einfuehrung eines Dokumentenmanagementsystems" });
      check("Schwelle: p=0.35 ist bei Schwelle 0.3 relevant", decision.relevant === true);
    } finally {
      handle.restore();
    }
  });

  // Decider outage: deterministic fallback heuristic
  await withEnv({ OPENROUTER_API_KEY: "test-key" }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.reject(new Error("netz weg")));
    try {
      const itTender = await classifyTenderRelevance({
        title: "Einfuehrung eines CRM-Systems",
        description: "Konzeption und Implementierung inkl. Schulung",
      });
      check("Ausfall: IT-Text => Fallback relevant", itTender.relevant === true && itTender.source === "fallback-heuristic");
      const cleaningTender = await classifyTenderRelevance({
        title: "Unterhaltsreinigung Rathaus",
        description: "Glas- und Grundreinigung, Winterdienst",
      });
      check("Ausfall: Reinigung => Fallback nicht relevant", cleaningTender.relevant === false && cleaningTender.source === "fallback-heuristic");
      const categoryTender = await classifyTenderRelevance({
        title: "Rahmenvertrag Netzwerkbetreuung",
        category: "IT-Dienstleistungen",
      });
      check("Ausfall: Kategorie IT-Dienstleistungen => relevant", categoryTender.relevant === true);
      check("Ausfall: Netzaufrufe passierten (Decider zuerst probiert)", handle.calls() > 0);
    } finally {
      handle.restore();
    }
  });

  // HTTP 500 twice: also falls back to the heuristic
  await withEnv({ OPENROUTER_API_KEY: "test-key" }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.resolve(new Response("boom", { status: 500 })));
    try {
      const decision = await classifyTenderRelevance({
        title: "Lieferung von Kopierpapier",
        description: "Rahmenvertrag Buerobedarf",
      });
      check("HTTP 500: faellt auf Heuristik zurueck", decision.source === "fallback-heuristic");
      check("HTTP 500: Retry-Logik hat 2 Versuche unternommen", handle.calls() === 2);
    } finally {
      handle.restore();
    }
  });

  // Missing API key: heuristic without network
  await withEnv({ OPENROUTER_API_KEY: undefined }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.reject(new Error("darf nicht aufgerufen werden")));
    try {
      const decision = await classifyTenderRelevance({ title: "Bauarbeiten Sportplatz" });
      check("Ohne API-Key: Heuristik ohne Netzaufruf", decision.source === "fallback-heuristic" && handle.calls() === 0);
    } finally {
      handle.restore();
    }
  });

  // Invalid answer shape: treated like an outage
  await withEnv({ OPENROUTER_API_KEY: "test-key" }, async () => {
    resetTenderRelevanceCacheForTests();
    const handle = installFetchMock(() => Promise.resolve(new Response(JSON.stringify({ answers: {} }), { status: 200 })));
    try {
      const decision = await classifyTenderRelevance({ title: "Gartenpflege Parkanlage" });
      check("Ungueltige Antwort: faellt auf Heuristik zurueck", decision.source === "fallback-heuristic" && decision.probability === null);
    } finally {
      handle.restore();
    }
  });

  console.log(`\n${total - failures.length}/${total} Checks bestanden`);
  if (failures.length > 0) {
    console.error("Fehlgeschlagene Checks:");
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
