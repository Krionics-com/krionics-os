-- ============================================================
-- 20260523000014: Add Reply Orchestration Columns to Raw Replies
-- ============================================================

ALTER TABLE raw_replies
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS thread_id TEXT,
ADD COLUMN IF NOT EXISTS email_sequence_number INTEGER,
ADD COLUMN IF NOT EXISTS last_sent_subject TEXT,
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS classification_error TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_raw_replies_client_id ON raw_replies(client_id);
CREATE INDEX IF NOT EXISTS idx_raw_replies_thread_id ON raw_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_raw_replies_classification_status ON raw_replies(classification_status);
