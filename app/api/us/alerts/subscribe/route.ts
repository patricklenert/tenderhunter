import { json, parseJsonBody } from "@/lib/http";
import { createAlertSubscription, sendConfirmationEmail, type AlertFilters } from "@/lib/us/alerts";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const premiumOrResponse = await requirePremiumSession(request);
  if (premiumOrResponse instanceof Response) return premiumOrResponse;

  try {
    const body = await parseJsonBody<{
      email: string;
      filters: AlertFilters;
    }>(request);

    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "A valid email address is required." }, { status: 422 });
    }

    const { confirmToken, alreadyConfirmed } = await createAlertSubscription(premiumOrResponse.session.user.id, email, body.filters ?? {});

    if (alreadyConfirmed) {
      return json({ status: "already_confirmed" });
    }

    const sent = await sendConfirmationEmail(email, confirmToken);
    return json({ status: sent ? "confirmation_sent" : "subscribed_pending_email", email });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to subscribe." }, { status: 400 });
  }
}
