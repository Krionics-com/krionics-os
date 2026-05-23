# Dashboard Phase 5 — Client Management & Profiles

## Overview

Phase 5 implements client account management, directory listings, dynamic KPI calculations, full inline editing for client records, custom tag-based configuration (e.g., ICP settings), automation control settings, CRM/Slack integrations, and team access overview lists.

## Client Schema & Mapping

All operations correspond directly to the `clients` table columns:
- Scalars: `id`, `slug`, `company_name`, `contact_email`, `contact_name`, `timezone`, `service_type`, `status`, `tier`, `automation_level`, `mrr_usd`, `setup_fee_usd`, `contract_start`, `contract_end`, `sales_lead_name`, `service_description`, `icp_description`, `positioning_statement`, `calendly_link`, `slack_webhook_url`, `slack_channel_id`.
- JSONB config columns:
  - `config`: Handles `icp_config` (industries, titles, company_size, geographies, exclusions), `automation_config` (auto_approve_positive, auto_suppress_objections, escalation_email, sla_hours), `slack_config` (alert_channels, escalation_channel).
  - `crm_config`: Handles `api_key`, `portal_id`, `field_mappings`.

## API Endpoints

- `GET /api/dashboard/clients` — Returns client directory with calculated total active campaigns count and averaged reply rate. Respects `client_access` list in operator token.
- `POST /api/dashboard/clients` — Creates new client (admin/super_admin only). Auto-generates slug, checks slug uniqueness.
- `GET /api/dashboard/clients/[slug]` — Returns full details for a client and the 5 most recent reply items.
- `PATCH /api/dashboard/clients/[slug]` — Deep-merges JSONB fields and updates scalar columns (admin/super_admin only).
- `POST /api/dashboard/clients/[slug]/pause` — Pauses client status.
- `POST /api/dashboard/clients/[slug]/archive` — Archives (churns) client status.
- `GET /api/dashboard/clients/[slug]/team` — Retrieves operators who have access to this client.

## Directory and Profile UI

- **Client Directory (`/dashboard/clients`):**
  - Searchable by company name, filterable by status.
  - Quick action controls to pause or archive with confirmation prompts.
  - Trigger for the client creation form modal.
- **Client Profiles (`/dashboard/clients/[slug]`):**
  - **KPI Header:** Dynamic display of active campaigns, total sent, reply rate %, and meetings booked.
  - **Overview Tab:** Summary of recent reply activity.
  - **Business Info Tab:** Inline editor for contact names, timezone dropdown, dates, and MRR.
  - **ICP & Positioning Tab:** Structured textareas and Tag Inputs for industries, titles, size, geographies, exclusions.
  - **Automation Tab:** Level select (1-3), auto-approve toggles, and SLA parameters.
  - **CRM Config Tab:** Dynamic visibility toggles for credentials, JSON configuration editor, sync indicators.
  - **Slack Config Tab:** Webhook validation, channel alerts, escalation channels.
  - **AI Config Tab:** Professional/Friendly tone tuning, personalization limits, forbidden claim lists.
  - **Team Tab:** Overview of active engineers or reviewers mapped to the client tenant.

## Custom Components

- **TagInput (`components/ui/tag-input.tsx`):** Handlers for parsing comma-delimited strings or keyboard entries into custom dynamic tag chips.
- **ClientCreateModal (`components/client-create-modal.tsx`):** Populates fields with automatic slug formatting.

## Verification

Build completed successfully with 0 TypeScript/Next.js errors.
