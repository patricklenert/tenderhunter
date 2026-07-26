import { parseBillingPlan, getBillingSiteUrl, getStripe, getStripePriceId } from "@/lib/billing";
import { requireSession } from "@/lib/api-auth";
import { getLatestBillingSubscription, isSubscriptionEntitled } from "@/lib/entitlements";
import { json, parseJsonBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const body = await parseJsonBody<{ plan?: unknown }>(request);
    const plan = parseBillingPlan(body.plan);
    if (!plan) {
      return json({ error: "Ein gültiger Billing-Plan ist erforderlich." }, { status: 422 });
    }

    const existingSubscription = await getLatestBillingSubscription(sessionOrResponse.session.user.id);
    if (isSubscriptionEntitled(existingSubscription)) {
      return json(
        { error: "Es besteht bereits ein aktiver Billing-Plan.", code: "ALREADY_SUBSCRIBED", upgradeUrl: "/upgrade" },
        { status: 409 },
      );
    }

    let priceId: string;
    try {
      priceId = getStripePriceId(plan);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Stripe ist nicht konfiguriert." }, { status: 503 });
    }

    const checkout = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: existingSubscription?.stripeCustomerId ?? undefined,
      customer_email: existingSubscription?.stripeCustomerId ? undefined : sessionOrResponse.session.user.email,
      client_reference_id: sessionOrResponse.session.user.id,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        userId: sessionOrResponse.session.user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: sessionOrResponse.session.user.id,
          plan,
        },
      },
      success_url: `${getBillingSiteUrl()}/upgrade?checkout=success`,
      cancel_url: `${getBillingSiteUrl()}/upgrade?checkout=cancelled`,
    });

    if (!checkout.url) {
      return json({ error: "Stripe konnte keine Checkout-URL erstellen." }, { status: 502 });
    }

    return json({ url: checkout.url, plan });
  } catch (error) {
    console.error("[billing/checkout] Fehler:", error);
    return json({ error: "Checkout konnte nicht gestartet werden." }, { status: 502 });
  }
}
