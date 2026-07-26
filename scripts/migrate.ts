import postgres from "postgres";

const connectionString = process.env.DATABASE_URL ?? "postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter";
const MIGRATION_LOCK_ID = 42_024_205;

async function main() {
  console.log("Connecting to PostgreSQL...");
  const client = postgres(connectionString, { max: 1 });
  console.log("Acquiring migration lock...");
  await client`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;

  try {
    console.log("Creating tables...");

    await client`
      CREATE TABLE IF NOT EXISTS tenders (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        source_key TEXT,
        url TEXT NOT NULL,
        title TEXT,
        external_id TEXT,
        raw_text TEXT,
        metadata_json JSONB,
        quality_status TEXT NOT NULL DEFAULT 'candidate',
        quality_reason TEXT,
        content_fingerprint TEXT,
        duplicate_of_tender_id INTEGER,
        version INTEGER NOT NULL DEFAULT 1,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(source, url)
      )
    `;

    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS source_key TEXT`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'candidate'`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS quality_reason TEXT`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS content_fingerprint TEXT`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS duplicate_of_tender_id INTEGER`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS category TEXT`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS slug TEXT`;

    await client`
      CREATE TABLE IF NOT EXISTS us_tenders (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        source_key TEXT,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        external_id TEXT,
        description TEXT,
        buyer TEXT,
        location TEXT,
        state TEXT,
        solicitation_number TEXT,
        naics_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        psc_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        set_aside TEXT,
        contract_type TEXT,
        currency TEXT NOT NULL DEFAULT 'USD',
        deadline_at TIMESTAMPTZ,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        quality_status TEXT NOT NULL DEFAULT 'qualified',
        quality_reason TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(source, url)
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS us_source_runs (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        discovered_count INTEGER NOT NULL DEFAULT 0,
        accepted_count INTEGER NOT NULL DEFAULT 0,
        inserted_count INTEGER NOT NULL DEFAULT 0,
        updated_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await client`ALTER TABLE us_tenders ADD COLUMN IF NOT EXISTS category TEXT`;

    await client`
      CREATE TABLE IF NOT EXISTS us_alert_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        confirm_token TEXT NOT NULL,
        confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        last_notified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(email, filters_json)
      )
    `;
    await client`ALTER TABLE us_alert_subscriptions ADD COLUMN IF NOT EXISTS user_id TEXT`;

    await client`
      CREATE TABLE IF NOT EXISTS billing_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT NOT NULL,
        stripe_price_id TEXT NOT NULL,
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(stripe_subscription_id)
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS stripe_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
        url TEXT,
        storage_path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        content_type TEXT,
        extracted_text TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tender_id, sha256)
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS structured_data (
        id SERIAL PRIMARY KEY,
        tender_id INTEGER NOT NULL UNIQUE REFERENCES tenders(id) ON DELETE CASCADE,
        json_blob JSONB NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS company_profiles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        website_url TEXT,
        capabilities_json JSONB NOT NULL,
        certifications_json JSONB NOT NULL,
        team_size INTEGER,
        regions_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await client`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS website_url TEXT`;
    await client`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS markets_json JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await client`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS naics_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await client`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS psc_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await client`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS uei TEXT`;
    await client`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS cage_code TEXT`;
    await client`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS socio_economic_json JSONB NOT NULL DEFAULT '[]'::jsonb`;

    await client`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
        fit REAL NOT NULL,
        win_probability REAL NOT NULL,
        effort REAL NOT NULL,
        requirement_coverage REAL NOT NULL,
        kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
        details_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tender_id, company_id)
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS insights (
        id SERIAL PRIMARY KEY,
        tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
        explanation TEXT NOT NULL,
        actions_json JSONB NOT NULL,
        missing_items_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tender_id, company_id)
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS attribution_events (
        id SERIAL PRIMARY KEY,
        tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        metadata_json JSONB NOT NULL,
        score_snapshot_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
        retries INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
         run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         locked_at TIMESTAMPTZ,
         locked_by TEXT,
         job_key TEXT,
         group_key TEXT,
         started_at TIMESTAMPTZ,
         heartbeat_at TIMESTAMPTZ,
         finished_at TIMESTAMPTZ,
         queue_latency_ms INTEGER,
         duration_ms INTEGER,
         last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )
     `;

    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_key TEXT`;
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS group_key TEXT`;
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`;
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ`;
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ`;
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS queue_latency_ms INTEGER`;
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duration_ms INTEGER`;

    await client`
      CREATE TABLE IF NOT EXISTS tracked_tenders (
        id SERIAL PRIMARY KEY,
        tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'tracked',
        owner TEXT,
        deadline_at TIMESTAMPTZ,
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(company_id, tender_id)
      )
    `;

    console.log("Creating indexes...");

     await client`CREATE INDEX IF NOT EXISTS idx_jobs_status_run_after ON jobs(status, run_after)`;
    await client`CREATE INDEX IF NOT EXISTS idx_jobs_type_status_created ON jobs(type, status, created_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_jobs_running_heartbeat ON jobs(status, heartbeat_at)`;
    await client`CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_active_job_key ON jobs(job_key) WHERE job_key IS NOT NULL AND status IN ('pending', 'running')`;
    await client`CREATE INDEX IF NOT EXISTS idx_scores_company ON scores(company_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tenders_source_url ON tenders(source, url)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tenders_source_external ON tenders(source, external_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tenders_quality_status ON tenders(quality_status)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tenders_deadline ON tenders(deadline_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tenders_content_fingerprint ON tenders(content_fingerprint)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tenders_slug ON tenders(slug)`;
    await client`CREATE INDEX IF NOT EXISTS idx_us_tenders_source_url ON us_tenders(source, url)`;
    await client`CREATE INDEX IF NOT EXISTS idx_us_tenders_source_external ON us_tenders(source, external_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_us_tenders_deadline ON us_tenders(deadline_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_us_tenders_state ON us_tenders(state)`;
    await client`CREATE INDEX IF NOT EXISTS idx_us_tenders_quality_status ON us_tenders(quality_status)`;
    await client`CREATE INDEX IF NOT EXISTS idx_us_tenders_category ON us_tenders(category)`;
    await client`CREATE INDEX IF NOT EXISTS idx_us_source_runs_source_finished ON us_source_runs(source, finished_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_updated ON billing_subscriptions(user_id, updated_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer ON billing_subscriptions(stripe_customer_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON stripe_events(processed_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_documents_tender ON documents(tender_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_events_company ON attribution_events(company_id, event_type)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tracked_tenders_status_updated ON tracked_tenders(status, updated_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tracked_tenders_deadline ON tracked_tenders(deadline_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_company_profiles_website ON company_profiles(website_url)`;

    console.log("Database migration completed successfully!");
  } finally {
    await client`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
