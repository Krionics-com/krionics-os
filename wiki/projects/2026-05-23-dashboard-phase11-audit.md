# Phase 11 — Immutable Audit Logs

This document covers the Phase 11 implementation details of the Krionics Operator Dashboard, focusing on immutable audit logs tracking, search capabilities, before/after JSON diffs, and client-side CSV downloads.

## DB Schema Specifications

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id    UUID         REFERENCES operators(id),
  action         TEXT         NOT NULL,
  resource_type  TEXT         NOT NULL,
  resource_id    TEXT,
  summary        TEXT         NOT NULL,
  before_value   JSONB,
  after_value    JSONB,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### Table Indices
*   `idx_audit_logs_operator` on `operator_id`
*   `idx_audit_logs_action` on `action`
*   `idx_audit_logs_created` on `created_at DESC`

---

## `recordAudit` Middleware

Exposes a thread-safe database insertion helper under `apps/dashboard/lib/audit.ts`:
```typescript
recordAudit({
  operator_id: string,
  action: string,
  resource_type: string,
  resource_id: string,
  summary: string,
  before_value?: object,
  after_value?: object
})
```

### Wired Endpoints
The following endpoints record state changes:
1.  `POST /api/dashboard/review/[id]/approve` (action: `'approved'`)
2.  `POST /api/dashboard/review/[id]/reject` (action: `'rejected'`)
3.  `POST /api/dashboard/alerts/[id]/acknowledge` (action: `'acknowledged'`)
4.  `POST /api/dashboard/alerts/[id]/resolve` (action: `'resolved'`)

---

## Front-end & UX Patterns

### 1. Advanced Querying & Filters
*   Full-text search on log summaries.
*   Operators selection dropdown synced dynamically.
*   Incident types and Date Range boundary pickers (from/to, defaults to 7 days).
*   SWR Polling updates every 30 seconds.

### 2. Client-side CSV Download
Leverages native `Blob` and `URL.createObjectURL` methods:
*   Exports currently active filtered logs into CSV files instantly.
*   No additional network loads or dedicated backend handlers needed.

### 3. Expandable JSON Diff Analysis
*   Clicking a log entry expands a state diff analysis card in-place.
*   Renders side-by-side `<pre>` codes blocks matching before and after JSON objects.
*   Utilizes green text and background overlays for current values, and red ones for historical state.
