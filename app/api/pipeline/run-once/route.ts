import { processNextJob } from "@/lib/pipeline";
import { json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const result = await processNextJob("api-run-once");
  if (!result) {
    return json({ processed: false, message: "Keine Jobs verfuegbar" });
  }
  return json({ processed: true, result });
}
