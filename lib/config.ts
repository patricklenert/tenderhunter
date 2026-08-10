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

const positiveIntEnv = (name: string, fallback: number): number => Math.max(1, parseIntEnv(name, fallback));

const defaultSources = parseConfiguredTenderSources(process.env.DEFAULT_SOURCES);

export const settings = {
  objectStorePath: path.resolve(process.env.OBJECT_STORE_PATH ?? "data/object_store"),
  defaultSources,
  maxPdfLinksPerTender: parseIntEnv("MAX_PDF_LINKS_PER_TENDER", 20),
  documentRefreshHours: positiveIntEnv("DOCUMENT_REFRESH_HOURS", 72),
  publicDetailLimit: positiveIntEnv("PUBLIC_DETAIL_LIMIT", 15),
  publicNoticeLimit: positiveIntEnv("PUBLIC_NOTICE_LIMIT", 15),
  publicSearchLimit: positiveIntEnv("PUBLIC_SEARCH_LIMIT", 30),
  publicPaginationPages: positiveIntEnv("PUBLIC_PAGINATION_PAGES", 3),
  publicCpvCodesPerRun: positiveIntEnv("PUBLIC_CPV_CODES_PER_RUN", 20),
  maxJobRetries: parseIntEnv("MAX_JOB_RETRIES", 3),
  maxPendingJobs: positiveIntEnv("MAX_PENDING_JOBS", 5_000),
  maxCriticalJobAgeMinutes: positiveIntEnv("MAX_CRITICAL_JOB_AGE_MINUTES", 30),
  workerConcurrency: positiveIntEnv("WORKER_CONCURRENCY", 1),
  workerPollSeconds: parseIntEnv("WORKER_POLL_SECONDS", 3),
  usScrapeIntervalHours: positiveIntEnv("US_SCRAPE_INTERVAL_HOURS", 24),
  publicScrapeIntervalHours: positiveIntEnv("PUBLIC_SCRAPE_INTERVAL_HOURS", 48),
  samLookbackDays: positiveIntEnv("SAM_LOOKBACK_DAYS", 2),
  samMaxRecords: positiveIntEnv("SAM_MAX_RECORDS", 5_000),
  samSetAside: process.env.SAM_SET_ASIDE?.trim() || undefined,
  usPortalMaxPages: positiveIntEnv("US_PORTAL_MAX_PAGES", 2),
};

export type Settings = typeof settings;
