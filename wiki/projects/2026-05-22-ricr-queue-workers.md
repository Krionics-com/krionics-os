# RICR Queue Workers

Summary
- Added BullMQ-based queue workers for reply ingestion, classification, draft generation, and review dispatch.
- Implemented PostgreSQL writes for raw replies, reply_items, classifications, drafts, review_items, and scheduled_sends.
- Added worker scaffolding, shared queue config, and unit tests for core routing helpers.

Key points
- Workers honor idempotency_keys for webhook replay protection and propagate trace_id.
- Classification routes to draft generation or review dispatch based on confidence thresholds.
- Review dispatch auto-schedules sends for higher automation levels and queues human review for others.

Sources
- [raw/sources/2026-05-20-krionics-os-reply-subsystem.md](../../raw/sources/2026-05-20-krionics-os-reply-subsystem.md)
- [raw/sources/2026-05-20-krionics-os-blueprint.md](../../raw/sources/2026-05-20-krionics-os-blueprint.md)

## Implementation Details

- Packages added/modified:
	- [packages/workers](packages/workers) — new worker package containing queue definitions, worker implementations, and tests.
	- [packages/ai-provider](packages/ai-provider) — provider factory updated to support `openai` in addition to `claude`.
	- [packages/schema](packages/schema) — Zod schemas used to validate AI inputs/outputs.

- Key files (worker package):
	- [packages/workers/src/queues.ts](packages/workers/src/queues.ts) — BullMQ queues and Redis connection (`REDIS_URL` expected).
	- [packages/workers/src/index.ts](packages/workers/src/index.ts) — worker bootstrap that creates ingest/classify/draft/review workers.
	- [packages/workers/src/workers/ingest.ts](packages/workers/src/workers/ingest.ts) — webhook ingest handling, idempotency, raw_replies + reply_items writes.
	- [packages/workers/src/workers/classify.ts](packages/workers/src/workers/classify.ts) — calls AI provider, inserts `reply_classifications`, routes next jobs.
	- [packages/workers/src/workers/draft.ts](packages/workers/src/workers/draft.ts) — generates drafts and stores `reply_drafts`.
	- [packages/workers/src/workers/review-dispatch.ts](packages/workers/src/workers/review-dispatch.ts) — routes drafts to scheduled sends or human review.

## Environment & Runtime Notes

- Required `.env` variables (subset):
	- `DATABASE_URL` — Postgres connection (we used the Supabase pooler URL during development).
	- `REDIS_URL` or `UPSTASH_REDIS_URL` — BullMQ requires a TCP/SSL Redis URL (e.g. `rediss://...`). `UPSTASH_REDIS_REST_URL` is REST-only and will NOT work.
	- `AI_PROVIDER` — `openai` or `claude`.
	- `OPENAI_API_KEY`, `OPENAI_MODEL` (if `openai` selected) or `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (if `claude`).

## How to run locally

1. Install workspace deps:

```bash
npm install
```

2. Start workers (dev mode — uses tsx import):

```bash
node --env-file=.env --import tsx/esm packages/workers/src/index.ts
```

3. Run the integration smoke test (seed + ingest job):

```bash
node --env-file=.env --import tsx/esm scripts/integration/test-ingest.ts
```

4. Check classification/draft state:

```bash
node --env-file=.env --import tsx/esm scripts/integration/check-class-draft.ts
```

## Integration notes & gotchas encountered

- DNS/IPv6: the Supabase DB host returned only an AAAA record in one environment; switching to the Supabase session pooler `DATABASE_URL` avoided IPv4 resolution failures in Node.
- Redis: the Upstash REST URL is not usable by BullMQ. A TCP Redis URL (`rediss://...`) must be present in `REDIS_URL` or `UPSTASH_REDIS_URL` for workers to start.
- Queue name restriction: BullMQ queue names cannot contain `:` characters — queue names were adjusted to use `-` (e.g. `reply-ingest`). See [packages/workers/src/queues.ts](packages/workers/src/queues.ts).
- OpenAI quota: during integration, OpenAI returned a 429 `insufficient_quota`. To continue testing we inserted synthetic classification + draft rows and advanced the `reply_items` state; see `scripts/integration/insert-fake-class-draft.ts` for the helper used.

## Bug fixes

- Added missing reply intents (`BOUNCE_OOO`, `HOSTILE`) to schema and classifier routing.
- Draft generation now uses original cold email from raw payload and skips AI draft creation when calendly_link is missing (routes to human review).
- Review dispatch now fails fast when sending inbox is unknown and enqueues scheduled sends for delivery.
- Added scheduled send worker to dispatch replies via Instantly and update send state transitions.

## Tests

- Unit tests: `npm -w @krionics/workers run test` — small routing/utility tests passed during development.
- Integration smoke test: `scripts/integration/test-ingest.ts` enqueued a webhook payload and validated a `reply_items` record moved to `CLASSIFYING` and then to `PENDING_REVIEW` when synthetic AI output was inserted.

## Next steps

- Add end-to-end classification/draft tests using a paid AI key or a local mock server to avoid quota rate limits.
- Implement scheduled send worker (consume `scheduled_sends` and call Instantly API).
- Add n8n nodes or webhook handlers to forward inbound webhooks into `ingestQueue`.
- Harden idempotency and DLQ monitoring (alerts + Slack integration).

## Webhook trigger layer

- Added an Express webhook handler in `apps/webhook-handler` that validates Instantly HMAC signatures, performs idempotency checks, and enqueues reply ingestion jobs to `reply-ingest`.
- Includes `/health` endpoint for Redis + DB connectivity, structured JSON logging, and graceful shutdown.
