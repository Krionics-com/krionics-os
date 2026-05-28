# Ingest Record: Module 4 — Apollo Lead Acquisition

Date: 2026-05-28
Branch: feat/module-4-apollo-lead-acquisition

## Actions taken

1. Extended `packages/workers/src/env.ts` with apolloApiKey, clayApiKey, clayWebhookSecret, calcomWebhookSecret, hubspotAccessToken, pipedriveApiKey (all optional — only required at runtime when the respective feature is used).

2. Added 7 new queues to `packages/workers/src/queues.ts`: apolloImportQueue, clayEnrichmentQueue, signalExtractionQueue, crmSyncQueue, analyticsAggregateQueue, analyticsIntelligenceQueue, bookingReminderQueue.

3. Created `packages/workers/src/public.ts` — proper library exports barrel. Updated `package.json` main/types to point to `dist/public.js` so the dashboard can `import { apolloImportQueue } from "@krionics/workers"`.

4. Created `packages/workers/src/clients/apollo.ts` — typed Apollo API client wrapping `POST /v1/mixed_people/search`.

5. Created `packages/workers/src/workers/apollo-import.ts`:
   - Calls Apollo API with configurable search params
   - Upserts each person into `leads` table (ON CONFLICT client_id+email DO UPDATE)
   - Detects new inserts via `(xmax = 0)` Postgres trick
   - Emits `leads_imported` event for batches of new leads
   - Enqueues `clay-enrichment` job for each new lead

6. Created `apps/dashboard/app/api/apollo/import/route.ts` — POST endpoint that validates request and enqueues an apollo_import job. Returns 202 Accepted with jobId.

7. Updated dashboard `lib/queues.ts` to export all new queues.

8. Updated `.env.example` with APOLLO_API_KEY, CLAY_API_KEY, CLAY_WEBHOOK_SECRET, CALCOM_WEBHOOK_SECRET, PIPEDRIVE_API_KEY.

## Touched files

- `packages/workers/src/env.ts`
- `packages/workers/src/queues.ts`
- `packages/workers/src/public.ts` (new)
- `packages/workers/src/clients/apollo.ts` (new)
- `packages/workers/src/workers/apollo-import.ts` (new)
- `packages/workers/src/index.ts`
- `packages/workers/package.json`
- `apps/dashboard/app/api/apollo/import/route.ts` (new)
- `apps/dashboard/lib/queues.ts`
- `.env.example`

## Sources

- Apollo API v1 docs (people search endpoint)
- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §5 Lead Acquisition
