import { json } from "@/lib/http";
import { requireSession } from "@/lib/api-auth";
import { isSmallVendorTenderModeEnabled } from "@/lib/small-vendor";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  return json({ smallVendorMode: isSmallVendorTenderModeEnabled(sessionOrResponse.session.user) });
}
