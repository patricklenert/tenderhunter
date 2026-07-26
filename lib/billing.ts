import Stripe from "stripe";

export type BillingPlan = "weekly" | "yearly";

export const BILLING_PLANS: Record<
  BillingPlan,
  {
    label: string;
    price: string;
    cadence: string;
    description: string;
  }
> = {
  weekly: {
    label: "Wöchentlich",
    price: "$12",
    cadence: "pro Woche",
    description: "Flexibel starten und jederzeit über Stripe verwalten.",
  },
  yearly: {
    label: "Jährlich",
    price: "$79",
    cadence: "pro Jahr",
    description: "Der beste Wert für Teams, die regelmäßig Ausschreibungen verfolgen.",
  },
};

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getStripePriceId(plan: BillingPlan): string {
  const priceId = plan === "weekly" ? process.env.STRIPE_PRICE_WEEKLY : process.env.STRIPE_PRICE_YEARLY;
  if (!priceId) {
    throw new Error(`STRIPE_PRICE_${plan === "weekly" ? "WEEKLY" : "YEARLY"} ist nicht gesetzt.`);
  }
  return priceId;
}

export function parseBillingPlan(value: unknown): BillingPlan | null {
  return value === "weekly" || value === "yearly" ? value : null;
}

export function billingPlanFromPriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_WEEKLY) return "weekly";
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return "yearly";
  return null;
}

export function getBillingSiteUrl(): string {
  return "https://palemaz.com";
}
