-- ============================================================
-- 20260523000002: alerts & alert_rules tables
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT          NOT NULL,
  severity        TEXT          NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  client_id       UUID          REFERENCES clients(id),
  title           TEXT          NOT NULL,
  description     TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type       TEXT          UNIQUE NOT NULL,
  enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
  severity        TEXT          NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  threshold       FLOAT,
  destinations    TEXT[]        NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indices for fast filtering
CREATE INDEX IF NOT EXISTS idx_alerts_status      ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity    ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at  ON alerts(created_at DESC);

-- Seed alert rules
INSERT INTO alert_rules (rule_type, enabled, severity, threshold, destinations) VALUES
  ('SLA_BREACH', TRUE, 'critical', 4.0, ARRAY['slack', 'email', 'toast']),
  ('QUEUE_OVERLOAD', TRUE, 'warning', 50.0, ARRAY['slack', 'toast']),
  ('WORKFLOW_FAILURE', TRUE, 'critical', NULL, ARRAY['slack', 'email', 'toast']),
  ('BOUNCE_SPIKE', TRUE, 'critical', 2.0, ARRAY['slack', 'email']),
  ('INBOX_ISSUE', TRUE, 'warning', 80.0, ARRAY['slack', 'toast']),
  ('AI_FAILURE', TRUE, 'warning', 5.0, ARRAY['slack', 'toast'])
ON CONFLICT (rule_type) DO NOTHING;

-- Seed some mock alerts (using first client if exists, otherwise NULL)
DO $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT id INTO v_client_id FROM clients LIMIT 1;

  INSERT INTO alerts (type, severity, client_id, title, description, status, created_at) VALUES
    ('SLA breach', 'critical', v_client_id, 'SLA Breach: reply-review overdue', 'Reply item thread_9f88a1 for client has exceeded the 4-hour SLA window without review action.', 'new', NOW() - INTERVAL '15 minutes'),
    ('queue overload', 'warning', NULL, 'Queue Overload: reply-classification depth', 'The reply-classification BullMQ queue has reached a depth of 68 jobs, exceeding the warning threshold of 50.', 'new', NOW() - INTERVAL '8 minutes'),
    ('workflow failure', 'critical', NULL, 'Workflow Failure: reply-draft_generation job failed', 'Job draft_gen_99a8f failed repeatedly after 3 retries in BullMQ. Redis connection stable.', 'new', NOW() - INTERVAL '2 minutes'),
    ('bounce spike', 'critical', v_client_id, 'Bounce Spike: Acme Corp domain', 'Outbound sending bounce rate for acme-corp.com has spiked to 3.4% in the last 24 hours (threshold 2.0%).', 'acknowledged', NOW() - INTERVAL '1 hour'),
    ('inbox issue', 'warning', v_client_id, 'Inbox Issue: contact@acme.com deliverability', 'Sending reputation score for contact@acme.com dropped to 74% (threshold 80%).', 'new', NOW() - INTERVAL '25 minutes'),
    ('CRM failure', 'warning', v_client_id, 'CRM Integration: HubSpot API error', 'HubSpot OAuth token expired or revoked. Lead status updates failing for the last 40 minutes.', 'resolved', NOW() - INTERVAL '2 hours'),
    ('AI failure', 'warning', NULL, 'AI Provider: Claude-3-5 API timeouts', 'ai_invocations endpoint reports a timeout failure rate of 6.2% over the last 15 minutes (threshold 5.0%).', 'new', NOW() - INTERVAL '12 minutes');
END $$;
