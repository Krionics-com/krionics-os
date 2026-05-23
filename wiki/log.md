# Wiki Log

## [2026-05-20] setup | initialize wiki structure and schema
- Created AGENTS.md and wiki base folders.
- Added index.md and log.md.

## [2026-05-20] ingest | LLM Wiki idea
- Added raw source and summary pages.
- Created concept page and ingest record.
- Updated index.

## [2026-05-20] ingest | Krionics OS architecture
- Added raw source and summary page.
- Added ingest record and updated index.

## [2026-05-20] ingest | Krionics OS implementation blueprint
- Added raw source and summary page.
- Added ingest record and updated index.

## [2026-05-20] ingest | Krionics OS reply subsystem
- Added raw source and summary page.
- Added ingest record and updated index.

## [2026-05-21] build | Supabase schema migration
- Wrote 17 SQL migration files covering enums, all core tables, RICR subsystem, partitioned tables, RLS policies, and triggers.
- Created packages/db migration runner (migrate.ts, postgres npm package, DATABASE_URL direct connection).
- Added db:migrate script to root package.json and DATABASE_URL to .env.example.
- Committed 25 files as 83de6af on branch claude/hopeful-planck-q4WyA.
- Added wiki/sources/2026-05-21-supabase-schema-migration.md and wiki/architecture/database-schema.md.
- Updated wiki/index.md and wiki/log.md.

## [2026-05-22] fix | Supabase pooler migration
- Added a session pooler-based `DATABASE_URL` path to avoid IPv4 direct connection costs.
- Fixed `supabase/migrations/20260521000016_rls_policies.sql` so `uuid[]` containment uses `@>` instead of invalid `uuid = uuid[]` semantics.
- Created `wiki/projects/2026-05-22-supabase-pooler-migration-fix.md` to capture this learning.

## [2026-05-22] build | RICR queue workers
- Added `@krionics/workers` with BullMQ queues and workers for ingest, classify, draft, and review dispatch.
- Implemented PostgreSQL writes for RICR tables with idempotency and trace propagation.
- Added unit tests for routing helpers and updated build scripts.

## [2026-05-22] test | RICR integration smoke test
- Started workers locally using `REDIS_URL` (Upstash TCP URL) and `DATABASE_URL` (Supabase pooler).
- Executed `scripts/integration/test-ingest.ts` to seed a `client/campaign/lead`, enqueue an ingest job, and confirm `reply_items` was created and progressed to `CLASSIFYING`.
- OpenAI returned a 429 `insufficient_quota` during live `classify()` calls. To continue testing we inserted synthetic `reply_classifications` and `reply_drafts` using `scripts/integration/insert-fake-class-draft.ts`, which advanced the `reply_items` to `PENDING_REVIEW`.
- Outcome: end-to-end worker flow validated up to draft creation and review dispatch logic without consuming additional OpenAI quota.

## [2026-05-22] fix | RICR worker bug fixes and scheduled send worker
- Added missing intents to schema, fixed draft calendly fallback and original_body sourcing, and added BOUNCE_OOO/HOSTILE routing.
- Updated review dispatch to enforce to_email, corrected from_email fallback, and enqueue scheduled send jobs.
- Added scheduled send worker to dispatch approved replies through Instantly and update send status.
- Updated wiki project page and index to reflect the fixes.

## [2026-05-22] build | Instantly webhook handler
- Added Express webhook handler in apps/webhook-handler to validate HMAC signatures and enqueue reply ingestion jobs.
- Implemented structured JSON logging, health checks (Redis + DB), and graceful shutdown.
- Added webhook test script for local validation.

## [2026-05-22] build | Operator dashboard Phase 1
- Bootstrapped apps/dashboard Next.js 14 app with auth, middleware, and core review queue pages.
- Added reply-item API routes, approve/reject flows with audit logging, and operator password migration seed.
- Documented dashboard in wiki/projects and updated index.

## [2026-05-22] fix | Dashboard API route stability
- Fixed reply-items list query composition and dynamic route param handling after initial smoke tests.

## [2026-05-22] build | Operator Dashboard Phase 2
- Implemented settings profile/change password, admin panel with operator creation modal (plaintext password input), inline role updates, active state toggles, and soft deactivations.
- Enriched review page SWR config with 3-second polling, cache busting on submission, and tabbed Markdown previewing.
- Addressed mobile usability via hamburger layouts, horizontal-scrolling queues, and 44px minimum touch targets.
- Introduced LoadingSpinner, ErrorState boundaries, and built a fetch-only e2e-dashboard script.

## [2026-05-23] phase | Dashboard Phase 1 — Design Foundation
- Configured Shadcn UI, Krionics brand colors, and Next.js fonts (Playfair Display, Inter).
- Rebuilt layout shell with Sidebar, Topbar, and AuthShell.
- Redesigned operator login page.
- Implemented RBAC middleware and SessionManager.

