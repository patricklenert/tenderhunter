import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { billingSubscriptions, type BillingSubscription } from "@/lib/schema";

const ENTITLED_STATUSES = new Set(["active", "trialing"]);

export const PREMIUM_FEATURES = [
  "documents",
  "ai_analysis",
  "alerts",
  "exports",
  "us_pursuit",
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

export interface BillingStatus {
  active: boolean;
  plan: string | null;
  status: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export function isSubscriptionEntitled(subscription: Pick<BillingSubscription, "plan" | "status" | "currentPeriodEnd"> | null): boolean {
  if (!subscription || !["weekly", "yearly"].includes(subscription.plan) || !ENTITLED_STATUSES.has(subscription.status)) return false;
  return !subscription.currentPeriodEnd || subscription.currentPeriodEnd.getTime() > Date.now();
}

export async function getLatestBillingSubscription(userId: string): Promise<BillingSubscription | null> {
  const rows = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.userId, userId))
    .orderBy(desc(billingSubscriptions.updatedAt), desc(billingSubscriptions.id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const subscription = await getLatestBillingSubscription(userId);
  return {
    active: isSubscriptionEntitled(subscription),
    plan: subscription?.plan ?? null,
    status: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
  };
}

export async function hasPremiumAccess(userId: string): Promise<boolean> {
  return isSubscriptionEntitled(await getLatestBillingSubscription(userId));
}

export async function requirePremiumSession(
  request: Request,
): Promise<
  | {
      session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
      subscription: BillingSubscription;
    }
  | Response
> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const subscription = await getLatestBillingSubscription(sessionOrResponse.session.user.id);
  if (!subscription || !isSubscriptionEntitled(subscription)) {
    return Response.json(
      {
        error: "Für diese Funktion ist ein aktiver Billing-Plan erforderlich.",
        code: "PAYMENT_REQUIRED",
        upgradeUrl: "/upgrade",
      },
      { status: 402, headers: { "cache-control": "no-store" } },
    );
  }

  return { session: sessionOrResponse.session, subscription };
}
