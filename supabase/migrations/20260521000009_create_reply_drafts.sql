-- ============================================================
-- 000009: reply_drafts — AI-generated response drafts
-- ============================================================

CREATE TABLE IF NOT EXISTS reply_drafts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_item_id     UUID          NOT NULL REFERENCES reply_items(id),
  classification_id UUID          NOT NULL REFERENCES reply_classifications(id),
  client_id         UUID          NOT NULL REFERENCES clients(id),
  lead_id           UUID          NOT NULL REFERENCES leads(id),
  version           INTEGER       NOT NULL DEFAULT 1,
  -- Draft content
  subject           TEXT          NOT NULL,
  body_text         TEXT          NOT NULL,
  body_html         TEXT,
  -- Metadata
  tone              TEXT          CHECK (tone IN ('WARM','DIRECT','PROFESSIONAL','EMPATHETIC')),
  cta_type          TEXT          CHECK (cta_type IN ('BOOK_CALL','SEND_RESOURCE','FOLLOW_UP','NONE')),
  cta_url           TEXT,
  word_count        INTEGER,
  -- AI provenance
  model_used        TEXT          NOT NULL,
  prompt_version    TEXT          NOT NULL,
  raw_model_output  JSONB         NOT NULL DEFAULT '{}',
  generated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  generation_ms     INTEGER,
  -- Human edits (populated if operator edits before approval)
  edited_body_text  TEXT,
  edited_at         TIMESTAMPTZ,
  edited_by         UUID          REFERENCES operators(id),
  -- Structured diff of operator edits
  edit_diff         JSONB,
  -- Final sent version (may differ from edited)
  sent_draft        TEXT,
  -- Status
  status            draft_status  NOT NULL DEFAULT 'pending_review',
  operator_id       UUID          REFERENCES operators(id),
  reviewed_at       TIMESTAMPTZ,
  approved_at       TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  rejection_reason  TEXT,
  -- SLA: auto-computed on insert (received_at + client SLA config, default 4h)
  sla_deadline      TIMESTAMPTZ,
  trace_id          UUID          NOT NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_drafts_reply_item  ON reply_drafts(reply_item_id);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_client_stat ON reply_drafts(client_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_sla         ON reply_drafts(sla_deadline)
  WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_reply_drafts_pending     ON reply_drafts(client_id, sla_deadline ASC)
  WHERE status = 'pending_review';

-- Back-fill FK
ALTER TABLE reply_items
  ADD CONSTRAINT fk_reply_items_draft
  FOREIGN KEY (draft_id) REFERENCES reply_drafts(id);
