import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { BidPackError, linkBidPackEvidence, unlinkBidPackEvidence } from "@/lib/bid-packs";
import { requirePremiumSession } from "@/lib/entitlements";
import { requirementEvidenceLinkSchema } from "@/lib/validation";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string; requirementId: string }> }
const parseId = (value: string): number | null => /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
const handleError = (error: unknown): Response => error instanceof BidPackError
  ? json({ error: error.message, code: error.code }, { status: error.status })
  : errorResponse(error);

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const resolved = await params;
    const packId = parseId(resolved.id);
    const requirementId = parseId(resolved.requirementId);
    if (packId === null || requirementId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    const body = requirementEvidenceLinkSchema.parse(await parseJsonBody<unknown>(request));
    const item = await linkBidPackEvidence(
      sessionOrResponse.session.user.id,
      packId,
      requirementId,
      body.evidence_id,
      body.rationale,
    );
    return json({ item });
  } catch (error) { return handleError(error); }
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const resolved = await params;
    const packId = parseId(resolved.id);
    const requirementId = parseId(resolved.requirementId);
    const evidenceId = parseId(new URL(request.url).searchParams.get("evidenceId") ?? "");
    if (packId === null || requirementId === null || evidenceId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    const item = await unlinkBidPackEvidence(sessionOrResponse.session.user.id, packId, requirementId, evidenceId);
    return json({ item });
  } catch (error) { return handleError(error); }
}
