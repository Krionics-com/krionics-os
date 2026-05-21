# Source Summary: Supabase Schema Migration (2026-05-21)

Summary
- Full PostgreSQL schema for Krionics OS was designed and applied as 17 ordered migration files under `supabase/migrations/`.
- A `packages/db` migration runner using a direct PostgreSQL connection (`DATABASE_URL`) was created because the Supabase service role key cannot execute DDL via the PostgREST REST API.
- All tables implement multi-tenancy via `client_id` foreign keys and Row-Level Security (RLS).

Key points

Migration files (applied in order):
1. `20260521000001_create_enums.sql` — 14 PostgreSQL enum types (client_status, campaign_status, lead_status with 29 states, reply_intent, reply_status, review_action, send_status, draft_status, execution_status, meeting_status, service_type, ai_invocation_type, call_outcome, reply_sentiment). Idempotent via `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`.
2. `20260521000002_create_clients_operators.sql` — `clients` (slug, config JSONB, automation_level 1–3, crm_type, knowledge asset fields, Slack fields) and `operators` (email, role, client_access UUID[]).
3. `20260521000003_create_campaigns.sql` — `campaigns` with icp_config/sequence_config/reply_policies JSONB, send counters, FK to clients.
4. `20260521000004_create_leads.sql` — Universal Lead Schema: identity, company, role, source, enrichment (clay_enrichment JSONB, lqs_score, personalization_depth L1–L4), full state machine (lead_status, prev_status, status_updated_at), suppression, CRM sync fields.
5. `20260521000005_create_email_events.sql` — Partitioned RANGE on occurred_at, monthly partitions 2026-05 → 2027-06.
6. `20260521000006_create_raw_replies.sql` — Immutable webhook store with idempotency_key UNIQUE (sha256 of instantly_reply_id), raw_payload JSONB (never modified).
7. `20260521000007_create_reply_items.sql` — RICR state machine entity: status reply_status DEFAULT 'RECEIVED', nullable FK stubs for classification_id, draft_id, review_item_id, scheduled_send_id (populated by ALTER TABLE in later migrations to avoid circular dependency).
8. `20260521000008_create_reply_classifications.sql` — Claude output store: intent, confidence NUMERIC(4,3), key_signals TEXT[], raw_model_output JSONB (immutable). Adds FK constraint back to reply_items.
9. `20260521000009_create_reply_drafts.sql` — AI draft store: version, tone, cta_type, AI provenance fields, human edit fields (edited_body_text, edit_diff JSONB), SLA deadline. Adds FK back to reply_items.
10. `20260521000010_create_review_items.sql` — Operator inbox: priority, queue_position, action_taken review_action. Partial index on pending items. Adds FK back to reply_items.
11. `20260521000011_create_scheduled_sends.sql` — Send queue: scheduled_at, status send_status, attempt_count, instantly_message_id. Partial index on pending sends. Adds FK back to reply_items.
12. `20260521000012_create_meetings_voice.sql` — `voice_calls` (vapi/retell integration) and `meetings` (calendly_event_id, cal_booking_id, source, lifecycle).
13. `20260521000013_create_ai_tables.sql` — `ai_prompts` (slug+version+client_id UNIQUE, Handlebars templates, test_cases JSONB) and `ai_invocations` partitioned (input_hash for caching, cost_usd_micro, validation_passed). Monthly partitions 2026-05 → 2027-05.
14. `20260521000014_create_workflow_audit.sql` — `workflow_executions` partitioned (queue_name, attempt_number, emitted_events JSONB[]) and `audit_log` partitioned BIGSERIAL (actor_type, before/after_state JSONB). Monthly partitions 2026-05 → 2027-05.
15. `20260521000015_create_suppression_config.sql` — `suppression_list` (global or per-client), `idempotency_keys` (48h TTL), `config` table seeded with 22 system-wide defaults (confidence thresholds, SLA, send delay, queue alert thresholds, AI model/retry/cache settings).
16. `20260521000016_rls_policies.sql` — RLS enabled on 14 tables. Operator policies use `auth.email()` lookup against operators table with role and client_access checks. audit_log is INSERT-only (no UPDATE/DELETE policy). suppression_list INSERT restricted to service_role.
17. `20260521000017_triggers.sql` — Trigger functions: set_updated_at (6 tables), audit_reply_item_status (append to audit_log on status change), update_campaign_email_counters, sync_lead_status_timestamp, cleanup_expired_idempotency_keys (cron target).

packages/db migration runner:
- `packages/db/src/migrate.ts` — reads `DATABASE_URL`, connects via `postgres` npm package (ssl: "require"), creates `_migrations` tracking table, runs pending `.sql` files in sorted order, each in a transaction with an INSERT into `_migrations` for atomicity.
- Run with: `pnpm db:migrate` (requires `DATABASE_URL` set in `.env`; get it from Supabase Dashboard → Settings → Database → URI).

Circular dependency resolution pattern:
- `reply_items` references classification_id, draft_id, review_item_id, scheduled_send_id.
- Those tables also reference reply_items. Solved by: create nullable FK columns in reply_items migration (007) with no constraint, then each downstream table (008–011) does `ALTER TABLE reply_items ADD CONSTRAINT ... FOREIGN KEY ...` after the referenced table exists.

Sources
- [wiki/sources/2026-05-20-krionics-os-blueprint.md](2026-05-20-krionics-os-blueprint.md)
- [wiki/sources/2026-05-20-krionics-os-reply-subsystem.md](2026-05-20-krionics-os-reply-subsystem.md)
- [supabase/migrations/](../../supabase/migrations/)
- [packages/db/src/migrate.ts](../../packages/db/src/migrate.ts)
