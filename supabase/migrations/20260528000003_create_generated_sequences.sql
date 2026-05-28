-- ============================================================
-- 20260528000003: generated_sequences
-- Stores AI-generated email sequences per lead. Written by the
-- sequence-generation worker; read by instantly-push worker.
-- ============================================================

CREATE TABLE IF NOT EXISTS generated_sequences (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id           UUID          REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id               UUID          NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Sequence content
  emails                JSONB         NOT NULL DEFAULT '[]',
  strategy_notes        TEXT,

  -- Generation metadata
  model_used            TEXT,
  prompt_version        TEXT          NOT NULL DEFAULT 'v1',
  icp_fit_score         FLOAT,
  generation_ms         INTEGER,
  trace_id              UUID,

  -- Push state
  status                TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'pushing', 'pushed', 'failed')),
  instantly_campaign_id TEXT,
  instantly_contact_id  TEXT,
  pushed_at             TIMESTAMPTZ,
  push_error            TEXT,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_sequences_lead_id
  ON generated_sequences(lead_id);

CREATE INDEX IF NOT EXISTS idx_generated_sequences_client_id
  ON generated_sequences(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_sequences_status
  ON generated_sequences(status) WHERE status IN ('pending', 'pushing');
