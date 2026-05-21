-- ============================================================
-- 000015: suppression_list + idempotency_keys + config
-- ============================================================

-- ─── suppression_list ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppression_list (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  client_id     UUID        REFERENCES clients(id),  -- NULL = global suppression
  reason        TEXT        NOT NULL CHECK (reason IN ('UNSUBSCRIBE','BOUNCE','HOSTILE','MANUAL')),
  reply_item_id UUID        REFERENCES reply_items(id),
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'system' or operator id
  suppressed_by TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suppression_email     ON suppression_list(email);
CREATE INDEX IF NOT EXISTS idx_suppression_client    ON suppression_list(client_id);

-- ─── idempotency_keys ───────────────────────────────────────────────────────
-- Prevent double-processing of webhook replays. TTL enforced by cron job.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT        PRIMARY KEY,
  entity_id   UUID        NOT NULL,
  entity_type TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
-- Cron: DELETE FROM idempotency_keys WHERE expires_at < NOW();  (run hourly)

-- ─── config ─────────────────────────────────────────────────────────────────
-- Runtime configuration loaded by workers. Changes cache-busted on write.

CREATE TABLE IF NOT EXISTS config (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

-- Seed default values
INSERT INTO config (key, value, description, updated_by) VALUES
  ('classification.confidence.auto_route',   '"0.85"', 'Min confidence for auto-routing without human review',  'seed'),
  ('classification.confidence.soft_route',   '"0.65"', 'Min confidence for soft routing (flags requires_human)', 'seed'),
  ('classification.prompt_version',          '"v1.0"', 'Active classification prompt version',                  'seed'),
  ('draft.prompt_version',                   '"v1.0"', 'Active draft generation prompt version',                'seed'),
  ('send.default_delay_minutes',             '"15"',   'Default delay before sending approved drafts',          'seed'),
  ('send.business_hours_only',               '"true"', 'Only send during 9-5 prospect timezone',                'seed'),
  ('send.business_hours_start',              '"9"',    'Business hours start (hour, 0-23)',                     'seed'),
  ('send.business_hours_end',                '"17"',   'Business hours end (hour, 0-23)',                       'seed'),
  ('review.sla_hours_default',               '"4"',    'Default SLA hours for draft review',                    'seed'),
  ('review.escalation_threshold_minutes',    '"30"',   'Minutes before SLA breach to alert operator',           'seed'),
  ('queue.enrichment.max_depth_alert',       '"500"',  'Enrichment queue depth that triggers Slack warning',    'seed'),
  ('queue.classify.max_depth_alert',         '"50"',   'Classification queue depth alert threshold',            'seed'),
  ('queue.approval.max_depth_alert',         '"20"',   'Approval queue depth alert threshold',                  'seed'),
  ('queue.retry.max_depth_alert',            '"50"',   'Retry queue depth alert threshold',                     'seed'),
  ('slack.channel_review_alerts',            '"#reply-review"',     'Slack channel for new review items',       'seed'),
  ('slack.channel_sent_alerts',              '"#pipeline-activity"','Slack channel for sent confirmations',     'seed'),
  ('slack.channel_system_alerts',            '"#system-alerts"',    'Slack channel for system failures',        'seed'),
  ('ai.default_model',                       '"claude-sonnet-4-20250514"', 'Default Claude model for all AI invocations', 'seed'),
  ('ai.max_retries',                         '"3"',    'Max retries for Claude API calls',                      'seed'),
  ('ai.cache_ttl_classification_seconds',    '"3600"', 'Cache TTL for classification outputs',                  'seed'),
  ('ai.cache_ttl_draft_seconds',             '"300"',  'Cache TTL for draft generation outputs',                'seed'),
  ('ai.cache_ttl_personalization_seconds',   '"86400"','Cache TTL for personalization line outputs',            'seed')
ON CONFLICT (key) DO NOTHING;
