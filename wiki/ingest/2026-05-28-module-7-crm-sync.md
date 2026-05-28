# Ingest Record: Module 7 — CRM Sync

Date: 2026-05-28
Branch: feat/module-7-crm-sync

## Actions taken

1. Created CRM strategy pattern in `packages/workers/src/clients/crm/`:
   - `types.ts` — `CRMProvider` interface with `upsertContact()` and `createDeal()`.
   - `hubspot.ts` — `HubSpotProvider`: searches existing contact by email before creating/updating; creates deals with HUBSPOT_DEFINED contact association type.
   - `pipedrive.ts` — `PipedriveProvider`: searches existing person by email, upserts, creates deal linked to person_id.
   - `factory.ts` — `createCRMProvider(crmType)`: reads `HUBSPOT_ACCESS_TOKEN` / `PIPEDRIVE_API_KEY` from env, returns null for `"none"`.

2. Created `packages/workers/src/workers/crm-sync.ts`:
   - Job payload: `{ clientId, leadId, meetingId?, triggerEvent }`.
   - Loads client CRM type from `clients.crm_type`.
   - Returns `{ status: "skipped" }` when no CRM configured.
   - Calls `provider.upsertContact()` and writes `crm_contact_id` + `crm_synced` to leads.
   - On `triggerEvent === "meeting_booked"`: creates CRM deal with 30-day estimated close date, writes `crm_deal_id` to meeting.
   - Emits `opportunity_created` event with contact_id, deal_id, crm_type.

## CRM Provider interface

```typescript
interface CRMProvider {
  upsertContact(contact: CRMContact): Promise<{ id: string }>;
  createDeal(deal: CRMDeal): Promise<{ id: string }>;
}
```

## Touched files

- `packages/workers/src/clients/crm/types.ts` (new)
- `packages/workers/src/clients/crm/hubspot.ts` (new)
- `packages/workers/src/clients/crm/pipedrive.ts` (new)
- `packages/workers/src/clients/crm/factory.ts` (new)
- `packages/workers/src/workers/crm-sync.ts` (new)
- `packages/workers/src/index.ts`

## Sources

- [wiki/sources/2026-05-23-krionics-os-architecture-v1.md](../sources/2026-05-23-krionics-os-architecture-v1.md) — §14 CRM Integration
