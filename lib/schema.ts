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
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";
import {
  BID_PACK_DECISION_STATUSES,
  BID_PACK_REQUIREMENT_STATUSES,
  BID_PACK_TASK_STATUSES,
} from "./bid-pack-types";

export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "done", "failed"]);
export const bidPackDecisionStatusEnum = pgEnum("bid_pack_decision_status", BID_PACK_DECISION_STATUSES);
export const bidPackRequirementStatusEnum = pgEnum("bid_pack_requirement_status", BID_PACK_REQUIREMENT_STATUSES);
export const bidPackTaskStatusEnum = pgEnum("bid_pack_task_status", BID_PACK_TASK_STATUSES);

export type TenderReadinessStatus = "pending" | "partial" | "ready" | "blocked" | "failed" | "manual_review";

export const tenders = pgTable(
  "tenders",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    sourceKey: text("source_key"),
    url: text("url").notNull(),
    title: text("title"),
    slug: text("slug"),
    externalId: text("external_id"),
    rawText: text("raw_text"),
    metadataJson: jsonb("metadata_json"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    category: text("category"),
    qualityStatus: text("quality_status").notNull().default("candidate"),
    qualityReason: text("quality_reason"),
    readinessStatus: text("readiness_status").notNull().default("pending"),
    readinessReason: text("readiness_reason"),
    readinessUpdatedAt: timestamp("readiness_updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    uniqueIndex("idx_tenders_source_external_unique")
      .on(table.source, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    index("idx_tenders_quality_status").on(table.qualityStatus),
    index("idx_tenders_readiness_status").on(table.readinessStatus),
    index("idx_tenders_deadline").on(table.deadlineAt),
    index("idx_tenders_content_fingerprint").on(table.contentFingerprint),
    index("idx_tenders_contract_value").on(table.contractValueMax),
    index("idx_tenders_slug").on(table.slug),
  ]
);

// US opportunities intentionally use a separate table so the established German
// procurement, SEO, and scoring flows remain isolated.
export const usTenders = pgTable(
  "us_tenders",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    sourceKey: text("source_key"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    externalId: text("external_id"),
    description: text("description"),
    buyer: text("buyer"),
    location: text("location"),
    state: text("state"),
    solicitationNumber: text("solicitation_number"),
    naicsCodesJson: jsonb("naics_codes_json").notNull().default([]),
    pscCodesJson: jsonb("psc_codes_json").notNull().default([]),
    setAside: text("set_aside"),
    contractType: text("contract_type"),
    currency: text("currency").notNull().default("USD"),
    category: text("category"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    qualityStatus: text("quality_status").notNull().default("qualified"),
    qualityReason: text("quality_reason"),
    version: integer("version").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_us_tenders_source_url").on(table.source, table.url),
    index("idx_us_tenders_source_external").on(table.source, table.externalId),
    index("idx_us_tenders_deadline").on(table.deadlineAt),
    index("idx_us_tenders_state").on(table.state),
    index("idx_us_tenders_quality_status").on(table.qualityStatus),
    index("idx_us_tenders_category").on(table.category),
  ]
);

export const usAlertSubscriptions = pgTable(
  "us_alert_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    filtersJson: jsonb("filters_json").notNull().default({}),
    confirmToken: text("confirm_token").notNull(),
    confirmed: boolean("confirmed").notNull().default(false),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_us_alert_subscriptions_email_filters").on(table.email, table.filtersJson),
  ]
);

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripePriceId: text("stripe_price_id").notNull(),
    plan: text("plan").notNull(),
    status: text("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_billing_subscriptions_stripe_subscription").on(table.stripeSubscriptionId),
    index("idx_billing_subscriptions_user_updated").on(table.userId, table.updatedAt),
    index("idx_billing_subscriptions_customer").on(table.stripeCustomerId),
  ],
);

export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_stripe_events_processed_at").on(table.processedAt)],
);

export const usSourceRuns = pgTable(
  "us_source_runs",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    discoveredCount: integer("discovered_count").notNull().default(0),
    acceptedCount: integer("accepted_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_us_source_runs_source_finished").on(table.source, table.finishedAt)]
);

