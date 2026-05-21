-- ============================================================
-- 000006: raw_replies — immutable first-write of every incoming reply
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_replies (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- sha256(instantly_reply_id) — prevents double-ingestion on webhook replay
  idempotency_key       TEXT        UNIQUE NOT NULL,
  campaign_id           UUID        REFERENCES campaigns(id),
  lead_id               UUID        REFERENCES leads(id),
  instantly_reply_id    TEXT        NOT NULL,
  instantly_email_id    TEXT,
  from_email            TEXT        NOT NULL,
  from_name             TEXT,
  to_email              TEXT,
  subject               TEXT,
  body_text             TEXT        NOT NULL,
  body_html             TEXT,
  headers               JSONB       NOT NULL DEFAULT '{}',
  received_at           TIMESTAMPTZ NOT NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Full webhook body — immutable, never modified
  raw_payload           JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_raw_replies_campaign   ON raw_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_raw_replies_lead       ON raw_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_raw_replies_received   ON raw_replies(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_replies_from_email ON raw_replies(from_email);
