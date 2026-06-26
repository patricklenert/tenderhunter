import { seedManualTender } from "@/lib/pipeline";
import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { manualTenderSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = manualTenderSchema.parse(await parseJsonBody<unknown>(request));
    const tenderId = await seedManualTender(body.source, body.url, body.title, {
      external_id: body.external_id ?? null,
      ...(body.metadata ?? {})
    });
    return json({ tender_id: tenderId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
