-- ============================================================
-- 20260523000012: Add Reply Orchestration Config to Clients
-- ============================================================

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS reply_processing_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_send_enabled BOOLEAN DEFAULT FALSE;
