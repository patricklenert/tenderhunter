import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { BidPackError, updateBidPackRequirement } from "@/lib/bid-packs";
import { bidPackRequirementUpdateSchema } from "@/lib/validation";
import { requirePremiumSession } from "@/lib/entitlements";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string; requirementId: string }>;
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

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const resolved = await params;
    const id = parseId(resolved.id);
    const requirementId = parseId(resolved.requirementId);
    if (id === null || requirementId === null) return json({ error: "ungueltige ID" }, { status: 400 });

    const body = bidPackRequirementUpdateSchema.parse(await parseJsonBody<unknown>(request));
    const item = await updateBidPackRequirement(
      sessionOrResponse.session.user.id,
      id,
      requirementId,
      body.status,
    );
    return json({ item });
  } catch (error) {
    return bidPackErrorResponse(error);
  }
}
