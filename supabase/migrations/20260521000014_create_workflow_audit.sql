-- ============================================================
-- 000014: workflow_executions + audit_log (both partitioned)
-- ============================================================

-- ─── workflow_executions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_executions (
  id                  UUID              NOT NULL DEFAULT gen_random_uuid(),
  workflow_name       TEXT              NOT NULL,
  workflow_version    TEXT,
  client_id           UUID              REFERENCES clients(id),
  trace_id            UUID              NOT NULL,
  trigger_event       TEXT,
  trigger_entity_id   UUID,
  status              execution_status  NOT NULL DEFAULT 'queued',
  queue_name          TEXT              NOT NULL,
  attempt_number      INTEGER           NOT NULL DEFAULT 1,
  max_attempts        INTEGER           NOT NULL DEFAULT 3,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  duration_ms         INTEGER,
  error_message       TEXT,
  error_stack         TEXT,
  input_payload       JSONB,
  output_payload      JSONB,
  emitted_events      JSONB             NOT NULL DEFAULT '[]',
  db_reads            INTEGER           NOT NULL DEFAULT 0,
  db_writes           INTEGER           NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS workflow_executions_2026_05 PARTITION OF workflow_executions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2026_06 PARTITION OF workflow_executions
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2026_07 PARTITION OF workflow_executions
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2026_08 PARTITION OF workflow_executions
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2026_09 PARTITION OF workflow_executions
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2026_10 PARTITION OF workflow_executions
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2026_11 PARTITION OF workflow_executions
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2026_12 PARTITION OF workflow_executions
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2027_01 PARTITION OF workflow_executions
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2027_02 PARTITION OF workflow_executions
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2027_03 PARTITION OF workflow_executions
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2027_04 PARTITION OF workflow_executions
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE IF NOT EXISTS workflow_executions_2027_05 PARTITION OF workflow_executions
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

CREATE INDEX IF NOT EXISTS idx_exec_trace         ON workflow_executions(trace_id);
CREATE INDEX IF NOT EXISTS idx_exec_client_status ON workflow_executions(client_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_workflow      ON workflow_executions(workflow_name, status);
CREATE INDEX IF NOT EXISTS idx_exec_failed        ON workflow_executions(client_id, created_at DESC)
  WHERE status IN ('failed', 'dead_lettered');

-- ─── audit_log (append-only, partitioned) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL     NOT NULL,
  client_id   UUID          REFERENCES clients(id),
  actor_type  TEXT          NOT NULL CHECK (actor_type IN ('operator', 'system', 'workflow', 'ai')),
  actor_id    TEXT,
  action      TEXT          NOT NULL,
  entity_type TEXT          NOT NULL,
  entity_id   UUID          NOT NULL,
  before_state JSONB,
  after_state  JSONB,
  metadata    JSONB         NOT NULL DEFAULT '{}',
  trace_id    UUID,
  occurred_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE IF NOT EXISTS audit_log_2026_05 PARTITION OF audit_log
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_06 PARTITION OF audit_log
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_07 PARTITION OF audit_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_08 PARTITION OF audit_log
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_09 PARTITION OF audit_log
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_10 PARTITION OF audit_log
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_11 PARTITION OF audit_log
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_12 PARTITION OF audit_log
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS audit_log_2027_01 PARTITION OF audit_log
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE IF NOT EXISTS audit_log_2027_02 PARTITION OF audit_log
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE IF NOT EXISTS audit_log_2027_03 PARTITION OF audit_log
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE IF NOT EXISTS audit_log_2027_04 PARTITION OF audit_log
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE IF NOT EXISTS audit_log_2027_05 PARTITION OF audit_log
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

CREATE INDEX IF NOT EXISTS idx_audit_client ON audit_log(client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trace  ON audit_log(trace_id);
