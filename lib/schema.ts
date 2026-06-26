import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "done", "failed"]);

export const tenders = pgTable(
  "tenders",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    sourceKey: text("source_key"),
    url: text("url").notNull(),
    title: text("title"),
    externalId: text("external_id"),
    rawText: text("raw_text"),
    metadataJson: jsonb("metadata_json"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    category: text("category"),
    qualityStatus: text("quality_status").notNull().default("candidate"),
    qualityReason: text("quality_reason"),
    contentFingerprint: text("content_fingerprint"),
    duplicateOfTenderId: integer("duplicate_of_tender_id"),
    // Procurement data
    contractValueMin: real("contract_value_min"),
    contractValueMax: real("contract_value_max"),
    contractDurationMonths: integer("contract_duration_months"),
    procedureType: text("procedure_type"),
    version: integer("version").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tenders_source_url").on(table.source, table.url),
    index("idx_tenders_source_external").on(table.source, table.externalId),
    index("idx_tenders_quality_status").on(table.qualityStatus),
    index("idx_tenders_deadline").on(table.deadlineAt),
    index("idx_tenders_content_fingerprint").on(table.contentFingerprint),
    index("idx_tenders_contract_value").on(table.contractValueMax),
  ]
);

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    url: text("url"),
    storagePath: text("storage_path").notNull(),
    sha256: text("sha256").notNull(),
    contentType: text("content_type"),
    extractedText: text("extracted_text"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_documents_tender_sha256").on(table.tenderId, table.sha256),
    index("idx_documents_tender").on(table.tenderId),
  ]
);

export const structuredData = pgTable(
  "structured_data",
  {
    id: serial("id").primaryKey(),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" })
      .unique(),
    jsonBlob: jsonb("json_blob").notNull(),
    confidence: real("confidence").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const companyProfiles = pgTable(
  "company_profiles",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    slug: text("slug"),
    websiteUrl: text("website_url"),
    description: text("description"),
    industry: text("industry"),
    logoUrl: text("logo_url"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    address: text("address"),
    capabilitiesJson: jsonb("capabilities_json").notNull(),
    certificationsJson: jsonb("certifications_json").notNull(),
    teamSize: integer("team_size"),
    regionsJson: jsonb("regions_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_company_profiles_website").on(table.websiteUrl),
    uniqueIndex("idx_company_profiles_slug").on(table.slug),
  ]
);

export const userCompanies = pgTable(
  "user_companies",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companyProfiles.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(false),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_companies_user_company").on(table.userId, table.companyId),
    index("idx_user_companies_user_active").on(table.userId, table.isActive),
  ]
);

export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companyProfiles.id, { onDelete: "cascade" }),
    fit: real("fit").notNull(),
    winProbability: real("win_probability").notNull(),
    effort: real("effort").notNull(),
    requirementCoverage: real("requirement_coverage").notNull(),
    killSwitch: boolean("kill_switch").notNull().default(false),
    detailsJson: jsonb("details_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_scores_tender_company").on(table.tenderId, table.companyId),
    index("idx_scores_company").on(table.companyId),
  ]
);

export const insights = pgTable(
  "insights",
  {
    id: serial("id").primaryKey(),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companyProfiles.id, { onDelete: "cascade" }),
    explanation: text("explanation").notNull(),
    actionsJson: jsonb("actions_json").notNull(),
    missingItemsJson: jsonb("missing_items_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_insights_tender_company").on(table.tenderId, table.companyId),
  ]
);

export const attributionEvents = pgTable(
  "attribution_events",
  {
    id: serial("id").primaryKey(),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companyProfiles.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    metadataJson: jsonb("metadata_json").notNull(),
    scoreSnapshotJson: jsonb("score_snapshot_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_events_company").on(table.companyId, table.eventType),
  ]
);

export const trackedTenders = pgTable(
  "tracked_tenders",
  {
    id: serial("id").primaryKey(),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companyProfiles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("tracked"),
    owner: text("owner"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tracked_tenders_company_tender").on(table.companyId, table.tenderId),
    index("idx_tracked_tenders_status_updated").on(table.status, table.updatedAt),
    index("idx_tracked_tenders_deadline").on(table.deadlineAt),
  ]
);

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    retries: integer("retries").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_jobs_status_run_after").on(table.status, table.runAfter),
  ]
);

export const apiJobs = pgTable(
  "api_jobs",
  {
    id: serial("id").primaryKey(),
    companyUrl: text("company_url").notNull(),
    status: text("status").notNull().default("processing"),
    companyId: integer("company_id"),
    profileUrl: text("profile_url"),
    tendersJson: jsonb("tenders_json"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_api_jobs_status").on(table.status),
  ]
);

export type Tender = typeof tenders.$inferSelect;
export type NewTender = typeof tenders.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type StructuredData = typeof structuredData.$inferSelect;
export type NewStructuredData = typeof structuredData.$inferInsert;
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type NewCompanyProfile = typeof companyProfiles.$inferInsert;
export type UserCompany = typeof userCompanies.$inferSelect;
export type NewUserCompany = typeof userCompanies.$inferInsert;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
export type AttributionEvent = typeof attributionEvents.$inferSelect;
export type NewAttributionEvent = typeof attributionEvents.$inferInsert;
export type TrackedTender = typeof trackedTenders.$inferSelect;
export type NewTrackedTender = typeof trackedTenders.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type ApiJob = typeof apiJobs.$inferSelect;
export type NewApiJob = typeof apiJobs.$inferInsert;
