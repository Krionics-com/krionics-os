# Phase 13 — Admin Configuration & Feature Flags

This document covers the Phase 13 implementation details of the Krionics Operator Dashboard, focusing on global feature flags toggle pages, multi-provider model configurations parameters forms, dynamic API key eye-reveal masking, and RBAC strict security 403 Gates.

## DB Schema Specifications

### `feature_flags` Table
```sql
CREATE TABLE IF NOT EXISTS feature_flags (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key  TEXT        UNIQUE NOT NULL,
  enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  description  TEXT,
  updated_by   UUID        REFERENCES operators(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `global_config` Table
```sql
CREATE TABLE IF NOT EXISTS global_config (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key   TEXT        UNIQUE NOT NULL,
  value        JSONB       NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Seed Configurations & Default Toggles

*   **auto_send:** `FALSE` — Automatically send approved replies.
*   **voice_agents:** `TRUE` — Enable outbound calling agents.
*   **crm_sync:** `TRUE` — Sync HubSpot deal parameters.
*   **analytics:** `TRUE` — Activate operational charts reporting.
*   **duplicate_prevention:** `TRUE` — Prevent duplicate outbound threads.
*   **webhook_logging:** `TRUE` — Inbound webhook logs.

---

## Front-end & Security RBAC Checks

### 1. Security Gate Control (403 Forbidden Gate)
*   Every endpoint and UI route verifies that the authenticated operator role is `admin` or `super_admin`.
*   Non-admin operator inputs immediately render a premium glassmorphic locked gate alert warning screen blocking interaction.

### 2. Feature Flags Dashboard (/dashboard/admin/features)
*   Interactive multi-column grid toggles. Updates synchronize locally and trigger patch requests with instant user feedback toasts.

### 3. Global configurations form (/dashboard/admin/config)
*   Provides structured forms for API Settings (Anthropic keys, temp sliders, token counts), Retry Policies (exponential/linear parameters), Queue limits warnings, SLAs limits, and Concurrent sending throttles. Hitting Save merges payload configurations and logs to the Phase 11 immutable audit logs!
