import { db } from "@/lib/db";
import { usAlertSubscriptions } from "@/lib/schema";
import { searchUsTenders, getUsTenderMetadata } from "@/lib/us/repository";
import { sendEmail } from "@/lib/email";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hasPremiumAccess } from "@/lib/entitlements";
import { getSiteUrl } from "@/lib/site-config";

export interface AlertFilters {
  query?: string;
  state?: string;
  source?: string;
  category?: string;
  subcontracting?: boolean;
}

export async function createAlertSubscription(userId: string, email: string, filters: AlertFilters): Promise<{ id: number; confirmToken: string; alreadyConfirmed: boolean }> {
  const confirmToken = randomBytes(32).toString("hex");
  const filtersJson = filters as Record<string, unknown>;

  const existing = await db
    .select({ id: usAlertSubscriptions.id, confirmed: usAlertSubscriptions.confirmed })
    .from(usAlertSubscriptions)
    .where(and(eq(usAlertSubscriptions.email, email), eq(usAlertSubscriptions.filtersJson, filtersJson)))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].confirmed) {
      return { id: existing[0].id, confirmToken: "", alreadyConfirmed: true };
    }
    await db
      .update(usAlertSubscriptions)
      .set({ userId, confirmToken, updatedAt: new Date() })
      .where(eq(usAlertSubscriptions.id, existing[0].id));
    return { id: existing[0].id, confirmToken, alreadyConfirmed: false };
  }

  const result = await db
    .insert(usAlertSubscriptions)
    .values({ userId, email, filtersJson, confirmToken, confirmed: false })
    .returning({ id: usAlertSubscriptions.id });

  return { id: result[0].id, confirmToken, alreadyConfirmed: false };
}

export async function confirmAlertSubscription(token: string): Promise<boolean> {
  const result = await db
    .update(usAlertSubscriptions)
    .set({ confirmed: true, updatedAt: new Date() })
    .where(and(eq(usAlertSubscriptions.confirmToken, token), eq(usAlertSubscriptions.confirmed, false)))
    .returning({ id: usAlertSubscriptions.id });
  return result.length > 0;
}

export async function unsubscribeAlertSubscription(token: string): Promise<boolean> {
  const result = await db
    .delete(usAlertSubscriptions)
    .where(eq(usAlertSubscriptions.confirmToken, token))
    .returning({ id: usAlertSubscriptions.id });
  return result.length > 0;
}

export async function sendConfirmationEmail(email: string, token: string): Promise<boolean> {
  const confirmUrl = `${getSiteUrl()}/api/us/alerts/confirm?token=${token}`;
  return sendEmail({
    to: email,
    subject: "Confirm your Tenderhunter U.S. opportunity alerts",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #0d5c80;">Confirm your alert subscription</h1>
        <p style="color: #334155; font-size: 16px; line-height: 1.7;">
          Click the button below to start receiving U.S. procurement opportunity alerts from Tenderhunter.
          You'll get an email whenever new matching opportunities are discovered.
        </p>
        <a href="${confirmUrl}" style="display: inline-block; background: #0d5c80; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; margin: 16px 0;">
          Confirm subscription
        </a>
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
          If you didn't subscribe, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function processUsAlerts(): Promise<{ processed: number; notified: number }> {
  const subscriptions = await db
    .select()
    .from(usAlertSubscriptions)
    .where(eq(usAlertSubscriptions.confirmed, true));

  let notified = 0;

  for (const sub of subscriptions) {
    if (!sub.userId || !(await hasPremiumAccess(sub.userId))) continue;

    const filters = sub.filtersJson as AlertFilters;
    const { items } = await searchUsTenders({
      query: filters.query,
      state: filters.state,
      source: filters.source,
      category: filters.category,
      subcontracting: filters.subcontracting,
      limit: 20,
      page: 1,
    });

    const newItems = sub.lastNotifiedAt
      ? items.filter((item) => item.firstSeenAt.getTime() > sub.lastNotifiedAt!.getTime())
      : items;

    if (newItems.length === 0) continue;

    const emailSent = await sendDigestEmail(sub.email, sub.confirmToken, newItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      state: item.state,
      buyer: item.buyer,
      deadlineAt: item.deadlineAt,
      subcontracting: getUsTenderMetadata(item).subcontracting === true,
    })));

    if (emailSent) {
      notified += 1;
      await db
        .update(usAlertSubscriptions)
        .set({ lastNotifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(usAlertSubscriptions.id, sub.id));
    }
  }

  return { processed: subscriptions.length, notified };
}

async function sendDigestEmail(email: string, unsubscribeToken: string, opportunities: Array<{
  id: number;
  title: string;
  category: string | null;
  state: string | null;
  buyer: string | null;
  deadlineAt: Date | null;
  subcontracting: boolean;
}>): Promise<boolean> {
  const siteUrl = getSiteUrl();
  const items = opportunities.map((opp) => {
    const deadline = opp.deadlineAt
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(opp.deadlineAt)
      : "No deadline";
    return `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <a href="${siteUrl}/us/tender/${opp.id}" style="color: #0d5c80; font-weight: 700; text-decoration: none; font-size: 15px;">${opp.title}</a>
          <div style="color: #64748b; font-size: 13px; margin-top: 4px;">
            ${[opp.category, opp.state, opp.subcontracting ? "Subcontracting" : "Direct bid", `Due: ${deadline}`].filter(Boolean).join(" · ")}
          </div>
        </td>
      </tr>`;
  }).join("");

  return sendEmail({
    to: email,
    subject: `${opportunities.length} new U.S. opportunit${opportunities.length === 1 ? "y" : "ies"} on Tenderhunter`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #0d5c80;">${opportunities.length} new opportunit${opportunities.length === 1 ? "y" : "ies"} match your search</h1>
        <table style="width: 100%; border-collapse: collapse;">${items}</table>
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
          <a href="${siteUrl}/us" style="color: #0d5c80;">View all opportunities</a>
          · <a href="${siteUrl}/api/us/alerts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}" style="color: #64748b;">Unsubscribe</a>
        </p>
      </div>
    `,
  });
}
