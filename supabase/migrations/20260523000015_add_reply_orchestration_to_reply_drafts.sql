-- ============================================================
-- 20260523000015: Add Reply Orchestration Columns to Reply Drafts
-- ============================================================

ALTER TABLE reply_drafts
ADD COLUMN IF NOT EXISTS intent_classified_as TEXT,
ADD COLUMN IF NOT EXISTS includes_booking_link BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS booking_link_url TEXT,
ADD COLUMN IF NOT EXISTS quality_flags TEXT[],
ADD COLUMN IF NOT EXISTS confidence FLOAT,
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS prompt_template_id UUID,
ADD COLUMN IF NOT EXISTS prompt_template_version INTEGER,
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS generation_latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS send_status TEXT,
ADD COLUMN IF NOT EXISTS send_error TEXT;

CREATE INDEX IF NOT EXISTS idx_reply_drafts_intent ON reply_drafts(intent_classified_as);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_confidence ON reply_drafts(confidence DESC);
