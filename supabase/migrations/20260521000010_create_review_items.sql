-- ============================================================
-- 000010: review_items — operator inbox queue
-- ============================================================

CREATE TABLE IF NOT EXISTS review_items (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_item_id     UUID          NOT NULL REFERENCES reply_items(id),
  draft_id          UUID          REFERENCES reply_drafts(id),
  classification_id UUID          NOT NULL REFERENCES reply_classifications(id),
  client_id         UUID          NOT NULL REFERENCES clients(id),
  -- Queue ordering: lower = higher priority (1 = urgent)
  priority          INTEGER       NOT NULL DEFAULT 50,
  queue_position    INTEGER,
  assigned_to       UUID          REFERENCES operators(id),
  -- Populated when operator acts
  action_taken      review_action,
  action_at         TIMESTAMPTZ,
  action_by         UUID          REFERENCES operators(id),
  rejection_reason  TEXT,
  escalation_note   TEXT,
  -- 0 = send immediately on approval, >0 = delayed send (minutes)
  send_delay_minutes INTEGER      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Pending queue view (most commonly queried)
CREATE INDEX IF NOT EXISTS idx_review_items_pending   ON review_items(priority ASC, created_at ASC)
  WHERE action_taken IS NULL;
CREATE INDEX IF NOT EXISTS idx_review_items_client    ON review_items(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_items_assigned  ON review_items(assigned_to)
  WHERE action_taken IS NULL;

-- Back-fill FK
ALTER TABLE reply_items
  ADD CONSTRAINT fk_reply_items_review
  FOREIGN KEY (review_item_id) REFERENCES review_items(id);
