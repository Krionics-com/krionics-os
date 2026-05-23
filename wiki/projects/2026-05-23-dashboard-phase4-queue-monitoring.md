# Dashboard Phase 4 — Queue Monitoring & DLQ Inspector

## Overview

Phase 4 adds real-time BullMQ queue monitoring and a Dead Letter Queue (DLQ) inspector to the operator dashboard. Operators can now observe pipeline health, and admins can pause/resume queues, retry failed jobs, and manage dead-letter entries.

## Queue Names & RICR Pipeline Stages

| Queue Name | Pipeline Stage | Purpose |
|---|---|---|
| `reply-ingest` | Ingest | Receives raw replies from webhooks |
| `reply-classification` | Classify | AI intent classification of replies |
| `reply-draft_generation` | Draft | AI-generated response drafts |
| `reply-review_dispatch` | Review | Routes drafts to operator review |
| `reply-scheduled-send` | Send | Dispatches approved replies via Instantly |
| `reply-dlq` | Dead Letter | Captures jobs that exhausted all retries |

## BullMQ Integration

- **Library:** `apps/dashboard/lib/bull-redis.ts`
- Connects to Redis via `REDIS_URL` env var
- Module-level `Map<string, Queue>` cache prevents duplicate Queue instances per request
- Exports: `getQueue(name)`, `QUEUE_NAMES`, `getDLQName()`

## Pages

### Queue Monitor (`/dashboard/queues`)
- Summary cards: Total Pending, Active, Failed, Paused count
- Table: Queue Name, Pending, Active, Failed, Oldest Job Age, Status chip
- Status logic: Green (healthy), Yellow (warning: pending≥50 or failed>0), Red (critical: failed>10 or pending>200)
- Admin actions: Pause, Resume, Retry Failed, Flush (super_admin only with confirmation)
- 10-second SWR polling

### Queue Detail (`/dashboard/queues/[name]`)
- Stats cards: Pending, Active, Completed (24h), Failed (24h), Processing Rate
- Recharts AreaChart: 24h queue depth (mock data with TODO for real metrics)
- Active jobs list (up to 20): ID, name, timestamp, elapsed time
- Failed jobs list (up to 20): ID, error, fail time, retry count

### DLQ Inspector (`/dashboard/dlq`)
- Total failed count badge (30s refresh)
- Table: Job ID, Original Queue, Error (100 char), Retry Count, Failed At
- Filters: by original queue (dropdown), search by error/ID (client-side)
- Pagination: 20 per page
- Bulk actions (admin): Retry All, Discard All with confirmation

### DLQ Job Detail (`/dashboard/dlq/[jobId]`)
- Two-column layout: Job payload (JSON code block) | Error details (message + stack trace)
- Job metadata: attempts, created, processed, finished timestamps
- Actions: Retry Job, Discard Job, Escalate to Admin (Slack webhook)

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/queues` | Any role | List all RICR queues with counts |
| GET | `/api/dashboard/queues/[name]` | Any role | Queue detail with active/failed jobs |
| POST | `/api/dashboard/queues/[name]/pause` | admin+ | Pause a queue |
| POST | `/api/dashboard/queues/[name]/resume` | admin+ | Resume a queue |
| POST | `/api/dashboard/queues/[name]/retry-failed` | admin+ | Retry all failed jobs |
| POST | `/api/dashboard/queues/[name]/flush` | super_admin | Obliterate queue (destructive) |
| GET | `/api/dashboard/dlq` | Any role | List DLQ jobs with pagination |
| GET | `/api/dashboard/dlq/[jobId]` | Any role | Single DLQ job detail |
| POST | `/api/dashboard/dlq/[jobId]/retry` | admin+ | Retry single DLQ job |
| POST | `/api/dashboard/dlq/[jobId]/discard` | admin+ | Remove single DLQ job |

## Phase 3 Stats Mock Replacement

In `apps/dashboard/app/api/dashboard/stats/route.ts`:
- `queue_health` → sum of `waiting` counts across all 5 RICR queues (real BullMQ data)
- `failure_rate` → `(total_failed / total_all) * 100` rounded to 1 decimal (real BullMQ data)
- `ai_cost` → remains mocked at 42.50 (TODO: integrate with AI usage API)

## Dependencies Added

- `bullmq@^5.7.0` (matches `packages/workers`)
- `ioredis@^5.4.1` (matches `packages/workers`)
- `recharts@^2.12.0` (queue depth charts)

## Sources

- [packages/workers/src/queues.ts](../../packages/workers/src/queues.ts) — Queue definitions and DLQ routing
- [apps/dashboard/lib/bull-redis.ts](../../apps/dashboard/lib/bull-redis.ts) — Dashboard BullMQ integration
