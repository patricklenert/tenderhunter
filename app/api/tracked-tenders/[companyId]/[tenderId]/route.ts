import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { getTrackedTender, updateTrackedTender } from "@/lib/tracked-tenders";
import { trackedTenderUpdateSchema } from "@/lib/validation";
import { requireSession } from "@/lib/api-auth";
import { hasCompanyMembership } from "@/lib/company-access";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ companyId: string; tenderId: string }>;
}

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { companyId: companyIdRaw, tenderId: tenderIdRaw } = await params;
    const companyId = /^\d+$/.test(companyIdRaw) ? Number(companyIdRaw) : Number.NaN;
    const tenderId = /^\d+$/.test(tenderIdRaw) ? Number(tenderIdRaw) : Number.NaN;

    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(tenderId) || tenderId <= 0) {
      return json({ error: "ungueltige IDs" }, { status: 400 });
    }

    if (!(await hasCompanyMembership(sessionOrResponse.session.user.id, companyId))) {
      return json({ error: "Kein Zugriff auf dieses Unternehmen." }, { status: 403 });
    }

    const item = await getTrackedTender(sessionOrResponse.session.user.id, companyId, tenderId);
    if (!item) {
      return json({ error: "Verfolgte Ausschreibung nicht gefunden" }, { status: 404 });
    }

    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { companyId: companyIdRaw, tenderId: tenderIdRaw } = await params;
    const companyId = /^\d+$/.test(companyIdRaw) ? Number(companyIdRaw) : Number.NaN;
    const tenderId = /^\d+$/.test(tenderIdRaw) ? Number(tenderIdRaw) : Number.NaN;

    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(tenderId) || tenderId <= 0) {
      return json({ error: "ungueltige IDs" }, { status: 400 });
    }

    if (!(await hasCompanyMembership(sessionOrResponse.session.user.id, companyId))) {
      return json({ error: "Kein Zugriff auf dieses Unternehmen." }, { status: 403 });
    }

    const body = trackedTenderUpdateSchema.parse(await parseJsonBody<unknown>(request));
    const item = await updateTrackedTender(sessionOrResponse.session.user.id, companyId, tenderId, {
      status: body.status,
      owner: body.owner,
      deadlineAt: body.deadline_at,
      notes: body.notes,
    });

    if (!item) {
      return json({ error: "Verfolgte Ausschreibung nicht gefunden" }, { status: 404 });
    }

    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