## [2026-05-23] phase | Dashboard Phase 1 — Bug fixes & missing features
- Fixed 4 critical bugs: OperatorToken client_access, session warning spam, token refresh, sidebar colors
- Implemented 3 missing features: breadcrumb, client switcher, data-table component
- All E2E tests passing

## [2026-05-23] phase | Dashboard Phase 2 — Database SLA and Operator Assignment Migration
- Created database migration to add `sla_expires_at` and `assigned_to_operator_id` fields to `reply_items` along with high-performance indexes.
- Successfully applied and verified the migrations against Supabase using database runner.

## [2026-05-23] phase | Dashboard Phase 2 — Reply Review System UI & APIs
- Implemented interactive Review Inbox with full-text search, collateral collapsible status filters, and live countdown SlaTimer badges.
- Created premium Three-Panel Draft Detail Page with chronological email threads, lead and campaign metadata cards, visual AI classification statistics, complete markdown draft editor (Edit / Preview / Split modes), dynamic Approve/Approve with Edits action handlers, Custom LinkedIn SVG, and an overlay Rejection Modal.
- Built 7 REST API endpoints: GET list, GET detail, POST approve, POST reject, POST regenerate, POST assign, and GET dashboard stats.
- Verified Next.js dashboard compiles successfully with zero TypeScript or Turbopack errors.

## [2026-05-23] phase | Dashboard Phase 3 — Global Ops Dashboard
- Built 10 KPI cards (pending, approved, suppressed, sent, positive, campaigns, queue health, AI cost, failure %, SLA)
- Created real-time activity feed with 8 event types
- Built system health status bar for 5 services
- Created 2 new API endpoints: activity, health

## [2026-05-23] fix | Dashboard Phase 3 — Fix lead name in activity feed
- Fixed NULL lead names by using first_name + last_name concat instead of l.name

## [2026-05-23] merge | Dashboard Phase 3 — merged to main
- Merged `feature/dashboard-phase3-global-ops-dashboard` into `main`.
- All KPI cards, activity feed, and system health bar functional.
- Confirmed UI renders correctly and no TypeScript errors.

## [2026-05-23] project | Phase 4 — queue monitoring and DLQ inspector built
- Created BullMQ integration library (`apps/dashboard/lib/bull-redis.ts`) with module-level queue caching.
- Built Queue Monitor page (`/dashboard/queues`) with status chips, admin actions (pause/resume/retry/flush).
- Built Queue Detail page (`/dashboard/queues/[name]`) with Recharts depth chart and job lists.
- Built DLQ Inspector page (`/dashboard/dlq`) with search, filters, pagination, and bulk actions.
- Built DLQ Job Detail page (`/dashboard/dlq/[jobId]`) with payload viewer, stack trace, and Slack escalation.
- Created 10 API endpoints for queue and DLQ operations.
- Replaced Phase 3 hardcoded mocks: `queue_health` and `failure_rate` now use real BullMQ data.
- Added `bullmq`, `ioredis`, `recharts` to dashboard dependencies.
- Updated sidebar with Queues and DLQ navigation items.

## [2026-05-23] project | Phase 5 — client management pages and APIs built
- Created Client list page (`/dashboard/clients`) with status filters, search, quick actions (pause/archive), and New Client modal trigger.
- Created Client Profile page (`/dashboard/clients/[slug]`) featuring 8 tabs (Overview, Business Info, ICP, Automation, CRM, Slack, AI, Team) with full view/edit toggling, structured inline forms, custom dynamic TagInput handles, and robust PATCH updates.
- Built backend APIs for directories, creation validation (unique slug check), profiles, merging of JSONB columns, status shifts (pause/archive), and team retrieval.
- Integrated `ClientSwitcher` to connect directly to the newly implemented endpoints.
- Confirmed full monorepo static build completion with zero TypeScript or Next.js errors.

## [2026-05-23] project | Phase 6 — campaign management, funnel, sequence, activity
- Created Campaign list page (`/dashboard/campaigns`) with client filters, status selectors, search, and action managers (pause/resume/archive/duplicate/mock exports).
- Created Campaign Detail page (`/dashboard/campaigns/[id]`) with 6 tabs (Overview cards, Recharts custom horizontal Funnel bars, sequence steps table, Inbox Health grades, Recharts Lead state PieCharts, and live activity logs).
- Added dynamic polling mechanism to timeline events refreshing every 5 seconds.
- Built backend campaign endpoints for filtering directories, detailed config parameters, PATCH inline updates, and duplication cloning routines.
- Updated sidebar layout navigation adding direct access to Campaigns dashboard.
- Verified successful NextJS monorepo production build with zero errors.
