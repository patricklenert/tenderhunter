import { confirmAlertSubscription } from "@/lib/us/alerts";
import { json } from "@/lib/http";
import { getSiteUrl } from "@/lib/site-config";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return json({ error: "Missing confirmation token." }, { status: 400 });

  const confirmed = await confirmAlertSubscription(token);
  if (!confirmed) return json({ error: "Invalid or already confirmed token." }, { status: 400 });

  return Response.redirect(`${getSiteUrl()}/us?alert=confirmed`, 302);
}
