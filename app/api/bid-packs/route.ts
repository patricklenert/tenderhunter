import { errorResponse, json, parseJsonBody } from "@/lib/http";
import {
  BidPackError,
  createBidPack,
  listBidPacksForUser,
} from "@/lib/bid-packs";
import { bidPackCreateSchema } from "@/lib/validation";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parsePositiveId = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  if (!/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const bidPackErrorResponse = (error: unknown): Response => {
  if (error instanceof BidPackError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  return errorResponse(error);
};

export async function GET(request: Request): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const url = new URL(request.url);
    const companyIdRaw = url.searchParams.get("companyId");
    const trackedTenderIdRaw = url.searchParams.get("trackedTenderId");
    const companyId = parsePositiveId(companyIdRaw);
    const trackedTenderId = parsePositiveId(trackedTenderIdRaw);

    if ((companyIdRaw !== null && companyId === undefined) || (trackedTenderIdRaw !== null && trackedTenderId === undefined)) {
      return json({ error: "ungueltige IDs" }, { status: 400 });
    }

    const items = await listBidPacksForUser(sessionOrResponse.session.user.id, { companyId, trackedTenderId });
    return json({ items });
  } catch (error) {
    return bidPackErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const body = bidPackCreateSchema.parse(await parseJsonBody<unknown>(request));
    const item = await createBidPack({
      userId: sessionOrResponse.session.user.id,
      trackedTenderId: body.tracked_tender_id,
      decisionStatus: body.decision_status,
      decisionNote: body.decision_note,
    });

    return json({ item }, { status: 201 });
  } catch (error) {
    return bidPackErrorResponse(error);
  }
}
