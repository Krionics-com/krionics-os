# Architecture: Database Schema

Overview
- PostgreSQL via Supabase. All tables are multi-tenant via `client_id` FK and Row-Level Security.
- Service role bypasses RLS for n8n workers and BullMQ queue processors.
- Four tables are partitioned by month (RANGE on timestamp): `email_events`, `ai_invocations`, `workflow_executions`, `audit_log`.

Table groups

**Foundation**
- `clients` — tenant root; holds config JSONB, automation_level (1–3), CRM config, knowledge asset fields (sales_lead_name, service_description, icp_description, positioning_statement).
- `operators` — human users; client_access UUID[] (NULL = all clients); role: admin / reviewer / viewer.
- `config` — system-wide key/value defaults seeded at migration time.

**Pipeline**
- `campaigns` — per-client Instantly campaigns; icp/sequence/reply_policies JSONB; email send counters.
- `leads` — Universal Lead Schema: identity, company, role, enrichment (clay_enrichment JSONB, lqs_score, personalization_depth L1–L4), lead_status state machine (29 states), CRM sync, suppression.
- `email_events` — partitioned; all Instantly webhook events (sent, opened, clicked, bounced, replied).
- `raw_replies` — immutable webhook store; idempotency_key = sha256 of instantly_reply_id; raw_payload JSONB never modified.

**RICR Subsystem** (Reply Ingestion Classification Review)
- `reply_items` — central state machine entity; status reply_status (16 states from RECEIVED → SENT); holds nullable FKs to all downstream RICR tables.
- `reply_classifications` — Claude output: intent (10 values), confidence, key_signals[], raw_model_output JSONB.
- `reply_drafts` — AI draft: version, tone, cta_type, human edit fields, SLA deadline, AI provenance.
- `review_items` — operator inbox: priority (1=urgent), action_taken review_action, queue_position.
- `scheduled_sends` — send queue: scheduled_at, send_status, attempt_count, instantly_message_id.

**Meetings / Voice**
- `voice_calls` — Vapi / Retell integration; transcript, outcome, flagged_for_review.
- `meetings` — calendly/Cal.com bookings linked to leads, campaigns, optional voice_call.

**AI & Observability**
- `ai_prompts` — versioned Handlebars prompt templates; slug+version+client_id UNIQUE; test_cases JSONB.
- `ai_invocations` — partitioned; per-call record: input_hash (SHA-256, for cache hits), cost_usd_micro, validation_passed.
- `workflow_executions` — partitioned; BullMQ / n8n run record: queue_name, attempt_number, emitted_events JSONB[].
- `audit_log` — partitioned BIGSERIAL; append-only (no UPDATE/DELETE RLS policy); actor_type, before/after_state JSONB.

**Support tables**
- `suppression_list` — global or per-client; INSERT restricted to service_role via RLS.
- `idempotency_keys` — 48h TTL; cleaned by `cleanup_expired_idempotency_keys()` trigger (cron target).

**Reply Orchestration Extension** (migrations 006–015, added 2026-05-23)
- `enriched_leads` — structured Clay output per lead: buying_signals[], personalization_hooks[], icp_fit_score, tech_stack[], hiring_signals[], company_growth_signals[]. Supersedes the `clay_enrichment` JSONB blob on `leads`.
- `events` — immutable system event log partitioned by month (202605–202705+); trace_id + parent_event_id for full workflow tracing; append-only.
- `lead_state_history` — state transition audit trail; from_state/to_state, triggered_by_event_id, duration_in_state_ms; never updated.
- `reply_policies` — per-client, per-intent automation routing decisions: auto_send | draft_only | escalate | suppress; confidence_threshold override.
- `timing_rules` — per-client, per-intent response delay windows (min/max minutes); business hours enforcement; prospect timezone awareness.
- `response_queue` — pending outbound responses; scheduled_send_at, queue_type (immediate | delayed | approval | nurture), send_attempts.

Column additions to existing tables (same migration batch):
- `clients`: reply_processing_enabled BOOLEAN, auto_send_enabled BOOLEAN
- `leads`: thread_id TEXT UNIQUE (Instantly thread), assigned_to_operator_id UUID, routing_policy, first_reply_at, first_booking_link_sent_at, status_reason
- `raw_replies`: client_id, thread_id, email_sequence_number, classification_status, classification_error, processed_at
- `reply_drafts`: intent_classified_as, includes_booking_link, booking_link_url, quality_flags TEXT[], confidence FLOAT, approval_notes, send_status, send_error

Key design decisions
- Circular FK resolution: reply_items columns (classification_id, draft_id, etc.) are created nullable with no constraint in migration 007; each downstream table migration (008–011) issues `ALTER TABLE reply_items ADD CONSTRAINT ... FOREIGN KEY ...` after the referenced table exists.
- Partitioned tables use composite PKs `(id, occurred_at)` / `(id, created_at)` required by Postgres for partition-pruning.
- Automation levels: `clients.automation_level` INT CHECK IN (1,2,3) drives how reply_items route through the RICR pipeline (1=human reviews all, 2=hybrid, 3=full AI SDR).

Running migrations
```
# Add DATABASE_URL to .env (Supabase Dashboard → Settings → Database → URI)
pnpm db:migrate
```

Sources
- [wiki/sources/2026-05-21-supabase-schema-migration.md](../sources/2026-05-21-supabase-schema-migration.md)
- [wiki/sources/2026-05-20-krionics-os-blueprint.md](../sources/2026-05-20-krionics-os-blueprint.md)
- [wiki/sources/2026-05-20-krionics-os-reply-subsystem.md](../sources/2026-05-20-krionics-os-reply-subsystem.md)
