# Project: Reply Orchestration System — Phase 1-3

**Date:** 2026-05-23  
**Branch:** `claude/hopeful-planck-q4WyA`  
**PR:** #4 (merged to main via squash)  
**Reference:** Architecture §12, §6, §7, §8

---

## Objective

Implement the missing backend infrastructure for the reply orchestration pipeline. The 14-phase dashboard was complete, but the pipeline that processes incoming Instantly replies had no orchestration — just raw tables. This work adds the database schema, webhook handler, and state machine that power the full reply flow.

---

## What Was Built

### Phase 1: Database Migrations (migrations 006–015)

**6 new tables:**

| Table | Purpose |
|---|---|
| `enriched_leads` | Structured Clay enrichment — buying signals, tech stack, personalization hooks, ICP fit score |
| `events` | Immutable system event log partitioned by month (202605–202705); trace_id linkage for full workflow tracing |
| `lead_state_history` | Append-only state transition audit trail; records from_state, to_state, triggered_by, duration_in_state_ms |
| `reply_policies` | Per-client, per-intent automation routing: auto_send | draft_only | escalate | suppress |
| `timing_rules` | Response delay windows (min_minutes, max_minutes) with business hours enforcement |
| `response_queue` | Scheduled and pending outbound responses with send_status tracking |

**Column additions to existing tables:**

| Table | New Columns |
|---|---|
| `clients` | `reply_processing_enabled`, `auto_send_enabled` |
| `leads` | `thread_id` (Instantly), `assigned_to_operator_id`, `routing_policy`, `first_reply_at`, `first_booking_link_sent_at`, `status_reason` |
| `raw_replies` | `client_id`, `thread_id`, `email_sequence_number`, `classification_status`, `classification_error`, `processed_at` |
| `reply_drafts` | `intent_classified_as`, `includes_booking_link`, `booking_link_url`, `quality_flags[]`, `confidence`, `approval_notes`, `send_status`, `send_error` |

**Files:**
```
supabase/migrations/20260523000006_create_enriched_leads.sql
supabase/migrations/20260523000007_create_events.sql
supabase/migrations/20260523000008_create_lead_state_history.sql
supabase/migrations/20260523000009_create_reply_policies.sql
supabase/migrations/20260523000010_create_timing_rules.sql
supabase/migrations/20260523000011_create_response_queue.sql
supabase/migrations/20260523000012_add_reply_orchestration_to_clients.sql
supabase/migrations/20260523000013_add_reply_orchestration_to_leads.sql
supabase/migrations/20260523000014_add_reply_orchestration_to_raw_replies.sql
supabase/migrations/20260523000015_add_reply_orchestration_to_reply_drafts.sql
```

### Phase 2: Instantly Webhook Handler

**File:** `apps/dashboard/app/api/webhooks/instantly/route.ts`

Implements architecture §9.2 workflow 6.1 (Reply Intake). Key behaviours:
- HMAC-SHA256 signature verification using `INSTANTLY_WEBHOOK_SECRET`
- Returns `202 Accepted` in < 200ms (critical — Instantly has aggressive timeout)
- Enqueues payload to BullMQ `ingestQueue` without blocking
- Validates required fields before enqueue
- Fire-and-forget error logging for enqueue failures

The existing `ingestQueue` worker (`packages/workers/src/workers/ingest.ts`) then processes asynchronously: stores `raw_replies`, creates `reply_items`, registers idempotency key, enqueues to `classificationQueue`.

Also created `apps/dashboard/lib/queues.ts` to re-export BullMQ queues from `@krionics/workers` for use in the dashboard app.

### Phase 3: Lead State Machine

**File:** `apps/dashboard/lib/lead-state-machine.ts`

Implements architecture §6 (Lead State Machine). Key behaviours:
- Defines all 27 valid `LeadState` values as TypeScript type
- `STATE_TRANSITIONS` map — exhaustive valid transitions, enforced at runtime
- `transitionLeadState(leadId, clientId, toState, context)` — fetches current state, validates transition, updates `leads.lead_status`, inserts row in `lead_state_history` (including `duration_in_state_ms` calculation)
- `getValidNextStates(currentState)` — utility for routing logic
- `isValidTransition(from, to)` — boolean guard for pre-checks

All transitions wrapped in a DB transaction. Invalid transitions return `{ success: false, error }` without throwing, enabling safe caller-side handling.

---

## Pre-existing Workers (Already Implemented)

These workers in `packages/workers/src/workers/` were already present and are now connected by the webhook handler:

| Worker | File | Handles |
|---|---|---|
| Ingest | `ingest.ts` | Stores raw_replies, creates reply_items, enqueues classify |
| Classify | `classify.ts` | Claude classification → reply_classifications, routes to draftQueue or reviewDispatchQueue |
| Draft | `draft.ts` | Claude response generation → reply_drafts, routes to scheduledSendQueue or approval |
| Review Dispatch | `review-dispatch.ts` | Places draft in operator review queue |
| Send | `send.ts` | Sends approved reply via Instantly thread continuation |

---

## Data Flow (Architecture §9.2 Domain 6)

```
Instantly webhook
  ↓ POST /api/webhooks/instantly
  ↓ Signature verified
  ↓ 202 returned
  ↓ ingestQueue.add()
  ↓
ingest worker (async)
  → raw_replies INSERT
  → reply_items INSERT (status=RECEIVED)
  → idempotency_keys INSERT
  → classificationQueue.add()
  ↓
classify worker
  → Claude classification
  → reply_classifications INSERT
  → reply_items SET status=CLASSIFIED
  → Lead state transition (via STATE_TRANSITIONS)
  → If UNSUBSCRIBE → suppression_list + SUPPRESSED status
  → Else → draftQueue.add()
  ↓
draft worker
  → Claude response generation
  → reply_drafts INSERT
  → If automation_level >= 2 AND confidence >= threshold → scheduledSendQueue
  → Else → reviewDispatchQueue (human approval)
  ↓
[Human review OR scheduled send]
  ↓
send worker
  → POST Instantly /api/v1/campaign/thread/reply
  → scheduled_sends UPDATE status=sent
  → reply_items SET status=SENT
```

---

## Architecture Gaps Remaining

These items are in the architecture spec but not yet implemented:

| Gap | Architecture Section | Priority |
|---|---|---|
| Default `reply_policies` seeding per client | §12.4, §14 | High — required for automation routing to work |
| Default `timing_rules` seeding per client | §12.5, §14 | High — required for delay scheduling |
| Confidence-based routing override | §17.1 | Medium |
| Events emitted by classify/draft/send workers | §7 | Medium — currently only reply_received emits to `events` table |
| CRM sync workflow (positive reply → HubSpot) | §9.2 Domain 9 | Medium |
| Booking recovery flow | §12.6 | Medium |
| Cal.com booking webhook | §9.2 Domain 8 | Medium |
| Apollo lead acquisition | §9.2 Domain 2 | Low (manual import works) |
| Clay enrichment workflow | §9.2 Domain 3 | Low |
| Analytics Intelligence (AI invocation point 6) | §10.2 | Future |

---

## Commit History

| Commit | Description |
|---|---|
| `55690bd` | Phase 1: Database Migrations (10 files) |
| `d323a8c` | Phase 2: Instantly webhook handler (initial, direct DB version) |
| `652cd3f` | Phase 3: Lead state machine |
| `4331c82` | Phase 2-3: Refactor webhook to use ingestQueue pattern + lib/queues.ts |
| `2406e6c` | Implementation summary document |
| `15d25b0` | Original planning document |
| `7195e5c` | Squash merge to main via PR #4 |
