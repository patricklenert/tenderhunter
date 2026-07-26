import assert from "node:assert/strict";
import { buildUsPursuitChecklist, scoreUsTender } from "@/lib/us/scoring";
import { getUsTeamingResources } from "@/lib/us/teaming-resources";
import { isUsItOpportunity, normalizeUsDate, normalizeUsState } from "@/lib/us/types";

const deadline = normalizeUsDate("08/14/2026 5:30 PM");
assert.equal(deadline?.toISOString(), "2026-08-14T17:30:59.999Z");
assert.equal(normalizeUsDate("2026-02-30"), null);
assert.equal(normalizeUsState("California"), "CA");
assert.equal(normalizeUsState("VA"), "VA");
assert.equal(isUsItOpportunity({ title: "Cloud migration services", description: "", naicsCodes: [], pscCodes: [] }), true);
assert.equal(isUsItOpportunity({ title: "Road resurfacing", description: "", naicsCodes: ["237310"], pscCodes: [] }), false);

const tender = {
  title: "Cloud security modernization",
  description: "Cybersecurity engineering and cloud migration services.",
  naicsCodesJson: ["541512"],
  setAside: "Total Small Business Set-Aside",
  deadlineAt: deadline,
};
const company = {
  naicsCodesJson: ["541512"],
  capabilitiesJson: ["cloud migration", "cybersecurity engineering"],
  socioEconomicJson: ["small_business"],
  uei: "ABCD1234EFGH",
  cageCode: "1A2B3",
};

const fit = scoreUsTender(tender, company);
assert.equal(fit.naicsMatch, true);
assert.equal(fit.eligibleForSetAside, true);
assert.equal(fit.registrationReady, true);
assert.equal(fit.score, 100);
assert.equal(buildUsPursuitChecklist(tender, company).every((item) => item.status !== "action_required" || item.id === "review-solicitation" || item.id === "teaming"), true);
assert.equal(getUsTeamingResources("Department of Homeland Security").some((resource) => resource.organization === "Department of Homeland Security"), true);

console.log("U.S. market checks passed.");
