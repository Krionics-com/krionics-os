-- ============================================================
-- 20260522000001: add operator password hash + seed admin
-- ============================================================

ALTER TABLE operators ADD COLUMN IF NOT EXISTS password_hash TEXT;

INSERT INTO operators (email, name, role, is_active, password_hash)
VALUES (
  'admin@krionics.com',
  'Admin',
  'admin',
  true,
  '$2b$10$WgNiKlBFtnYBgJArkdJgt.CjP11YIxhyoPEqK7eOm7u0la6BW2lny'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
