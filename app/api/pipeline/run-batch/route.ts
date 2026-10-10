import { runBatch } from "@/lib/pipeline";
import { json } from "@/lib/http";
import { requireApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";

const parseLimit = (request: Request): number => {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = Number.parseInt(raw ?? "20", 10);
  if (Number.isNaN(parsed)) {
    return 20;
  }
  return Math.max(1, Math.min(parsed, 200));
};

export async function POST(request: Request): Promise<Response> {
  const authError = requireApiKey(request);
  if (authError) return authError;
  const limit = parseLimit(request);
  const results = await runBatch("api-run-batch", limit);
  return json({ processed: results.length, results });
}
