import Stripe from "stripe";

export type CheckoutBillingPlan = "weekly" | "quarterly";
export type BillingPlan = CheckoutBillingPlan | "yearly";

export const BILLING_PLANS: Record<
  CheckoutBillingPlan,
  {
    label: string;
    price: string;
    currency: string;
    cadence: string;
    description: string;
    features: string[];
  }
> = {
  weekly: {
    label: "Wöchentlich",
    price: "12",
    currency: "€",
    cadence: "pro Woche",
    description: "Flexibel starten und jederzeit über Stripe verwalten.",
    features: [
      "Alle Pro-Arbeitsansichten",
      "Fit-Score und Muss-Kriterien",
      "Risiken und nächste Schritte",
      "Wöchentlich kündbar",
    ],
  },
  quarterly: {
    label: "3 Monate",
    price: "39",
    currency: "€",
    cadence: "pro 3 Monate",
    description: "Mehr Zeit für die Recherche, ohne dich langfristig zu binden.",
    features: [
      "Alle Pro-Arbeitsansichten",
      "Fit-Score und Muss-Kriterien",
      "Risiken und nächste Schritte",
      "Brief- und Matrix-Exporte",
      "73 % günstiger als der Wochenplan",
    ],
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

export function getStripePriceId(plan: CheckoutBillingPlan): string {
  const priceId = plan === "weekly" ? process.env.STRIPE_PRICE_WEEKLY : process.env.STRIPE_PRICE_QUARTERLY;
  if (!priceId) {
    throw new Error(`STRIPE_PRICE_${plan === "weekly" ? "WEEKLY" : "QUARTERLY"} ist nicht gesetzt.`);
  }
  return priceId;
}

export function parseBillingPlan(value: unknown): CheckoutBillingPlan | null {
  return value === "weekly" || value === "quarterly" ? value : null;
}

export function parseStoredBillingPlan(value: unknown): BillingPlan | null {
  return parseBillingPlan(value) ?? (value === "yearly" ? "yearly" : null);
}

export function billingPlanFromPriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_WEEKLY) return "weekly";
  if (priceId === process.env.STRIPE_PRICE_QUARTERLY) return "quarterly";
  // Keep recognizing existing annual subscriptions without offering them again.
  if (process.env.STRIPE_PRICE_YEARLY && priceId === process.env.STRIPE_PRICE_YEARLY) return "yearly";
  return null;
}

export function getBillingSiteUrl(): string {
  return "https://palemaz.com";
}
