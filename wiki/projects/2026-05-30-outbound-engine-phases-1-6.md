# Outbound Engine Phases 1–6

Date: 2026-05-30
Status: Complete (Phases 1–6)

## Summary

Full end-to-end outbound pipeline built on top of the Apollo → Clay → AI sequence generation → human review → Instantly flow. Phases 1–4 established schema, workers, and configuration UI. Phases 5–6 completed the operator-facing review experience and pipeline visibility.

## Phases

### Phase 1 — Cal.com link rename [complete]
- Propagated `calcom_link` column rename across all TypeScript/TSX references.

### Phase 2 — Schema Foundation [complete]
- Migration `20260530000002`: Added outbound config columns to `clients` table (`apollo_config`, `clay_config`, `sequence_config`, `instantly_config`, `review_mode`, `outbound_active`, `outbound_launched_at`).
- Migration `20260530000002`: Added lead tracking columns (`enriched_data`, `lead_sequence`, `review_status`, `review_notes`, `reviewed_by`, `reviewed_at`, `instantly_contact_id`, `suppressed_at`, `suppressed_reason`).
- Added dedup index on `(client_id, apollo_id)`, review queue index on `(client_id, review_status)`.

### Phase 3 — Decouple Workers + Review Step [complete]
- `apollo-import.ts`: `campaignId` made optional; leads dedup is client-scoped.
- `sequence-generation.ts`: Reads `sequence_config` for step count and `review_mode` from client. Human-mode skips `instantly-push` (waits for approval). Auto-mode pushes immediately.
- `instantly-push.ts`: Stores `instantly_contact_id` on leads table after push.
- New APIs: `POST/DELETE /api/dashboard/clients/[slug]/launch-outbound`, `PATCH /api/dashboard/clients/[slug]/outbound-config`.
- New APIs: `POST /api/dashboard/leads/[id]/approve`, `POST /api/dashboard/leads/[id]/reject`.
- Leads API updated with `review_status` filter and new columns in SELECT.

### Phase 4 — Outbound Config UI [complete]
- Outbound configuration tab on client profile with Apollo, Clay, Instantly, and sequence settings.
- Launch/pause outbound controls.

### Phase 5 — Outbound Review Queue Page [complete]
- New page: `/dashboard/outbound-review` — shows pending AI-generated sequences for human approval.
- Lead cards show Clay enrichment data (expandable) + full email sequence (per-step expandable).
- Approve: `POST /leads/[id]/approve` → enqueues Instantly push. Reject: `POST /leads/[id]/reject` with optional notes.
- Client filter dropdown for multi-client operators.
- Loading skeleton (3 cards), empty state, optimistic removal on approve/reject.
- Sidebar: "Outbound Review" added to OPERATIONS group (Send icon). "Campaigns" removed (deprecated).

### Phase 6 — Pipeline Visibility Widget [complete]
- New API: `GET /api/dashboard/clients/[slug]/pipeline` — returns lead counts by stage (Raw, Enriching, Pending Review, Sending, Suppressed).
- Client profile Overview tab: pipeline status row shown when `outbound_active = true`.
- Counts are live via SWR on the client profile page.

## Files

- `apps/dashboard/app/dashboard/outbound-review/page.tsx` — Review queue page
- `apps/dashboard/app/api/dashboard/clients/[slug]/pipeline/route.ts` — Pipeline status API
- `apps/dashboard/app/dashboard/clients/[slug]/page.tsx` — Pipeline widget in Overview tab
- `apps/dashboard/components/layout/sidebar.tsx` — Outbound Review nav item

## Sources

- `wiki/log.md` entries from 2026-05-30 document all phase build steps.
