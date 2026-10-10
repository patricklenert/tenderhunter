import assert from "node:assert/strict";
import { parseGermanCount, parseGermanNumber } from "@/lib/german-number";
import {
  CRITERION_KINDS,
  extractTenderCriteria,
  type CriteriaSource,
  type CriterionFinding,
} from "@/lib/tender-criteria";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  try {
    fn();
    passed += 1;
    console.log(`  OK  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
};

const noticeSource = (text: string): CriteriaSource => ({
  documentId: null,
  filename: null,
  origin: "notice",
  page: null,
  text,
});

const documentSource = (text: string, overrides: Partial<CriteriaSource> = {}): CriteriaSource => ({
  documentId: 1,
  filename: "Vergabeunterlagen.pdf",
  origin: "document",
  page: 4,
  text,
  ...overrides,
});

const findingsFor = (text: string): CriterionFinding[] => extractTenderCriteria([noticeSource(text)]).findings;

const assertGrounded = (sources: CriteriaSource[], findings: CriterionFinding[]): void => {
  for (const finding of findings) {
    assert.ok(finding.quote.length <= 400, `Zitat länger als 400 Zeichen: ${finding.quote.length}`);
    assert.ok(
      sources.some((source) => source.text.includes(finding.quote)),
      `Zitat nicht im Quelltext: ${finding.quote}`,
    );
  }
};

const expectFinding = (text: string, expected: Partial<CriterionFinding>): CriterionFinding => {
  const keys = Object.keys(expected) as Array<keyof CriterionFinding>;
  const finding = findingsFor(text).find((candidate) => keys.every((key) => candidate[key] === expected[key]));
  assert.ok(finding, `keine Finding ${JSON.stringify(expected)} in: ${text}`);
  assertGrounded([noticeSource(text)], [finding]);
  return finding;
};

console.log("\n=== Tender Criteria: Zahlenformate ===");

check("parseGermanNumber liest deutsche und englische Zahlenformate", () => {
  assert.equal(parseGermanNumber("250.000"), 250_000);
  assert.equal(parseGermanNumber("1.500.000"), 1_500_000);
  assert.equal(parseGermanNumber("250.000,00"), 250_000);
  assert.equal(parseGermanNumber("2,5"), 2.5);
  assert.equal(parseGermanNumber("1,000.50"), 1_000.5);
  assert.equal(parseGermanNumber("12"), 12);
  assert.equal(parseGermanNumber("250.000."), 250_000);
  assert.equal(parseGermanNumber("abc"), null);
});

check("parseGermanCount liest Zahlwörter und Ziffern", () => {
  assert.equal(parseGermanCount("drei"), 3);
  assert.equal(parseGermanCount("zwanzig"), 20);
  assert.equal(parseGermanCount("3"), 3);
  assert.equal(parseGermanCount("constructor"), null);
});

console.log("\n=== Tender Criteria: Muss-Ergebnisse ===");

check("a) Umsatz über drei Geschäftsjahre mit Mindestbetrag ist muss", () => {
  const finding = expectFinding(
    "Umsatz mit KI-Anwendungen in jedem der letzten drei Geschäftsjahre von mindestens 250.000 Euro.",
    { kind: "revenue", type: "muss", amountEur: 250_000, years: 3 },
  );
  assert.equal(finding.label, "Mindestumsatz 250.000 EUR, 3 Geschäftsjahre");
});

check("b) Mindestumsatz pro Jahr ohne Zeitraum", () => {
  const finding = expectFinding("Mindestumsatz: 250.000 EUR pro Jahr", { kind: "revenue", amountEur: 250_000 });
  assert.equal(finding.label, "Mindestumsatz 250.000 EUR");
});

check("c) Referenzen mit Zahlwort und Zeitraum", () => {
  const finding = expectFinding("Mindestens drei vergleichbare Referenzen der letzten drei Jahre.", {
    kind: "references", type: "muss", count: 3, years: 3,
  });
  assert.equal(finding.label, "Referenzen: mindestens 3, letzte 3 Jahre");
});

check("d) Referenzen mit Ziffer", () => {
  expectFinding("Mindestens 3 vergleichbare Referenzen der letzten 3 Jahre.", { kind: "references", count: 3, years: 3 });
});

check("e) Projekte gelten als Referenzen", () => {
  expectFinding("Mindestens drei vergleichbare Projekte aus den letzten drei Jahren", { kind: "references", count: 3, years: 3 });
});

check("Komposita wie Projektreferenzen zählen, technische Frequenzreferenz nicht", () => {
  expectFinding("Mindestens drei Projektreferenzen aus den letzten drei Jahren.", { kind: "references", count: 3, years: 3 });
  assert.deepEqual(findingsFor("Die Zeit- und Frequenzreferenz wird bereitgestellt."), []);
});

check("f) Haftpflicht mit Deckungssumme in Mio. EUR", () => {
  const finding = expectFinding(
    "Die Berufshaftpflichtversicherung mit einer Deckungssumme von mindestens 5 Mio. EUR ist nachzuweisen.",
    { kind: "insurance", type: "muss", amountEur: 5_000_000 },
  );
  assert.equal(finding.label, "Versicherung: Haftpflicht 5.000.000 EUR");
});

check("g) ISO/IEC 27001 wird normalisiert", () => {
  const finding = expectFinding("Nachweis einer gültigen ISO/IEC 27001-Zertifizierung ist vorzulegen.", {
    kind: "certificate", type: "muss", certificate: "ISO 27001",
  });
  assert.equal(finding.label, "Zertifikat: ISO 27001");
});

check("h) C5 Typ 2 wird mit Typ benannt", () => {
  expectFinding("Nachweis einer C5-Testierung (Typ 2) des BSI ist vorzulegen.", {
    kind: "certificate", certificate: "BSI C5 Typ 2",
  });
});

check("i) Unterauftragnehmer nicht zulässig", () => {
  const finding = expectFinding("Unterauftragnehmer sind nicht zulässig.", { kind: "subcontracting", rule: "forbidden" });
  assert.equal(finding.label, "Subunternehmer: nicht zulässig");
});

check("j) Eignungsleihe zulässig", () => {
  const finding = expectFinding("Die Eignungsleihe nach § 47 VgV ist zulässig.", { kind: "third_party_capacity", rule: "allowed" });
  assert.equal(finding.label, "Eignungsleihe: zulässig");
});

check("k) Bietergemeinschaften zugelassen", () => {
  const finding = expectFinding("Bietergemeinschaften sind zugelassen.", { kind: "consortium", rule: "allowed" });
  assert.equal(finding.label, "Bietergemeinschaft: zulässig");
});

check("l) Jahresabschlüsse über drei Geschäftsjahre sind muss", () => {
  const finding = expectFinding("Vorlage der Jahresabschlüsse der letzten drei Geschäftsjahre.", {
    kind: "financial_statements", type: "muss", years: 3,
  });
  assert.equal(finding.label, "Jahresabschlüsse: 3 Geschäftsjahre");
});

check("m) Handelsregistereintragung ist muss", () => {
  const finding = expectFinding("Der Auftragnehmer muss im Handelsregister eingetragen sein.", {
    kind: "legal_form", type: "muss",
  });
  assert.equal(finding.label, "Eintragung im Handelsregister");
});

check("n) Vor-Ort-Präsenz", () => {
  const finding = expectFinding("Die Leistung ist vor Ort in Berlin zu erbringen.", { kind: "presence" });
  assert.equal(finding.label, "Vor-Ort-Präsenz");
});

check("o) Referenzen als Zuschlagskriterium", () => {
  expectFinding("Zuschlagskriterium: Referenzen (Gewichtung 20 %)", { kind: "references", type: "zuschlag" });
});

console.log("\n=== Tender Criteria: Weitere Kinds und Regeln ===");

check("Sprache, Verfügbarkeit, Teamgröße und Unternehmensalter", () => {
  expectFinding("Die Projektleitung spricht in deutscher Sprache.", { kind: "language" });
  expectFinding("Die Hotline ist 24/7 erreichbar.", { kind: "availability" });
  expectFinding("Mindestens 5 festangestellte Mitarbeitende sind vorzulegen.", { kind: "team", type: "muss", count: 5 });
  expectFinding("Der Anbieter muss seit mindestens drei Jahren am Markt tätig sein.", {
    kind: "company_age", type: "muss", years: 3,
  });
});

check("Kapazitätsregeln: begrenzt und nicht möglich", () => {
  const limited = expectFinding("Bis zu 30 % der Leistung dürfen an Unterauftragnehmer vergeben werden.", {
    kind: "subcontracting", rule: "limited",
  });
  assert.equal(limited.label, "Subunternehmer: begrenzt");
  expectFinding("Eine Eignungsleihe ist nicht möglich.", { kind: "third_party_capacity", rule: "forbidden" });
  expectFinding("Bietergemeinschaften sind nicht zugelassen.", { kind: "consortium", rule: "forbidden" });
});

check("Fehlalarme: Umsatzsteuer, Referenznummer und allgemeine Sätze", () => {
  assert.deepEqual(findingsFor("Die Umsatzsteuer ist im Preis enthalten."), []);
  assert.deepEqual(findingsFor("Der Auftrag umfasst die Migration eines Portals."), []);
  assert.deepEqual(findingsFor("Referenznummer: 2026-0417"), []);
  assert.deepEqual(findingsFor("Die Stadt wurde 1200 gegründet."), []);
  assert.deepEqual(findingsFor("Die Preise sind ohne Umsatz- steuer anzugeben."), []);
});

console.log("\n=== Tender Criteria: Segmentierung und Zitate ===");

check("Abkürzungen wie 'mind.' und 'Mio.' trennen keinen Satz", () => {
  const insurance = findingsFor("Die Deckungssumme beträgt mind. 5 Mio. EUR. Weitere Angaben folgen.")
    .find((finding) => finding.kind === "insurance");
  assert.equal(insurance?.amountEur, 5_000_000);
});

check("Listenpunkte werden ohne Aufzählungszeichen zitiert", () => {
  const text = "Nachweise:\n- Umsatz von mindestens 250.000 EUR\n- Zertifikat ISO 27001";
  const findings = findingsFor(text);
  assert.equal(findings.find((finding) => finding.kind === "revenue")?.quote, "Umsatz von mindestens 250.000 EUR");
  assert.equal(findings.find((finding) => finding.kind === "certificate")?.quote, "Zertifikat ISO 27001");
  assertGrounded([noticeSource(text)], findings);
});

check("Zitate über 400 Zeichen werden um den Treffer gekürzt", () => {
  const text = `${"Lorem ipsum dolor sit amet ".repeat(30)}Mindestumsatz von 250.000 EUR`;
  const finding = findingsFor(text).find((candidate) => candidate.kind === "revenue");
  assert.ok(finding, "keine Umsatz-Finding in langem Segment");
  assert.ok(finding.quote.length <= 400, `Zitat zu lang: ${finding.quote.length}`);
  assert.ok(finding.quote.includes("Mindestumsatz von 250.000 EUR"));
  assertGrounded([noticeSource(text)], [finding]);
});

check("Quelle (Dokument, Seite) wird an jedem Beleg übernommen", () => {
  const source = documentSource("Die Berufshaftpflicht ist nachzuweisen.", {
    documentId: 42,
    filename: "Leistungsverzeichnis.pdf",
    page: 7,
  });
  const result = extractTenderCriteria([source]);
  assert.ok(result.findings.length > 0);
  for (const finding of result.findings) {
    assert.deepEqual(finding.source, { documentId: 42, filename: "Leistungsverzeichnis.pdf", origin: "document", page: 7 });
  }
  assertGrounded([source], result.findings);
});

console.log("\n=== Tender Criteria: Sortierung, Dedupe, Abdeckung ===");

check("Bekanntmachung steht vor Dokumenten, identische Findings werden zusammengefasst", () => {
  const notice = noticeSource("Zertifikat ISO 27001 ist nachzuweisen.");
  const document = documentSource("Mindestens drei vergleichbare Referenzen.");
  const result = extractTenderCriteria([document, notice, notice]);
  assert.equal(result.findings[0]?.source.origin, "notice");
  assert.equal(result.findings.filter((finding) => finding.certificate === "ISO 27001").length, 1);
});

check("coverage listet alle Kinds in fester Reihenfolge", () => {
  const result = extractTenderCriteria([noticeSource("Umsatz von mindestens 250.000 EUR.")]);
  assert.deepEqual(result.coverage.map((item) => item.kind), [...CRITERION_KINDS]);
  assert.equal(result.coverage.find((item) => item.kind === "revenue")?.found, true);
  assert.equal(result.coverage.find((item) => item.kind === "references")?.found, false);
});

check("sourcesSearched zählt alle Quellen, documentsSearched nur verschiedene Dokumente mit Text", () => {
  const result = extractTenderCriteria([
    documentSource("Eine Seite.", { documentId: 7 }),
    documentSource("Weitere Seite.", { documentId: 7, page: 2 }),
    documentSource("   ", { documentId: 8 }),
    noticeSource("Bekanntmachung."),
  ]);
  assert.equal(result.sourcesSearched, 4);
  assert.equal(result.documentsSearched, 1);
});

check("limitations ohne Textquellen", () => {
  const result = extractTenderCriteria([]);
  assert.deepEqual(result.findings, []);
  assert.equal(result.sourcesSearched, 0);
  assert.deepEqual(result.limitations, [
    "Keine Textquellen vorhanden (weder Bekanntmachung noch geparste Dokumente).",
  ]);
});

check("limitations bei nur Bekanntmachung und bei Dokumenten ohne Seitenmarker", () => {
  assert.deepEqual(extractTenderCriteria([noticeSource("Umsatz von 250.000 EUR.")]).limitations, [
    "Nur Bekanntmachungstext ausgewertet; Vergabeunterlagen fehlen oder sind nicht geparst.",
  ]);
  assert.deepEqual(
    extractTenderCriteria([noticeSource("Umsatz von 250.000 EUR."), documentSource("Umsatz von 250.000 EUR.", { page: null })]).limitations,
    ["Dokumente ohne Seitenmarker: Seitenangabe nicht verfügbar."],
  );
});

console.log(`\n${passed} Checks bestanden.\n`);
console.log("Tender criteria tests passed.");
