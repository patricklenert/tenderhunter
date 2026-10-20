import assert from "node:assert/strict";
import { deriveBundesland, deriveCity, normalizeBundesland } from "../lib/bundesland";
import { normalizeOperatingArea, normalizeTenderLocation } from "../lib/location";

const RHEINLAND_PFALZ = "Rheinland-Pfalz";

for (const alias of ["RLP", "RP", "r.l.p.", "Rheinland Pfalz", "Rheinland-Pfalz"]) {
  assert.equal(normalizeBundesland(alias), RHEINLAND_PFALZ, `Bundesland alias: ${alias}`);
  assert.equal(deriveBundesland(alias), RHEINLAND_PFALZ, `Location alias: ${alias}`);
}

const rheinlandPfalzCities: Array<[string, string]> = [
  ["Koblenz", "Koblenz"],
  ["Ludwigshafen am Rhein", "Ludwigshafen"],
  ["Bad Kreuznach", "Bad Kreuznach"],
  ["Bingen am Rhein", "Bingen"],
  ["Frankenthal (Pfalz)", "Frankenthal"],
  ["Germersheim", "Germersheim"],
  ["Idar-Oberstein", "Idar-Oberstein"],
  ["Landau in der Pfalz", "Landau"],
  ["Neustadt an der Weinstrasse", "Neustadt an der Weinstraße"],
  ["Neuwied", "Neuwied"],
  ["Pirmasens", "Pirmasens"],
  ["Speyer", "Speyer"],
  ["Worms", "Worms"],
  ["Zweibruecken", "Zweibrücken"],
];

for (const [location, city] of rheinlandPfalzCities) {
  assert.equal(deriveBundesland(location), RHEINLAND_PFALZ, `RLP city: ${location}`);
  assert.equal(deriveCity(location), city, `RLP city canonicalization: ${location}`);
}

const postalCodeCases: Array<[string, string]> = [
  ["54290", RHEINLAND_PFALZ],
  ["Ausführungsort: 54 290 Trier", RHEINLAND_PFALZ],
  ["76726", RHEINLAND_PFALZ],
  ["76829 Landau", RHEINLAND_PFALZ],
  ["66953", RHEINLAND_PFALZ],
  ["66482", RHEINLAND_PFALZ],
  ["76706", "Baden-Württemberg"],
  ["76133", "Baden-Württemberg"],
  ["76275", "Baden-Württemberg"],
  ["66111", "Saarland"],
  ["66424", "Saarland"],
  ["53113", "Nordrhein-Westfalen"],
  ["57072", "Nordrhein-Westfalen"],
];

for (const [location, bundesland] of postalCodeCases) {
  assert.equal(deriveBundesland(location), bundesland, `Postal code: ${location}`);
}

assert.equal(deriveBundesland("54"), null, "A postal prefix alone is not a postal code");
assert.equal(deriveBundesland("Neubrandenburg"), "Mecklenburg-Vorpommern");
assert.equal(deriveBundesland("17033 Neubrandenburg"), "Mecklenburg-Vorpommern");
assert.equal(deriveBundesland("17033"), null, "An ambiguous postal code must not infer a Bundesland");
assert.equal(deriveBundesland("19322 Wittenberge"), "Brandenburg");
assert.equal(deriveBundesland("19246 Zarrentin am Schaalsee"), "Mecklenburg-Vorpommern");
assert.equal(deriveBundesland("19322"), null, "An ambiguous postal code must not infer a Bundesland");
assert.equal(deriveBundesland("Brandenburg"), "Brandenburg");
assert.equal(deriveBundesland("Brandenburg an der Havel"), "Brandenburg");

assert.deepEqual(normalizeOperatingArea(["RLP", "RP", "Bayern"]), {
  nationwide: false,
  bundeslaender: [RHEINLAND_PFALZ, "Bayern"],
  unresolvedRegions: [],
});

assert.deepEqual(normalizeTenderLocation({ metadataLocation: "66953" }), {
  bundesland: RHEINLAND_PFALZ,
  city: null,
  label: RHEINLAND_PFALZ,
  source: "metadata",
});

assert.equal(
  normalizeTenderLocation({ city: "Zweibruecken" }).label,
  "Zweibrücken, Rheinland-Pfalz",
);

console.log("Location normalization tests passed.");
