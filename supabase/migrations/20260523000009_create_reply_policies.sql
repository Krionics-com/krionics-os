-- ============================================================
-- 20260523000009: reply_policies — Automation Routing Rules
-- ============================================================

CREATE TABLE IF NOT EXISTS reply_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  intent                TEXT NOT NULL,

  -- Action based on automation level
  action_level_1        TEXT NOT NULL,
  action_level_2        TEXT NOT NULL,
  action_level_3        TEXT NOT NULL,

  -- Confidence-based override
  confidence_threshold  FLOAT DEFAULT 0.85,

  -- Special routing
  escalation_keywords   TEXT[],
  auto_suppress_phrases TEXT[],

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (client_id, intent)
);

CREATE INDEX IF NOT EXISTS idx_reply_policies_client_id ON reply_policies(client_id);
