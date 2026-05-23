# Dashboard Phase 6 — Campaign Management

## Overview

Phase 6 implements the core Campaign Management views and APIs in the operator dashboard. It includes structured campaign overview statistics, interactive search and filters, functional inline updates, campaign duplication cloning logic, live timeline events polling, sequences breakdowns, funnel conversion rates, and domain inboxes health dashboards.

## Campaign Schema & Mapping

Matches the dynamic schema of the `campaigns` table:
- Scalar fields: `id`, `client_id`, `name`, `status`, `total_leads`, `emails_sent`, `replies_received`, `positive_replies`, `meetings_booked`, `start_date`, `end_date`, `created_at`, `updated_at`.
- JSONB columns: `icp_config`, `sequence_config`, `sending_config`, `reply_policies`.

## API Endpoints

- `GET /api/dashboard/campaigns` — Returns paginated arrays of campaign metrics joined with client companies. Filters by client ID, status, and search query. Restricts output to `client_access` scopes in operator token.
- `GET /api/dashboard/campaigns/[id]` — Returns campaign detailed settings, computed ratios (rates for replies, positive interest), and recent 10 reply items with intent classifications.
- `PATCH /api/dashboard/campaigns/[id]` — Dynamic field updates for name, statuses, dates, sequence configs, sending configs, and reply policies (admin/super_admin only).
- `POST /api/dashboard/campaigns/[id]/pause` — Sets campaign status to `paused`.
- `POST /api/dashboard/campaigns/[id]/resume` — Restores campaign status from `paused` to `active`.
- `POST /api/dashboard/campaigns/[id]/archive` — Sets campaign status to `archived`.
- `POST /api/dashboard/campaigns/[id]/duplicate` — Copies entire sequence step sequences, sending parameters, and target ICPs. Resets counters to `0` and sets new campaign status to `draft`.
- `GET /api/dashboard/campaigns/[id]/activity` — Returns the last 20 events combining `email_events` and `reply_items` in a unified UNION log sorted chronologically.

## Directory and Detail UI

- **Campaigns Directory (`/dashboard/campaigns`):**
  - Columns: Name, Client, Status, Inbox Counts, Total Leads, Reply Rate, Positive Rate, Meetings Booked, Bounce Rate, and Warmup Status.
  - Interactive status tabs, client-specific filter dropdowns, and live title searches.
  - Quick action controls to pause, resume, archive, duplicate, or mock export leads.
- **Campaign Detail Page (`/dashboard/campaigns/[id]`):**
  - **KPI Header:** Large Playfair Display styled campaign titles, client links, status indicators, and date bounds.
  - **Overview Tab:** Grid of 8 metric tiles (including response times and spams) and recent reply logs.
  - **Funnel Tab:** Recharts horizontal bar chart visualizing the 6-stage funnel (Leads → Enriched → Personalized → Sent → Replied → Booked) styled in terracotta (`#C4521C`).
  - **Sequence Tab:** Step-by-step performance breakdowns of send, open, click, reply, and positive rates.
  - **Inbox Health Tab:** Status breakdown of outbound warmups, reputation grades, and specific inbox domains.
  - **Leads Tab:** Recharts donut/pie visualization of lead state distributions.
  - **Live Activity Tab:** Real-time chronological activity list with auto-polling every 5 seconds.

## Custom Components

- **CampaignDuplicateModal (`components/campaign-duplicate-modal.tsx`):** Clones target campaign configuration.

## Verification

The build succeeded perfectly with zero errors.
