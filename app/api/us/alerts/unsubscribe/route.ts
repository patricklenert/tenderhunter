import { unsubscribeAlertSubscription } from "@/lib/us/alerts";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("Missing unsubscribe token.", { status: 400 });
  const removed = await unsubscribeAlertSubscription(token);
  return new Response(removed ? "You have been unsubscribed from Tenderhunter U.S. alerts." : "This alert subscription was not found.", { status: removed ? 200 : 404 });
}
