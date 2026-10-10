import { createHash } from "node:crypto";
import { enqueueJob } from "@/lib/queue";
import { JOB_CRAWL } from "@/lib/types";
import { crawlSchema } from "@/lib/validation";
import { errorResponse, json, parseJsonBody } from "@/lib/http";
import { requireApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    const payload = crawlSchema.parse(await parseJsonBody<unknown>(request));
    const requestKey = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const jobId = await enqueueJob(JOB_CRAWL, payload, { jobKey: `${JOB_CRAWL}:${requestKey}`, dedupeCompleted: false });
    return json({ enqueued_job_id: jobId }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
