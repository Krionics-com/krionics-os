-- ============================================================
-- 000008: reply_classifications — Claude output for each reply
-- ============================================================

CREATE TABLE IF NOT EXISTS reply_classifications (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_item_id     UUID          NOT NULL REFERENCES reply_items(id),
  intent            reply_intent  NOT NULL,
  confidence        NUMERIC(4,3)  NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  sentiment         TEXT          CHECK (sentiment IN ('POSITIVE','NEUTRAL','NEGATIVE')),
  urgency           TEXT          CHECK (urgency IN ('HIGH','MEDIUM','LOW')),
  -- Verbatim phrases that drove the classification (max 5)
  key_signals       TEXT[]        NOT NULL DEFAULT '{}',
  objection_type    TEXT,  -- populated if intent = OBJECTION
  faq_topic         TEXT,  -- populated if intent = FAQ
  reasoning         TEXT,  -- Claude's one-sentence reasoning
  requires_draft    BOOLEAN       NOT NULL DEFAULT FALSE,
  requires_human    BOOLEAN       NOT NULL DEFAULT FALSE,
  routing_decision  TEXT          NOT NULL,
  -- AI provenance
  model_used        TEXT          NOT NULL,
  prompt_version    TEXT          NOT NULL,
  -- Full Claude response — immutable
  raw_model_output  JSONB         NOT NULL DEFAULT '{}',
  classified_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  classification_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_reply_cls_reply_item ON reply_classifications(reply_item_id);
CREATE INDEX IF NOT EXISTS idx_reply_cls_intent     ON reply_classifications(intent, classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_cls_confidence ON reply_classifications(confidence DESC);

-- Back-fill FK now that the target table exists
ALTER TABLE reply_items
  ADD CONSTRAINT fk_reply_items_classification
  FOREIGN KEY (classification_id) REFERENCES reply_classifications(id);
