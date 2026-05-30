-- Extend clients table for onboarding wizard v2

-- Add new service type values (outbound/inbound/hybrid align with product direction)
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'outbound';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'inbound';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'hybrid';

-- Company & contact detail columns
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS website_url           TEXT,
  ADD COLUMN IF NOT EXISTS industry              TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone         TEXT,
  ADD COLUMN IF NOT EXISTS contact_role          TEXT,
  ADD COLUMN IF NOT EXISTS company_description   TEXT,
  ADD COLUMN IF NOT EXISTS value_proposition     TEXT;

-- AI configuration columns
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ai_tone               TEXT NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS ai_knowledge_base     TEXT,
  ADD COLUMN IF NOT EXISTS forbidden_claims      TEXT;

-- Infrastructure strategy column
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS infrastructure_strategy TEXT
    CHECK (infrastructure_strategy IN ('existing', 'client_owned'));
