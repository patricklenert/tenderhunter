import { and, eq } from "drizzle-orm";
import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { requireSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { getTenderCheckState, updateTenderCheckState } from "@/lib/tender-check-state";
import { tenderCheckStateUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseTenderId = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const tenderExists = async (tenderId: number): Promise<boolean> => {
  const rows = await db
    .select({ id: tenders.id })
    .from(tenders)
    .where(and(eq(tenders.id, tenderId), eq(tenders.qualityStatus, "qualified")))
    .limit(1);
  return Boolean(rows[0]);
};

export async function GET(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const tenderId = parseTenderId(new URL(request.url).searchParams.get("tenderId"));
    if (tenderId === null) return json({ error: "ungueltige tenderId" }, { status: 400 });
    if (!(await tenderExists(tenderId))) return json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });

    const states = await getTenderCheckState(sessionOrResponse.session.user.id, tenderId);
    return json({ tenderId, states });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const sessionOrResponse = await requireSession(request);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const body = tenderCheckStateUpdateSchema.parse(await parseJsonBody<unknown>(request));
    if (!(await tenderExists(body.tender_id))) return json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });

    const states = await updateTenderCheckState(
      sessionOrResponse.session.user.id,
      body.tender_id,
      body.item_key,
      body.done,
    );
    return json({ tenderId: body.tender_id, states });
  } catch (error) {
    return errorResponse(error);
  }
}
