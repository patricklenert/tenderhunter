import assert from "node:assert/strict";
import {
  analyzeTenderForSmallVendor,
  computeSmallVendorFit,
  deriveCompactBadges,
  extractSmallVendorSignals,
  isSmallVendorTenderModeEnabled,
  toCompact,
  SMALL_VENDOR_HIGHLIGHT_THRESHOLD,
} from "@/lib/small-vendor";
import type { StructuredData } from "@/lib/structurer";

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

const structured = (overrides: Partial<StructuredData> = {}): StructuredData => ({
  title: "Ausschreibung",
  summary: "",
  confidence: 0.9,
  hard_facts: { location: null, deadline: null, budget: null, buyer: null, contract_type: null },
  decision_relevant: { scope: [], requirements: [], mandatory_documents: [], award_criteria: [] },
  procurement: {
    contract_value: { min: null, max: null, currency: "EUR" },
    contract_duration: { months: null, renewal: false },
    award_criteria_detailed: [],
    participation_requirements: [],
    cpv_codes: [],
    procedure_type: "offen",
  },
  ...overrides,
});

console.log("\n=== Small Vendor Mode: Feature-Flag ===");

check("patricklenert@gmail.com ist aktiviert", () => {
  assert.equal(isSmallVendorTenderModeEnabled({ email: "patricklenert@gmail.com" }), true);
});

check("Groß-/Kleinschreibung und Whitespace werden ignoriert", () => {
  assert.equal(isSmallVendorTenderModeEnabled({ email: "  PatrickLenert@Gmail.com " }), true);
});

check("Andere Nutzer sind nicht aktiviert", () => {
  assert.equal(isSmallVendorTenderModeEnabled({ email: "other@example.com" }), false);
});

check("Anonym (null/ohne E-Mail) ist nicht aktiviert", () => {
  assert.equal(isSmallVendorTenderModeEnabled(null), false);
  assert.equal(isSmallVendorTenderModeEnabled({}), false);
  assert.equal(isSmallVendorTenderModeEnabled({ email: "" }), false);
});

console.log("\n=== Small Vendor Mode: Signal-Extraktion ===");

check("Preisgewichtung 100% wird aus award_criteria_detailed extrahiert", () => {
  const signals = extractSmallVendorSignals("Weiterentwicklung Webportal", structured({
    procurement: {
      contract_value: { min: null, max: 250_000, currency: "EUR" },
      contract_duration: { months: 12, renewal: false },
      award_criteria_detailed: [
        { criterion: "Preis", weight: 100 },
      ],
      participation_requirements: [],
      cpv_codes: ["72220000-6"],
      procedure_type: "Offenes Verfahren",
    },
  }));
  assert.equal(signals.priceWeightPct, 100);
  assert.equal(signals.contractValueMaxEur, 250_000);
});

check("Preisgewichtung aus Text-Fallback (Preis 80 %)", () => {
  const signals = extractSmallVendorSignals("API-Anbindung", structured({
    decision_relevant: {
      scope: [], requirements: [], mandatory_documents: [],
      award_criteria: ["Preis (80 %)", "Qualität (20 %)"],
    },
  }));
  assert.equal(signals.priceWeightPct, 80);
});

check("Mindestumsatz im Millionenbereich wird erkannt", () => {
  const signals = extractSmallVendorSignals("Rahmenvertrag IT", structured({
    decision_relevant: {
      scope: [], requirements: [], mandatory_documents: [],
      award_criteria: ["Nachweis eines Mindestumsatzes von 5 Mio. EUR"],
    },
  }));
  assert.equal(signals.revenueMinEur, 5_000_000);
});

check("Referenzanzahl wird erkannt", () => {
  const signals = extractSmallVendorSignals("Portal", structured({
    decision_relevant: {
      scope: [], requirements: [], mandatory_documents: [],
      award_criteria: ["Mindestens 3 vergleichbare Referenzen der letzten Jahre"],
    },
  }));
  assert.equal(signals.referenceCountMin, 3);
});

