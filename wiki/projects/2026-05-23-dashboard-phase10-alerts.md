# Phase 10 — Alerts Center & Rules Routing Configurations

This document covers the Phase 10 implementation details of the Krionics Operator Dashboard, focusing on automated operations alerts, right-panel overlay sheets, and customizable routing destinations.

## Alert Core Specifications & Severity Levels

The automated system monitors six critical operational anomalies, categorizing them into three severity tiers:

### 1. Severity Tiers
*   `critical` (Red Flag): Incidents requiring immediate operator response to preserve customer success and deliverability bounds.
*   `warning` (Amber Alert): Operational bounds approaching limits that require proactive adjustments.
*   `info` (Blue Badge): Standard logging notifications.

### 2. Monitored Incident Types
*   **SLA Breach (`SLA_BREACH`):** A pending review item has exceeded the configured manual review deadline.
*   **Queue Overload (`QUEUE_OVERLOAD`):** A BullMQ active queue's depth exceeds configured thresholds.
*   **Workflow Failure (`WORKFLOW_FAILURE`):** A background worker task fails after exhausting all automatic retries.
*   **Bounce Spike (`BOUNCE_SPIKE`):** Bounce rates on active domains spike beyond limits.
*   **Inbox Issue (`INBOX_ISSUE`):** Inbox deliverability or reputation scores fall below thresholds.
*   **AI Failure (`AI_FAILURE`):** Provider API failure rates exceed threshold tolerances.

---

## DB Schema Specifications

### `alerts` Table
Tracks active and historical incident records:
```sql
CREATE TABLE IF NOT EXISTS alerts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT          NOT NULL,
  severity        TEXT          NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  client_id       UUID          REFERENCES clients(id),
  title           TEXT          NOT NULL,
  description     TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);
```

### `alert_rules` Table
Stores threshold configurations and dispatch destinations:
```sql
CREATE TABLE IF NOT EXISTS alert_rules (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type       TEXT          UNIQUE NOT NULL,
  enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
  severity        TEXT          NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  threshold       FLOAT,
  destinations    TEXT[]        NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

---

## Slide-over Sheet UX Pattern

When an operator clicks any row in the Alert Center table:
1. A smooth fixed overlay panel (`md:w-[480px]`) slides in from the right edge of the viewport.
2. Displays the incident's full context, suggested resolution playbook, and target resources.
3. Renders a chronologically ordered **State Audit History Log** showing exact timestamps for incident triggers, acknowledgments, and resolutions.
4. Mounts contextual action buttons letting the operator inline acknowledge or resolve the incident directly inside the overlay card.
