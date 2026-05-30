# Outbound Engine — Phases 1–6

Refactored Krionics OS from a campaign-centric model to a client-continuous multi-tenant outbound engine.

## What Changed
- Campaign concept removed from the pipeline. Leads belong directly to clients.
- Human review step inserted before Instantly: AI generates sequence → operator approves → Instantly sends.
- All workers decoupled from campaign_id. Client-scoped dedup on (client_id, email).
- New schema: apollo_config, clay_config, sequence_config, instantly_config, review_mode, outbound_active on clients. enriched_data, lead_sequence, review_status, instantly_contact_id on leads.

## Phases
- Phase 1: Fixed calcom_link column rename propagation
- Phase 2: Schema foundation migration (20260530000002)
- Phase 3: Worker decoupling, review gate, approve/reject/launch/config APIs
- Phase 4: Outbound config UI tab on client profile
- Phase 5: Outbound review queue page (/dashboard/outbound-review)
- Phase 6: Pipeline visibility widget on client profile overview

## Pipeline Flow
Client configured → Launch Outbound → Apollo pulls leads (cadenced) → Clay enriches → AI generates sequence → Review queue → Human approves → Instantly sends → Reply arrives → RICR pipeline handles it → suppressed if no reply after sequence
