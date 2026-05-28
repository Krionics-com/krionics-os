# Ingest Record: Module 1 — Seed Operational Config

Date: 2026-05-28
Branch: feat/module-1-seed-policies

## Actions taken

1. Fixed `supabase/migrations/20260523000009_create_reply_policies.sql` — removed duplicate `UUID PRIMARY KEY` from `id` column. The table was using `PRIMARY KEY (client_id, intent)` as table constraint AND `id UUID PRIMARY KEY` inline, which is invalid PostgreSQL. Fixed to `id UUID NOT NULL DEFAULT gen_random_uuid()`.

2. Created `supabase/migrations/20260528000001_seed_default_policies.sql`:
   - `seed_client_default_policies(p_client_id UUID)` PL/pgSQL function inserts 10 default `reply_policies` rows + 10 default `timing_rules` rows using `ON CONFLICT DO NOTHING` for idempotency.
   - `trigger_seed_client_policies()` trigger function auto-seeds new clients on INSERT.
   - `on_client_created_seed_policies` trigger registered on the `clients` table.
   - Backfill DO block seeds all existing clients.

3. Created `packages/workers/src/seed-client-policies.ts` — TypeScript wrapper calling `seed_client_default_policies()` from application code.

## Default policy matrix

| Intent | Level 1 | Level 2 | Level 3 | Confidence |
|--------|---------|---------|---------|-----------|
| POSITIVE | human_review | ai_draft_human_review | ai_send | 0.85 |
| BOOKING_INTENT | human_review | ai_draft_human_review | ai_send | 0.85 |
| OBJECTION | human_review | ai_draft_human_review | ai_draft_human_review | 0.85 |
| FAQ | human_review | ai_draft_human_review | ai_send | 0.80 |
| NURTURE | suppress | suppress | suppress | 0.85 |
| UNSUBSCRIBE | suppress | suppress | suppress | 0.99 |
| NOT_RELEVANT | suppress | suppress | suppress | 0.80 |
| BOUNCE_OOO | suppress | suppress | suppress | 0.85 |
| HOSTILE | suppress | suppress | suppress | 0.99 |
| UNKNOWN | human_review | human_review | human_review | 0.90 |

## Default timing windows

| Intent | Min (min) | Max (min) | Business Hours |
|--------|-----------|-----------|----------------|
| POSITIVE | 120 | 480 | Yes |
| BOOKING_INTENT | 30 | 120 | Yes |
| OBJECTION | 240 | 720 | Yes |
| FAQ | 60 | 240 | Yes |
| NURTURE | 1440 | 2880 | Yes |
| UNSUBSCRIBE | 0 | 0 | No |
| NOT_RELEVANT | 0 | 0 | No |
| BOUNCE_OOO | 0 | 0 | No |
| HOSTILE | 0 | 0 | No |
| UNKNOWN | 60 | 240 | Yes |

## Touched files

- `supabase/migrations/20260523000009_create_reply_policies.sql` (fixed)
- `supabase/migrations/20260528000001_seed_default_policies.sql` (new)
- `packages/workers/src/seed-client-policies.ts` (new)
- `wiki/index.md` (updated)
- `wiki/log.md` (updated)

## Sources

- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §12 automation levels, §12.5 timing windows