check("Referenzanzahl als Zahlwort wird erkannt", () => {
  const signals = extractSmallVendorSignals("Portal", structured({
    decision_relevant: {
      scope: [], requirements: [], mandatory_documents: [],
      award_criteria: ["Mindestens drei vergleichbare Referenzen"],
    },
  }));
  assert.equal(signals.referenceCountMin, 3);
});

check("Tausendertrennung im Mindestumsatz wird korrekt gelesen", () => {
  const signals = extractSmallVendorSignals("Portal", structured({
    decision_relevant: {
      scope: [], requirements: [], mandatory_documents: [],
      award_criteria: ["Mindestumsatz von 250.000 EUR in den letzten drei Geschäftsjahren"],
    },
  }));
  assert.equal(signals.revenueMinEur, 250_000);
});

check("Sicherheitsüberprüfung Ü3 wird erkannt", () => {
  const signals = extractSmallVendorSignals("Behördensystem", structured({
    decision_relevant: {
      scope: [], requirements: ["Sicherheitsüberprüfung Ü3 für alle Projektbeteiligten"], mandatory_documents: [],
      award_criteria: [],
    },
  }));
  assert.equal(signals.securityClearance, true);
});

check("ISO 27001 Pflicht wird erkannt", () => {
  const signals = extractSmallVendorSignals("Cloud-Plattform", structured({
    decision_relevant: {
      scope: [], requirements: ["Gültiges ISO 27001 Zertifikat erforderlich"], mandatory_documents: [],
      award_criteria: [],
    },
  }));
  assert.deepEqual(signals.certificates, ["ISO 27001"]);
});

check("Nachunternehmer zulässig wird erkannt", () => {
  const signals = extractSmallVendorSignals("Softwareprojekt", structured({
    decision_relevant: {
      scope: [], requirements: ["Der Einsatz von Nachunternehmern ist zulässig."], mandatory_documents: [],
      award_criteria: [],
    },
  }));
  assert.equal(signals.subcontractingAllowed, true);
});

check("Eignungsleihe zulässig wird erkannt", () => {
  const signals = extractSmallVendorSignals("Softwareprojekt", structured({
    decision_relevant: {
      scope: [], requirements: ["Eignungsleihe ist zulässig."], mandatory_documents: [],
      award_criteria: [],
    },
  }));
  assert.equal(signals.suitabilityLeaseAllowed, true);
});

check("Los im Titel wird erkannt", () => {
  const signals = extractSmallVendorSignals("Los 3: Frontend-Entwicklung für das Portal", structured({
    decision_relevant: { scope: ["Frontend-Entwicklung"], requirements: [], mandatory_documents: [], award_criteria: [] },
  }));
  assert.equal(signals.isLot, true);
});

check("IT-Domain wird stark erkannt (Softwareentwicklung + CPV 72)", () => {
  const signals = extractSmallVendorSignals("Softwareentwicklung Kundenportal", structured({
    decision_relevant: { scope: ["Konzeption, Entwicklung und Einführung"], requirements: [], mandatory_documents: [], award_criteria: [] },
    procurement: {
      contract_value: { min: null, max: null, currency: "EUR" },
      contract_duration: { months: null, renewal: false },
      award_criteria_detailed: [],
      participation_requirements: [],
      cpv_codes: ["72212311-3"],
      procedure_type: "offen",
    },
  }));
  assert.equal(signals.isItDomain, "strong");
});

check("Remote-Freundlichkeit wird erkannt", () => {
  const signals = extractSmallVendorSignals("App-Entwicklung", structured({
    decision_relevant: { scope: ["Mobile App"], requirements: ["Arbeit ist remote möglich, Telearbeit erlaubt"], mandatory_documents: [], award_criteria: [] },
  }));
  assert.equal(signals.remoteFriendly, true);
});

console.log("\n=== Small Vendor Mode: Scoring-Ordnung ===");

