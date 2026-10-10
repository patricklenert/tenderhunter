import assert from "node:assert/strict";
import {
  documentTextInputSchema,
  matchTendersInputSchema,
  rankMatchItems,
  tenderDossierInputSchema,
} from "../lib/mcp/analysis";
import { mcpTenderSearchSchema } from "../lib/mcp/tenders";

const bidderOnly = { bidder: {} };

const matchDefaults = matchTendersInputSchema.parse({ profile: bidderOnly });
assert.equal(matchDefaults.candidatePool, 40);
assert.equal(matchDefaults.limit, 5);
assert.equal(matchDefaults.deadlineFilter, "all");

assert.throws(() => matchTendersInputSchema.parse({ profile: bidderOnly, candidatePool: 0 }));
assert.throws(() => matchTendersInputSchema.parse({ profile: bidderOnly, candidatePool: 101 }));
assert.throws(() => matchTendersInputSchema.parse({ profile: bidderOnly, limit: 0 }));
assert.throws(() => matchTendersInputSchema.parse({ profile: bidderOnly, limit: 11 }));
assert.throws(() => matchTendersInputSchema.parse({ profile: bidderOnly, category: "Bau\" OR x" }));

assert.throws(() => matchTendersInputSchema.parse({ profile: { bidder: {}, partner: { inGermany: true } } }));
assert.throws(() => matchTendersInputSchema.parse({ profile: {} }));
assert.throws(() => matchTendersInputSchema.parse({ profile: { bidder: { foundedOn: "01.02.2020" } } }));

const revenue = matchTendersInputSchema.parse({
  profile: { bidder: { revenueByYearEur: { "2024": 1_250_000 } } },
});
assert.equal(revenue.profile.bidder.revenueByYearEur?.["2024"], 1_250_000);

const partner = matchTendersInputSchema.parse({
  profile: { bidder: {}, partner: { name: "Partner GmbH", inGermany: true } },
});
assert.equal(partner.profile.partner?.name, "Partner GmbH");

assert.equal(mcpTenderSearchSchema.parse({ sort: "smallVendorFit" }).sort, "smallVendorFit");
assert.throws(() => mcpTenderSearchSchema.parse({ sort: "foo" }));
assert.equal(mcpTenderSearchSchema.parse({ smallVendorFitMin: 0 }).smallVendorFitMin, 0);
assert.throws(() => mcpTenderSearchSchema.parse({ smallVendorFitMin: 101 }));
assert.throws(() => mcpTenderSearchSchema.parse({ category: "Bau\" OR x" }));

assert.equal(tenderDossierInputSchema.parse({ tenderId: 7 }).tenderId, 7);
assert.throws(() => tenderDossierInputSchema.parse({ tenderId: 0 }));

const documentDefaults = documentTextInputSchema.parse({ documentId: 3 });
assert.equal(documentDefaults.offset, 0);
assert.equal(documentDefaults.limit, 12_000);
assert.throws(() => documentTextInputSchema.parse({ documentId: 3, limit: 12_001 }));
assert.throws(() => documentTextInputSchema.parse({ documentId: 3, page: 0 }));

const ranked = rankMatchItems([
  { id: 1, verdict: "barrier" as const, smallVendorFit: 90, deadlineISO: "2026-11-01T00:00:00.000Z" },
  { id: 2, verdict: "no_barrier_found" as const, smallVendorFit: 40, deadlineISO: "2026-12-01T00:00:00.000Z" },
  { id: 3, verdict: "no_barrier_found" as const, smallVendorFit: 70, deadlineISO: null },
  { id: 4, verdict: "unclear" as const, smallVendorFit: null, deadlineISO: "2026-10-20T00:00:00.000Z" },
  { id: 5, verdict: "no_barrier_found" as const, smallVendorFit: 70, deadlineISO: "2026-11-15T00:00:00.000Z" },
]);
assert.deepEqual(ranked.map((item) => item.id), [5, 3, 2, 4, 1]);

console.log("mcp-analysis passed.");
