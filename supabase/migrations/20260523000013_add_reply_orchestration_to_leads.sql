-- ============================================================
-- 20260523000013: Add Reply Orchestration Columns to Leads
-- ============================================================

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS thread_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS assigned_to_operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS routing_policy TEXT,
ADD COLUMN IF NOT EXISTS first_reply_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_booking_link_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_thread_id ON leads(thread_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_operator ON leads(assigned_to_operator_id)
  WHERE assigned_to_operator_id IS NOT NULL;
