import {
  buildDeepDiveCorpus,
  buildDeepDiveMessages,
  normalizeDeepDiveResult,
} from "@/lib/small-vendor-deep-dive";

interface TestDoc {
  id: number;
  filename: string | null;
  role: string | null;
  roles: string[] | null;
  extractedText: string | null;
  parseStatus: string | null;
  downloadStatus: string | null;
}

interface TestTender {
  title: string | null;
  url: string | null;
  rawText: string | null;
  deadlineAt: Date | null;
  source: string | null;
  category: string | null;
}

const makeDoc = (overrides: Partial<TestDoc> = {}): TestDoc => ({
  id: 1,
  filename: "anlagen.pdf",
  role: null,
  roles: null,
  extractedText: null,
  parseStatus: "parsed",
  downloadStatus: "downloaded",
  ...overrides,
});

const makeTender = (overrides: Partial<TestTender> = {}): TestTender => ({
  title: "Software-Lösung für die Stadtverwaltung",
  url: "https://example.com/tender",
  rawText: null,
  deadlineAt: new Date("2026-09-30T12:00:00Z"),
  source: "bund",
  category: "IT-Dienstleistungen",
  ...overrides,
});

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
  console.log("[test-deep-dive] Starte Checks fuer buildDeepDiveCorpus ...");

  const parsedPending = buildDeepDiveCorpus(makeTender(), [
    makeDoc({ id: 1, extractedText: `G${"x".repeat(100)}`, parseStatus: "parsed" }),
    makeDoc({ id: 2, extractedText: `P${"x".repeat(100)}`, parseStatus: "pending" }),
  ]);
  check("parsed-Dokument wird verwertet, pending nicht (verwertbar = 1)", parsedPending.verwertbar === 1);
  check(
    "nur das parsed-Dokument landet im Korpus",
    parsedPending.dokumentTexte.includes("[Dokument 1:") && !parsedPending.dokumentTexte.includes("[Dokument 2:"),
  );

  const kurzerText = buildDeepDiveCorpus(makeTender(), [
    makeDoc({ id: 1, extractedText: "zu kurz", parseStatus: "parsed" }),
    makeDoc({ id: 2, extractedText: `g${"u".repeat(40)}`, parseStatus: "parsed" }),
  ]);
  check(
    "extractedText unter 20 Zeichen wird ignoriert",
    kurzerText.verwertbar === 1 && !kurzerText.dokumentTexte.includes("[Dokument 1:"),
  );

  const rollen = buildDeepDiveCorpus(makeTender(), [
    makeDoc({ id: 1, role: "leistungsverzeichnis", extractedText: `LV-INHALT-MARKER${"x".repeat(30)}` }),
    makeDoc({ id: 2, role: "bekanntmachung", extractedText: `BM-INHALT-MARKER${"x".repeat(30)}` }),
    makeDoc({ id: 3, role: "leistungsbeschreibung", extractedText: `LB-INHALT-MARKER${"x".repeat(30)}` }),
  ]);
  const posLv = rollen.dokumentTexte.indexOf("[Dokument 1:");
  const posBm = rollen.dokumentTexte.indexOf("[Dokument 2:");
  const posLb = rollen.dokumentTexte.indexOf("[Dokument 3:");
  check(
    "Rollen-Prioritaet: bekanntmachung vor leistungsbeschreibung vor leistungsverzeichnis",
    posBm >= 0 && posLb > posBm && posLv > posLb,
  );

  const idSortierung = buildDeepDiveCorpus(makeTender(), [
    makeDoc({ id: 5, role: "other", extractedText: `DOC-FUENF${"x".repeat(30)}` }),
    makeDoc({ id: 2, role: "other", extractedText: `DOC-ZWEI${"x".repeat(30)}` }),
    makeDoc({ id: 8, role: "other", extractedText: `DOC-ACHT${"x".repeat(30)}` }),
  ]);
  const pos2 = idSortierung.dokumentTexte.indexOf("[Dokument 2:");
  const pos5 = idSortierung.dokumentTexte.indexOf("[Dokument 5:");
  const pos8 = idSortierung.dokumentTexte.indexOf("[Dokument 8:");
  check("gleiche Prioritaet: aufsteigend nach id (2 vor 5 vor 8)", pos2 < pos5 && pos5 < pos8);

  const langerText = "L".repeat(50_000);
  const gekuerzt = buildDeepDiveCorpus(makeTender(), [makeDoc({ id: 1, extractedText: langerText })]);
  check(
    "Dokument ueber 40.000 Zeichen wird gekuerzt ([Text gekuerzt])",
    gekuerzt.dokumentTexte.includes("[Text gekürzt]") && gekuerzt.dokumentTexte.includes(`[Dokument 1:`),
  );
  check(
    "gekuerztes Dokument: Zeichenbudget eingehalten und Inhaltstext teilweise enthalten",
    gekuerzt.zeichen <= 120_000 && gekuerzt.dokumentTexte.includes("L".repeat(100)),
  );

  const budgetDocs = [1, 2, 3, 4, 5].map((id) =>
    makeDoc({ id, extractedText: `D${id}T${"X".repeat(40_000)}` }),
  );
  const budget = buildDeepDiveCorpus(makeTender(), budgetDocs);
  check(
    "Gesamtbudget 120.000 Zeichen wird eingehalten (≤ 125.000, aber > 100.000)",
    budget.zeichen <= 125_000 && budget.zeichen > 100_000,
  );

  const fakten = buildDeepDiveCorpus(makeTender(), []).fakten;
  check(
    "fakten enthaelt Titel, Quelle, Kategorie, Angebotsfrist (ISO), Original-URL",
    fakten.includes("Titel: Software-Lösung für die Stadtverwaltung") &&
      fakten.includes("Quelle: bund") &&
      fakten.includes("Kategorie: IT-Dienstleistungen") &&
      fakten.includes("Angebotsfrist: 2026-09-30") &&
      fakten.includes("Original-URL: https://example.com/tender"),
  );

  const mitPortalText = buildDeepDiveCorpus(
    makeTender({ rawText: "PORTAL-TEXT-MARKER Ausschreibungstext vom Portal" }),
    [makeDoc({ id: 1, extractedText: "d".repeat(200) })],
  );
  check(
    "rawText wird bei kleinem dokumentTexte als [Portal-Text] angehaengt",
    mitPortalText.dokumentTexte.includes("[Portal-Text]") &&
      mitPortalText.dokumentTexte.includes("PORTAL-TEXT-MARKER"),
  );

  const grossDocs = buildDeepDiveCorpus(makeTender({ rawText: "PORTAL-TEXT-MARKER" }), [
    makeDoc({ id: 1, extractedText: "A".repeat(35_000) }),
    makeDoc({ id: 2, extractedText: "B".repeat(35_000) }),
  ]);
  check(
    "rawText wird NICHT angehaengt, wenn dokumentTexte ≥ 60.000 Zeichen",
    grossDocs.dokumentTexte.length >= 60_000 &&
      !grossDocs.dokumentTexte.includes("[Portal-Text]") &&
      !grossDocs.dokumentTexte.includes("PORTAL-TEXT-MARKER"),
  );

  const leer = buildDeepDiveCorpus(makeTender({ rawText: "Nur Portaltext als Grundlage" }), []);
  check(
    "leere Doc-Liste: verwertbar 0, [Portal-Text] vorhanden",
    leer.verwertbar === 0 && leer.dokumentTexte.startsWith("[Portal-Text]"),
  );

  console.log("[test-deep-dive] Starte Checks fuer normalizeDeepDiveResult ...");

  const voll = normalizeDeepDiveResult({
    zusammenfassung: "Kurze Zusammenfassung des Auftrags",
    zielAuftraggeber: "Stadtverwaltung Musterstadt",
    wasWirdGekauft: ["Software", "Wartung"],
    umfang: "Mittelgrosser Auftrag",
    anforderungen: ["ISO 27001"],
    hindernisse: ["Ü3 erforderlich"],
    budgetLaufzeit: "250.000 EUR, 24 Monate",
    verfahrenFristen: "Offenes Verfahren",
    einschaetzung: "Lohnt sich fuer Spezialisten",
    offenePunkte: ["Budget unklar"],
    quellen: [{ dokument: "leistungsbeschreibung.pdf", seite: 3 }],
  });
  check(
    "vollstaendiges Payload: alle Felder korrekt gemappt",
    voll.zusammenfassung === "Kurze Zusammenfassung des Auftrags" &&
      voll.zielAuftraggeber === "Stadtverwaltung Musterstadt" &&
      voll.umfang === "Mittelgrosser Auftrag" &&
      voll.budgetLaufzeit === "250.000 EUR, 24 Monate" &&
      voll.verfahrenFristen === "Offenes Verfahren" &&
      voll.einschaetzung === "Lohnt sich fuer Spezialisten" &&
      JSON.stringify(voll.wasWirdGekauft) === JSON.stringify(["Software", "Wartung"]) &&
      JSON.stringify(voll.anforderungen) === JSON.stringify(["ISO 27001"]) &&
      JSON.stringify(voll.hindernisse) === JSON.stringify(["Ü3 erforderlich"]) &&
      JSON.stringify(voll.offenePunkte) === JSON.stringify(["Budget unklar"]) &&
      JSON.stringify(voll.quellen) === JSON.stringify([{ dokument: "leistungsbeschreibung.pdf", seite: 3 }]),
  );

  const zahlen = normalizeDeepDiveResult({ zusammenfassung: "Z", wasWirdGekauft: [1, 2, "drei"] });
  check(
    "Zahlen in Arrays werden zu Strings normalisiert",
    JSON.stringify(zahlen.wasWirdGekauft) === JSON.stringify(["1", "2", "drei"]),
  );

  const snake = normalizeDeepDiveResult({
    zusammenfassung: "Z",
    ziel_auftraggeber: "Bauamt der Stadt",
    was_wird_gekauft: ["Beratung"],
    offene_punkte: ["Frage offen"],
    budget_laufzeit: "100.000 EUR",
    verfahren_fristen: "Frist endet am 1.3.",
  });
  check(
    "Snake-Case-Fallbacks werden gelesen",
    snake.zielAuftraggeber === "Bauamt der Stadt" &&
      JSON.stringify(snake.wasWirdGekauft) === JSON.stringify(["Beratung"]) &&
      JSON.stringify(snake.offenePunkte) === JSON.stringify(["Frage offen"]) &&
      snake.budgetLaufzeit === "100.000 EUR" &&
      snake.verfahrenFristen === "Frist endet am 1.3.",
  );

  const quellen = normalizeDeepDiveResult({
    zusammenfassung: "Z",
    quellen: [
      { dokument: "a.pdf", seite: 4.2 },
      { dokument: "b.pdf", seite: "drei" },
      { seite: 2 },
      { dokument: "c.pdf", seite: -3 },
      { dokument: "d.pdf" },
      { dokument: "e.pdf", seite: 1 },
      { dokument: "f.pdf", seite: 2 },
      { dokument: "g.pdf", seite: 3 },
    ],
  });
  check(
    "quellen: seite 4.2 → 4 (floor), 'drei' → null, fehlendes dokument → 'Dokument'",
    quellen.quellen[0].seite === 4 &&
      quellen.quellen[1].seite === null &&
      quellen.quellen[2].dokument === "Dokument" &&
      quellen.quellen[2].seite === 2 &&
      quellen.quellen[3].seite === null &&
      quellen.quellen[4].seite === null,
  );
  check("quellen: mehr als 6 Eintraege werden auf 6 gestutzt", quellen.quellen.length === 6);

  const lang = normalizeDeepDiveResult({
    zusammenfassung: "Z",
    wasWirdGekauft: ["W".repeat(500)],
    anforderungen: ["A".repeat(450)],
  });
  check(
    "ueberlange Array-Items werden auf max. 400 Zeichen gekuerzt",
    lang.wasWirdGekauft[0].length <= 400 &&
      lang.wasWirdGekauft[0].length < 500 &&
      lang.anforderungen[0].length <= 400,
  );

  const ohneBudget = normalizeDeepDiveResult({ zusammenfassung: "Z" });
  check("budgetLaufzeit fehlt → 'Nicht angegeben'", ohneBudget.budgetLaufzeit === "Nicht angegeben");

  const mitLeeren = normalizeDeepDiveResult({ zusammenfassung: "Z", anforderungen: ["a", "", "   ", "b"] });
  check(
    "leere Strings in Arrays werden entfernt",
    JSON.stringify(mitLeeren.anforderungen) === JSON.stringify(["a", "b"]),
  );

  const nurZusammenfassung = normalizeDeepDiveResult({ zusammenfassung: "Nur die Zusammenfassung" });
  check(
    "nur zusammenfassung gefuellt → gueltiges Ergebnis ohne Wurf",
    nurZusammenfassung.zusammenfassung === "Nur die Zusammenfassung" &&
      nurZusammenfassung.wasWirdGekauft.length === 0,
  );

  let warfLeeresObjekt = false;
  try {
    normalizeDeepDiveResult({});
  } catch {
    warfLeeresObjekt = true;
  }
  check("komplett leeres Objekt wirft Error", warfLeeresObjekt);

  let warfNull = false;
  try {
    normalizeDeepDiveResult(null);
  } catch {
    warfNull = true;
  }
  check("null wirft Error", warfNull);

  console.log("[test-deep-dive] Starte Checks fuer buildDeepDiveMessages ...");

  const messageCorpus = buildDeepDiveCorpus(makeTender(), [
    makeDoc({ id: 1, extractedText: `MSG-MARKER${"x".repeat(50)}` }),
  ]);
  const messages = buildDeepDiveMessages(messageCorpus);
  check(
    "Nachricht 1 ist system mit JSON-Feldbeschreibung (zusammenfassung, quellen)",
    messages[0].role === "system" &&
      messages[0].content.includes("zusammenfassung") &&
      messages[0].content.includes("quellen"),
  );
  check(
    "Nachricht 2 enthaelt fakten und dokumentTexte",
    messages[1].content.includes(messageCorpus.fakten) &&
      messages[1].content.includes(messageCorpus.dokumentTexte),
  );
  check(
    "genau 2 Nachrichten mit Rollen system/user",
    messages.length === 2 && messages[0].role === "system" && messages[1].role === "user",
  );

  if (failures.length === 0) {
    console.log(`[test-deep-dive] ALLE ${total} CHECKS BESTANDEN`);
  } else {
    console.error(`[test-deep-dive] ${failures.length} von ${total} Checks fehlgeschlagen:`);
    for (const failure of failures) {
      console.error(`[test-deep-dive]   - ${failure}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[test-deep-dive] Fehler:", err);
  process.exit(1);
});
