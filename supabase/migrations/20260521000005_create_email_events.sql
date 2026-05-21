-- ============================================================
-- 000005: email_events — immutable event log, partitioned by month
-- ============================================================

CREATE TABLE IF NOT EXISTS email_events (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  client_id     UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id   UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id       UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,
  -- 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed'
  inbox_email   TEXT,
  subject       TEXT,
  body_snippet  TEXT,  -- first 500 chars, no full body stored here
  metadata      JSONB       NOT NULL DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source        TEXT        NOT NULL DEFAULT 'instantly',
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Monthly partitions: 2026-05 through 2027-06
CREATE TABLE IF NOT EXISTS email_events_2026_05 PARTITION OF email_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS email_events_2026_06 PARTITION OF email_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS email_events_2026_07 PARTITION OF email_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS email_events_2026_08 PARTITION OF email_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS email_events_2026_09 PARTITION OF email_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS email_events_2026_10 PARTITION OF email_events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS email_events_2026_11 PARTITION OF email_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS email_events_2026_12 PARTITION OF email_events
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS email_events_2027_01 PARTITION OF email_events
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE IF NOT EXISTS email_events_2027_02 PARTITION OF email_events
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE IF NOT EXISTS email_events_2027_03 PARTITION OF email_events
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE IF NOT EXISTS email_events_2027_04 PARTITION OF email_events
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE IF NOT EXISTS email_events_2027_05 PARTITION OF email_events
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE IF NOT EXISTS email_events_2027_06 PARTITION OF email_events
  FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

CREATE INDEX IF NOT EXISTS idx_email_events_client    ON email_events(client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_lead      ON email_events(lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign  ON email_events(campaign_id, event_type);
