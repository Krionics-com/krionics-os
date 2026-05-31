-- Outbound scheduler tracking columns

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_apollo_pull_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clients_outbound_active_pull_idx
  ON clients (outbound_active, last_apollo_pull_at)
  WHERE outbound_active = true;
