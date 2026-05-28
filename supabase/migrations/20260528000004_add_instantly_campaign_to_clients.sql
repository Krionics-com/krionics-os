-- ============================================================
-- 20260528000004: add instantly_campaign_id to clients
-- Required by the sequence-generation worker to know which
-- Instantly campaign to push generated sequences into.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS instantly_campaign_id TEXT;
