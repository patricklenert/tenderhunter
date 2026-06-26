# Tender Agent -- Technical Architecture (No Redis / No Celery)

## System Philosophy

-   Minimal moving parts
-   Deterministic pipelines
-   Strong observability
-   Easy to debug
-   Self-hosted friendly

------------------------------------------------------------------------

## Core Stack

### Backend

-   Python
-   FastAPI (API + orchestration entrypoints)

### Orchestration (NO Celery / Redis)

Choose ONE:

#### Option A (recommended)

-   **Temporal** (self-hostable, durable workflows)

#### Option B (simpler V1)

-   **Postgres-based job queue**

-   -   background workers (async Python)

------------------------------------------------------------------------

## Storage

### Object Storage

-   RustFS (your choice) ✅
-   Stores:
    -   PDFs
    -   raw HTML
    -   intermediate artifacts

### Database

-   Postgres

------------------------------------------------------------------------

## High-Level Flow

    Crawler → DB Job Table → Worker → Parser → Structurer → Scoring → Insights → Delivery

------------------------------------------------------------------------

## 1. Job System (Replacing Celery)

### Approach: Postgres Job Queue

Create a table:

    jobs
    - id
    - type (crawl, parse, score, notify)
    - payload (json)
    - status (pending, running, done, failed)
    - retries
    - created_at
    - updated_at

------------------------------------------------------------------------

### Worker Behavior

Workers: - poll jobs (`SELECT ... FOR UPDATE SKIP LOCKED`) - process -
update status

------------------------------------------------------------------------

### Advantages

-   no Redis
-   fully transactional
-   easy debugging
-   persistent

------------------------------------------------------------------------

## 2. Services

### 2.1 Crawler

**Runs via:** - cron or internal scheduler

**Writes:** - tenders table - creates `fetch_documents` jobs

------------------------------------------------------------------------

### 2.2 Document Fetcher

**Tasks:** - download PDFs - store in RustFS - compute hash

------------------------------------------------------------------------

### 2.3 Parser (Firecrawl)

**Input:** - RustFS file URL

**Output:** - raw text - stored in DB

------------------------------------------------------------------------

### 2.4 Structuring Layer

**Responsibility:** - convert raw text → structured JSON

**Technique:** - LLM extraction - section classification

------------------------------------------------------------------------

### 2.5 Scoring Engine

**Runs per company**

Inputs: - structured tender - company profile

Outputs: - fit score - win probability - effort

Stored in: - `tender_scores`

------------------------------------------------------------------------

### 2.6 Insight Engine

Generates: - reasoning - missing requirements - action steps

------------------------------------------------------------------------

### 2.7 Delivery Layer

-   Email (initial)
-   API (dashboard later)

------------------------------------------------------------------------

### 2.8 Tracking Layer

Tracks: - when shown - when clicked - when marked "pursued" - outcome
(won/lost)

------------------------------------------------------------------------

## 3. Data Model (Simplified)

### tenders

-   id
-   title
-   source
-   url

### documents

-   tender_id
-   rustfs_path
-   hash

### structured_data

-   tender_id
-   json_blob

### company_profiles

-   id
-   capabilities
-   certifications

### scores

-   tender_id
-   company_id
-   fit
-   win_probability

### insights

-   tender_id
-   company_id
-   explanation
-   actions

------------------------------------------------------------------------

## 4. Pipeline Execution

### Step-by-step

    1. crawler inserts tender
    2. create job: fetch_docs
    3. worker downloads PDFs → RustFS
    4. create job: parse
    5. worker parses via Firecrawl
    6. create job: structure
    7. worker extracts fields
    8. create job: score (per company)
    9. worker computes scores
    10. create job: insight
    11. worker generates explanation
    12. notify user

------------------------------------------------------------------------

## 5. Scheduling

### Option A

-   cron (simple)

### Option B

-   Temporal (advanced workflows)

------------------------------------------------------------------------

## 6. Why This Setup Works

### No Redis

-   avoids ops overhead
-   fewer failure points

### No Celery

-   no distributed state issues
-   easier debugging

### Postgres Queue

-   reliable
-   transactional
-   simple scaling

------------------------------------------------------------------------

## 7. Scaling Strategy

### Early Stage

-   1 API server
-   1--2 workers
-   Postgres
-   RustFS

### Growth

-   multiple workers
-   split job types
-   read replicas

------------------------------------------------------------------------

## 8. Observability

-   log every job
-   store failures in DB
-   add retry counters

------------------------------------------------------------------------

## 9. Key Principle

Keep AI at the edges: - parsing - reasoning

Keep system core: - deterministic - debuggable - boring (this is good)

------------------------------------------------------------------------

## Final Thought

Your competitive edge is NOT infrastructure.

It is: - scoring quality - insight clarity - attribution accuracy

This architecture gets you there fast without unnecessary complexity.
