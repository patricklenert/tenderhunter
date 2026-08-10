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
        deadline_at TIMESTAMPTZ,
        category TEXT,
        slug TEXT,
        contract_value_min REAL,
        contract_value_max REAL,
        contract_duration_months INTEGER,
        procedure_type TEXT,
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
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS contract_value_min REAL`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS contract_value_max REAL`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS procedure_type TEXT`;

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
        roles JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tender_id, sha256)
      )
    `;

    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS download_status TEXT NOT NULL DEFAULT 'downloaded'`;
    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS parse_status TEXT NOT NULL DEFAULT 'pending'`;
    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT`;
    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS filename TEXT`;
    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS page_count INTEGER`;
    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS role TEXT`;
    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS roles JSONB`;
    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS role_source TEXT`;
    await client`ALTER TABLE documents ADD COLUMN IF NOT EXISTS role_confidence REAL`;
    await client`
      CREATE TABLE IF NOT EXISTS us_documents (
        id SERIAL PRIMARY KEY,
        us_tender_id INTEGER NOT NULL REFERENCES us_tenders(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        content_type TEXT,
        extracted_text TEXT,
        download_status TEXT NOT NULL DEFAULT 'downloaded',
        parse_status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        filename TEXT,
        page_count INTEGER,
        role TEXT,
        roles JSONB,
        role_source TEXT,
        role_confidence REAL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(us_tender_id, sha256)
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS idx_us_documents_tender ON us_documents(us_tender_id)`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS readiness_status TEXT NOT NULL DEFAULT 'pending'`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS readiness_reason TEXT`;
    await client`ALTER TABLE tenders ADD COLUMN IF NOT EXISTS readiness_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
    await client`UPDATE documents SET parse_status = 'failed', error_message = left(extracted_text, 500) WHERE extracted_text LIKE '[parse_error]%' AND parse_status = 'pending'`;
    await client`UPDATE documents SET parse_status = 'parsed' WHERE extracted_text IS NOT NULL AND extracted_text != '' AND extracted_text NOT LIKE '[parse_error]%' AND parse_status = 'pending'`;

    await client`
      CREATE TABLE IF NOT EXISTS tender_resources (
        id SERIAL PRIMARY KEY,
        tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        canonical_url TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        filename TEXT,
        resource_type TEXT NOT NULL DEFAULT 'unknown',
        role_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_page_url TEXT,
        discovery_method TEXT NOT NULL DEFAULT 'unknown',
        method TEXT NOT NULL DEFAULT 'GET',
        status TEXT NOT NULL DEFAULT 'discovered',
        content_type TEXT,
        content_disposition TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
         priority INTEGER NOT NULL DEFAULT 100,
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
    await client`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100`;

    await client`
      CREATE TABLE IF NOT EXISTS job_attempts (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        attempt_number INTEGER NOT NULL,
        worker_id TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        error_code TEXT,
        error_message TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS idx_job_attempts_job_started ON job_attempts(job_id, started_at)`;
    await client`CREATE INDEX IF NOT EXISTS idx_job_attempts_status ON job_attempts(status)`;

    await client`
      CREATE TABLE IF NOT EXISTS catalog_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        revision INTEGER NOT NULL DEFAULT 0,
        synced_revision INTEGER NOT NULL DEFAULT 0,
        sync_running BOOLEAN NOT NULL DEFAULT FALSE,
        sync_started_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`ALTER TABLE catalog_state ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ`;
    await client`INSERT INTO catalog_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
    await client`
      CREATE TABLE IF NOT EXISTS public_scrape_runs (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
        scope_source_key TEXT,
        is_full_run BOOLEAN NOT NULL DEFAULT TRUE,
        status TEXT NOT NULL DEFAULT 'running',
        total_found INTEGER NOT NULL DEFAULT 0,
        after_dedup INTEGER NOT NULL DEFAULT 0,
        accepted_count INTEGER NOT NULL DEFAULT 0,
        inserted_count INTEGER NOT NULL DEFAULT 0,
        updated_count INTEGER NOT NULL DEFAULT 0,
        skipped_expired INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`
      CREATE TABLE IF NOT EXISTS public_source_runs (
        id SERIAL PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES public_scrape_runs(id) ON DELETE CASCADE,
        source_key TEXT NOT NULL,
        status TEXT NOT NULL,
        discovered_count INTEGER NOT NULL DEFAULT 0,
        listed_count INTEGER NOT NULL DEFAULT 0,
        detail_attempted INTEGER NOT NULL DEFAULT 0,
        detail_failed INTEGER NOT NULL DEFAULT 0,
        pending_count INTEGER NOT NULL DEFAULT 0,
        continuation_scheduled BOOLEAN NOT NULL DEFAULT FALSE,
        accepted_count INTEGER NOT NULL DEFAULT 0,
        inserted_count INTEGER NOT NULL DEFAULT 0,
        updated_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        cursor_before_json JSONB,
        cursor_after_json JSONB,
        cursor_version_before INTEGER NOT NULL DEFAULT 0,
        cursor_version_after INTEGER NOT NULL DEFAULT 0,
        pages_fetched INTEGER NOT NULL DEFAULT 0,
        exhausted BOOLEAN NOT NULL DEFAULT FALSE,
        cursor_advanced BOOLEAN NOT NULL DEFAULT FALSE,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        UNIQUE(run_id, source_key)
      )
    `;
    await client`ALTER TABLE public_scrape_runs ADD COLUMN IF NOT EXISTS scope_source_key TEXT`;
    await client`ALTER TABLE public_scrape_runs ADD COLUMN IF NOT EXISTS is_full_run BOOLEAN NOT NULL DEFAULT TRUE`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS listed_count INTEGER NOT NULL DEFAULT 0`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS detail_attempted INTEGER NOT NULL DEFAULT 0`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS detail_failed INTEGER NOT NULL DEFAULT 0`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS pending_count INTEGER NOT NULL DEFAULT 0`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS continuation_scheduled BOOLEAN NOT NULL DEFAULT FALSE`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS cursor_before_json JSONB`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS cursor_after_json JSONB`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS cursor_version_before INTEGER NOT NULL DEFAULT 0`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS cursor_version_after INTEGER NOT NULL DEFAULT 0`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS pages_fetched INTEGER NOT NULL DEFAULT 0`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS exhausted BOOLEAN NOT NULL DEFAULT FALSE`;
    await client`ALTER TABLE public_source_runs ADD COLUMN IF NOT EXISTS cursor_advanced BOOLEAN NOT NULL DEFAULT FALSE`;
    await client`
      CREATE TABLE IF NOT EXISTS public_source_cursors (
        source_key TEXT PRIMARY KEY,
         cursor_json JSONB NOT NULL DEFAULT '{}'::jsonb,
         cursor_version INTEGER NOT NULL DEFAULT 0,
         exhausted BOOLEAN NOT NULL DEFAULT FALSE,
         continuation_required BOOLEAN NOT NULL DEFAULT FALSE,
        last_run_id INTEGER REFERENCES public_scrape_runs(id) ON DELETE SET NULL,
        last_status TEXT,
        last_error TEXT,
        last_advanced_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )
     `;
    await client`ALTER TABLE public_source_cursors ADD COLUMN IF NOT EXISTS cursor_version INTEGER NOT NULL DEFAULT 0`;
    await client`ALTER TABLE public_source_cursors ADD COLUMN IF NOT EXISTS continuation_required BOOLEAN NOT NULL DEFAULT FALSE`;
    // continuation_required is scraper state, not a synonym for exhausted=false.
    // Promoting every cursor here causes blocked/permanent sources to be retried
    // on every container restart and creates an endless continuation backlog.
    await client`CREATE INDEX IF NOT EXISTS idx_public_source_cursors_status ON public_source_cursors(exhausted, updated_at)`;

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

    await client`
      DO $$
      BEGIN
        CREATE TYPE bid_pack_decision_status AS ENUM ('undecided', 'go', 'no_go');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;

    await client`
      DO $$
      BEGIN
        CREATE TYPE bid_pack_requirement_status AS ENUM ('open', 'met', 'not_met', 'waived');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;

    await client`
      DO $$
      BEGIN
        CREATE TYPE bid_pack_task_status AS ENUM ('todo', 'in_progress', 'done', 'blocked');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;

    await client`
      CREATE TABLE IF NOT EXISTS bid_packs (
        id SERIAL PRIMARY KEY,
        tracked_tender_id INTEGER NOT NULL REFERENCES tracked_tenders(id) ON DELETE CASCADE,
        decision_status bid_pack_decision_status NOT NULL DEFAULT 'undecided',
        decision_note TEXT,
        snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        snapshot_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )
     `;
    await client`
      CREATE TABLE IF NOT EXISTS bid_pack_requirements (
        id SERIAL PRIMARY KEY,
        bid_pack_id INTEGER NOT NULL REFERENCES bid_packs(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        source_quote TEXT,
        is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
        status bid_pack_requirement_status NOT NULL DEFAULT 'open',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS bid_pack_tasks (
        id SERIAL PRIMARY KEY,
        bid_pack_id INTEGER NOT NULL REFERENCES bid_packs(id) ON DELETE CASCADE,
        requirement_id INTEGER REFERENCES bid_pack_requirements(id) ON DELETE SET NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        title TEXT NOT NULL,
        status bid_pack_task_status NOT NULL DEFAULT 'todo',
        assignee TEXT,
        due_at TIMESTAMPTZ,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
     await client`
       CREATE TABLE IF NOT EXISTS company_evidence (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
        evidence_type TEXT NOT NULL DEFAULT 'other',
        title TEXT NOT NULL,
        description TEXT,
        issuer TEXT,
        issued_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        source_url TEXT,
        tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )
     `;
     await client`
       CREATE TABLE IF NOT EXISTS company_evidence_files (
         id SERIAL PRIMARY KEY,
         evidence_id INTEGER NOT NULL REFERENCES company_evidence(id) ON DELETE CASCADE,
         storage_path TEXT NOT NULL,
         original_filename TEXT NOT NULL,
         content_type TEXT NOT NULL,
         size_bytes INTEGER NOT NULL,
         sha256 TEXT NOT NULL,
         upload_status TEXT NOT NULL DEFAULT 'available',
         scan_status TEXT NOT NULL DEFAULT 'clean',
         uploaded_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
         uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         available_at TIMESTAMPTZ,
         deleted_at TIMESTAMPTZ,
         failure_reason TEXT,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )
     `;
     await client`
       CREATE TABLE IF NOT EXISTS company_evidence_events (
         id SERIAL PRIMARY KEY,
         evidence_id INTEGER NOT NULL REFERENCES company_evidence(id) ON DELETE CASCADE,
         file_id INTEGER REFERENCES company_evidence_files(id) ON DELETE SET NULL,
         actor_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
         event_type TEXT NOT NULL,
         metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )
     `;
    await client`
      CREATE TABLE IF NOT EXISTS requirement_evidence_matches (
        id SERIAL PRIMARY KEY,
        requirement_id INTEGER NOT NULL REFERENCES bid_pack_requirements(id) ON DELETE CASCADE,
        evidence_id INTEGER NOT NULL REFERENCES company_evidence(id) ON DELETE CASCADE,
        match_status TEXT NOT NULL DEFAULT 'suggested',
        rationale TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS source_url TEXT`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS tags_json JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS verified_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS verification_note TEXT`;
    await client`ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;
    await client`ALTER TABLE bid_packs ADD COLUMN IF NOT EXISTS decision_note TEXT`;
    await client`ALTER TABLE bid_packs ADD COLUMN IF NOT EXISTS snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await client`ALTER TABLE bid_packs ADD COLUMN IF NOT EXISTS snapshot_version INTEGER NOT NULL DEFAULT 1`;
    await client`ALTER TABLE bid_pack_requirements ADD COLUMN IF NOT EXISTS source_quote TEXT`;
    await client`ALTER TABLE requirement_evidence_matches ADD COLUMN IF NOT EXISTS evidence_file_id INTEGER REFERENCES company_evidence_files(id) ON DELETE SET NULL`;
    await client`ALTER TABLE requirement_evidence_matches ADD COLUMN IF NOT EXISTS linked_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL`;
    await client`ALTER TABLE requirement_evidence_matches ADD COLUMN IF NOT EXISTS evidence_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb`;

    await client`
      CREATE TABLE IF NOT EXISTS company_url_cache (
        id SERIAL PRIMARY KEY,
        canonical_url TEXT NOT NULL UNIQUE,
        url_hash TEXT NOT NULL UNIQUE,
        final_url TEXT,
        profile_json JSONB,
        profile_fingerprint TEXT,
        extractor_version TEXT NOT NULL DEFAULT 'v1',
        status TEXT NOT NULL DEFAULT 'pending',
        fetched_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        failure_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`
      CREATE TABLE IF NOT EXISTS company_url_match_cache (
        id SERIAL PRIMARY KEY,
        cache_id INTEGER NOT NULL REFERENCES company_url_cache(id) ON DELETE CASCADE,
        rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
        tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
        title_snapshot TEXT NOT NULL,
        source_snapshot TEXT NOT NULL,
        url_snapshot TEXT,
        deadline_at_snapshot TIMESTAMPTZ,
        fit REAL NOT NULL,
        win_probability REAL NOT NULL,
        reason TEXT NOT NULL,
        details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        scoring_version TEXT NOT NULL DEFAULT 'v1',
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        UNIQUE(cache_id, rank)
      )
    `;
    await client`
      CREATE TABLE IF NOT EXISTS company_match_previews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        cache_id INTEGER REFERENCES company_url_cache(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
        idempotency_key TEXT,
        error_code TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`
      CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
        bucket_key TEXT PRIMARY KEY,
        window_started_at TIMESTAMPTZ NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;

    console.log("Creating indexes...");

     await client`CREATE INDEX IF NOT EXISTS idx_jobs_status_priority_run_after ON jobs(status, priority, run_after)`;
     await client`CREATE INDEX IF NOT EXISTS idx_jobs_type_status_created ON jobs(type, status, created_at)`;
     await client`CREATE INDEX IF NOT EXISTS idx_jobs_running_heartbeat ON jobs(status, heartbeat_at)`;
     await client`CREATE INDEX IF NOT EXISTS idx_catalog_state_revision ON catalog_state(revision, synced_revision)`;
     await client`CREATE INDEX IF NOT EXISTS idx_public_scrape_runs_status_finished ON public_scrape_runs(status, finished_at)`;
     await client`CREATE INDEX IF NOT EXISTS idx_public_scrape_runs_job ON public_scrape_runs(job_id)`;
     await client`CREATE INDEX IF NOT EXISTS idx_public_source_runs_source_finished ON public_source_runs(source_key, finished_at)`;
    await client`CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_active_job_key ON jobs(job_key) WHERE job_key IS NOT NULL AND status IN ('pending', 'running')`;
    await client`CREATE INDEX IF NOT EXISTS idx_scores_company ON scores(company_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tenders_source_url ON tenders(source, url)`;
     await client`CREATE INDEX IF NOT EXISTS idx_tenders_source_external ON tenders(source, external_id)`;
     await client`CREATE INDEX IF NOT EXISTS idx_tenders_source_key_external ON tenders(source_key, external_id)`;
     await client`DROP INDEX IF EXISTS idx_tenders_source_external_unique`;
     await client`CREATE INDEX IF NOT EXISTS idx_tenders_quality_status ON tenders(quality_status)`;
     await client`CREATE INDEX IF NOT EXISTS idx_tenders_readiness_status ON tenders(readiness_status)`;
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
     await client`CREATE UNIQUE INDEX IF NOT EXISTS idx_tender_resources_tender_canonical ON tender_resources(tender_id, canonical_url)`;
     await client`CREATE INDEX IF NOT EXISTS idx_tender_resources_tender_status ON tender_resources(tender_id, status)`;
     await client`CREATE INDEX IF NOT EXISTS idx_tender_resources_tender_type ON tender_resources(tender_id, resource_type)`;
     await client`CREATE INDEX IF NOT EXISTS idx_tender_resources_status_attempt ON tender_resources(status, last_attempt_at)`;
     await client`CREATE INDEX IF NOT EXISTS idx_events_company ON attribution_events(company_id, event_type)`;
    await client`CREATE INDEX IF NOT EXISTS idx_tracked_tenders_status_updated ON tracked_tenders(status, updated_at)`;
     await client`CREATE INDEX IF NOT EXISTS idx_tracked_tenders_deadline ON tracked_tenders(deadline_at)`;
     await client`CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_packs_tracked_tender ON bid_packs(tracked_tender_id)`;
     await client`CREATE INDEX IF NOT EXISTS idx_bid_packs_decision_updated ON bid_packs(decision_status, updated_at)`;
     await client`CREATE INDEX IF NOT EXISTS idx_bid_pack_requirements_pack_status ON bid_pack_requirements(bid_pack_id, status)`;
     await client`CREATE INDEX IF NOT EXISTS idx_bid_pack_tasks_pack_status ON bid_pack_tasks(bid_pack_id, status)`;
     await client`CREATE INDEX IF NOT EXISTS idx_bid_pack_tasks_due_at ON bid_pack_tasks(due_at)`;
     await client`CREATE INDEX IF NOT EXISTS idx_company_evidence_company_status ON company_evidence(company_id, status)`;
      await client`CREATE INDEX IF NOT EXISTS idx_company_evidence_expires_at ON company_evidence(expires_at)`;
      await client`CREATE INDEX IF NOT EXISTS idx_company_evidence_files_evidence_status ON company_evidence_files(evidence_id, upload_status)`;
      await client`CREATE INDEX IF NOT EXISTS idx_company_evidence_files_scan_created ON company_evidence_files(scan_status, created_at)`;
      await client`CREATE INDEX IF NOT EXISTS idx_company_evidence_events_evidence_created ON company_evidence_events(evidence_id, created_at)`;
     await client`CREATE UNIQUE INDEX IF NOT EXISTS idx_requirement_evidence_unique ON requirement_evidence_matches(requirement_id, evidence_id)`;
     await client`CREATE INDEX IF NOT EXISTS idx_requirement_evidence_requirement ON requirement_evidence_matches(requirement_id)`;
      await client`CREATE INDEX IF NOT EXISTS idx_requirement_evidence_evidence ON requirement_evidence_matches(evidence_id)`;
      await client`CREATE INDEX IF NOT EXISTS idx_company_url_cache_status_expires ON company_url_cache(status, expires_at)`;
      await client`CREATE INDEX IF NOT EXISTS idx_company_url_match_cache_cache ON company_url_match_cache(cache_id)`;
      await client`CREATE INDEX IF NOT EXISTS idx_company_match_previews_user_created ON company_match_previews(user_id, created_at)`;
      await client`CREATE INDEX IF NOT EXISTS idx_company_match_previews_status ON company_match_previews(status)`;
      await client`CREATE INDEX IF NOT EXISTS idx_api_rate_limit_buckets_expires ON api_rate_limit_buckets(expires_at)`;
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
