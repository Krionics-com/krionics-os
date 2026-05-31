-- Update default sequence_config to a 4-step sequence (Initial / FU1 / FU2 / Breakup)
-- and backfill any clients still on the 1-step default.

ALTER TABLE clients
  ALTER COLUMN sequence_config SET DEFAULT '{
    "steps": [
      {"step": 1, "name": "Initial Email", "delay_days": 0},
      {"step": 2, "name": "Follow-up 1", "delay_days": 3},
      {"step": 3, "name": "Follow-up 2", "delay_days": 7},
      {"step": 4, "name": "Breakup", "delay_days": 14}
    ]
  }'::jsonb;

-- Backfill clients still on the 1-step default and have not yet launched outbound.
-- A client that already customized their sequence keeps it.
UPDATE clients
SET sequence_config = '{
  "steps": [
    {"step": 1, "name": "Initial Email", "delay_days": 0},
    {"step": 2, "name": "Follow-up 1", "delay_days": 3},
    {"step": 3, "name": "Follow-up 2", "delay_days": 7},
    {"step": 4, "name": "Breakup", "delay_days": 14}
  ]
}'::jsonb
WHERE outbound_active = false
  AND jsonb_array_length(COALESCE(sequence_config->'steps', '[]'::jsonb)) <= 1;

-- Tighten review_mode CHECK: only human/auto exposed in V1.
-- We migrate any existing 'ai' value to 'human' (safer default).
UPDATE clients SET review_mode = 'human' WHERE review_mode = 'ai';

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_review_mode_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_review_mode_check
  CHECK (review_mode IN ('human', 'auto'));