export type DocumentRole =
  | "bekanntmachung"
  | "leistungsbeschreibung"
  | "leistungsverzeichnis"
  | "eignung"
  | "zuschlagskriterien"
  | "vertragsbedingungen"
  | "formblatt"
  | "anlage"
  | "nachtrag"
  | "other";

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
    downloadStatus: text("download_status").notNull().default("downloaded"),
    parseStatus: text("parse_status").notNull().default("pending"),
    errorMessage: text("error_message"),
    filename: text("filename"),
    pageCount: integer("page_count"),
    role: text("role"),
    roles: jsonb("roles").$type<DocumentRole[]>(),
    roleSource: text("role_source"),
    roleConfidence: real("role_confidence"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_documents_tender_sha256").on(table.tenderId, table.sha256),
    index("idx_documents_tender").on(table.tenderId),
  ]
);

export const usDocuments = pgTable(
  "us_documents",
  {
    id: serial("id").primaryKey(),
    usTenderId: integer("us_tender_id")
      .notNull()
      .references(() => usTenders.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    storagePath: text("storage_path").notNull(),
    sha256: text("sha256").notNull(),
    contentType: text("content_type"),
    extractedText: text("extracted_text"),
    downloadStatus: text("download_status").notNull().default("downloaded"),
    parseStatus: text("parse_status").notNull().default("pending"),
    errorMessage: text("error_message"),
    filename: text("filename"),
    pageCount: integer("page_count"),
    role: text("role"),
    roles: jsonb("roles").$type<DocumentRole[]>(),
    roleSource: text("role_source"),
    roleConfidence: real("role_confidence"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_us_documents_tender_sha256").on(table.usTenderId, table.sha256),
    index("idx_us_documents_tender").on(table.usTenderId),
  ]
);

export const tenderResources = pgTable(
  "tender_resources",
  {
    id: serial("id").primaryKey(),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    label: text("label").notNull().default(""),
    filename: text("filename"),
    resourceType: text("resource_type").notNull().default("unknown"),
    roleHints: jsonb("role_hints").$type<string[]>().notNull().default([]),
    sourcePageUrl: text("source_page_url"),
    discoveryMethod: text("discovery_method").notNull().default("unknown"),
    method: text("method").notNull().default("GET"),
    status: text("status").notNull().default("discovered"),
    contentType: text("content_type"),
    contentDisposition: text("content_disposition"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tender_resources_tender_canonical").on(table.tenderId, table.canonicalUrl),
    index("idx_tender_resources_tender_status").on(table.tenderId, table.status),
    index("idx_tender_resources_tender_type").on(table.tenderId, table.resourceType),
    index("idx_tender_resources_status_attempt").on(table.status, table.lastAttemptAt),
  ],
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
    marketsJson: jsonb("markets_json").notNull().default([]),
    naicsCodesJson: jsonb("naics_codes_json").notNull().default([]),
    pscCodesJson: jsonb("psc_codes_json").notNull().default([]),
    uei: text("uei"),
    cageCode: text("cage_code"),
    socioEconomicJson: jsonb("socio_economic_json").notNull().default([]),
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

export const companyEvidence = pgTable(
  "company_evidence",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companyProfiles.id, { onDelete: "cascade" }),
    evidenceType: text("evidence_type").notNull().default("other"),
    title: text("title").notNull(),
    description: text("description"),
    issuer: text("issuer"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    sourceUrl: text("source_url"),
    tagsJson: jsonb("tags_json").notNull().default([]),
    status: text("status").notNull().default("active"),
    sourceType: text("source_type").notNull().default("manual"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    verifiedByUserId: text("verified_by_user_id").references(() => user.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationNote: text("verification_note"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_company_evidence_company_status").on(table.companyId, table.status),
    index("idx_company_evidence_expires_at").on(table.expiresAt),
  ],
);

export const companyEvidenceFiles = pgTable(
  "company_evidence_files",
  {
    id: serial("id").primaryKey(),
    evidenceId: integer("evidence_id")
      .notNull()
      .references(() => companyEvidence.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    uploadStatus: text("upload_status").notNull().default("available"),
    scanStatus: text("scan_status").notNull().default("clean"),
    uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, { onDelete: "set null" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    availableAt: timestamp("available_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_company_evidence_files_evidence_status").on(table.evidenceId, table.uploadStatus),
    index("idx_company_evidence_files_scan_created").on(table.scanStatus, table.createdAt),
  ],
);

export const companyEvidenceEvents = pgTable(
  "company_evidence_events",
  {
    id: serial("id").primaryKey(),
    evidenceId: integer("evidence_id")
      .notNull()
      .references(() => companyEvidence.id, { onDelete: "cascade" }),
    fileId: integer("file_id").references(() => companyEvidenceFiles.id, { onDelete: "set null" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_company_evidence_events_evidence_created").on(table.evidenceId, table.createdAt)],
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

export const bidPacks = pgTable(
  "bid_packs",
  {
    id: serial("id").primaryKey(),
    trackedTenderId: integer("tracked_tender_id")
      .notNull()
      .references(() => trackedTenders.id, { onDelete: "cascade" }),
    decisionStatus: bidPackDecisionStatusEnum("decision_status")
      .notNull()
      .default("undecided"),
    decisionNote: text("decision_note"),
    snapshotJson: jsonb("snapshot_json").notNull().default({}),
    snapshotVersion: integer("snapshot_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_bid_packs_tracked_tender").on(table.trackedTenderId),
    index("idx_bid_packs_decision_updated").on(table.decisionStatus, table.updatedAt),
  ],
);

export const bidPackRequirements = pgTable(
  "bid_pack_requirements",
  {
    id: serial("id").primaryKey(),
    bidPackId: integer("bid_pack_id")
      .notNull()
      .references(() => bidPacks.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    title: text("title").notNull(),
    sourceQuote: text("source_quote"),
    isMandatory: boolean("is_mandatory").notNull().default(false),
    status: bidPackRequirementStatusEnum("status").notNull().default("open"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_bid_pack_requirements_pack_status").on(table.bidPackId, table.status),
  ],
);

export const bidPackTasks = pgTable(
  "bid_pack_tasks",
  {
    id: serial("id").primaryKey(),
    bidPackId: integer("bid_pack_id")
      .notNull()
      .references(() => bidPacks.id, { onDelete: "cascade" }),
    requirementId: integer("requirement_id").references(() => bidPackRequirements.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull().default("manual"),
    title: text("title").notNull(),
    status: bidPackTaskStatusEnum("status").notNull().default("todo"),
    assignee: text("assignee"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_bid_pack_tasks_pack_status").on(table.bidPackId, table.status),
    index("idx_bid_pack_tasks_due_at").on(table.dueAt),
  ],
);

export const requirementEvidenceMatches = pgTable(
  "requirement_evidence_matches",
  {
    id: serial("id").primaryKey(),
    requirementId: integer("requirement_id")
      .notNull()
      .references(() => bidPackRequirements.id, { onDelete: "cascade" }),
    evidenceId: integer("evidence_id")
      .notNull()
      .references(() => companyEvidence.id, { onDelete: "cascade" }),
    matchStatus: text("match_status").notNull().default("suggested"),
    rationale: text("rationale"),
    evidenceFileId: integer("evidence_file_id").references(() => companyEvidenceFiles.id, { onDelete: "set null" }),
    linkedByUserId: text("linked_by_user_id").references(() => user.id, { onDelete: "set null" }),
    evidenceSnapshotJson: jsonb("evidence_snapshot_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_requirement_evidence_unique").on(table.requirementId, table.evidenceId),
    index("idx_requirement_evidence_requirement").on(table.requirementId),
    index("idx_requirement_evidence_evidence").on(table.evidenceId),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(100),
    retries: integer("retries").notNull().default(0),
     maxRetries: integer("max_retries").notNull().default(3),
     runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
     lockedAt: timestamp("locked_at", { withTimezone: true }),
     lockedBy: text("locked_by"),
     jobKey: text("job_key"),
     groupKey: text("group_key"),
     startedAt: timestamp("started_at", { withTimezone: true }),
     heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
     finishedAt: timestamp("finished_at", { withTimezone: true }),
     queueLatencyMs: integer("queue_latency_ms"),
     durationMs: integer("duration_ms"),
     lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
   (table) => [
      index("idx_jobs_status_priority_run_after").on(table.status, table.priority, table.runAfter),
     index("idx_jobs_type_status_created").on(table.type, table.status, table.createdAt),
     index("idx_jobs_running_heartbeat").on(table.status, table.heartbeatAt),
     uniqueIndex("idx_jobs_active_job_key")
       .on(table.jobKey)
       .where(sql`${table.jobKey} IS NOT NULL AND ${table.status} IN ('pending', 'running')`),
   ]
   );

export const jobAttempts = pgTable(
  "job_attempts",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    workerId: text("worker_id"),
    status: text("status").notNull().default("running"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_job_attempts_job_started").on(table.jobId, table.startedAt),
    index("idx_job_attempts_status").on(table.status),
  ],
);

export const catalogState = pgTable("catalog_state", {
  id: integer("id").primaryKey().default(1),
  revision: integer("revision").notNull().default(0),
    syncedRevision: integer("synced_revision").notNull().default(0),
    syncRunning: boolean("sync_running").notNull().default(false),
    syncStartedAt: timestamp("sync_started_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const publicScrapeRuns = pgTable(
  "public_scrape_runs",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
    scopeSourceKey: text("scope_source_key"),
    isFullRun: boolean("is_full_run").notNull().default(true),
    status: text("status").notNull().default("running"),
    totalFound: integer("total_found").notNull().default(0),
    afterDedup: integer("after_dedup").notNull().default(0),
    acceptedCount: integer("accepted_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedExpired: integer("skipped_expired").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_public_scrape_runs_status_finished").on(table.status, table.finishedAt),
    index("idx_public_scrape_runs_job").on(table.jobId),
  ],
);

export const publicSourceRuns = pgTable(
  "public_source_runs",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => publicScrapeRuns.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    status: text("status").notNull(),
    discoveredCount: integer("discovered_count").notNull().default(0),
    listedCount: integer("listed_count").notNull().default(0),
    detailAttempted: integer("detail_attempted").notNull().default(0),
    detailFailed: integer("detail_failed").notNull().default(0),
    pendingCount: integer("pending_count").notNull().default(0),
    continuationScheduled: boolean("continuation_scheduled").notNull().default(false),
    acceptedCount: integer("accepted_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    errorMessage: text("error_message"),
    cursorBeforeJson: jsonb("cursor_before_json"),
    cursorAfterJson: jsonb("cursor_after_json"),
    cursorVersionBefore: integer("cursor_version_before").notNull().default(0),
    cursorVersionAfter: integer("cursor_version_after").notNull().default(0),
    pagesFetched: integer("pages_fetched").notNull().default(0),
    exhausted: boolean("exhausted").notNull().default(false),
    cursorAdvanced: boolean("cursor_advanced").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_public_source_runs_run_source").on(table.runId, table.sourceKey),
    index("idx_public_source_runs_source_finished").on(table.sourceKey, table.finishedAt),
  ],
);

export const publicSourceCursors = pgTable(
  "public_source_cursors",
  {
    sourceKey: text("source_key").primaryKey(),
    cursorJson: jsonb("cursor_json").notNull().default({}),
    cursorVersion: integer("cursor_version").notNull().default(0),
    exhausted: boolean("exhausted").notNull().default(false),
    continuationRequired: boolean("continuation_required").notNull().default(false),
    lastRunId: integer("last_run_id").references(() => publicScrapeRuns.id, { onDelete: "set null" }),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    lastAdvancedAt: timestamp("last_advanced_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_public_source_cursors_status").on(table.exhausted, table.updatedAt),
  ],
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

export const companyUrlCache = pgTable(
  "company_url_cache",
  {
    id: serial("id").primaryKey(),
    canonicalUrl: text("canonical_url").notNull().unique(),
    urlHash: text("url_hash").notNull().unique(),
    finalUrl: text("final_url"),
    profileJson: jsonb("profile_json"),
    profileFingerprint: text("profile_fingerprint"),
    extractorVersion: text("extractor_version").notNull().default("v1"),
    status: text("status").notNull().default("pending"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_company_url_cache_status_expires").on(table.status, table.expiresAt)],
);

export const companyUrlMatchCache = pgTable(
  "company_url_match_cache",
  {
    id: serial("id").primaryKey(),
    cacheId: integer("cache_id")
      .notNull()
      .references(() => companyUrlCache.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    tenderId: integer("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    titleSnapshot: text("title_snapshot").notNull(),
    sourceSnapshot: text("source_snapshot").notNull(),
    urlSnapshot: text("url_snapshot"),
    deadlineAtSnapshot: timestamp("deadline_at_snapshot", { withTimezone: true }),
    fit: real("fit").notNull(),
    winProbability: real("win_probability").notNull(),
    reason: text("reason").notNull(),
    detailsJson: jsonb("details_json").notNull().default({}),
    scoringVersion: text("scoring_version").notNull().default("v1"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_company_url_match_cache_rank").on(table.cacheId, table.rank),
    index("idx_company_url_match_cache_cache").on(table.cacheId),
  ],
);

export const companyMatchPreviews = pgTable(
  "company_match_previews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cacheId: integer("cache_id").references(() => companyUrlCache.id, { onDelete: "set null" }),
    status: text("status").notNull().default("queued"),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key"),
    errorCode: text("error_code"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_company_match_previews_user_created").on(table.userId, table.createdAt),
    index("idx_company_match_previews_status").on(table.status),
  ],
);

export const apiRateLimitBuckets = pgTable(
  "api_rate_limit_buckets",
  {
    bucketKey: text("bucket_key").primaryKey(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_api_rate_limit_buckets_expires").on(table.expiresAt)],
);

export type Tender = typeof tenders.$inferSelect;
export type NewTender = typeof tenders.$inferInsert;
export type UsTender = typeof usTenders.$inferSelect;
export type NewUsTender = typeof usTenders.$inferInsert;
export type UsSourceRun = typeof usSourceRuns.$inferSelect;
export type UsAlertSubscription = typeof usAlertSubscriptions.$inferSelect;
export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type StripeEvent = typeof stripeEvents.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type UsDocument = typeof usDocuments.$inferSelect;
export type NewUsDocument = typeof usDocuments.$inferInsert;
export type TenderResource = typeof tenderResources.$inferSelect;
export type NewTenderResource = typeof tenderResources.$inferInsert;
export type StructuredData = typeof structuredData.$inferSelect;
export type NewStructuredData = typeof structuredData.$inferInsert;
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type NewCompanyProfile = typeof companyProfiles.$inferInsert;
export type UserCompany = typeof userCompanies.$inferSelect;
export type NewUserCompany = typeof userCompanies.$inferInsert;
export type CompanyEvidence = typeof companyEvidence.$inferSelect;
export type NewCompanyEvidence = typeof companyEvidence.$inferInsert;
export type CompanyEvidenceFile = typeof companyEvidenceFiles.$inferSelect;
export type NewCompanyEvidenceFile = typeof companyEvidenceFiles.$inferInsert;
export type CompanyEvidenceEvent = typeof companyEvidenceEvents.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
export type AttributionEvent = typeof attributionEvents.$inferSelect;
export type NewAttributionEvent = typeof attributionEvents.$inferInsert;
export type TrackedTender = typeof trackedTenders.$inferSelect;
export type NewTrackedTender = typeof trackedTenders.$inferInsert;
export type BidPack = typeof bidPacks.$inferSelect;
export type NewBidPack = typeof bidPacks.$inferInsert;
export type BidPackRequirement = typeof bidPackRequirements.$inferSelect;
export type NewBidPackRequirement = typeof bidPackRequirements.$inferInsert;
export type BidPackTask = typeof bidPackTasks.$inferSelect;
export type NewBidPackTask = typeof bidPackTasks.$inferInsert;
export type RequirementEvidenceMatch = typeof requirementEvidenceMatches.$inferSelect;
export type NewRequirementEvidenceMatch = typeof requirementEvidenceMatches.$inferInsert;
export type CompanyUrlCache = typeof companyUrlCache.$inferSelect;
export type CompanyUrlMatchCache = typeof companyUrlMatchCache.$inferSelect;
export type CompanyMatchPreview = typeof companyMatchPreviews.$inferSelect;
export type CatalogState = typeof catalogState.$inferSelect;
export type PublicScrapeRun = typeof publicScrapeRuns.$inferSelect;
export type PublicSourceRun = typeof publicSourceRuns.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type ApiJob = typeof apiJobs.$inferSelect;
export type NewApiJob = typeof apiJobs.$inferInsert;
