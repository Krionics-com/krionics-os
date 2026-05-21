-- ============================================================
-- 000011: scheduled_sends — approved drafts awaiting dispatch
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_sends (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_item_id           UUID        NOT NULL REFERENCES reply_items(id),
  draft_id                UUID        NOT NULL REFERENCES reply_drafts(id),
  to_email                TEXT        NOT NULL,
  from_email              TEXT        NOT NULL,
  subject                 TEXT        NOT NULL,
  body_text               TEXT        NOT NULL,
  body_html               TEXT,
  scheduled_at            TIMESTAMPTZ NOT NULL,
  status                  send_status NOT NULL DEFAULT 'PENDING',
  sent_at                 TIMESTAMPTZ,
  instantly_message_id    TEXT,
  attempt_count           INTEGER     NOT NULL DEFAULT 0,
  last_error              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary queue scan: pending sends ordered by scheduled time
CREATE INDEX IF NOT EXISTS idx_scheduled_sends_pending ON scheduled_sends(scheduled_at ASC)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_scheduled_sends_reply   ON scheduled_sends(reply_item_id);

-- Back-fill FK
ALTER TABLE reply_items
  ADD CONSTRAINT fk_reply_items_scheduled_send
  FOREIGN KEY (scheduled_send_id) REFERENCES scheduled_sends(id);
