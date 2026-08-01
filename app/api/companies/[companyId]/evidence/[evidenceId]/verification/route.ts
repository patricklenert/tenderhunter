import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { CompanyEvidenceError, verifyCompanyEvidence } from "@/lib/company-evidence";
import { requirePremiumSession } from "@/lib/entitlements";
import { companyEvidenceVerificationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params { params: Promise<{ companyId: string; evidenceId: string }> }
const parseId = (value: string): number | null => /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
const handleError = (error: unknown): Response => error instanceof CompanyEvidenceError
  ? json({ error: error.message, code: error.code }, { status: error.status })
  : errorResponse(error);

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const resolved = await params;
    const companyId = parseId(resolved.companyId);
    const evidenceId = parseId(resolved.evidenceId);
    if (companyId === null || evidenceId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    const body = companyEvidenceVerificationSchema.parse(await parseJsonBody<unknown>(request));
    const item = await verifyCompanyEvidence(sessionOrResponse.session.user.id, companyId, evidenceId, body.status, body.note);
    return json({ item });
  } catch (error) { return handleError(error); }
}
