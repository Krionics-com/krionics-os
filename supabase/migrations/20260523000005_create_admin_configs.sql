-- ============================================================
-- 20260523000005: feature_flags and global_config DDL and Seeds
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key  TEXT        UNIQUE NOT NULL,
  enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  description  TEXT,
  updated_by   UUID        REFERENCES operators(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_config (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key   TEXT        UNIQUE NOT NULL,
  value        JSONB       NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed feature flags defaults
INSERT INTO feature_flags (feature_key, enabled, description) VALUES
  ('auto_send', FALSE, 'Automatically send approved draft replies directly without manual operator dispatch clicks.'),
  ('voice_agents', TRUE, 'Enable live outbound voice calling agents for immediate positive reply scheduling.'),
  ('crm_sync', TRUE, 'Synchronize contact pipelines, status indicators, and logged calls directly to HubSpot or Salesforce.'),
  ('analytics', TRUE, 'Activate operational leaderboards, quality trends, and LLM consumption metric reporting.'),
  ('duplicate_prevention', TRUE, 'Enforce strict filters preventing multiple duplicate outreach threads to the same inbox.'),
  ('webhook_logging', TRUE, 'Log inbound event webhooks details to the database for developers debugging.')
ON CONFLICT (feature_key) DO NOTHING;

-- Seed default global configs
INSERT INTO global_config (config_key, value) VALUES
  ('api_provider', '{
    "anthropic_api_key": "sk-ant-mockkey1234567890abcdefghijklmnopqrstuvwxyz",
    "model": "claude-3-5-sonnet",
    "temperature": 0.7,
    "max_tokens": 1000
  }'::jsonb),
  ('retry_policy', '{
    "max_retries": 3,
    "backoff_strategy": "exponential",
    "initial_backoff_seconds": 1
  }'::jsonb),
  ('queue_limits', '{
    "depth_warning_threshold": 100,
    "max_active_jobs": 50,
    "failed_discard_after": 5
  }'::jsonb),
  ('global_sla', '{
    "review_sla_hours": 4,
    "escalation_threshold_minutes": 30
  }'::jsonb),
  ('sending_limits', '{
    "max_emails_per_inbox_day": 500,
    "max_emails_per_domain_day": 5000,
    "concurrent_sending_jobs": 10
  }'::jsonb)
ON CONFLICT (config_key) DO NOTHING;
