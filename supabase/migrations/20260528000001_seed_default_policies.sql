-- ============================================================
-- 20260528000001: seed_default_policies
-- Seeds default reply_policies and timing_rules for every client,
-- and installs a trigger so new clients are seeded automatically.
-- ============================================================

-- ── Seeder function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_client_default_policies(p_client_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Default routing actions per intent and automation level.
  -- Level 1 = full human review.
  -- Level 2 = AI drafts, human approves.
  -- Level 3 = full AI SDR (OBJECTION always stays human-reviewed).
  INSERT INTO reply_policies (
    client_id, intent,
    action_level_1, action_level_2, action_level_3,
    confidence_threshold
  ) VALUES
    (p_client_id, 'POSITIVE',       'human_review', 'ai_draft_human_review', 'ai_send',               0.85),
    (p_client_id, 'BOOKING_INTENT', 'human_review', 'ai_draft_human_review', 'ai_send',               0.85),
    (p_client_id, 'OBJECTION',      'human_review', 'ai_draft_human_review', 'ai_draft_human_review', 0.85),
    (p_client_id, 'FAQ',            'human_review', 'ai_draft_human_review', 'ai_send',               0.80),
    (p_client_id, 'NURTURE',        'suppress',     'suppress',              'suppress',              0.85),
    (p_client_id, 'UNSUBSCRIBE',    'suppress',     'suppress',              'suppress',              0.99),
    (p_client_id, 'NOT_RELEVANT',   'suppress',     'suppress',              'suppress',              0.80),
    (p_client_id, 'BOUNCE_OOO',     'suppress',     'suppress',              'suppress',              0.85),
    (p_client_id, 'HOSTILE',        'suppress',     'suppress',              'suppress',              0.99),
    (p_client_id, 'UNKNOWN',        'human_review', 'human_review',          'human_review',          0.90)
  ON CONFLICT (client_id, intent) DO NOTHING;

  -- Default timing windows.
  -- UNSUBSCRIBE/NOT_RELEVANT/BOUNCE_OOO/HOSTILE have 0-minute delay (instant suppress).
  -- Business hours are enforced by default (7 AM – 10 PM prospect timezone).
  INSERT INTO timing_rules (
    client_id, intent,
    delay_min_minutes, delay_max_minutes,
    enforce_business_hours
  ) VALUES
    (p_client_id, 'POSITIVE',       120,  480,  TRUE),
    (p_client_id, 'BOOKING_INTENT', 30,   120,  TRUE),
    (p_client_id, 'OBJECTION',      240,  720,  TRUE),
    (p_client_id, 'FAQ',            60,   240,  TRUE),
    (p_client_id, 'NURTURE',        1440, 2880, TRUE),
    (p_client_id, 'UNSUBSCRIBE',    0,    0,    FALSE),
    (p_client_id, 'NOT_RELEVANT',   0,    0,    FALSE),
    (p_client_id, 'BOUNCE_OOO',     0,    0,    FALSE),
    (p_client_id, 'HOSTILE',        0,    0,    FALSE),
    (p_client_id, 'UNKNOWN',        60,   240,  TRUE)
  ON CONFLICT (client_id, intent) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ── Trigger: auto-seed on new client ────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_seed_client_policies()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_client_default_policies(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_client_created_seed_policies ON clients;
CREATE TRIGGER on_client_created_seed_policies
  AFTER INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION trigger_seed_client_policies();

-- ── Backfill: seed all existing clients ─────────────────────────────────────

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT id FROM clients LOOP
    PERFORM seed_client_default_policies(c.id);
  END LOOP;
END $$;
