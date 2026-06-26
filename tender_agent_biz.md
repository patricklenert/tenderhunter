# Tender Agent -- System Architecture

## Overview

A pipeline-driven decision engine for identifying, analyzing, scoring,
and delivering high-quality public tenders with clear attribution.

    Sources → Crawl → Parse → Structure → Score → Explain → Deliver → Track Outcome

------------------------------------------------------------------------

## 1. Source & Discovery Layer

**Goal:** Continuously discover new tenders early.

**Inputs:** - bund.de / TED (EU) - State procurement portals -
Specialized platforms

**Outputs:** - Tender URLs + metadata

**Key Requirements:** - Continuous crawling (1--6h intervals) -
Deduplication - Version tracking

------------------------------------------------------------------------

## 2. Document Acquisition Layer

**Goal:** Collect all tender documents reliably.

**Tasks:** - Download PDFs and attachments - Version control - Hashing
for change detection

**Storage:** - Object storage (S3-like)

------------------------------------------------------------------------

## 3. Parsing & Structuring Layer

**Goal:** Convert unstructured PDFs into structured data.

**Pipeline:**

    PDF → Text → Sections → Semantic Blocks → Structured Fields

**Extract:**

### Hard Facts

-   Deadline
-   Budget
-   Location
-   Buyer
-   Contract type

### Decision-Relevant

-   Requirements (Eignungskriterien)
-   Scope (Leistungsbeschreibung)
-   Award criteria (Zuschlagskriterien)
-   Mandatory documents

**Key Capability:** Semantic section detection: - Scope - Requirements -
Evaluation logic

------------------------------------------------------------------------

## 4. Company Profile Layer

**Goal:** Represent the customer in structured form.

**Input:** - Services - References - Certifications - Team size - Region

**Output:** - Capability profile

------------------------------------------------------------------------

## 5. Scoring Engine (Core Product)

### 5.1 Fit Score

-   Domain match
-   Size compatibility
-   Region match
-   Requirement coverage

### 5.2 Win Probability

-   Requirement fulfillment ratio
-   Gap to ideal profile
-   Complexity
-   Competitive assumptions (later)

### 5.3 Effort Score

-   Document complexity
-   Required proofs
-   Preparation effort

### 5.4 Kill Switch

Reject tenders if: - Mandatory requirements not met

------------------------------------------------------------------------

## 6. Explanation Engine (USP)

**Outputs:**

### Why it fits

-   Matching capabilities

### Why not

-   Missing requirements

### How to win

-   Strategic suggestions

### What is missing

-   Certifications, references, etc.

------------------------------------------------------------------------

## 7. Action Layer

**Goal:** Provide next steps.

Examples: - Suggest partners - Highlight references - Strategic bid
positioning

------------------------------------------------------------------------

## 8. Delivery Layer

**Channels:** - Web dashboard - Email alerts - CRM integrations

**Principle:** Only show top opportunities.

------------------------------------------------------------------------

## 9. Attribution Layer

**Purpose:** Enable performance-based pricing.

**Tracking:** - Tender ID - Recommendation timestamp - Score snapshot

**Optional:** - Customer marks: - pursuing - won / lost

------------------------------------------------------------------------

## 10. Storage Architecture

### Raw Data

-   PDFs
-   HTML

### Structured Data

-   Tender fields
-   Scores

### Derived Data

-   Embeddings
-   Match results

------------------------------------------------------------------------

## 11. Pipeline Orchestration

    1. Crawl
    2. Detect new tender
    3. Fetch documents
    4. Parse
    5. Structure
    6. Score (per customer)
    7. Generate insights
    8. Deliver

**Requirements:** - Event-driven - Idempotent

------------------------------------------------------------------------

## 12. Agentic AI Usage

**Use AI for:** - Document understanding - Requirement extraction -
Recommendation reasoning

**Do NOT use AI for:** - Crawling - Scheduling - Infrastructure logic

------------------------------------------------------------------------

## Product Definition

Not a scraper:

> Decision engine for winning tenders

------------------------------------------------------------------------

## Competitive Moat

-   Historical data
-   Feedback loops (won/lost)
-   Improved scoring over time

------------------------------------------------------------------------

## Business Model

### Phase 1

-   Subscription (€99--€499)
-   Tender feed + scoring

### Phase 2

-   €1k--€3k
-   Matching + integrations

### Phase 3

-   Performance fee (10%)
-   Based on attributed wins

------------------------------------------------------------------------

## Core Insight

Real value comes from: - Fit scoring - Win probability - Actionable
recommendations - Time savings
