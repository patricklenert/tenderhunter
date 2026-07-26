import { timingSafeEqual } from "node:crypto";
import { json } from "@/lib/http";
import { enqueueJob } from "@/lib/queue";
import { JOB_SCRAPE_US } from "@/lib/types";

export const runtime = "nodejs";

const matchesApiKey = (provided: string | null, expected: string | undefined): boolean => {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
};

export async function POST(request: Request): Promise<Response> {
  if (!matchesApiKey(request.headers.get("x-api-key"), process.env.TENDERHUNTER_API_KEY)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobId = await enqueueJob(JOB_SCRAPE_US, {}, { jobKey: JOB_SCRAPE_US });
    return json({ enqueuedJobId: jobId }, { status: 202 });
  } catch {
    return json({ error: "Unable to queue U.S. scrape." }, { status: 500 });
  }
}
