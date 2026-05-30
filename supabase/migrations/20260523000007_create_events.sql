-- ============================================================
-- 20260523000007: events — Immutable System Event Log
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  event_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id               UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id           UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Event Classification
  event_type            TEXT NOT NULL,
  -- Acquisition: leads_imported, duplicate_detected, enrichment_queued, enrichment_completed, enrichment_failed
  -- Outbound: campaign_pushed, email_sent, email_opened, email_bounced, sequence_paused, sequence_resumed
  -- Reply: reply_received, reply_classified, draft_generated, draft_approved, draft_rejected, auto_reply_sent, human_reply_sent
  -- Conversion: meeting_link_sent, booking_reminder_triggered, meeting_booked, opportunity_created
  -- System: workflow_failed, retry_queued, dead_letter_queued, deliverability_warning, config_reloaded

  event_timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT,

  -- Event Metadata (polymorphic structure)
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Tracing
  trace_id              UUID,
  parent_event_id       UUID REFERENCES events(event_id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_client_id ON events(client_id);
CREATE INDEX IF NOT EXISTS idx_events_lead_id ON events(lead_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_trace_id ON events(trace_id);
