# Ingest Record: Module 2 — Event Emission in Workers

Date: 2026-05-28
Branch: feat/module-2-event-emission

## Actions taken

1. Created `packages/workers/src/emit-event.ts` — `emitEvent(params)` helper that inserts into the partitioned `events` table. Errors are caught and logged but never propagated so event emission never blocks pipeline jobs.

2. Wired emitEvent into all 5 workers:
   - **ingest.ts**: emits `reply_received` after successful ingest with from_email, subject, reply_item_id, raw_reply_id in metadata.
   - **classify.ts**: emits `reply_classified` after updating status to CLASSIFIED, before intent-specific branches. Captures intent, confidence, routing_decision.
   - **draft.ts**: emits `draft_generated` after draft is persisted, with draft_id, generation_ms, model_used.
   - **review-dispatch.ts**: emits `review_queued` when routed to human review; emits `auto_send_queued` when auto-scheduled.
   - **send.ts**: emits `auto_reply_sent` on success; emits `send_failed` on Instantly API error with attempt_count and error message. Extended rawReply query to JOIN reply_items for client_id and lead_id.

## Event catalog (wired)

| Event Type | Worker | Trigger |
|---|---|---|
| reply_received | ingest | After raw_reply + reply_item insert |
| reply_classified | classify | After classification INSERT |
| draft_generated | draft | After reply_drafts INSERT |
| review_queued | review-dispatch | After review_items INSERT |
| auto_send_queued | review-dispatch | After scheduled_sends INSERT (auto path) |
| auto_reply_sent | send | After Instantly API success |
| send_failed | send | On Instantly API error |

## Touched files

- `packages/workers/src/emit-event.ts` (new)
- `packages/workers/src/workers/ingest.ts`
- `packages/workers/src/workers/classify.ts`
- `packages/workers/src/workers/draft.ts`
- `packages/workers/src/workers/review-dispatch.ts`
- `packages/workers/src/workers/send.ts`
- `wiki/index.md` (updated)
- `wiki/log.md` (updated)

## Sources

- [supabase/migrations/20260523000007_create_events.sql](../../supabase/migrations/20260523000007_create_events.sql) — events table schema
- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §9 Event Catalog
