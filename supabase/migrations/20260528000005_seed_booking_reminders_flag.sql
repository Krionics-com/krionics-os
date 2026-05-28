-- ============================================================
-- 20260528000005: add booking_reminders feature flag
-- Required by the booking-reminder worker to check whether
-- reminder sending is enabled for a client.
-- ============================================================

INSERT INTO feature_flags (feature_key, enabled, description)
VALUES ('booking_reminders', TRUE, 'Send automated 24h/72h/5d pre-meeting reminder emails to booked prospects.')
ON CONFLICT (feature_key) DO NOTHING;
