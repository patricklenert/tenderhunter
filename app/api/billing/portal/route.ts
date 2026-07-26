import { getBillingSiteUrl, getStripe } from "@/lib/billing";
import { requireSession } from "@/lib/api-auth";
import { getLatestBillingSubscription } from "@/lib/entitlements";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const subscription = await getLatestBillingSubscription(sessionOrResponse.session.user.id);
    if (!subscription?.stripeCustomerId) {
      return json({ error: "Für dieses Konto wurde noch kein Stripe-Kunde angelegt." }, { status: 404 });
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getBillingSiteUrl()}/upgrade`,
    });

    return json({ url: portal.url });
  } catch (error) {
    console.error("[billing/portal] Fehler:", error);
    return json({ error: "Billing-Verwaltung konnte nicht geöffnet werden." }, { status: 502 });
  }
}