const smallClearItTender = analyzeTenderForSmallVendor(
  "Weiterentwicklung Webanwendung und API-Anbindung",
  structured({
    summary: "Weiterentwicklung einer bestehenden Webanwendung inklusive Schnittstellen.",
    hard_facts: { location: "Remote", deadline: null, budget: null, buyer: "Stadt X", contract_type: null },
    decision_relevant: {
      scope: ["Weiterentwicklung Webanwendung", "API-Anbindung", "Automatisierung von Prozessen"],
      requirements: ["Arbeit remote möglich"],
      mandatory_documents: [],
      award_criteria: [],
    },
    procurement: {
      contract_value: { min: 100_000, max: 250_000, currency: "EUR" },
      contract_duration: { months: 12, renewal: false },
      award_criteria_detailed: [{ criterion: "Preis", weight: 100 }],
      participation_requirements: [],
      cpv_codes: ["72220000-6"],
      procedure_type: "Offenes Verfahren",
    },
  }),
);

const largeEnterpriseTender = analyzeTenderForSmallVendor(
  "Rahmenvertrag IT-Dienstleistungen bundesweit",
  structured({
    summary: "Bundesweiter Rahmenvertrag mit mehreren Gewerken, 24/7 Betrieb.",
    hard_facts: { location: "Bundesweit", deadline: null, budget: null, buyer: "Konzern Y", contract_type: "Rahmenvertrag" },
    decision_relevant: {
      scope: ["Betrieb und Weiterentwicklung mehrerer Systeme", "Vor-Ort-Support bundesweit"],
      requirements: [
        "Mindestumsatz 5 Mio. EUR in den letzten drei Geschäftsjahren",
        "Mindestens 3 Referenzen aus Projekten mit über 500 Personentagen",
        "Gültiges ISO 27001 Zertifikat erforderlich",
        "Betriebshaftpflichtversicherung mit mindestens 5 Mio. EUR",
        "Niederlassung in Deutschland erforderlich",
        "24/7 Bereitschaftsdienst",
      ],
      mandatory_documents: ["Formblatt A", "Formblatt B", "Referenzliste", "Zertifikate", "Erklärung zur Eignung", "Betriebshaftpflicht-Nachweis"],
      award_criteria: [],
    },
    procurement: {
      contract_value: { min: 3_000_000, max: 5_000_000, currency: "EUR" },
      contract_duration: { months: 48, renewal: true },
      award_criteria_detailed: [
        { criterion: "Preis", weight: 30 },
        { criterion: "Qualität und Referenzen", weight: 70 },
      ],
      participation_requirements: ["Nachweis Referenzen", "Zertifikatsnachweis"],
      cpv_codes: ["72260000-5"],
      procedure_type: "Verhandlungsverfahren",
    },
  }),
);

check("Klarer kleiner IT-Tender hat hohen Fit (>= 75)", () => {
  assert.ok(
    smallClearItTender.fit >= SMALL_VENDOR_HIGHLIGHT_THRESHOLD,
    `erwartet >= ${SMALL_VENDOR_HIGHLIGHT_THRESHOLD}, erhalten ${smallClearItTender.fit}`,
  );
});

check("Enterprise-Tender mit hohen Hürden hat niedrigen Fit", () => {
  assert.ok(
    largeEnterpriseTender.fit < 40,
    `erwartet < 40, erhalten ${largeEnterpriseTender.fit}`,
  );
});

check("Kleiner IT-Tender schlägt Enterprise-Tender klar", () => {
  assert.ok(
    smallClearItTender.fit > largeEnterpriseTender.fit + 35,
    `Differenz zu klein: ${smallClearItTender.fit} vs ${largeEnterpriseTender.fit}`,
  );
});

check("Enterprise-Tender hat Ausschluss-/Barrier-Hinweise", () => {
  assert.ok(largeEnterpriseTender.risks.length >= 3);
  assert.ok(largeEnterpriseTender.why.length >= 1);
});

check("Badges für den kleinen IT-Tender enthalten High Winability und Preis 100 %", () => {
  assert.ok(smallClearItTender.badges.includes("High Winability"));
  assert.ok(smallClearItTender.badges.some((badge) => badge.startsWith("Preis")));
});

console.log("\n=== Small Vendor Mode: Los-Heuristik ===");

