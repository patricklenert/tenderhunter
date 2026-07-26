import { requireSession } from "@/lib/api-auth";
import { getBillingStatus } from "@/lib/entitlements";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const status = await getBillingStatus(sessionOrResponse.session.user.id);
  return json(status);
}
