# Ingest Record: Module 8 — Analytics Intelligence

Date: 2026-05-28
Branch: feat/module-8-analytics-intelligence

## Actions taken

1. Created `supabase/migrations/20260528000002_create_analytics_snapshots.sql`:
   - `analytics_snapshots` table — stores pre-computed campaign metric snapshots.
   - Columns: `client_id`, `campaign_id`, `period_start/end`, `granularity` (hourly/daily/weekly/monthly), reply metrics (total_replies, reply_rate, positive_rate, booking_rate, avg_response_time_hours, sequences_sent), `intent_breakdown` JSONB, `top_objections TEXT[]`.
   - AI columns: `ai_summary`, `ai_key_insights TEXT[]`, `ai_recommended_actions JSONB`, `ai_sequence_suggestions TEXT[]`, `ai_health_score FLOAT`, `ai_analyzed_at`.
   - Unique index on `(client_id, period_start, period_end, granularity)` for upsert idempotency.

2. Created `packages/workers/src/workers/analytics-aggregator.ts`:
   - BullMQ worker on `analytics-aggregate` queue.
   - Job payload: `{ clientId?, periodStart?, periodEnd?, granularity }` — all optional; defaults to "all clients, last day, daily".
   - Per-client aggregation: queries `reply_items` for total/positive/booking counts, avg response time; queries `events` for sequences sent; builds intent breakdown from GROUP BY intent; pulls top 10 objection reply bodies.
   - Computes derived rates: `reply_rate = total / sequencesSent`, `positive_rate`, `booking_rate`.
   - Upserts to `analytics_snapshots` with ON CONFLICT DO UPDATE.
   - Emits `analytics_snapshot_created` event after each upsert.
   - Enqueues `analytics-intelligence` job for weekly snapshots (or when a single client is targeted).

3. Created `packages/workers/src/workers/analytics-intelligence.ts` (AI invocation point 6):
   - BullMQ worker on `analytics-intelligence` queue.
   - Loads snapshot + client context from DB.
   - Calls `provider.analyzePerformance()` with full metrics and top objections.
   - Writes AI output back to snapshot: `ai_summary`, `ai_key_insights`, `ai_recommended_actions`, `ai_sequence_suggestions`, `ai_health_score`, `ai_analyzed_at`.
   - Emits `analytics_ai_analyzed` event with health_score, insight_count, duration_ms.

4. Updated `packages/workers/src/index.ts`:
   - Imported and registered `createAnalyticsAggregatorWorker` and `createAnalyticsIntelligenceWorker`.
   - Added BullMQ repeatable job: `analytics-aggregate` runs every 15 minutes (`repeat: { every: 15 * 60 * 1000 }`).

## AI invocation point 6

```typescript
provider.analyzePerformance({
  period_start, period_end, client_id,
  metrics: { total_replies, intent_breakdown, reply_rate, booking_rate,
             positive_rate, avg_response_time_hours, sequences_sent },
  top_objections,
  client_context: { company_name, service_description }
})
// → { summary, key_insights[], recommended_actions[], sequence_suggestions[], health_score }
```

## Touched files

- `supabase/migrations/20260528000002_create_analytics_snapshots.sql` (new)
- `packages/workers/src/workers/analytics-aggregator.ts` (new)
- `packages/workers/src/workers/analytics-intelligence.ts` (new)
- `packages/workers/src/index.ts` (updated — imports, worker list, repeatable scheduler)

## Sources

- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §15 Analytics Intelligence
