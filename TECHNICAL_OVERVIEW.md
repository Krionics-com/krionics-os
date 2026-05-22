# Krionics OS - Technical Overview & What's Been Built

> A comprehensive guide to understanding the Krionics OS codebase, architecture, and what has been implemented so far.

---

## Table of Contents
1. [What We're Building](#what-were-building)
2. [System Architecture](#system-architecture)
3. [What's Been Built (Phase 1 & 2)](#whats-been-built)
4. [Codebase Structure & File Mapping](#codebase-structure--file-mapping)
5. [Key Technologies & Libraries](#key-technologies--libraries)
6. [Data Flow & Processing Pipeline](#data-flow--processing-pipeline)
7. [Security & Multi-Tenancy](#security--multi-tenancy)

---

## What We're Building

**Krionics OS** is an AI-powered email reply automation platform for B2B sales teams. It solves this problem:

**Problem:** Sales development reps (SDRs) spend hours manually replying to cold email responses, classifying if they're positive, objections, out-of-office, etc.

**Solution:** Automate the entire workflow:
1. **Ingest** — Instantly.ai webhook delivers inbound emails (replies to cold campaigns)
2. **Classify** — Claude AI analyzes intent, confidence, sentiment, urgency
3. **Draft** — Claude generates contextual reply (or skip if Calendly link isn't configured)
4. **Review** — Human operator reviews before sending (or auto-send based on automation level)
5. **Send** — Instantly.ai sends approved reply back to the lead
6. **Track** — Monitor open rates, click rates, meetings booked

**Key Feature: Multi-Tenant & Flexible Automation**
- Clients can set automation levels (1=all human review, 2=hybrid, 3=full AI SDR)
- Each client has their own leads, campaigns, enrichment data, and reply policies
- Row-Level Security (RLS) ensures tenant isolation at the database level

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      KRIONICS OS PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘

Instantly.ai Webhook
       ↓ (HTTP POST)
┌──────────────────────┐
│  Webhook Handler     │  apps/webhook-handler/
│  (Express.js)        │  - Validates HMAC signature
│                      │  - Enqueues ingest job
└──────┬───────────────┘
       ↓ (Redis Queue)
┌──────────────────────┐
│  BullMQ Workers      │  packages/workers/src/workers/
│  (Node.js)           │
│                      │
│  1. Ingest Worker    │  ─→ Parse email, store raw_replies
│     ↓                │
│  2. Classify Worker  │  ─→ Call Claude API, save intent/confidence
│     ↓                │
│  3. Draft Worker     │  ─→ Generate reply draft
│     ↓                │
│  4. Review Worker    │  ─→ Route to operator queue or auto-send
│     ↓                │
│  5. Send Worker      │  ─→ Call Instantly API, mark sent
└──────┬───────────────┘
       ↓ (PostgreSQL)
┌──────────────────────┐
│  Supabase Database   │  supabase/migrations/
│  (PostgreSQL + RLS)  │  - 14 tables + partitioned audit
│                      │  - RICR state machine
└──────┬───────────────┘
       ↓ (HTTP API)
┌──────────────────────┐
│  Operator Dashboard  │  apps/dashboard/
│  (Next.js 14)        │  - Review queue UI
│                      │  - Approve/reject drafts
│                      │  - Admin operator management
└──────────────────────┘
```

### Database Schema (Simplified)

**Foundation Tables**
- `clients` — Tenant/workspace root
- `operators` — Human users with roles (admin/reviewer) and multi-client access
- `config` — System-wide settings

**Lead & Campaign Management**
- `campaigns` — Instantly.ai campaigns, config
- `leads` — All prospects with enrichment, lead status state machine
- `email_events` — Sent, opened, clicked, bounced, replied

**RICR Subsystem** (Reply Ingestion Classification Review)
- `raw_replies` — Immutable webhook payload store
- `reply_items` — Central state machine (RECEIVED → SENT)
- `reply_classifications` — Claude output: intent, confidence, sentiment
- `reply_drafts` — AI-generated reply with operator edit history
- `review_items` — Operator inbox for human review
- `scheduled_sends` — Queue for Instantly API calls

**AI & Observability**
- `ai_prompts` — Versioned Handlebars templates for Claude
- `ai_invocations` — Per-call metrics (cost, cache hit, validation)
- `audit_log` — Append-only log of all state changes
- `idempotency_keys` — Prevents duplicate ingest on webhook retries

---

## What's Been Built

### Phase 1: Core Dashboard & Auth (Completed ✓)

#### Files & Components

**Authentication Layer**
```
apps/dashboard/lib/auth.ts
├── signToken(payload)           // JWT signing via jose
├── verifyToken(token)           // JWT verification
├── getTokenFromRequest(req)      // Extract kos_session cookie
└── getCookieName()              // Returns 'kos_session'

apps/dashboard/app/api/auth/login/route.ts
├── POST /api/auth/login
│   ├── Query operators table by email
│   ├── bcrypt.compare(password, password_hash)
│   ├── Generate JWT (8h expiry)
│   ├── Set httpOnly, sameSite=strict cookie
│   └── Return operator object

apps/dashboard/app/api/auth/logout/route.ts
└── POST /api/auth/logout
    └── Clear kos_session cookie
```

**Middleware & Route Protection**
```
apps/dashboard/middleware.ts
├── Protects /dashboard/* routes
├── Reads kos_session cookie
├── Verifies JWT (redirects to /login on invalid)
└── Sets x-operator-id header for downstream routes
```

**Pages & UI**
```
apps/dashboard/app/login/page.tsx
├── Email + password form
├── Calls POST /api/auth/login
└── Redirects to /dashboard on success

apps/dashboard/app/dashboard/page.tsx
├── Stats cards (4):
│   ├─ Pending Review count
│   ├─ Approved Today count
│   ├─ Suppressed Today count
│   └─ Sent Today count
└── Server-side SQL queries for real-time stats

apps/dashboard/app/dashboard/review/page.tsx
├── SWR-fetched queue list (5s polling)
├── ReplyQueueTable component
│   ├─ Lead email (clickable link)
│   ├─ Company name
│   ├─ Intent badge (color-coded)
│   ├─ Confidence % display
│   ├─ Reply preview (60 chars)
│   ├─ SLA countdown (4h deadline)
│   └─ Created timestamp
└── Click row → detail page

apps/dashboard/app/dashboard/review/[replyItemId]/page.tsx
├── Two-column layout:
│   ├─ LEFT: Raw reply, lead info, classification details
│   └─ RIGHT: Draft subject/body textareas, approve/reject buttons
├── Approve button calls POST /api/reply-items/{id}/approve
├── Reject button calls POST /api/reply-items/{id}/reject
└── Shows success/error messages

apps/dashboard/components/
├── intent-badge.tsx         // Color-coded intent display
├── sla-countdown.tsx        // Live countdown timer (60s refresh)
├── sidebar.tsx              // Navigation links + pending count
├── navbar.tsx               // Top bar with operator name + logout
└── reply-queue-table.tsx    // Reusable table component
```

**API Routes**
```
apps/dashboard/app/api/reply-items/route.ts
├── GET /api/reply-items?status=PENDING_REVIEW&skip=0&limit=20
├── Multi-tenant filtering via operator.client_access
├── Constructs SQL WHERE clause dynamically
├── Joins: reply_items → classifications → drafts → leads → clients → raw_replies
└── Returns: {data: [], total: number}

apps/dashboard/app/api/reply-items/[replyItemId]/route.ts
├── GET /api/reply-items/{id}
├── Returns full detail: reply_item, classification, draft, raw_reply, lead, client
└── Multi-tenant access control

apps/dashboard/app/api/reply-items/[replyItemId]/approve/route.ts
├── POST /api/reply-items/{id}/approve
├── Validates token + client_access
├── Transactional update:
│   ├─ UPDATE reply_drafts SET status='approved', ...
│   ├─ UPDATE reply_items SET status='APPROVED'
│   └─ INSERT audit_log entry
└── Returns {ok: true}

apps/dashboard/app/api/reply-items/[replyItemId]/reject/route.ts
├── POST /api/reply-items/{id}/reject
├── Transactional update with rejection_reason
├── Same audit logging as approve
└── Returns {ok: true}
```

**Database Setup**
```
apps/dashboard/lib/db.ts
├── postgres npm client (v3.4.9)
├── Connects to DATABASE_URL (Supabase session pooler)
└── sql template literal wrapper

apps/dashboard/lib/types.ts
└── TypeScript interfaces for all data structures

supabase/migrations/20260522000001_add_operator_password.sql
├── ALTER TABLE operators ADD COLUMN password_hash TEXT
└── SEED: admin@krionics.com with bcrypt hash of "admin123"
```

**What Phase 1 Enables**
- Operators can log in with email + password
- View pending replies in a queue
- Click any reply to see details and classification
- Approve reply (optionally edit draft)
- Reject reply with reason
- All actions are audited in audit_log
- Multi-tenant isolation via operator.client_access

---

### Phase 2: Settings, Admin, Real-Time, & Mobile (Completed ✓)

#### Files & Components Added

**Settings Page**
```
apps/dashboard/app/dashboard/settings/page.tsx
├── Displays operator profile (name, email, role)
├── Fetches /api/auth/me
├── "Change Password" form:
│   ├─ Current password input
│   ├─ New password (min 8 chars)
│   ├─ Confirm new password
│   └─ Success/error messages (inline, no reload)
└── Uses SWR with retry logic

apps/dashboard/app/api/auth/me/route.ts
├── GET /api/auth/me
├── Verifies JWT token
└── Returns: {operator: {id, email, name, role, client_access}}

apps/dashboard/app/api/auth/change-password/route.ts
├── POST /api/auth/change-password
├── Validates: current_password (min 1), new_password (min 8)
├── bcrypt.compare(current, stored_hash)
├── bcrypt.hash(new_password, 10)
├── UPDATE operators SET password_hash=...
└── Returns {ok: true}
```

**Admin Page**
```
apps/dashboard/app/dashboard/admin/page.tsx
├── Admin-only route (redirects non-admins to /dashboard)
├── Operator management table:
│   ├─ Email, name, role, is_active, created_at columns
│   ├─ Inline role SELECT (admin/reviewer)
│   ├─ Toggle is_active button (one-click enable/disable)
│   ├─ Soft-delete button (sets is_active=false)
│   └─ Create Operator button opens modal
├── Create modal form:
│   ├─ Email, name, password, role fields
│   ├─ POST /api/admin/operators
│   └─ Show success message + clear form
└── Fetches from /api/admin/operators with admin auth

apps/dashboard/app/api/admin/operators/route.ts
├── GET /api/admin/operators
│   ├─ Admin-only (requireAdmin() helper)
│   └─ Returns all operators sorted by created_at DESC
├── POST /api/admin/operators
│   ├─ Admin-only
│   ├─ Validate schema: email, name, role, password (min 8)
│   ├─ bcrypt.hash(password, 10)
│   ├─ INSERT into operators
│   └─ Returns created operator
└── requireAdmin() helper
    ├─ Verifies JWT token
    ├─ Checks operator.role === 'admin'
    └── Returns {error: ...} if not

apps/dashboard/app/api/admin/operators/[id]/route.ts
├── PATCH /api/admin/operators/{id}
│   ├─ Admin-only
│   ├─ Update: role, is_active, password (optional)
│   └─ Returns updated operator
└── DELETE /api/admin/operators/{id} (soft-delete)
    ├─ Admin-only
    └─ SET is_active=FALSE
```

**Real-Time Queue Enhancements**
```
apps/dashboard/app/dashboard/review/page.tsx (upgraded)
├── SWR options changed:
│   ├─ refreshInterval: 3000 (down from 5000ms)
│   ├─ revalidateOnFocus: true (refresh when tab regains focus)
│   ├─ keepPreviousData: true (don't blank during refetch)
│   └─ onErrorRetry: exponential backoff (3 retries)
├── Header shows: "Review Queue (N pending)"
├── LoadingSpinner while loading
└── ErrorState with retry button on error

apps/dashboard/app/dashboard/review/[replyItemId]/page.tsx (upgraded)
├── On approve/reject success:
│   ├─ Call router.refresh() to bust Next.js cache
│   └─ Then redirect to /dashboard/review
└── Uses new MarkdownEditor component for draft body
```

**Markdown Draft Editor**
```
apps/dashboard/components/markdown-editor.tsx
├── Props:
│   ├─ value: string (markdown content)
│   ├─ onChange: (value) => void
│   └─ mode: 'edit' | 'preview' | 'split'
├── Modes:
│   ├─ 'edit': plain textarea
│   ├─ 'preview': ReactMarkdown renderer
│   └─ 'split': textarea on left, preview on right (side-by-side)
└── Dependency: react-markdown

apps/dashboard/app/dashboard/review/[replyItemId]/page.tsx (uses it)
├── useState for activeTab: 'edit' | 'preview' | 'split'
├── MarkdownEditor with mode={activeTab}
├── Tab buttons to switch between modes
└── Store as plain markdown in edited_body_text
```

**Mobile Responsiveness**
```
apps/dashboard/components/dashboard-shell.tsx (NEW)
├── Client component managing sidebar open state
├── Props: children
├── Layout:
│   ├─ Fixed sidebar (hidden on mobile via CSS)
│   ├─ Mobile overlay when sidebar is open
│   └─ Main content area
└── Pass setSidebarOpen to Navbar

apps/dashboard/components/sidebar.tsx (upgraded)
├── Props: isOpen, onClose
├── Hidden on mobile (<md: breakpoint)
├── Hamburger state controlled by DashboardShell

apps/dashboard/components/navbar.tsx (upgraded)
├── Props: onMenuClick
├── Hamburger button (three lines) visible only on mobile
├── onClick triggers setSidebarOpen(true)
└── Mobile overlay to close sidebar on click

apps/dashboard/components/reply-queue-table.tsx (upgraded)
├── Wrapped in: <div className="overflow-x-auto">
└── Allows horizontal scroll on mobile

apps/dashboard/app/page.tsx
├── Uses DashboardShell wrapper
└── All dashboard pages inherit mobile layout

All buttons/inputs:
├── min-h-[44px] touch target minimum
└── Forms: grid gap-4 md:grid-cols-2
```

**Error Boundaries & Loading States**
```
apps/dashboard/components/loading-spinner.tsx
├── CSS-based spinner (no external dependency)
├── Props: label?: string
└── Centered, animated

apps/dashboard/components/error-state.tsx
├── Props:
│   ├─ message: string (error text)
│   └─ onRetry?: () => void (optional retry button)
├── Red background, centered
└── Shows message + optional retry button

All SWR configurations:
├── onErrorRetry: exponential backoff
│   ├─ 1st retry: wait 1s
│   ├─ 2nd retry: wait 2s
│   ├─ 3rd retry: wait 4s
│   └─ Max 3 retries
└── isRetryableStatus: checks for 5xx errors only

Usage in pages:
├── if (isLoading && !data) → <LoadingSpinner />
└── if (error && !data) → <ErrorState message="..." onRetry={mutate} />
```

**HTTP Utility Library**
```
apps/dashboard/lib/http.ts
├── fetchJson<T>(url, options?)
│   ├─ Fetch wrapper with JSON parsing
│   ├─ Passes credentials: 'include' for cookies
│   └─ Type-safe via generics
├── fetchJsonWithRetry<T>(url, options?, maxRetries=3)
│   ├─ fetchJson with exponential backoff
│   ├─ Retries on 5xx errors only
│   └─ Throws on 4xx or max retries exceeded
├── isRetryableStatus(status?: number)
│   └─ Returns true if status >= 500
└── getErrorMessage(error, fallback)
    └─ Extract error message from response or fallback
```

**E2E Test Script**
```
scripts/e2e-dashboard.ts
├── Pure TypeScript (no test framework)
├── Uses fetch() API only
├── Reads env: BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
├── 7-step checklist:
│   1. POST /api/auth/login → captures kos_session cookie
│   2. GET /api/reply-items?status=PENDING_REVIEW → list queue
│   3. GET /api/reply-items/{id} → detail with classification
│   4. POST /api/reply-items/{id}/approve → approve with edit
│   5. GET /api/reply-items?status=APPROVED → verify count >= 1
│   6. GET /api/auth/me → verify logged-in operator
│   7. POST /api/auth/change-password (wrong current) → expect 400
├── Zod validation on all responses
├── Output: ✓ checkmarks for each step
└── Exit code: 0 if all pass, 1 if any fail
    Run: npx tsx scripts/e2e-dashboard.ts
```

**Wiki Documentation**
```
wiki/projects/2026-05-22-operator-dashboard-phase2.md
├── Summary of all 8 features
├── Implementation notes
├── Known limitations
└── Success criteria checklist

wiki/index.md
└── Updated with link to phase2 project

wiki/log.md
└── Appended: [2026-05-22] build | Operator Dashboard Phase 2
```

**What Phase 2 Enables**
- Operators can change their own passwords
- Admins can manage operators (create, toggle active, edit role, delete)
- Real-time queue updates (3s polling + focus refresh)
- Draft editing with markdown preview
- Mobile-friendly UI (hamburger sidebar, scrollable table, 44px targets)
- Graceful error handling with retry logic
- E2E testing capability

---

## Codebase Structure & File Mapping

### Directory Tree

```
krionics-os/
├── AGENTS.md                          # Universal AI operating manual
├── TECHNICAL_OVERVIEW.md              # THIS FILE
├── .env.example                       # Template env vars
├── package.json                       # Root workspace config
├── tsconfig.json                      # TypeScript config
│
├── apps/
│   ├── dashboard/                     # Next.js 14 operator UI
│   │   ├── package.json               # Dependencies (react-markdown, swr, jose, bcryptjs)
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── AGENTS.md                  # Points to root AGENTS.md
│   │   ├── CLAUDE.md
│   │   ├── .env.example
│   │   │
│   │   ├── app/
│   │   │   ├── layout.tsx             # Root layout
│   │   │   ├── page.tsx               # Home redirect → /dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx           # Login form
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx         # Dashboard wrapper (uses DashboardShell)
│   │   │       ├── page.tsx           # Stats overview
│   │   │       ├── settings/
│   │   │       │   └── page.tsx       # Operator profile + change password
│   │   │       ├── admin/
│   │   │       │   └── page.tsx       # Admin operator management
│   │   │       └── review/
│   │   │           ├── page.tsx       # Queue list
│   │   │           └── [replyItemId]/
│   │   │               └── page.tsx   # Detail + approve/reject
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts       # POST login
│   │   │   │   ├── logout/
│   │   │   │   │   └── route.ts       # POST logout
│   │   │   │   ├── me/
│   │   │   │   │   └── route.ts       # GET current operator
│   │   │   │   └── change-password/
│   │   │   │       └── route.ts       # POST password change
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   └── operators/
│   │   │   │       ├── route.ts       # GET/POST operators (admin-only)
│   │   │   │       └── [id]/
│   │   │   │           └── route.ts   # PATCH/DELETE operator (admin-only)
│   │   │   │
│   │   │   └── reply-items/
│   │   │       ├── route.ts           # GET list (multi-tenant filtered)
│   │   │       └── [replyItemId]/
│   │   │           ├── route.ts       # GET detail
│   │   │           ├── approve/
│   │   │           │   └── route.ts   # POST approve
│   │   │           └── reject/
│   │   │               └── route.ts   # POST reject
│   │   │
│   │   ├── components/
│   │   │   ├── dashboard-shell.tsx    # Layout wrapper (manages sidebar state)
│   │   │   ├── navbar.tsx             # Top bar (hamburger button on mobile)
│   │   │   ├── sidebar.tsx            # Navigation (hidden on mobile)
│   │   │   ├── intent-badge.tsx       # Color-coded intent display
│   │   │   ├── sla-countdown.tsx      # Live countdown timer
│   │   │   ├── reply-queue-table.tsx  # Reusable queue table
│   │   │   ├── markdown-editor.tsx    # Edit/preview markdown tabs
│   │   │   ├── loading-spinner.tsx    # CSS-based spinner
│   │   │   └── error-state.tsx        # Error display + retry
│   │   │
│   │   └── lib/
│   │       ├── auth.ts                # JWT: signToken, verifyToken, getCookieName
│   │       ├── db.ts                  # Postgres client (DATABASE_URL)
│   │       ├── types.ts               # TypeScript interfaces
│   │       └── http.ts                # Fetch wrappers (fetchJson, retry logic)
│   │
│   └── webhook-handler/               # Express.js webhook receiver
│       ├── src/
│       │   ├── server.ts              # POST /webhooks/instantly (HMAC validation)
│       │   ├── validation.ts          # HMAC-SHA256 signature check
│       │   └── queue.ts               # BullMQ ingestQueue instantiation
│       └── scripts/
│           └── webhook-test.ts        # Local webhook test
│
├── packages/
│   ├── db/                            # Database migration runner
│   │   ├── src/
│   │   │   └── migrate.ts             # Reads supabase/migrations/, runs pending
│   │   └── package.json               # postgres@3.4.9, tsx, dotenv
│   │
│   ├── workers/                       # BullMQ worker processes
│   │   ├── src/
│   │   │   ├── queues.ts              # Queue definitions
│   │   │   ├── workers/
│   │   │   │   ├── ingest.ts          # Process raw reply, enqueue classify
│   │   │   │   ├── classify.ts        # Call Claude, route based on intent
│   │   │   │   ├── draft.ts           # Generate draft reply
│   │   │   │   ├── review-dispatch.ts # Route to operator or auto-send
│   │   │   │   └── send.ts            # Call Instantly API, mark sent
│   │   │   ├── helpers/
│   │   │   │   └── routing.ts         # Route logic by intent + automation_level
│   │   │   └── index.ts               # Entry point (start all workers)
│   │   ├── tests/
│   │   │   ├── routing.test.ts        # Unit tests
│   │   │   └── ...
│   │   └── package.json               # bullmq, @redis/client, openai, zod
│   │
│   ├── schema/                        # Shared Zod schemas
│   │   ├── src/
│   │   │   ├── index.ts               # Export all schemas
│   │   │   ├── reply.ts               # ReplyIntentSchema, ClassificationOutputSchema
│   │   │   ├── draft.ts               # DraftOutputSchema
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── ai/                            # AI provider abstraction
│       ├── src/
│       │   ├── index.ts               # Factory pattern for providers
│       │   ├── openai.ts              # OpenAI implementation
│       │   └── provider.ts            # Abstract Provider interface
│       └── package.json
│
├── supabase/
│   ├── migrations/                    # 17 SQL migration files
│   │   ├── 20260521000001_create_enums.sql
│   │   ├── 20260521000002_create_clients_operators.sql
│   │   ├── 20260521000003_create_campaigns.sql
│   │   ├── ... (14 more files)
│   │   ├── 20260521000016_rls_policies.sql    # Row-level security
│   │   ├── 20260521000017_triggers.sql        # Audit triggers
│   │   └── 20260522000001_add_operator_password.sql
│   └── config.toml                    # Supabase CLI config
│
├── scripts/
│   ├── e2e-dashboard.ts               # E2E test (login → approve → reject)
│   └── integration/
│       ├── test-ingest.ts             # Smoke test
│       └── insert-fake-class-draft.ts # Test data generation
│
├── wiki/
│   ├── index.md                       # Catalog of all wiki pages
│   ├── log.md                         # Append-only timeline
│   ├── README.md                      # Folder conventions
│   ├── AGENTS.md                      # AI operating manual (main)
│   │
│   ├── concepts/
│   │   └── llm-wiki.md               # LLM Wiki pattern explanation
│   │
│   ├── architecture/
│   │   ├── database-schema.md        # Full DB table listing + design decisions
│   │   └── standards.md              # Doc standard
│   │
│   ├── projects/
│   │   ├── 2026-05-21-monorepo-scaffold.md
│   │   ├── 2026-05-21-supabase-schema-migration.md
│   │   ├── 2026-05-22-supabase-pooler-migration-fix.md
│   │   ├── 2026-05-22-ricr-queue-workers.md
│   │   ├── 2026-05-22-operator-dashboard-phase1.md
│   │   └── 2026-05-22-operator-dashboard-phase2.md
│   │
│   ├── sources/                      # Raw source summaries
│   │   ├── 2026-05-20-llm-wiki-idea.md
│   │   ├── 2026-05-20-krionics-os-architecture.md
│   │   ├── 2026-05-20-krionics-os-blueprint.md
│   │   ├── 2026-05-20-krionics-os-reply-subsystem.md
│   │   └── 2026-05-21-supabase-schema-migration.md
│   │
│   └── ingest/
│       └── (ingest records for each source)
└── README.md                          # Project root docs
```

### Key File Relationships

**Authentication Flow**
```
login/page.tsx (UI form)
    ↓ POST
auth/login/route.ts (validate email/password, hash check, JWT generation)
    ↓ set cookie
kos_session (httpOnly, sameSite=strict)
    ↓ on every request
middleware.ts (verify JWT, set x-operator-id header)
    ↓
Protected routes work, /login redirects if invalid
```

**Data Fetching on Dashboard**
```
dashboard/review/page.tsx (client component)
    ↓ useSWR
api/reply-items/route.ts (GET with multi-tenant filter)
    ↓ sql template literal
lib/db.ts (postgres client)
    ↓ DATABASE_URL (Supabase session pooler)
PostgreSQL reply_items table (with RLS)
```

**Admin-Only Routes**
```
dashboard/admin/page.tsx (client component)
    ↓ checks operator.role on page load
    ↓ if not admin, redirects
admin/operators/route.ts
    ↓ requireAdmin() helper
    ├─ verifyToken(token)
    └─ check operator.role === 'admin'
        ├─ if yes: execute query
        └─ if no: return 403 Forbidden
```

---

## Key Technologies & Libraries

### Frontend (apps/dashboard)
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.x | React framework, server/client components, routing, middleware |
| `react` | 18.x | UI library |
| `swr` | ^2.x | Data fetching, caching, revalidation |
| `react-markdown` | ^8.x | Render markdown → HTML |
| `jose` | ^4.x | JWT signing/verification |
| `bcryptjs` | ^2.x | Password hashing |
| `zod` | ^3.x | Schema validation |
| `tailwindcss` | ^3.x | CSS utility framework |

### Backend (apps/webhook-handler, packages/workers)
| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.x | HTTP server |
| `bullmq` | ^5.x | Redis-backed job queue |
| `@redis/client` | ^4.x | Redis client |
| `postgres` | ^3.x | PostgreSQL client (no ORM) |
| `openai` | ^4.x | Claude API calls (via provider abstraction) |
| `zod` | ^3.x | Schema validation |

### Database
| Component | Purpose |
|-----------|---------|
| `Supabase` | PostgreSQL hosting + auth/RLS |
| `Session Pooler` | Connection pooling (avoids IPv4 direct connection) |
| `Row-Level Security (RLS)` | Tenant isolation at DB level |
| `Triggers` | Automatic audit logging, timestamp updates |

### DevOps & Testing
| Component | Purpose |
|-----------|---------|
| `tsx` | TypeScript execution (scripts) |
| `dotenv` | Environment variable loading |
| `Upstash Redis` | Managed Redis (for BullMQ queues) |
| `Instantly.ai` | Email delivery + webhooks |

---

## Data Flow & Processing Pipeline

### Complete End-to-End Flow

#### 1. **Ingest Phase**
```
Instantly.ai Webhook
    │
    ├─ HTTP POST https://your-domain/webhooks/instantly
    │  Payload: {reply_id, from, subject, body, original_body, ...}
    │
    └─→ apps/webhook-handler/src/server.ts
        ├─ Validate HMAC signature (INSTANTLY_WEBHOOK_SECRET)
        ├─ Extract email from "from" field
        ├─ Look up lead by email
        ├─ Look up campaign by campaign_id
        ├─ Check idempotency_keys table (sha256 of reply_id)
        ├─ INSERT INTO raw_replies (idempotency_key, raw_payload, ...)
        ├─ INSERT INTO reply_items (status='RECEIVED', ...)
        ├─ Enqueue ingest job to BullMQ queue
        └─ Return 200 OK (even if deduped)
```

#### 2. **Classify Phase**
```
BullMQ Worker: packages/workers/src/workers/classify.ts
    │
    ├─ Fetch reply_item, raw_reply, lead, client
    ├─ Build Claude prompt:
    │  "Here is an original email and reply. Classify the intent..."
    ├─ Call openai.chat.completions.create()
    ├─ Parse response via ClassificationOutputSchema (Zod)
    ├─ INSERT INTO reply_classifications
    │  (intent, confidence, sentiment, urgency, key_signals, reasoning, ...)
    │
    └─ Route based on intent:
       ├─ UNSUBSCRIBE: INSERT suppression_list, status='SUPPRESSED'
       ├─ NOT_RELEVANT: status='DISMISSED'
       ├─ NURTURE: status='NURTURE_ENROLLED'
       ├─ BOUNCE_OOO: status='DISMISSED', UPDATE leads.lead_status='ooo'
       ├─ HOSTILE: INSERT suppression_list, status='SUPPRESSED'
       └─ OTHER: Enqueue draftQueue
```

#### 3. **Draft Phase**
```
BullMQ Worker: packages/workers/src/workers/draft.ts
    │
    ├─ Fetch client.automation_level, client.calendly_link
    │
    ├─ If NO calendly_link:
    │  └─ Skip draft, enqueue reviewDispatchQueue (draftId=null)
    │
    └─ If YES calendly_link:
       ├─ Build Claude prompt with Calendly link as CTA
       ├─ Call openai.chat.completions.create()
       ├─ Parse via DraftOutputSchema
       ├─ INSERT INTO reply_drafts (subject, body_text, body_html, tone, cta_type)
       └─ Enqueue reviewDispatchQueue (draftId=...)
```

#### 4. **Review/Dispatch Phase**
```
BullMQ Worker: packages/workers/src/workers/review-dispatch.ts
    │
    ├─ Check automation_level + classification.confidence
    │
    ├─ If automation_level=1 OR confidence < 0.75:
    │  ├─ Operator must review
    │  ├─ INSERT INTO review_items
    │  └─ Operator sees it in /dashboard/review
    │
    └─ If automation_level=2 OR automation_level=3 AND confidence > 0.75:
       ├─ Auto-send enabled
       ├─ Calculate send delay (client.send_delay_minutes)
       ├─ INSERT INTO scheduled_sends (scheduled_at=NOW()+delay)
       └─ Enqueue scheduledSendQueue
```

#### 5. **Send Phase**
```
BullMQ Worker: packages/workers/src/workers/send.ts
    │
    ├─ Poll scheduled_sends for ready items (scheduled_at <= NOW())
    ├─ Fetch reply_drafts.body_text
    │
    └─ Call Instantly API:
       POST https://api.instantly.ai/api/v2/emails/reply
       {
         api_key: INSTANTLY_API_KEY,
         reply_id: reply_item.id,
         subject: draft.subject,
         body: draft.body_text
       }
       │
       ├─ If success:
       │  ├─ UPDATE scheduled_sends.status='SENT'
       │  ├─ UPDATE reply_items.status='SENT'
       │  └─ INSERT audit_log
       │
       └─ If failure:
          ├─ Increment attempt_count
          ├─ If attempts < 5: reschedule for retry
          └─ If attempts >= 5: status='FAILED', move to DLQ
```

#### 6. **Human Review (Operator Dashboard)**
```
Operator logs in: /login
    ↓ email + password
    ↓ validates vs operators.password_hash (bcrypt)
    ↓ generates JWT (kos_session cookie, 8h expiry)
    ↓
/dashboard
    ├─ Shows stats: pending, approved today, suppressed, sent
    └─ Link to review queue

/dashboard/review
    ├─ SWR fetches /api/reply-items?status=PENDING_REVIEW (3s polling)
    ├─ Table: lead_email, company, intent (badge), confidence, sla countdown
    └─ Click row → detail

/dashboard/review/{replyItemId}
    ├─ LEFT: raw reply, lead info, classification
    ├─ RIGHT: draft editor (edit/preview/split markdown tabs)
    ├─ Approve button:
    │  └─ POST /api/reply-items/{id}/approve
    │     ├─ UPDATE reply_drafts (status='approved')
    │     ├─ UPDATE reply_items (status='APPROVED')
    │     ├─ INSERT audit_log
    │     └─ Enqueue scheduledSendQueue
    │
    └─ Reject button:
       └─ POST /api/reply-items/{id}/reject
          ├─ UPDATE reply_drafts (status='rejected', rejection_reason)
          ├─ UPDATE reply_items (status='REJECTED')
          └─ INSERT audit_log (no send scheduled)
```

### State Machine for reply_items

```
RECEIVED
    ↓ (classify worker runs)
CLASSIFYING
    ↓ (classification complete)
CLASSIFIED
    ├─→ SUPPRESSED (UNSUBSCRIBE/HOSTILE intents)
    ├─→ DISMISSED (NOT_RELEVANT, BOUNCE_OOO)
    ├─→ NURTURE_ENROLLED (NURTURE intent)
    │
    └─→ DRAFT_GENERATING (other intents, needs draft)
        ↓ (draft worker runs)
    PENDING_REVIEW
        ├─→ APPROVED (operator approves)
        │   ├─→ SCHEDULED (for delayed send)
        │   └─→ SENT (immediately after sending)
        │
        └─→ REJECTED (operator rejects)
            └─ No further action
```

---

## Security & Multi-Tenancy

### Authentication & Authorization

**JWT Token Structure**
```typescript
{
  sub: operator.id,                    // Subject (operator ID)
  email: operator.email,               // Email
  name: operator.name,                 // Display name
  role: 'admin' | 'reviewer',         // Role
  client_access: UUID[] | null,        // null = all clients; array = filtered
  iat: timestamp,                      // Issued at
  exp: timestamp + 8h,                 // Expires in 8 hours
}
```

**Cookie Configuration**
```typescript
{
  httpOnly: true,           // Not accessible to JavaScript (XSS protection)
  sameSite: 'strict',       // Only sent on same-site requests (CSRF protection)
  secure: prod ? true : false,  // HTTPS only in production
  path: '/',                // Sent with all requests
  maxAge: 8 * 60 * 60,      // 8 hours in seconds
}
```

**Password Hashing**
```typescript
// Storing
const hash = await bcrypt.hash(plaintext, 10);
// Checking
const match = await bcrypt.compare(plaintext, hash);
```

### Multi-Tenant Row-Level Security (RLS)

**Database Policy Example**
```sql
-- For reply_items table (operator can only see items in their assigned clients)
CREATE POLICY "Operators can view reply_items in their clients"
ON reply_items FOR SELECT
USING (
  CASE
    WHEN auth.jwt() ->> 'role' = 'admin' THEN true
    ELSE (SELECT client_access FROM operators WHERE id = auth.uid()) @> ARRAY[client_id]::uuid[]
  END
);
```

**How It Works**
1. Every SELECT from reply_items is intercepted
2. If operator.role = 'admin': can see all rows
3. If operator.role = 'reviewer': can only see rows where `client_id` is in their `client_access` array
4. If operator.client_access is NULL: can see all clients

**API-Level Enforcement**
```typescript
// In app/api/reply-items/route.ts
if (operator.client_access && operator.client_access.length > 0) {
  conditions.push(sql`ri.client_id = ANY(${operator.client_access})`);
}
```

### Service Role Bypass

**For Workers & Webhooks**
- Supabase has two API keys:
  - **Anon key**: Uses RLS policies (public API)
  - **Service role key**: Bypasses RLS (trusted backend)
- BullMQ workers use **service role** to bypass RLS
- Webhook handler uses **service role** to insert raw_replies

```typescript
// In packages/workers/index.ts
const sql = postgres({
  host: process.env.DB_HOST,
  port: 5432,
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: 'postgres',
  options: `sslmode=require`,  // Session pooler URL
});
// This is a direct connection that bypasses RLS
```

### Idempotency & Deduplication

**Problem**: Webhook might retry, creating duplicate reply_items

**Solution**: Idempotency keys
```sql
-- In raw_replies table
idempotency_key TEXT UNIQUE,  -- sha256(instantly_reply_id)
```

```typescript
// In ingest worker
const idempKey = sha256(webhook.reply_id);
const [existing] = await sql`
  SELECT id FROM raw_replies WHERE idempotency_key = ${idempKey}
`;
if (existing) {
  // Already processed, return early
  return;
}
```

**Cleanup**
```sql
-- Old idempotency keys expire after 48 hours
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

### Audit Logging

**Every State Change is Logged**
```sql
-- audit_log table structure
{
  id: BIGSERIAL,
  client_id: UUID,
  actor_type: 'operator' | 'worker' | 'system',
  actor_id: UUID,
  action: 'APPROVE_DRAFT' | 'REJECT_DRAFT' | 'CLASSIFY' | ...,
  entity_type: 'reply_item',
  entity_id: UUID,
  before_state: JSONB,  -- Previous values
  after_state: JSONB,   -- New values
  trace_id: UUID,       -- Link to reply_item.trace_id
  created_at: TIMESTAMP,
}
```

**Example: Approve Creates Audit Entry**
```typescript
// In approve/route.ts
await tx`
  INSERT INTO audit_log (
    client_id, actor_type, actor_id, action, entity_type, entity_id, trace_id
  ) VALUES (
    ${client_id}, 'operator', ${operator.id}, 'APPROVE_DRAFT', 'reply_item', ${reply_id}, ${trace_id}
  )
`;
```

---

## Summary: What You Have Now

### ✅ Built & Tested
1. **Supabase Database** — 17 migrations, 14 tables, partitioning, RLS, triggers
2. **Webhook Handler** — Validates Instantly.ai webhooks, enqueues jobs
3. **BullMQ Workers** — 5 workers (ingest, classify, draft, review-dispatch, send) for RICR pipeline
4. **Operator Dashboard (Phase 1)** — Auth, queue, approve/reject, audit logging
5. **Operator Dashboard (Phase 2)** — Settings, admin panel, real-time, markdown editor, mobile, E2E tests

### ✅ Production-Ready Patterns
- JWT + httpOnly cookie auth
- Multi-tenant RLS at database layer
- Idempotency for webhook deduplication
- Transactional operations with audit logging
- Error boundaries + retry logic
- Exponential backoff on network failures

### ✅ Next Steps (Not Yet Built)
- Lead enrichment via Apollo API integration
- Client self-serve onboarding flow
- Real-time Websocket updates (vs polling)
- Advanced filtering/search in queue
- Batch operations (approve multiple at once)
- Performance dashboards & analytics
- Integration testing with live Instantly.ai API

---

**Last Updated**: May 22, 2026 (Operator Dashboard Phase 2 complete)
