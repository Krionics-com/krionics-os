-- ============================================================
-- 000013: ai_prompts + ai_invocations
-- ============================================================

-- ─── ai_prompts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_prompts (
  id                UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = global/shared prompt
  client_id         UUID                REFERENCES clients(id) ON DELETE CASCADE,
  name              TEXT                NOT NULL,
  -- e.g. 'classify-reply-v1', 'generate-draft-v2'
  slug              TEXT                NOT NULL,
  version           INTEGER             NOT NULL DEFAULT 1,
  invocation_type   ai_invocation_type  NOT NULL,
  system_prompt     TEXT                NOT NULL,
  -- Handlebars template with {{variable}} placeholders
  user_template     TEXT                NOT NULL,
  model             TEXT                NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  max_tokens        INTEGER             NOT NULL DEFAULT 1024,
  temperature       NUMERIC(3,2)        NOT NULL DEFAULT 0.30,
  is_active         BOOLEAN             NOT NULL DEFAULT TRUE,
  is_global         BOOLEAN             NOT NULL DEFAULT FALSE,
  -- Regression test inputs/outputs
  test_cases        JSONB               NOT NULL DEFAULT '[]',
  created_by        UUID                REFERENCES operators(id),
  created_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  UNIQUE (slug, version, client_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_slug    ON ai_prompts(slug, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_client  ON ai_prompts(client_id, invocation_type);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_global  ON ai_prompts(invocation_type)
  WHERE is_global = TRUE AND is_active = TRUE;

-- ─── ai_invocations (partitioned) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_invocations (
  id                UUID                NOT NULL DEFAULT gen_random_uuid(),
  client_id         UUID                REFERENCES clients(id),
  prompt_id         UUID                REFERENCES ai_prompts(id),
  prompt_version    INTEGER             NOT NULL,
  invocation_type   ai_invocation_type  NOT NULL,
  trace_id          UUID                NOT NULL,
  -- The entity this invocation was for
  entity_type       TEXT                CHECK (entity_type IN ('reply', 'lead', 'campaign')),
  entity_id         UUID,
  model             TEXT                NOT NULL,
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  latency_ms        INTEGER,
  -- SHA-256 of input for cache key
  input_hash        TEXT,
  cached            BOOLEAN             NOT NULL DEFAULT FALSE,
  success           BOOLEAN             NOT NULL DEFAULT TRUE,
  error_code        TEXT,
  raw_output        JSONB,
  validated_output  JSONB,
  validation_passed BOOLEAN,
  -- Cost in micro-dollars ($0.000001 units)
  cost_usd_micro    INTEGER,
  invoked_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, invoked_at)
) PARTITION BY RANGE (invoked_at);

CREATE TABLE IF NOT EXISTS ai_invocations_2026_05 PARTITION OF ai_invocations
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2026_06 PARTITION OF ai_invocations
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2026_07 PARTITION OF ai_invocations
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2026_08 PARTITION OF ai_invocations
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2026_09 PARTITION OF ai_invocations
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2026_10 PARTITION OF ai_invocations
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2026_11 PARTITION OF ai_invocations
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2026_12 PARTITION OF ai_invocations
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2027_01 PARTITION OF ai_invocations
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2027_02 PARTITION OF ai_invocations
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2027_03 PARTITION OF ai_invocations
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2027_04 PARTITION OF ai_invocations
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE IF NOT EXISTS ai_invocations_2027_05 PARTITION OF ai_invocations
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

CREATE INDEX IF NOT EXISTS idx_ai_inv_trace    ON ai_invocations(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_inv_client   ON ai_invocations(client_id, invoked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_inv_type     ON ai_invocations(invocation_type, invoked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_inv_entity   ON ai_invocations(entity_type, entity_id);
