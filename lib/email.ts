import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "alerts@tenderhunter.us";

let client: Resend | null = null;

const getClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
};

export const isEmailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY?.trim());

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY is not configured; skipping email send.");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error("[email] Send failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Send error:", error instanceof Error ? error.message : "unknown");
    return false;
  }
}
