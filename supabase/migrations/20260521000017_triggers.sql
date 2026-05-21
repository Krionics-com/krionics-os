-- ============================================================
-- 000017: Functions and triggers
-- ============================================================

-- ─── updated_at auto-maintenance ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reply_drafts_updated_at
  BEFORE UPDATE ON reply_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── reply_items updated_at ─────────────────────────────────────────────────

CREATE TRIGGER trg_reply_items_updated_at
  BEFORE UPDATE ON reply_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Auto-audit on reply_items status change ─────────────────────────────────

CREATE OR REPLACE FUNCTION audit_reply_item_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log (
      client_id, actor_type, action,
      entity_type, entity_id,
      before_state, after_state,
      trace_id
    ) VALUES (
      NEW.client_id,
      'system',
      'reply_item.status_changed',
      'reply_item',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NEW.trace_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reply_items_audit_status
  AFTER UPDATE ON reply_items
  FOR EACH ROW EXECUTE FUNCTION audit_reply_item_status();

-- ─── Campaign counter maintenance ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_campaign_email_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_type = 'sent' THEN
    UPDATE campaigns SET emails_sent = emails_sent + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.event_type = 'replied' THEN
    UPDATE campaigns SET replies_received = replies_received + 1 WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_event_counters
  AFTER INSERT ON email_events
  FOR EACH ROW EXECUTE FUNCTION update_campaign_email_counters();

-- ─── Lead status_updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_lead_status_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    NEW.prev_status = OLD.lead_status;
    NEW.status_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_status_timestamp
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION sync_lead_status_timestamp();

-- ─── Idempotency key cleanup function (call from cron) ──────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_keys WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
