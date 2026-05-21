-- ============================================================
-- 000016: Row-Level Security policies
-- ============================================================

-- Enable RLS on all client-scoped tables
ALTER TABLE campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_replies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_drafts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_sends    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_calls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_invocations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;

-- ─── Operator policies: authenticated Krionics team ─────────────────────────
-- Operators with client_access = NULL can see all clients.
-- Operators with client_access = [uuid, ...] see only those clients.

CREATE POLICY op_campaigns ON campaigns
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM operators WHERE email = auth.email()) IN ('admin', 'reviewer')
    AND (
      (SELECT client_access FROM operators WHERE email = auth.email()) IS NULL
      OR client_id = ANY((SELECT client_access FROM operators WHERE email = auth.email()))
    )
  );

CREATE POLICY op_leads ON leads
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM operators WHERE email = auth.email()) IN ('admin', 'reviewer')
    AND (
      (SELECT client_access FROM operators WHERE email = auth.email()) IS NULL
      OR client_id = ANY((SELECT client_access FROM operators WHERE email = auth.email()))
    )
  );

CREATE POLICY op_reply_items ON reply_items
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM operators WHERE email = auth.email()) IN ('admin', 'reviewer')
    AND (
      (SELECT client_access FROM operators WHERE email = auth.email()) IS NULL
      OR client_id = ANY((SELECT client_access FROM operators WHERE email = auth.email()))
    )
  );

CREATE POLICY op_reply_drafts ON reply_drafts
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM operators WHERE email = auth.email()) IN ('admin', 'reviewer')
    AND (
      (SELECT client_access FROM operators WHERE email = auth.email()) IS NULL
      OR client_id = ANY((SELECT client_access FROM operators WHERE email = auth.email()))
    )
  );

CREATE POLICY op_review_items ON review_items
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM operators WHERE email = auth.email()) IN ('admin', 'reviewer')
    AND (
      (SELECT client_access FROM operators WHERE email = auth.email()) IS NULL
      OR client_id = ANY((SELECT client_access FROM operators WHERE email = auth.email()))
    )
  );

CREATE POLICY op_meetings ON meetings
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM operators WHERE email = auth.email()) IN ('admin', 'reviewer')
    AND (
      (SELECT client_access FROM operators WHERE email = auth.email()) IS NULL
      OR client_id = ANY((SELECT client_access FROM operators WHERE email = auth.email()))
    )
  );

-- ─── audit_log: append-only ─────────────────────────────────────────────────
-- Any authenticated actor can INSERT. Nobody can UPDATE or DELETE.

CREATE POLICY audit_insert ON audit_log
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY audit_select ON audit_log
  FOR SELECT TO authenticated USING (
    (SELECT role FROM operators WHERE email = auth.email()) IN ('admin', 'reviewer')
  );
-- No UPDATE or DELETE policies → enforces append-only constraint.

-- ─── suppression_list ───────────────────────────────────────────────────────
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY supp_read ON suppression_list
  FOR SELECT TO authenticated USING (TRUE);

-- Only service_role (n8n workers) may write suppression records.
CREATE POLICY supp_write ON suppression_list
  FOR INSERT TO service_role WITH CHECK (TRUE);

-- ─── config: read by all authenticated, write by admin only ─────────────────
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_read ON config
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY config_admin_write ON config
  FOR ALL TO authenticated
  USING ((SELECT role FROM operators WHERE email = auth.email()) = 'admin');

-- ─── Service role bypass ─────────────────────────────────────────────────────
-- The service role key used by n8n and the migration runner bypasses all RLS.
-- Never expose the service role key to browser clients.
