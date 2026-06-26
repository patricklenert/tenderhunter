import { db } from "@/lib/db";
import { attributionEvents } from "@/lib/schema";
import { trackEventSchema } from "@/lib/validation";
import { errorResponse, json, parseJsonBody } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = trackEventSchema.parse(await parseJsonBody<unknown>(request));
    const result = await db
      .insert(attributionEvents)
      .values({
        tenderId: body.tender_id,
        companyId: body.company_id,
        eventType: body.event_type,
        metadataJson: body.metadata ?? {},
        scoreSnapshotJson: null,
      })
      .returning({ id: attributionEvents.id });

    return json({ event_id: result[0]?.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
