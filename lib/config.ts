import path from "node:path";
import { parseConfiguredTenderSources } from "@/lib/tender-sources";

const parseIntEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const defaultSources = parseConfiguredTenderSources(process.env.DEFAULT_SOURCES);

export const settings = {
  objectStorePath: path.resolve(process.env.OBJECT_STORE_PATH ?? "data/object_store"),
  defaultSources,
  maxPdfLinksPerTender: parseIntEnv("MAX_PDF_LINKS_PER_TENDER", 5),
  maxJobRetries: parseIntEnv("MAX_JOB_RETRIES", 3),
  workerPollSeconds: parseIntEnv("WORKER_POLL_SECONDS", 3)
};

export type Settings = typeof settings;
