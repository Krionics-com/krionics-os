-- ============================================================
-- 000007: reply_items — main state-machine entity for RICR
-- ============================================================

CREATE TABLE IF NOT EXISTS reply_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_reply_id        UUID          NOT NULL REFERENCES raw_replies(id),
  campaign_id         UUID          NOT NULL REFERENCES campaigns(id),
  lead_id             UUID          NOT NULL REFERENCES leads(id),
  client_id           UUID          NOT NULL REFERENCES clients(id),
  status              reply_status  NOT NULL DEFAULT 'RECEIVED',
  -- FK populated as pipeline progresses
  classification_id   UUID,  -- → reply_classifications (set after 000008)
  draft_id            UUID,  -- → reply_drafts          (set after 000009)
  review_item_id      UUID,  -- → review_items           (set after 000010)
  scheduled_send_id   UUID,  -- → scheduled_sends        (set after 000011)
  -- Operator assignment for manual escalations
  assigned_to         UUID    REFERENCES operators(id),
  trace_id            UUID    NOT NULL DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ,
  metadata            JSONB   NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_reply_items_status      ON reply_items(status);
CREATE INDEX IF NOT EXISTS idx_reply_items_campaign    ON reply_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reply_items_lead        ON reply_items(lead_id);
CREATE INDEX IF NOT EXISTS idx_reply_items_client      ON reply_items(client_id);
CREATE INDEX IF NOT EXISTS idx_reply_items_created_at  ON reply_items(created_at DESC);
-- Pending items view (review queue source)
CREATE INDEX IF NOT EXISTS idx_reply_items_pending     ON reply_items(client_id, created_at DESC)
  WHERE status = 'PENDING_REVIEW';
