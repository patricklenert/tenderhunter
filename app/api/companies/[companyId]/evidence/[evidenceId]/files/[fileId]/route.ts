import { errorResponse, json } from "@/lib/http";
import { CompanyEvidenceError, deleteCompanyEvidenceFile, getCompanyEvidenceFile } from "@/lib/company-evidence";
import { requirePremiumSession } from "@/lib/entitlements";
import { consumeRateLimit, RateLimitError } from "@/lib/rate-limit";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params { params: Promise<{ companyId: string; evidenceId: string; fileId: string }> }
const parseId = (value: string): number | null => /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
const handleError = (error: unknown): Response => {
  if (error instanceof RateLimitError) return json({ error: error.message, code: error.code }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
  return error instanceof CompanyEvidenceError
    ? json({ error: error.message, code: error.code }, { status: error.status })
    : errorResponse(error);
};

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const resolved = await params;
    const companyId = parseId(resolved.companyId);
    const evidenceId = parseId(resolved.evidenceId);
    const fileId = parseId(resolved.fileId);
    if (companyId === null || evidenceId === null || fileId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    await consumeRateLimit(`evidence-download:user:${sessionOrResponse.session.user.id}`, 120, 60 * 60 * 1000);
    const file = await getCompanyEvidenceFile(sessionOrResponse.session.user.id, companyId, evidenceId, fileId);
    const stream = Readable.toWeb((await import("node:fs")).createReadStream(file.path)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) { return handleError(error); }
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requirePremiumSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const resolved = await params;
    const companyId = parseId(resolved.companyId);
    const evidenceId = parseId(resolved.evidenceId);
    const fileId = parseId(resolved.fileId);
    if (companyId === null || evidenceId === null || fileId === null) return json({ error: "ungueltige ID" }, { status: 400 });
    await deleteCompanyEvidenceFile(sessionOrResponse.session.user.id, companyId, evidenceId, fileId);
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
