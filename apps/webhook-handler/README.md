# Webhook Handler

Receives Instantly.ai webhooks and enqueues reply ingestion jobs for the RICR pipeline.

## Setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Start the server:

```bash
node --env-file=.env --import tsx/esm src/server.ts
```

## Endpoints

- `POST /webhooks/instantly`
  - Validates signature via `INSTANTLY_WEBHOOK_SECRET`.
  - Enqueues job to `reply-ingest` queue.
  - Returns `200` with `status: queued` or `status: duplicate`.

- `GET /health`
  - Returns Redis + DB connectivity status.

## Local test

From repo root:

```bash
node --env-file=.env --import tsx/esm scripts/webhook-test.ts
```
