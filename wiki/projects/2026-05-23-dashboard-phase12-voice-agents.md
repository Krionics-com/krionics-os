# Phase 12 — Voice Agents Call Monitoring

This document covers the Phase 12 implementation details of the Krionics Operator Dashboard, focusing on outbound/inbound live voice calls monitor, multi-speaker colored transcripts scroll, interactive sentiment turn sparklines, and mock scrubber audio player control boxes.

## DB Schema Specifications

### `voice_calls` Table
```sql
CREATE TABLE IF NOT EXISTS voice_calls (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID         REFERENCES leads(id),
  client_id       UUID         REFERENCES clients(id),
  reply_item_id   UUID         REFERENCES reply_items(id),
  duration_seconds INTEGER,
  status          TEXT         NOT NULL DEFAULT 'completed' CHECK (status IN ('in-progress', 'completed', 'escalated', 'failed')),
  sentiment       TEXT         CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  meeting_booked  BOOLEAN      NOT NULL DEFAULT FALSE,
  escalation_note TEXT,
  summary         TEXT,
  transcript      JSONB,
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);
```

### Table Indices
*   `idx_voice_calls_client` on `client_id`
*   `idx_voice_calls_status` on `status`
*   `idx_voice_calls_started` on `started_at DESC`

---

## Front-end & UI Patterns

### 1. Voice Agent Call Monitor (/dashboard/voice)
*   **KPI Summary Chips:** Displays 4 live cards: Active Calls (pulse count), Completed, Escalated, and Meetings Booked.
*   **Live Listing Table:** Renders Call IDs, Lead details, Client accounts, mm:ss durations, status enums, sentiment badges, checkmark booked demo indicator, and relative times.
*   **SWR Live Polling:** Auto-polls every 10 seconds.

### 2. Call Detail view (/dashboard/voice/[callId])
*   **3-Section Visual Layout Grid:**
    1.  **Transcript Viewer (Left 55%):** Displays a scrollable chat-style transcript message list. Speaker roles are color-coded: Agent turns in light terracotta tints, and Lead turns in light gray tints. Includes keyword term searching with instant highlights.
    2.  **Audio Recording Playback (Right Sidebar 45%):** Fully functional interactive mock scrubber player where hitting Play ticks the scrubber seconds along in real-time.
    3.  **Sentiment Breakdown & summaries:** Renders overall sentiments, per-turn visual sentiment mini-walk sparklines, auto summaries, and direct contextual escalation blocks with linked review queue objects.
    4.  **Audit trail:** Links out to system audit log querying this call's ID.
