-- ============================================================
-- 20260523000011: response_queue — Pending Scheduled Responses
-- ============================================================

CREATE TABLE IF NOT EXISTS response_queue (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id              UUID NOT NULL UNIQUE REFERENCES reply_drafts(id) ON DELETE CASCADE,
  lead_id               UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Scheduling
  scheduled_send_at     TIMESTAMPTZ NOT NULL,
  actual_sent_at        TIMESTAMPTZ,
  send_status           TEXT DEFAULT 'pending',

  -- Queue Classification
  queue_type            TEXT NOT NULL,

  -- Send Attempt Tracking
  send_attempts         INTEGER DEFAULT 0,
  last_send_error       TEXT,

  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_response_queue_scheduled_send_at ON response_queue(scheduled_send_at);
CREATE INDEX IF NOT EXISTS idx_response_queue_send_status ON response_queue(send_status);
CREATE INDEX IF NOT EXISTS idx_response_queue_queue_type ON response_queue(queue_type);
CREATE INDEX IF NOT EXISTS idx_response_queue_client_id ON response_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_response_queue_pending ON response_queue(scheduled_send_at)
  WHERE send_status IN ('pending', 'scheduled');
