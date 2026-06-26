import { enqueueJob } from "@/lib/queue";
import { JOB_CRAWL } from "@/lib/types";
import { crawlSchema } from "@/lib/validation";
import { errorResponse, json, parseJsonBody } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = crawlSchema.parse(await parseJsonBody<unknown>(request));
    const jobId = await enqueueJob(JOB_CRAWL, payload);
    return json({ enqueued_job_id: jobId }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
