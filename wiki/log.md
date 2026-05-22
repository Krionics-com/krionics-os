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
