# Ingest Record: Module 5 — Clay Enrichment Workflow

Date: 2026-05-28
Branch: feat/module-5-clay-enrichment

## Actions taken

1. Created `packages/workers/src/clients/clay.ts` — typed Clay API client with `triggerClayEnrichment()`. Sends lead data to Clay with a callback_url pointing to `/api/webhooks/clay`. Returns request_id for tracking.

2. Created `packages/workers/src/workers/clay-enrichment.ts`:
   - Loads lead from DB
   - Emits `enrichment_queued` event
   - Calls `triggerClayEnrichment()` to kick off async enrichment
   - Clay will POST back to our webhook when done

3. Created `packages/workers/src/workers/signal-extraction.ts` (AI invocation point 1):
   - Loads lead + enriched_lead data from DB
   - Calls `provider.extractSignals()` (Module 0)
   - Writes icp_fit_score, icp_fit_reasoning, buying_signals, personalization_hooks, recommended_depth back to `enriched_leads`
   - Emits `enrichment_completed` event with icp_fit_score and signal_count

4. Created `apps/dashboard/app/api/webhooks/clay/route.ts`:
   - Optional HMAC-SHA256 signature verification (skipped if CLAY_WEBHOOK_SECRET not set)
   - Upserts Clay payload into `enriched_leads` (ON CONFLICT lead_id)
   - Enqueues `signal_extraction` job for AI processing

## Data flow

```
apollo-import → clayEnrichmentQueue
             → clay-enrichment worker → Clay API (async)
             → Clay POSTs to /api/webhooks/clay
             → enriched_leads upsert
             → signalExtractionQueue
             → signal-extraction worker → extractSignals() AI
             → enriched_leads.icp_fit_score, buying_signals updated
             → enrichment_completed event
```

## Touched files

- `packages/workers/src/clients/clay.ts` (new)
- `packages/workers/src/workers/clay-enrichment.ts` (new)
- `packages/workers/src/workers/signal-extraction.ts` (new)
- `packages/workers/src/index.ts`
- `apps/dashboard/app/api/webhooks/clay/route.ts` (new)

## Sources

- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §6 Lead Enrichment, §11.1 AI Invocation Point 1 (signal extraction)
