import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { BidPackError, getBidPackForUser, updateBidPack } from "@/lib/bid-packs";
import { bidPackDecisionUpdateSchema } from "@/lib/validation";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

const parseId = (value: string): number | null => {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const bidPackErrorResponse = (error: unknown): Response => {
  if (error instanceof BidPackError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  return errorResponse(error);
};

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const id = parseId((await params).id);
    if (id === null) return json({ error: "ungueltige ID" }, { status: 400 });

    const item = await getBidPackForUser(sessionOrResponse.session.user.id, id);
    return json({ item });
  } catch (error) {
    return bidPackErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const id = parseId((await params).id);
    if (id === null) return json({ error: "ungueltige ID" }, { status: 400 });

    const body = bidPackDecisionUpdateSchema.parse(await parseJsonBody<unknown>(request));
    const item = await updateBidPack(sessionOrResponse.session.user.id, id, {
      decisionStatus: body.decision_status,
      decisionNote: body.decision_note,
    });
    return json({ item });
  } catch (error) {
    return bidPackErrorResponse(error);
  }
}
