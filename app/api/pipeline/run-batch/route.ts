import { json } from "@/lib/http";
import { requireApiKey } from "@/lib/api-auth";
import { runWorkerProcess } from "@/lib/worker-process";

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
  let execution;
  try {
    execution = await runWorkerProcess([`--batch=${limit}`]);
  } catch (error) {
    console.error("[pipeline/run-batch] Worker-Kindprozess konnte nicht gestartet werden:", error);
    return json({ error: "Workerprozess konnte nicht gestartet werden" }, { status: 500 });
  }
  if (execution.exitCode !== 0) {
    return json({
      processed: execution.results.length,
      results: execution.results,
      error: `Workerprozess wurde unerwartet beendet (Exit-Code ${execution.exitCode ?? execution.signal ?? "unbekannt"})`,
    }, { status: 500 });
  }
  return json({ processed: execution.results.length, results: execution.results });
}
