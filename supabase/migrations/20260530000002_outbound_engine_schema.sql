-- Outbound engine configuration columns on clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS apollo_config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS clay_config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sequence_config      JSONB NOT NULL DEFAULT '{"steps":[{"step":1,"name":"Initial","delay_days":0},{"step":2,"name":"Follow-up 1","delay_days":3},{"step":3,"name":"Follow-up 2","delay_days":7},{"step":4,"name":"Breakup","delay_days":14}]}'::jsonb,
  ADD COLUMN IF NOT EXISTS instantly_config     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS review_mode          TEXT NOT NULL DEFAULT 'human'
                           CHECK (review_mode IN ('human', 'ai', 'auto')),
  ADD COLUMN IF NOT EXISTS outbound_active      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outbound_launched_at TIMESTAMPTZ;

-- Outbound review and sequence columns on leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS enriched_data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lead_sequence        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_status        TEXT NOT NULL DEFAULT 'pending'
                           CHECK (review_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_notes         TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by          UUID REFERENCES operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS instantly_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS suppressed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppressed_reason    TEXT;

-- Dedup indexes (client-scoped — same lead can exist for multiple clients)
CREATE UNIQUE INDEX IF NOT EXISTS leads_client_apollo_id_idx
  ON leads (client_id, apollo_id)
  WHERE apollo_id IS NOT NULL;

-- Index for review queue queries
CREATE INDEX IF NOT EXISTS leads_review_status_idx
  ON leads (client_id, review_status)
  WHERE review_status = 'pending';

-- Index for outbound active clients
CREATE INDEX IF NOT EXISTS clients_outbound_active_idx
  ON clients (outbound_active)
  WHERE outbound_active = true;
