import { json } from "@/lib/http";
import { requireApiKey } from "@/lib/api-auth";
import { runWorkerProcess } from "@/lib/worker-process";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const authError = requireApiKey(request);
  if (authError) return authError;
  let execution;
  try {
    execution = await runWorkerProcess(["--once"]);
  } catch (error) {
    console.error("[pipeline/run-once] Worker-Kindprozess konnte nicht gestartet werden:", error);
    return json({ error: "Workerprozess konnte nicht gestartet werden" }, { status: 500 });
  }
  if (execution.exitCode !== 0) {
    return json({
      processed: execution.results.length > 0,
      results: execution.results,
      error: `Workerprozess wurde unerwartet beendet (Exit-Code ${execution.exitCode ?? execution.signal ?? "unbekannt"})`,
    }, { status: 500 });
  }
  const result = execution.results[0] ?? null;
  if (!result) {
    return json({ processed: false, message: "Keine Jobs verfuegbar" });
  }
  return json({ processed: true, result });
}
