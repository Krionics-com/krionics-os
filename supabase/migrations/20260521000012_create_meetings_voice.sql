-- ============================================================
-- 000012: meetings + voice_calls
-- ============================================================

-- ─── voice_calls ────────────────────────────────────────────────────────────
-- Created before meetings so meetings can FK to it.

CREATE TABLE IF NOT EXISTS voice_calls (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vapi_call_id        TEXT          UNIQUE,
  retell_call_id      TEXT          UNIQUE,
  phone_number        TEXT          NOT NULL,
  caller_name         TEXT,
  caller_company      TEXT,
  direction           TEXT          NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  outcome             call_outcome,
  duration_seconds    INTEGER,
  started_at          TIMESTAMPTZ   NOT NULL,
  ended_at            TIMESTAMPTZ,
  transcript          TEXT,
  -- AI-generated post-call summary
  summary             TEXT,
  recording_url       TEXT,
  agent_id            TEXT,
  crm_contact_id      TEXT,
  crm_synced          BOOLEAN       NOT NULL DEFAULT FALSE,
  meeting_booked      BOOLEAN       NOT NULL DEFAULT FALSE,
  escalated           BOOLEAN       NOT NULL DEFAULT FALSE,
  flagged_for_review  BOOLEAN       NOT NULL DEFAULT FALSE,
  metadata            JSONB         NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_client   ON voice_calls(client_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_outcome  ON voice_calls(outcome, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_flagged  ON voice_calls(client_id)
  WHERE flagged_for_review = TRUE;

-- ─── meetings ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meetings (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID            NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id             UUID            REFERENCES leads(id),
  campaign_id         UUID            REFERENCES campaigns(id),
  voice_call_id       UUID            REFERENCES voice_calls(id),
  -- External booking platform IDs
  calendly_event_id   TEXT,
  cal_booking_id      TEXT,
  status              meeting_status  NOT NULL DEFAULT 'scheduled',
  scheduled_at        TIMESTAMPTZ     NOT NULL,
  duration_minutes    INTEGER         NOT NULL DEFAULT 30,
  attendee_email      TEXT            NOT NULL,
  attendee_name       TEXT,
  attendee_company    TEXT,
  meeting_type        TEXT            CHECK (meeting_type IN ('discovery', 'demo', 'qualification', 'follow_up')),
  source              TEXT            NOT NULL CHECK (source IN ('cold_email', 'voice_agent', 'inbound')),
  -- CRM
  crm_deal_id         TEXT,
  crm_synced          BOOLEAN         NOT NULL DEFAULT FALSE,
  -- Lifecycle
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_at        TIMESTAMPTZ,
  notes               TEXT,
  metadata            JSONB           NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_client   ON meetings(client_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_lead     ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status   ON meetings(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_campaign ON meetings(campaign_id);
