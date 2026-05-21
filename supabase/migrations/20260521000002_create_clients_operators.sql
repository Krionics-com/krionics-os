-- ============================================================
-- 000002: clients + operators (base tenant and team tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT        UNIQUE NOT NULL,
  company_name      TEXT        NOT NULL,
  contact_email     TEXT        NOT NULL,
  contact_name      TEXT        NOT NULL,
  timezone          TEXT        NOT NULL DEFAULT 'America/New_York',
  service_type      service_type NOT NULL DEFAULT 'cold_outbound',
  status            client_status NOT NULL DEFAULT 'onboarding',
  tier              TEXT        NOT NULL DEFAULT 'founding',
  automation_level  INTEGER     NOT NULL DEFAULT 1 CHECK (automation_level IN (1,2,3)),
  mrr_usd           INTEGER     NOT NULL DEFAULT 0,
  setup_fee_usd     INTEGER     NOT NULL DEFAULT 0,
  contract_start    DATE,
  contract_end      DATE,
  -- Runtime config blob: SLA hours, review thresholds, approved sender list, webhook secrets
  config            JSONB       NOT NULL DEFAULT '{}',
  -- CRM integration
  crm_type          TEXT        CHECK (crm_type IN ('hubspot', 'pipedrive', 'salesforce', 'ghl', 'none')),
  crm_config        JSONB       NOT NULL DEFAULT '{}',
  -- Knowledge assets for AI generation
  sales_lead_name   TEXT,
  service_description TEXT,
  icp_description   TEXT,
  positioning_statement TEXT,
  calendly_link     TEXT,
  -- Slack
  slack_webhook_url TEXT,
  slack_channel_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_slug   ON clients(slug);

-- ─── Operators ──────────────────────────────────────────────────────────────
-- Internal Krionics team members who interact with the review system.

CREATE TABLE IF NOT EXISTS operators (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT    UNIQUE NOT NULL,
  name           TEXT    NOT NULL,
  role           TEXT    NOT NULL DEFAULT 'reviewer'
                         CHECK (role IN ('admin', 'reviewer', 'viewer')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  client_access  UUID[]  DEFAULT NULL,  -- NULL = all clients
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
