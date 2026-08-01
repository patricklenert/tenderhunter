import { errorResponse, json } from "@/lib/http";
import { CompanyEvidenceError, uploadCompanyEvidenceFile } from "@/lib/company-evidence";
import { requirePremiumSession } from "@/lib/entitlements";
import { consumeRateLimit, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params { params: Promise<{ companyId: string; evidenceId: string }> }
const parseId = (value: string): number | null => /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
const handleError = (error: unknown): Response => {
  if (error instanceof RateLimitError) return json({ error: error.message, code: error.code }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
  if (error instanceof CompanyEvidenceError) return json({ error: error.message, code: error.code }, { status: error.status });
  return errorResponse(error);
};

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const resolved = await params;
    const companyId = parseId(resolved.companyId);
    const evidenceId = parseId(resolved.evidenceId);
    if (companyId === null || evidenceId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    await consumeRateLimit(`evidence-upload:user:${sessionOrResponse.session.user.id}`, 20, 60 * 60 * 1000);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Eine Datei ist erforderlich.", code: "FILE_REQUIRED" }, { status: 422 });
    const item = await uploadCompanyEvidenceFile(sessionOrResponse.session.user.id, companyId, evidenceId, file);
    return json({ item }, { status: 201 });
  } catch (error) { return handleError(error); }
}
