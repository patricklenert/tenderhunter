import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { CompanyEvidenceError, createCompanyEvidence, listCompanyEvidence } from "@/lib/company-evidence";
import { requirePremiumSession } from "@/lib/entitlements";
import { companyEvidenceCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params { params: Promise<{ companyId: string }> }

const parseId = (value: string): number | null => /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
const handleError = (error: unknown): Response => error instanceof CompanyEvidenceError
  ? json({ error: error.message, code: error.code }, { status: error.status })
  : errorResponse(error);

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const companyId = parseId((await params).companyId);
    if (companyId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    return json({ items: await listCompanyEvidence(sessionOrResponse.session.user.id, companyId) });
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const companyId = parseId((await params).companyId);
    if (companyId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    const body = companyEvidenceCreateSchema.parse(await parseJsonBody<unknown>(request));
    const item = await createCompanyEvidence(sessionOrResponse.session.user.id, companyId, {
      evidenceType: body.evidence_type,
      title: body.title,
      description: body.description,
      issuer: body.issuer,
      issuedAt: body.issued_at,
      expiresAt: body.expires_at,
      sourceUrl: body.source_url,
      tags: body.tags,
    });
    return json({ item }, { status: 201 });
  } catch (error) { return handleError(error); }
}
