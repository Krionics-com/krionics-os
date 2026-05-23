-- ============================================================
-- 20260523000010: timing_rules — Response Delay Configuration
-- ============================================================

CREATE TABLE IF NOT EXISTS timing_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  intent                TEXT NOT NULL,

  -- Delay Window (in minutes)
  delay_min_minutes     INTEGER NOT NULL,
  delay_max_minutes     INTEGER NOT NULL,

  -- Business Hours
  enforce_business_hours BOOLEAN DEFAULT TRUE,
  business_hours_start  TIME DEFAULT '07:00:00',
  business_hours_end    TIME DEFAULT '22:00:00',
  timezone              TEXT DEFAULT 'America/New_York',

  -- Lead Timezone Handling
  send_in_prospect_timezone BOOLEAN DEFAULT TRUE,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (client_id, intent)
);

CREATE INDEX IF NOT EXISTS idx_timing_rules_client_id ON timing_rules(client_id);
