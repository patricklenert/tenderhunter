import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { billingPlanFromPriceId, parseStoredBillingPlan, getStripe } from "@/lib/billing";
import { db } from "@/lib/db";
import { billingSubscriptions, stripeEvents } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toDate = (timestamp: number | null | undefined): Date | null =>
  typeof timestamp === "number" ? new Date(timestamp * 1000) : null;

async function findUserIdByCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const rows = await db
    .select({ userId: billingSubscriptions.userId })
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.stripeCustomerId, customerId))
    .limit(1);
  return rows[0]?.userId ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const priceId = subscription.items.data[0]?.price.id ?? "unknown";
  const currentPeriod = subscription.items.data[0];
  const plan = billingPlanFromPriceId(priceId) ?? parseStoredBillingPlan(subscription.metadata.plan) ?? "unknown";
  const userId = subscription.metadata.userId ?? fallbackUserId ?? await findUserIdByCustomer(customerId);
  if (!userId) {
    console.warn(`[stripe/webhook] Keine User-ID für Subscription ${subscription.id} gefunden.`);
    return;
  }

  await db
    .insert(billingSubscriptions)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      plan,
      status: subscription.status,
      currentPeriodStart: toDate(currentPeriod?.current_period_start),
      currentPeriodEnd: toDate(currentPeriod?.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: billingSubscriptions.stripeSubscriptionId,
      set: {
        userId,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        plan,
        status: subscription.status,
        currentPeriodStart: toDate(currentPeriod?.current_period_start),
        currentPeriodEnd: toDate(currentPeriod?.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });
}

async function processEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();

  if (event.type.startsWith("customer.subscription.")) {
    await syncSubscription(event.data.object as Stripe.Subscription);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || typeof session.subscription !== "string") return;
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await syncSubscription(subscription, session.client_reference_id ?? session.metadata?.userId ?? null);
    return;
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscription = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = typeof subscription === "string" ? subscription : null;
    if (subscriptionId) {
      await db
        .update(billingSubscriptions)
        .set({ status: "past_due", updatedAt: new Date() })
        .where(eq(billingSubscriptions.stripeSubscriptionId, subscriptionId));
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!webhookSecret || !signature) {
    return Response.json({ error: "Stripe Webhook-Konfiguration fehlt." }, { status: 400 });
  }

  try {
    const event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
    const existing = await db
      .select({ id: stripeEvents.id })
      .from(stripeEvents)
      .where(eq(stripeEvents.id, event.id))
      .limit(1);
    if (existing.length > 0) {
      return Response.json({ received: true, duplicate: true });
    }

    await processEvent(event);
    await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
    return Response.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook] Fehler:", error);
    return Response.json({ error: "Ungültiger Stripe Webhook." }, { status: 400 });
  }
}
