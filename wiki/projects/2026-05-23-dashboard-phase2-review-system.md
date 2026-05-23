# Dashboard Phase 2 — Reply Review System

## Objective
Implement Phase 2 of the Krionics Operator Dashboard, focusing on a fully featured, real-time Reply Review System. This includes building an interactive review inbox with rich search and filtering capabilities, creating a highly detailed three-panel draft detail page for operator reviews, and implementing all supporting API endpoints.

## What Was Built
- **Database Schema Upgrades**:
  - Implemented migration `20260523000001_add_sla_and_assignment.sql` to add:
    - `sla_expires_at` (`TIMESTAMPTZ`): SLA expiration timestamp for the reply item.
    - `assigned_to_operator_id` (`UUID`): Operator assigned to resolve the reply.
    - Indexes on `sla_expires_at` to optimize queue sorting.
- **API REST Endpoints**:
  - `GET /api/dashboard/review`: Returns filtered, paginated list of reply items including SLA countdown status and search capabilities.
  - `GET /api/dashboard/review/[id]`: Returns detailed thread history (sender, received timestamps, clean bodies), lead metadata (enriched LinkedIn URL), campaign info, AI classification scores, and drafts.
  - `POST /api/dashboard/review/[id]/approve`: Saves manual operator draft modifications, transitions draft status to `approved`, and reply status to `APPROVED`.
  - `POST /api/dashboard/review/[id]/reject`: Captures mandatory rejection reasons, transitions draft status to `rejected`, and reply status to `REJECTED`.
  - `POST /api/dashboard/review/[id]/regenerate`: Resets status to `PENDING_REVIEW` and logs regeneration trigger.
  - `POST /api/dashboard/review/[id]/assign`: Sets the operator assignment. Supports passing `"admin"` to auto-assign/escalate to the first active admin.
  - `GET /api/dashboard/stats`: Tenant-aware stats endpoint that aggregates current queue metrics (pending, approved, suppressed, sent counts) to feed the live dashboard overview.
- **Custom Components**:
  - `components/sla-timer.tsx`: Live-refreshing client-side SLA countdown badge. Displays remaining hours/minutes with corresponding visual indicator colors:
    - **Green** badge: `> 1h left`
    - **Yellow** badge: `< 1h left`
    - **Red** badge: `Overdue`
- **Dashboard Review Inbox**:
  - Complete rewrite of `app/dashboard/review/page.tsx` using `DataTable`.
  - Added full-text search across lead emails, companies, and reply texts.
  - Built an interactive filter sidebar for Status (Pending, SLA Warning, Overdue), Intent (Positive, Booking, Objection, FAQ, Nurture), and SLA Health.
- **Three-Panel Draft Detail Page**:
  - Complete overhaul of `app/dashboard/review/[replyItemId]/page.tsx`.
  - **Desktop Layout**: 3 columns consisting of:
    - **Conversation Thread (35%)**: Chronological thread history showing inbound/outbound context and an enriched Lead details card.
    - **AI Classification (25%)**: Interactive confidence progress bar, Claude's italics reasoning statement, sentiment, urgency, quoted key signals, and objection/FAQ context.
    - **Draft Response Editor (40%)**: Fully interactive markdown editor (Edit / Preview / Split modes), dynamic "Approve" vs. "Approve with Edits" button toggles, inline regeneration, custom overlay Rejection modal, and Escalation action.
  - **Mobile Layout**: Tabbed layout toggling between Thread, Classification, and Draft views.

## Design Decisions
- **Three-Panel Split Screen**: Ensures operators have all necessary context (past history, lead metadata, AI confidence, and the drafted response) visible simultaneously without context switching, drastically lowering average handle time (AHT).
- **Custom SVG Icons**: Used an inline custom LinkedIn SVG icon instead of relying on external icon packages to guarantee build consistency and prevent any Turbopack version resolution mismatches.
- **Client-Side SWR Polling**:
  - The review queue page polls every 3 seconds to keep SLA indicators highly accurate.
  - The dashboard overview polls every 10 seconds to keep operational dashboard metrics live without manual refreshing.

## Database Changes
- Migration `20260523000001_add_sla_and_assignment.sql` added SLA and assignment fields to `reply_items` and backfilled them with a non-destructive multi-stage script.

## API Endpoints Created
- `GET /api/dashboard/review`
- `GET /api/dashboard/review/[id]`
- `POST /api/dashboard/review/[id]/approve`
- `POST /api/dashboard/review/[id]/reject`
- `POST /api/dashboard/review/[id]/regenerate`
- `POST /api/dashboard/review/[id]/assign`
- `GET /api/dashboard/stats`

## Testing
- Verified `npm run build` succeeds cleanly under Turbopack in next.js.
- Tested tenant filtering with various dummy datasets to ensure security boundaries are fully enforced.

## Sources
- `ANTIGRAVITY_PROMPTS.md` (Phase 2)
- `DASHBOARD_BUILD_GUIDE.md`
- `AGENTS.md`
