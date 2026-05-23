-- ============================================================
-- 20260523000006: enriched_leads — Clay Enrichment Output
-- ============================================================

CREATE TABLE IF NOT EXISTS enriched_leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- LinkedIn Data
  linkedin_profile_url  TEXT,
  linkedin_headline     TEXT,
  linkedin_summary      TEXT,
  linkedin_updated_at   TIMESTAMPTZ,

  -- Company Intelligence
  company_summary       TEXT,
  company_growth_signals TEXT[],
  hiring_signals        TEXT[],
  tech_stack            TEXT[],
  website_summary       TEXT,
  recent_news           TEXT[],

  -- Signal Extraction (AI-processed)
  buying_signals        TEXT[],
  personalization_hooks TEXT[],
  icp_fit_score         FLOAT,
  icp_fit_reasoning     TEXT,
  recommended_depth     TEXT,

  -- Metadata
  enrichment_version    TEXT,
  clay_request_id       TEXT,
  enriched_at           TIMESTAMPTZ DEFAULT NOW(),
  is_stale              BOOLEAN DEFAULT FALSE,
  stale_reason          TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enriched_leads_lead_id ON enriched_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_client_id ON enriched_leads(client_id);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_enriched_at ON enriched_leads(enriched_at DESC);
