import { processNextJob } from "@/lib/pipeline";
import { json } from "@/lib/http";
import { requireApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const authError = requireApiKey(request);
  if (authError) return authError;
  const result = await processNextJob("api-run-once");
  if (!result) {
    return json({ processed: false, message: "Keine Jobs verfuegbar" });
  }
  return json({ processed: true, result });
}
