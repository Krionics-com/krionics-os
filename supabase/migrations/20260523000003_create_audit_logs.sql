-- ============================================================
-- 20260523000003: audit_logs table
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id    UUID         REFERENCES operators(id),
  action         TEXT         NOT NULL,
  resource_type  TEXT         NOT NULL,
  resource_id    TEXT,
  summary        TEXT         NOT NULL,
  before_value   JSONB,
  after_value    JSONB,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_operator  ON audit_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON audit_logs(created_at DESC);

-- Seed mock audit logs
DO $$
DECLARE
  v_op_id UUID;
  v_client_id UUID;
BEGIN
  SELECT id INTO v_op_id FROM operators LIMIT 1;
  SELECT id INTO v_client_id FROM clients LIMIT 1;

  INSERT INTO audit_logs (operator_id, action, resource_type, resource_id, summary, before_value, after_value, created_at) VALUES
    (v_op_id, 'approved', 'reply', 'reply_item_11a8f', 'Approved draft reply for Sarah Chen at Acme Corp', '{"draft": "Hello Sarah, let''s connect...", "status": "PENDING_REVIEW"}'::jsonb, '{"draft": "Hello Sarah, let''s connect...", "status": "APPROVED"}'::jsonb, NOW() - INTERVAL '4 minutes'),
    (v_op_id, 'rejected', 'reply', 'reply_item_22b9f', 'Rejected draft reply for John Smith (too casual)', '{"draft": "Hey John! Dynamic sales intro...", "status": "PENDING_REVIEW"}'::jsonb, '{"draft": "Hey John! Dynamic sales intro...", "status": "REJECTED"}'::jsonb, NOW() - INTERVAL '12 minutes'),
    (v_op_id, 'config_changed', 'client', v_client_id::text, 'Updated campaign SLA policy to 2 hours for client Acme Corp', '{"sla_hours": 4}'::jsonb, '{"sla_hours": 2}'::jsonb, NOW() - INTERVAL '35 minutes'),
    (v_op_id, 'acknowledged', 'alert', 'alert_90a88', 'Acknowledged critical SLA breach alert for reply-review overload', '{"status": "new"}'::jsonb, '{"status": "acknowledged"}'::jsonb, NOW() - INTERVAL '50 minutes'),
    (v_op_id, 'resolved', 'alert', 'alert_81b99', 'Resolved CRM connection error for Acme Corp HubSpot sync', '{"status": "acknowledged"}'::jsonb, '{"status": "resolved"}'::jsonb, NOW() - INTERVAL '1 hour'),
    (v_op_id, 'regenerated', 'reply', 'reply_item_33c9f', 'Regenerated draft reply for David Miller using aggressive prompt style', '{"draft": "Hi David, thanks..."}'::jsonb, '{"draft": "Hello David, our platform scales..."}'::jsonb, NOW() - INTERVAL '2 hours'),
    (v_op_id, 'created', 'prompt', 'prompt_55x', 'Created new global cold outreach prompt for enterprise tech client segment', NULL, '{"name": "Enterprise Cold Outreach v2", "model": "claude-3-5"}'::jsonb, NOW() - INTERVAL '4 hours'),
    (v_op_id, 'deleted', 'operator', 'op_temp_99', 'Removed temporary operations assistant from operators list', '{"email": "temp@krionics.com", "role": "operator"}'::jsonb, NULL, NOW() - INTERVAL '6 hours'),
    (v_op_id, 'escalated', 'reply', 'reply_item_44d9f', 'Escalated reply item thread_abc to administrator review', '{"status": "PENDING_REVIEW"}'::jsonb, '{"status": "ESCALATED"}'::jsonb, NOW() - INTERVAL '8 hours'),
    (v_op_id, 'edited', 'prompt', 'prompt_66y', 'Edited model temperature configuration from 0.7 to 0.4', '{"temperature": 0.7}'::jsonb, '{"temperature": 0.4}'::jsonb, NOW() - INTERVAL '10 hours'),
    (v_op_id, 'config_changed', 'campaign', 'camp_32a', 'Paused Outreach warmup campaign due to bounce threshold crossing warnings', '{"status": "active"}'::jsonb, '{"status": "paused"}'::jsonb, NOW() - INTERVAL '1 day'),
    (v_op_id, 'approved', 'reply', 'reply_item_55e9f', 'Approved draft reply for Lisa Zhang at FinTech Solutions', '{"draft": "Hi Lisa...", "status": "PENDING_REVIEW"}'::jsonb, '{"draft": "Hi Lisa...", "status": "APPROVED"}'::jsonb, NOW() - INTERVAL '1 day');
END $$;
