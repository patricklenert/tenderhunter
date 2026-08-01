import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { CompanyEvidenceError, archiveCompanyEvidence, updateCompanyEvidence } from "@/lib/company-evidence";
import { requirePremiumSession } from "@/lib/entitlements";
import { companyEvidenceUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

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
    const body = companyEvidenceUpdateSchema.parse(await parseJsonBody<unknown>(request));
    const item = await updateCompanyEvidence(sessionOrResponse.session.user.id, companyId, evidenceId, {
      evidenceType: body.evidence_type,
      title: body.title,
      description: body.description,
      issuer: body.issuer,
      issuedAt: body.issued_at,
      expiresAt: body.expires_at,
      sourceUrl: body.source_url,
      tags: body.tags,
    });
    return json({ item });
  } catch (error) { return handleError(error); }
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const resolved = await params;
    const companyId = parseId(resolved.companyId);
    const evidenceId = parseId(resolved.evidenceId);
    if (companyId === null || evidenceId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    await archiveCompanyEvidence(sessionOrResponse.session.user.id, companyId, evidenceId);
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
