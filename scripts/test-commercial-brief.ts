import assert from "node:assert/strict";
import {
  COMMERCIAL_BRIEF_MAX_HEADLINE_LENGTH,
  COMMERCIAL_BRIEF_MAX_LIST_ITEMS,
  COMMERCIAL_BRIEF_MAX_RATIONALE_LENGTH,
  COMMERCIAL_BRIEF_MAX_STRING_LENGTH,
  createCommercialBriefFallback,
  normalizeCommercialBrief,
  validateCommercialBrief,
} from "@/lib/commercial-brief";

const awardedDwiLikeFacts = {
  title: "DWI: Dokumentenmanagement für die Stadtverwaltung",
  awarded: true,
  whatIsBeingBought: ["Einführung eines Dokumentenmanagementsystems"],
  documentedWinRequirements: [],
  deliveryRequirements: [],
  unknowns: ["Zuschlagskriterien wurden nicht veröffentlicht."],
};

const awardedBrief = normalizeCommercialBrief({
  action: "pursue",
  headline: "Angebot vorbereiten",
  rationale: "ISO 27001 ist zwingend.",
  whatIsBeingBought: ["Etwas anderes"],
  documentedWinRequirements: ["ISO 27001"],
  deliveryRequirements: ["24/7-Betrieb"],
  risks: [],
  unknowns: [],
  nextAction: "Angebot schreiben",
}, awardedDwiLikeFacts);

assert.equal(awardedBrief.action, "do_not_pursue");
assert.match(awardedBrief.rationale, /bereits vergeben/i);
assert.deepEqual(awardedBrief.documentedWinRequirements, []);
assert.deepEqual(awardedBrief.deliveryRequirements, []);
assert.ok(awardedBrief.unknowns.includes("Gewinnanforderungen sind nicht dokumentiert."));
assert.ok(awardedBrief.unknowns.includes("Lieferanforderungen sind nicht dokumentiert."));
assert.doesNotMatch(JSON.stringify(awardedBrief), /ISO 27001|24\/7-Betrieb/);

const activeFacts = {
  title: "Betrieb einer kommunalen Fachanwendung",
  awarded: false,
  whatIsBeingBought: ["Betrieb und Weiterentwicklung einer Fachanwendung"],
  documentedWinRequirements: ["Drei vergleichbare Referenzen"],
  deliveryRequirements: ["Störungsannahme an Werktagen"],
  risks: ["Kurze Angebotsfrist"],
};

const activeRaw = {
  action: "pursue",
  headline: "Passende Angebotschance",
  rationale: "Die dokumentierten Anforderungen passen zum Angebot.",
  whatIsBeingBought: ["Erfundener Leistungsumfang"],
  documentedWinRequirements: ["Drei vergleichbare Referenzen", "ISO 27001"],
  deliveryRequirements: ["Störungsannahme an Werktagen", "24/7-Betrieb"],
  risks: ["Unbelegtes Risiko"],
  unknowns: ["Erfundene Anforderung"],
  nextAction: "Referenzen und Kapazität prüfen.",
};

const activeBrief = normalizeCommercialBrief(activeRaw, activeFacts);
assert.equal(activeBrief.action, "verify");
assert.deepEqual(activeBrief.whatIsBeingBought, activeFacts.whatIsBeingBought);
assert.deepEqual(activeBrief.documentedWinRequirements, activeFacts.documentedWinRequirements);
assert.deepEqual(activeBrief.deliveryRequirements, activeFacts.deliveryRequirements);
assert.deepEqual(activeBrief.risks, activeFacts.risks);
assert.doesNotMatch(JSON.stringify(activeBrief), /ISO 27001|24\/7-Betrieb|Erfundene/);
assert.equal(validateCommercialBrief(activeRaw, activeFacts).valid, false);

const cappedFacts = {
  title: "Sicherheitsprüfung",
  awarded: false,
  documentedWinRequirements: [
    "Nachweis 1",
    "Nachweis 1",
    "<script>alert(1)</script>",
    ...Array.from({ length: COMMERCIAL_BRIEF_MAX_LIST_ITEMS + 4 }, (_, index) => `Nachweis ${index + 2}`),
  ],
};

const cappedFallback = createCommercialBriefFallback(cappedFacts);
const sanitizedBrief = normalizeCommercialBrief({
  action: "verify",
  headline: "x".repeat(COMMERCIAL_BRIEF_MAX_HEADLINE_LENGTH + 20),
  rationale: "<script>alert(1)</script>",
  nextAction: "Unterlagen prüfen.",
}, cappedFacts);

assert.equal(cappedFallback.documentedWinRequirements.length, COMMERCIAL_BRIEF_MAX_LIST_ITEMS);
assert.equal(new Set(cappedFallback.documentedWinRequirements.map((item) => item.toLowerCase())).size, cappedFallback.documentedWinRequirements.length);
assert.ok(cappedFallback.documentedWinRequirements.every((item) => !item.includes("script")));
assert.equal(sanitizedBrief.headline, cappedFallback.headline);
assert.equal(sanitizedBrief.rationale, cappedFallback.rationale);

const longRationale = "Für das Vorhaben „Citrix Lizenz Renewal“ liegen nur begrenzte öffentlich sichtbare Verfahrensdaten vor. Als Leistungsgegenstand sind die CPV-Codes 48000000-8 (Softwarepaket und Informationssysteme) und 72268000-1 (Bereitstellung von Software) dokumentiert. Die vollständige Leistungsbeschreibung und die Vergabeunterlagen sind auf dem Quellportal erst nach Teilnahme am Verfahren zugänglich.";
const uncappedBrief = normalizeCommercialBrief({
  action: "verify",
  headline: "Citrix Lizenz Renewal",
  rationale: longRationale,
}, { title: "Citrix Lizenz Renewal", whatIsBeingBought: ["Citrix Lizenz Renewal"] });
assert.ok(uncappedBrief.rationale.length > COMMERCIAL_BRIEF_MAX_STRING_LENGTH);
assert.ok(uncappedBrief.rationale.length <= COMMERCIAL_BRIEF_MAX_RATIONALE_LENGTH);
assert.match(uncappedBrief.rationale, /zugänglich\.$/);

const sparseBrief = createCommercialBriefFallback({
  title: "Generalsanierung Kläranlage Itzgrund - Bauarbeiten",
  buyer: "Stadt Coburg",
  procedure: "Öffentliche Ausschreibung (VOB)",
  deadline: "14.08.2026 10:00",
  location: "96274 Itzgrund Bayern",
});
assert.equal(sparseBrief.action, "verify");
assert.match(sparseBrief.headline, /Generalsanierung Kläranlage/);
assert.match(sparseBrief.rationale, /Stadt Coburg|Öffentliche Ausschreibung|Itzgrund|14\.08\.2026/);
assert.match(sparseBrief.nextAction, /14\.08\.2026/);
assert.doesNotMatch(JSON.stringify(sparseBrief), /ISO 27001|zwingend|veröffentlichtes LV/i);

console.log("Commercial brief tests passed.");
