import type { TrackedTenderStatus, TrackingEventType } from "@/lib/tracked-tender-types";

export type JobStatus = "pending" | "running" | "done" | "failed";

export const JOB_CRAWL = "crawl_sources";
export const JOB_SCRAPE_PUBLIC = "scrape_public_tenders";
export const JOB_FETCH_DOCUMENTS = "fetch_documents";
export const JOB_PARSE = "parse_documents";
export const JOB_STRUCTURE = "structure_tender";
export const JOB_SCORE = "score_tender";
export const JOB_INSIGHT = "generate_insight";
export const JOB_NOTIFY = "notify_company";
export const JOB_CACHE_DETAIL = "cache_detail";
export const JOB_SYNC_MEILI = "sync_meilisearch";
export const JOB_DISCOVER_COMPANY = "discover_company";
export const JOB_SCRAPE_US = "scrape_us_tenders";

export type JobType =
  | typeof JOB_CRAWL
  | typeof JOB_SCRAPE_PUBLIC
  | typeof JOB_FETCH_DOCUMENTS
  | typeof JOB_PARSE
  | typeof JOB_STRUCTURE
  | typeof JOB_SCORE
  | typeof JOB_INSIGHT
  | typeof JOB_NOTIFY
  | typeof JOB_CACHE_DETAIL
  | typeof JOB_SYNC_MEILI
  | typeof JOB_DISCOVER_COMPANY
  | typeof JOB_SCRAPE_US;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface JobRow {
  id: number;
  type: JobType;
  payload: string;
  status: JobStatus;
  retries: number;
  max_retries: number;
  run_after: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceItem {
  key?: string;
  name?: string;
  url: string;
}

export interface CrawlRequest {
  sources?: SourceItem[];
}

export interface ManualTenderCreate {
  source: string;
  url: string;
  title: string;
  external_id?: string;
  metadata?: Record<string, JsonValue>;
}

export interface CompanyProfileCreate {
  name: string;
  capabilities: string[];
  certifications: string[];
  team_size?: number;
  regions: string[];
  markets?: string[];
  naics_codes?: string[];
  psc_codes?: string[];
  uei?: string;
  cage_code?: string;
  socio_economic?: string[];
}

export interface TrackEventCreate {
  tender_id: number;
  company_id: number;
  event_type: TrackingEventType;
  metadata?: Record<string, JsonValue>;
}

export interface TrackedTenderCreate {
  tender_id: number;
  company_id: number;
  status?: TrackedTenderStatus;
  owner?: string;
  deadline_at?: string | null;
  notes?: string;
  metadata?: Record<string, JsonValue>;
}

export interface TrackedTenderUpdate {
  status?: TrackedTenderStatus;
  owner?: string | null;
  deadline_at?: string | null;
  notes?: string;
}

export interface JobProcessResult {
  job_id: number;
  job_type: JobType;
  status: "done" | "failed";
  queue_latency_ms?: number;
  duration_ms?: number;
  result?: Record<string, JsonValue>;
  error?: string;
}
