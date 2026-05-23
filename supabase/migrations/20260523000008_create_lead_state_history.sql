-- ============================================================
-- 20260523000008: lead_state_history — State Transition Audit Trail
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_state_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- State Transition
  from_state            TEXT NOT NULL,
  to_state              TEXT NOT NULL,
  transition_reason     TEXT,

  -- Triggering Event
  triggered_by_event_id UUID REFERENCES events(event_id) ON DELETE SET NULL,
  triggered_by          TEXT,

  -- Actor (if human)
  actor_operator_id     UUID REFERENCES operators(id) ON DELETE SET NULL,

  -- Timing
  transitioned_at       TIMESTAMPTZ DEFAULT NOW(),
  duration_in_state_ms  BIGINT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_state_history_lead_id ON lead_state_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_state_history_client_id ON lead_state_history(client_id);
CREATE INDEX IF NOT EXISTS idx_lead_state_history_from_state ON lead_state_history(from_state);
CREATE INDEX IF NOT EXISTS idx_lead_state_history_to_state ON lead_state_history(to_state);
CREATE INDEX IF NOT EXISTS idx_lead_state_history_transitioned_at ON lead_state_history(transitioned_at DESC);
