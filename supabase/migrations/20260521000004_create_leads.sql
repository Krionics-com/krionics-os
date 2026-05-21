-- ============================================================
-- 000004: leads (Universal Lead Schema)
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id           UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Identity
  email                 TEXT        NOT NULL,
  first_name            TEXT,
  last_name             TEXT,
  phone                 TEXT,
  linkedin_url          TEXT,

  -- Company
  company               TEXT,
  company_domain        TEXT,
  company_industry      TEXT,
  company_size          TEXT,
  company_revenue       TEXT,
  company_location      TEXT,

  -- Role
  title                 TEXT,
  seniority             TEXT,

  -- Source
  source                TEXT        NOT NULL DEFAULT 'apollo',
  apollo_id             TEXT,
  instantly_lead_id     TEXT,

  -- Enrichment (raw Clay output)
  clay_enrichment       JSONB       NOT NULL DEFAULT '{}',
  -- AI-generated personalization context
  personalization_line  TEXT,
  lqs_score             NUMERIC(4,3),
  lqs_computed_at       TIMESTAMPTZ,
  personalization_depth TEXT        DEFAULT 'L2'
                                    CHECK (personalization_depth IN ('L1','L2','L3','L4')),

  -- State machine
  lead_status           lead_status NOT NULL DEFAULT 'raw_imported',
  prev_status           lead_status,
  status_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Suppression
  is_suppressed         BOOLEAN     NOT NULL DEFAULT FALSE,
  suppression_reason    TEXT,
  suppressed_at         TIMESTAMPTZ,

  -- CRM
  crm_contact_id        TEXT,
  crm_synced            BOOLEAN     NOT NULL DEFAULT FALSE,
  crm_synced_at         TIMESTAMPTZ,

  -- Key timestamps
  last_contacted_at     TIMESTAMPTZ,
  replied_at            TIMESTAMPTZ,
  unsubscribed_at       TIMESTAMPTZ,
  meeting_booked_at     TIMESTAMPTZ,

  -- Misc
  metadata              JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_client_id         ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id       ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_status       ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_email             ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_status   ON leads(campaign_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_client_email      ON leads(client_id, email);
-- Partial index for active leads needing action
CREATE INDEX IF NOT EXISTS idx_leads_pending_review    ON leads(client_id, replied_at)
  WHERE lead_status IN ('reply_received', 'positive_reply', 'faq_reply', 'objection_reply');
