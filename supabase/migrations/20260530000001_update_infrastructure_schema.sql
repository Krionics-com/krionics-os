-- Update infrastructure_strategy check constraint
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_infrastructure_strategy_check;
ALTER TABLE clients ADD CONSTRAINT clients_infrastructure_strategy_check 
  CHECK (infrastructure_strategy IN ('existing', 'setup_required'));

-- Migrate any existing records with 'client_owned' to 'setup_required'
UPDATE clients SET infrastructure_strategy = 'setup_required' WHERE infrastructure_strategy = 'client_owned';

-- Add new infrastructure columns
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS primary_domain TEXT,
  ADD COLUMN IF NOT EXISTS outbound_domains TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS inboxes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mail_provider TEXT,
  ADD COLUMN IF NOT EXISTS technical_contact JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS access_checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS setup_checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Safely clean up deprecated columns if they exist
ALTER TABLE clients DROP COLUMN IF EXISTS assigned_domains;
ALTER TABLE clients DROP COLUMN IF EXISTS assigned_inboxes;
ALTER TABLE clients DROP COLUMN IF EXISTS available_domains;
ALTER TABLE clients DROP COLUMN IF EXISTS available_inboxes;
