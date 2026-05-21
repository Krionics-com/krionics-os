-- ============================================================
-- 000003: campaigns
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id                        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 UUID            NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name                      TEXT            NOT NULL,
  status                    campaign_status NOT NULL DEFAULT 'draft',
  instantly_campaign_id     TEXT,
  -- ICP filters: verticals, company size, title filters
  icp_config                JSONB           NOT NULL DEFAULT '{}',
  -- Sequence: email steps, delays, A/B subject variants
  sequence_config           JSONB           NOT NULL DEFAULT '{}',
  -- Sending: inboxes, daily limits, send window
  sending_config            JSONB           NOT NULL DEFAULT '{}',
  -- Personalization context for AI generation
  personalization_prompt_id UUID,
  -- Reply policy overrides per intent (NULL = inherit client defaults)
  reply_policies            JSONB           NOT NULL DEFAULT '{}',
  -- Counters — maintained by triggers
  total_leads               INTEGER         NOT NULL DEFAULT 0,
  emails_sent               INTEGER         NOT NULL DEFAULT 0,
  replies_received          INTEGER         NOT NULL DEFAULT 0,
  positive_replies          INTEGER         NOT NULL DEFAULT 0,
  meetings_booked           INTEGER         NOT NULL DEFAULT 0,
  start_date                DATE,
  end_date                  DATE,
  created_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_client_id     ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status        ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_status ON campaigns(client_id, status);
