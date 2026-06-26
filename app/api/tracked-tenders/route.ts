import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { createOrUpdateTrackedTender, listTrackedTenders } from "@/lib/tracked-tenders";
import { TRACKED_TENDER_STATUSES, type TrackedTenderStatus } from "@/lib/tracked-tender-types";
import { trackedTenderCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

const isTrackedTenderStatus = (value: string): value is TrackedTenderStatus =>
  (TRACKED_TENDER_STATUSES as readonly string[]).includes(value);

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const companyIdRaw = url.searchParams.get("companyId");
    const companyId = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : undefined;
    if (companyIdRaw && (!Number.isFinite(companyId) || (companyId ?? 0) <= 0)) {
      return json({ error: "ungueltige companyId" }, { status: 400 });
    }

    const statusRaw = (url.searchParams.get("status") ?? "all").trim();
    if (statusRaw !== "all" && statusRaw !== "active" && !isTrackedTenderStatus(statusRaw)) {
      return json({ error: "ungueltiger Status" }, { status: 400 });
    }

    const result = await listTrackedTenders({
      companyId,
      status: statusRaw as "all" | "active" | TrackedTenderStatus,
      search: url.searchParams.get("search") ?? "",
    });

    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = trackedTenderCreateSchema.parse(await parseJsonBody<unknown>(request));
    const item = await createOrUpdateTrackedTender({
      companyId: body.company_id,
      tenderId: body.tender_id,
      status: body.status,
      owner: body.owner,
      deadlineAt: body.deadline_at,
      notes: body.notes,
      metadata: body.metadata,
    });

    return json({ item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
