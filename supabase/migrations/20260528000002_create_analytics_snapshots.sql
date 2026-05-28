-- ============================================================
-- 20260528000002: analytics_snapshots
-- Stores pre-computed campaign metric snapshots for AI analysis
-- and dashboard charts. Written by the analytics-aggregator worker
-- every 15 minutes; read by analytics-intelligence worker weekly.
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id           UUID          REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Snapshot window
  period_start          TIMESTAMPTZ   NOT NULL,
  period_end            TIMESTAMPTZ   NOT NULL,
  granularity           TEXT          NOT NULL DEFAULT 'daily'
                                      CHECK (granularity IN ('hourly', 'daily', 'weekly', 'monthly')),

  -- Reply metrics
  total_replies         INTEGER       NOT NULL DEFAULT 0,
  reply_rate            FLOAT         NOT NULL DEFAULT 0,
  positive_rate         FLOAT         NOT NULL DEFAULT 0,
  booking_rate          FLOAT         NOT NULL DEFAULT 0,
  avg_response_time_hours FLOAT       NOT NULL DEFAULT 0,
  sequences_sent        INTEGER       NOT NULL DEFAULT 0,

  -- Intent breakdown (JSONB for flexibility)
  intent_breakdown      JSONB         NOT NULL DEFAULT '{}',

  -- Top objections
  top_objections        TEXT[]        NOT NULL DEFAULT '{}',

  -- AI analysis output (populated by analytics-intelligence worker)
  ai_summary            TEXT,
  ai_key_insights       TEXT[]        DEFAULT '{}',
  ai_recommended_actions JSONB        DEFAULT '[]',
  ai_sequence_suggestions TEXT[]      DEFAULT '{}',
  ai_health_score       FLOAT,
  ai_analyzed_at        TIMESTAMPTZ,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_snapshots_client_period
  ON analytics_snapshots(client_id, period_start, period_end, granularity);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_client_id
  ON analytics_snapshots(client_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_campaign_id
  ON analytics_snapshots(campaign_id, period_end DESC);
