import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

export type WorkerJobResult = {
  job_id: number;
  job_type: string;
  status: "done" | "failed";
  [key: string]: unknown;
};

export type WorkerProcessResult = {
  results: WorkerJobResult[];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
};

const isWorkerJobResult = (value: unknown): value is WorkerJobResult => {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return typeof result.job_id === "number"
    && typeof result.job_type === "string"
    && (result.status === "done" || result.status === "failed");
};

export const runWorkerProcess = async (args: string[]): Promise<WorkerProcessResult> => {
  const cwd = process.cwd();
  const workerCli = resolve(cwd, "node_modules/tsx/dist/cli.mjs");
  const workerScript = resolve(cwd, "scripts/worker.ts");
  const child = spawn(process.execPath, [workerCli, workerScript, ...args], {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const results: WorkerJobResult[] = [];
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const value: unknown = JSON.parse(line);
      if (isWorkerJobResult(value)) results.push(value);
    } catch {
      // Worker startup and progress messages are not job results.
    }
  });

  const { exitCode, signal } = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code, closeSignal) => resolveExit({ exitCode: code, signal: closeSignal }));
  });

  return { results, exitCode, signal };
};