const lotInLargeTender = analyzeTenderForSmallVendor(
  "Los 3: Frontend-Entwicklung Barrierefreies Bürgerportal",
  structured({
    summary: "Teil einer Gesamtvergabe über 5 Mio. EUR; Los 3 umfasst ausschließlich Frontend-Entwicklung.",
    hard_facts: { location: null, deadline: null, budget: null, buyer: "Bund Z", contract_type: null },
    decision_relevant: {
      scope: ["Frontend-Entwicklung", "Umsetzung der Designsystem-Vorgaben"],
      requirements: ["Der Einsatz von Nachunternehmern ist zulässig."],
      mandatory_documents: [],
      award_criteria: [],
    },
    procurement: {
      contract_value: { min: 500_000, max: 5_000_000, currency: "EUR" },
      contract_duration: { months: 18, renewal: false },
      award_criteria_detailed: [{ criterion: "Preis", weight: 80 }],
      participation_requirements: [],
      cpv_codes: ["72220000-6"],
      procedure_type: "Offenes Verfahren",
    },
  }),
);

check("Los 3 in großer Vergabe wird als Los erkannt und hoch bewertet", () => {
  assert.equal(lotInLargeTender.signals.isLot, true);
  assert.ok(
    lotInLargeTender.fit >= 65,
    `erwartet >= 65, erhalten ${lotInLargeTender.fit}`,
  );
  assert.ok(lotInLargeTender.badges.includes("Small Lot"));
  assert.ok(lotInLargeTender.badges.includes("Subcontracting Allowed"));
});

check("Kill-Regel: Ü3 cappt den Fit hart", () => {
  const signals = extractSmallVendorSignals("Sicheres System", structured({
    decision_relevant: {
      scope: ["Softwareentwicklung"], requirements: ["Sicherheitsüberprüfung Ü2 erforderlich"], mandatory_documents: [],
      award_criteria: [],
    },
    procurement: {
      contract_value: { min: null, max: 100_000, currency: "EUR" },
      contract_duration: { months: null, renewal: false },
      award_criteria_detailed: [{ criterion: "Preis", weight: 100 }],
      participation_requirements: [],
      cpv_codes: ["72220000-6"],
      procedure_type: "offen",
    },
  }));
  const fit = computeSmallVendorFit(signals);
  assert.ok(fit.fit <= 20, `erwartet <= 20, erhalten ${fit.fit}`);
  assert.ok(fit.killReasons.length > 0);
});

check("Nicht-IT-Domäne ohne Preisgewichtung bleibt niedrig", () => {
  const analysis = analyzeTenderForSmallVendor(
    "Lieferung von Gartengeräten und Winterdienst",
    structured({
      decision_relevant: { scope: ["Lieferung von Geräten"], requirements: [], mandatory_documents: [], award_criteria: [] },
    }),
  );
  assert.ok(analysis.fit < 50, `erwartet < 50, erhalten ${analysis.fit}`);
});

console.log("\n=== Small Vendor Mode: Kompakte Badges ===");

check("deriveCompactBadges erzeugt High Winability bei hohem Fit", () => {
  const badges = deriveCompactBadges({
    fit: 85,
    priceWeightPct: 100,
    lowEntryBarrier: true,
    remoteFriendly: true,
    isItDomain: true,
    isLot: false,
  });
  assert.ok(badges.includes("High Winability"));
  assert.ok(badges.includes("Preis 100 %"));
  assert.ok(badges.includes("Low Entry Barrier"));
  assert.ok(badges.includes("Remote"));
});

check("deriveCompactBadges ohne High-Fit keinen High-Winability-Badge", () => {
  const badges = deriveCompactBadges({
    fit: 40,
    priceWeightPct: null,
    lowEntryBarrier: false,
    remoteFriendly: false,
    isItDomain: false,
    isLot: false,
  });
  assert.ok(!badges.includes("High Winability"));
});

check("toCompact markiert Low Entry Barrier korrekt", () => {
  const clean = toCompact(smallClearItTender);
  assert.equal(clean.lowEntryBarrier, true);
  const barred = toCompact(largeEnterpriseTender);
  assert.equal(barred.lowEntryBarrier, false);
});

console.log(`\n${passed} Checks bestanden.\n`);
