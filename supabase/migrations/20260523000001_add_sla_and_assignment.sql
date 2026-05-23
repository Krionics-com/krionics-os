-- supabase/migrations/20260523000001_add_sla_and_assignment.sql
ALTER TABLE reply_items 
  ADD COLUMN IF NOT EXISTS sla_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours');

ALTER TABLE reply_items
  ADD COLUMN IF NOT EXISTS assigned_to_operator_id UUID REFERENCES operators(id);

UPDATE reply_items SET sla_expires_at = created_at + INTERVAL '24 hours' WHERE sla_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reply_items_sla 
  ON reply_items(sla_expires_at) WHERE status = 'PENDING_REVIEW';
