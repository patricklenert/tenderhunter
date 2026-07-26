import assert from "node:assert/strict";
import { BILLING_PLANS, parseBillingPlan } from "@/lib/billing";
import { isSubscriptionEntitled } from "@/lib/entitlements";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

assert.equal(parseBillingPlan("weekly"), "weekly");
assert.equal(parseBillingPlan("yearly"), "yearly");
assert.equal(parseBillingPlan("monthly"), null);
assert.equal(BILLING_PLANS.weekly.price, "$12");
assert.equal(BILLING_PLANS.yearly.price, "$79");

assert.equal(isSubscriptionEntitled({ plan: "weekly", status: "active", currentPeriodEnd: future }), true);
assert.equal(isSubscriptionEntitled({ plan: "yearly", status: "trialing", currentPeriodEnd: future }), true);
assert.equal(isSubscriptionEntitled({ plan: "weekly", status: "active", currentPeriodEnd: past }), false);
assert.equal(isSubscriptionEntitled({ plan: "unknown", status: "active", currentPeriodEnd: future }), false);
assert.equal(isSubscriptionEntitled({ plan: "weekly", status: "past_due", currentPeriodEnd: future }), false);
assert.equal(isSubscriptionEntitled(null), false);

console.log("Billing checks passed.");
