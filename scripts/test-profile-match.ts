import assert from "node:assert/strict";
import {
  evaluateTenderFit,
  type BarrierCheck,
  type BarrierStatus,
  type BidderProfile,
  type CapacityRuleSummary,
  type MatchProfile,
  type PartnerProfile,
  type TenderMatchResult,
} from "@/lib/profile-match";
import {
  CRITERION_KINDS,
  type CriteriaResult,
  type CriterionFinding,
  type CriterionKind,
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

const finding = (kind: CriterionKind, fields: Partial<CriterionFinding> = {}): CriterionFinding => ({
  kind,
  type: "muss",
  label: kind,
  quote: "Nachweis ist vorzulegen.",
  source: { documentId: 1, filename: "Vergabeunterlagen.pdf", origin: "document", page: 3 },
  amountEur: null,
  count: null,
  years: null,
  certificate: null,
  rule: null,
  ...fields,
});

const capacityRule = (kind: CriterionKind, rule: CriterionFinding["rule"]): CriterionFinding =>
  finding(kind, { type: "beschreibung", quote: "Die Regelung zur Kapazität ist im Dokument genannt.", rule });

const criteriaWith = (findings: CriterionFinding[], documentsSearched = 2): CriteriaResult => ({
  findings,
  coverage: CRITERION_KINDS.map((kind) => ({ kind, found: findings.some((item) => item.kind === kind) })),
  sourcesSearched: documentsSearched,
  documentsSearched,
  limitations: [],
});

const run = (findings: CriterionFinding[], profile: MatchProfile, documentsSearched = 2, now?: Date): TenderMatchResult =>
  evaluateTenderFit(criteriaWith(findings, documentsSearched), profile, now);

const checkOf = (result: TenderMatchResult, kind: CriterionKind): BarrierCheck => {
  const found = result.checks.find((item) => item.kind === kind);
  assert.ok(found, `kein Check für ${kind}`);
  return found;
};

const statusOf = (result: TenderMatchResult, kind: CriterionKind): BarrierStatus => checkOf(result, kind).status;

const revenue = finding("revenue", {
  amountEur: 250_000,
  years: 3,
  quote: "Jahresumsatz von mindestens 250.000 EUR in jedem der letzten drei Geschäftsjahre.",
});
const partner: PartnerProfile = {
  name: "Beispiel LLC",
  legalForm: "LLC",
  foundedOn: "2015-03-01",
  revenueByYearEur: { "2023": 300_000, "2024": 300_000, "2025": 300_000 },
};
const founded2026: BidderProfile = { legalForm: "UG", foundedOn: "2026-05-01" };

console.log("\n=== Profile Match: Gesellschaftsalter, Umsatz und Partnerroute ===");

check("UG mit Gründung 2026-05-01 ist für drei Jahre Umsatz eine Barriere", () => {
  const result = run([revenue], { bidder: founded2026, asOf: "2026-10-10" });
  assert.equal(result.verdict, "barrier");
  assert.equal(statusOf(result, "revenue"), "barrier");
  assert.equal(checkOf(result, "revenue").reason, "Gründung 2026-05-01: weniger als 3 abgeschlossene Geschäftsjahre");
});

check("Partner mit Umsatz 2023-2025 und zulässiger Eignungsleihe: via_partner", () => {
  const result = run([revenue, capacityRule("third_party_capacity", "allowed")], {
    bidder: founded2026,
    partner,
    asOf: "2026-10-10",
  });
  assert.equal(statusOf(result, "revenue"), "via_partner");
  assert.equal(result.verdict, "no_barrier_found");
  assert.ok(
    result.limitations.includes(
      "Partnerroute setzt eine ausdrücklich zulässige Eignungsleihe bzw. Nachunternehmerregelung voraus.",
    ),
  );
});

check("Partner erfüllt die Forderung, aber ohne Regel zur Eignungsleihe: unclear", () => {
  const result = run([revenue], { bidder: founded2026, partner, asOf: "2026-10-10" });
  assert.equal(statusOf(result, "revenue"), "unclear");
  assert.equal(
    checkOf(result, "revenue").reason,
    "Regel zu Eignungsleihe bzw. Nachunternehmern nicht gefunden; Partner Beispiel LLC erfüllt das Kriterium",
  );
  assert.equal(result.verdict, "unclear");
});

check("Referenzen: Partnerroute nur mit zulässiger Eignungsleihe, sonst barrier bzw. unclear", () => {
  const references = finding("references", { count: 3, quote: "Mindestens drei vergleichbare Referenzen." });
  const profile: MatchProfile = { bidder: { referenceCount: 0 }, partner: { name: "Beispiel GmbH", referenceCount: 3 } };
  assert.equal(statusOf(run([references, capacityRule("third_party_capacity", "allowed")], profile), "references"), "via_partner");
  const blocked = run([references, capacityRule("third_party_capacity", "forbidden")], profile);
  assert.equal(statusOf(blocked, "references"), "barrier");
  assert.equal(blocked.verdict, "barrier");
  assert.equal(statusOf(run([references], profile), "references"), "unclear");
});

check("Zertifikat: Name ohne Groß- und Leerzeichen vergleichen, Partnerroute über Nachunternehmer", () => {
  const certificate = finding("certificate", {
    certificate: "ISO 27001",
    quote: "Nachweis einer gültigen ISO/IEC 27001-Zertifizierung.",
  });
  assert.equal(statusOf(run([certificate], { bidder: { certificates: ["iso 27001"] } }), "certificate"), "met");
  const profile: MatchProfile = {
    bidder: { certificates: ["ISO 9001"] },
    partner: { name: "Beispiel GmbH", certificates: ["ISO 27001"] },
  };
  assert.equal(statusOf(run([certificate, capacityRule("subcontracting", "allowed")], profile), "certificate"), "via_partner");
});

check("Haftpflicht: fehlende Deckung unclear, zu niedrig barrier, ausreichend met", () => {
  const insurance = finding("insurance", {
    amountEur: 5_000_000,
    quote: "Berufshaftpflicht mit einer Deckungssumme von mindestens 5 Mio. EUR.",
  });
  const unknown = run([insurance], { bidder: {} });
  assert.equal(statusOf(unknown, "insurance"), "unclear");
  assert.ok(unknown.limitations.includes("Profilwert fehlt: bidder.liabilityInsuranceEur"));
  assert.equal(statusOf(run([insurance], { bidder: { liabilityInsuranceEur: 1_000_000 } }), "insurance"), "barrier");
  assert.equal(statusOf(run([insurance], { bidder: { liabilityInsuranceEur: 5_000_000 } }), "insurance"), "met");
});

console.log("\n=== Profile Match: Verdicts, Zählung und Belege ===");

check("ohne muss-Findings: unclear, weil keine Anforderung positiv geprüft wurde; nicht gefunden zählt die 11 Kinds", () => {
  const result = run(
    [
      capacityRule("subcontracting", "allowed"),
      capacityRule("third_party_capacity", "allowed"),
      capacityRule("consortium", "allowed"),
    ],
    { bidder: {} },
  );
  assert.equal(result.verdict, "unclear");
  assert.equal(result.notFoundCount, 11);
  assert.equal(result.barrierCount, 0);
  assert.equal(result.unclearCount, 0);
  assert.equal(result.documentsSearched, 2);
  assert.ok(
    result.limitations.includes(
      "Kriterien nicht gefunden bedeutet: in den geprüften Dokumenten nicht gefunden, nicht: nicht erforderlich.",
    ),
  );
});

check("eine positiv geprüfte Anforderung ohne Lücken: no_barrier_found, übrige Kinds bleiben not_found", () => {
  const result = run([finding("insurance", { type: "muss", amountEur: 1_000_000 })], { bidder: { liabilityInsuranceEur: 5_000_000 } });
  assert.equal(statusOf(result, "insurance"), "met");
  assert.equal(result.verdict, "no_barrier_found");
  assert.equal(result.notFoundCount, 10);
});

check("ohne durchsuchte Dokumente: unclear; ohne Funde gelten die 11 Anforderungs-Kinds als nicht gefunden", () => {
  const result = run([], { bidder: {} }, 0);
  assert.equal(result.verdict, "unclear");
  assert.equal(result.notFoundCount, 11);
});

check("Kapazitätsregeln stehen in capacityRules und verändern den Verdict nicht", () => {
  const profile: MatchProfile = { bidder: {} };
  const rules = (result: TenderMatchResult, kind: CapacityRuleSummary["kind"]) =>
    result.capacityRules.find((candidate) => candidate.kind === kind)?.rule;
  assert.equal(rules(run([capacityRule("consortium", "allowed")], profile), "consortium"), "allowed");
  assert.equal(rules(run([capacityRule("subcontracting", "forbidden")], profile), "subcontracting"), "forbidden");
  assert.equal(rules(run([capacityRule("subcontracting", "limited")], profile), "subcontracting"), "limited");
  assert.equal(rules(run([], profile), "third_party_capacity"), "nicht_gefunden");
  const forbidden = run([capacityRule("subcontracting", "forbidden")], profile, 2);
  assert.equal(forbidden.barrierCount, 0);
  assert.equal(forbidden.verdict, "unclear");
});

check("Partner mit unvollständigen Daten: Barriere wird zu unclear, weil die Partnerroute offen ist", () => {
  const result = run(
    [finding("references", { count: 3 }), capacityRule("third_party_capacity", "allowed")],
    { bidder: { referenceCount: 0 }, partner: { name: "Partnerfirma" } },
  );
  assert.equal(statusOf(result, "references"), "unclear");
  assert.equal(result.verdict, "unclear");
});

check("je muss-Finding genau ein Check mit Beleg; Zuschlag und Beschreibung erzeugen keine Barriere", () => {
  const musts = [finding("insurance", { amountEur: 1_000_000 }), finding("language")];
  const result = run(
    [...musts, finding("references", { type: "zuschlag", count: 3 }), finding("presence", { type: "beschreibung" })],
    { bidder: { liabilityInsuranceEur: 5_000_000, germanLanguage: true } },
  );
  for (const item of musts) {
    assert.equal(result.checks.filter((candidate) => candidate.evidence.includes(item)).length, 1);
  }
  assert.equal(statusOf(result, "references"), "not_found");
  assert.equal(checkOf(result, "references").reason, "nur als Zuschlagskriterium gefunden");
  assert.equal(checkOf(result, "presence").reason, "nur als Beschreibung gefunden");
  assert.ok(result.checks.every((item) => item.reason.trim() !== ""));
});

console.log("\n=== Profile Match: Stichtag und Eingaben ===");

check("profile.asOf hat Vorrang vor now; der Geburtstag zählt für das Gesellschaftsalter", () => {
  const bidder: BidderProfile = {
    foundedOn: "2023-10-10",
    revenueByYearEur: { "2023": 300_000, "2024": 300_000, "2025": 300_000 },
  };
  const now = new Date("2026-10-10T12:00:00Z");
  assert.equal(statusOf(run([revenue], { bidder }, 2, now), "revenue"), "met");
  assert.equal(statusOf(run([revenue], { bidder, asOf: "2026-10-09" }, 2, now), "revenue"), "barrier");
});

check("Eingaben bleiben unverändert, das Ergebnis ist deterministisch", () => {
  const criteria = criteriaWith([revenue, capacityRule("third_party_capacity", "allowed")]);
  const profile: MatchProfile = { bidder: founded2026, partner, asOf: "2026-10-10" };
  const before = structuredClone({ criteria, profile });
  const first = evaluateTenderFit(criteria, profile);
  assert.deepEqual({ criteria, profile }, before);
  assert.deepEqual(evaluateTenderFit(criteria, profile), first);
});

console.log(`\n${passed} Checks bestanden.\n`);
console.log("profile-match passed.");
