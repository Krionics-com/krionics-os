# Antigravity Build Prompts — Krionics Operator Dashboard Full Build

**Important First Steps:**
1. Read `AGENTS.md` (root directory) — this defines our knowledge base system
2. Read `wiki/index.md` and `wiki/log.md` — understand what's been documented
3. For each phase, update the wiki with your work — follow the ingest workflow in AGENTS.md
4. Create a branch with the meaningful name provided
5. Push to that branch, link to wiki records

---

## Phase 1 — Foundation (Design System + Auth Upgrades)

**Branch:** `feature/dashboard-foundation-design-system`

**Objective:**
Set up the design foundation for the entire dashboard. This is the blocker — everything else depends on it.

**What to do:**

### 1.1 Install shadcn/ui
- Install shadcn/ui in `apps/dashboard/`
- Configure Tailwind with Krionics brand tokens:
  - Background: `#F5EFE0` (warm cream)
  - Primary: `#C4521C` (burnt terracotta)
  - Text primary: `#1A1A1A`
  - Text secondary: `#666666`
  - Border: `#E5DDD0`
- Typography:
  - Serif (Playfair Display for headings, large numbers)
  - Sans (Inter for body, labels)
- Shadows: Soft, subtle (shadow-sm for cards)
- Border radius: 8px default
- Reference: krionics.com design language

### 1.2 Define Shared Components
- Create/enhance `apps/dashboard/components/`:
  - `ui/card.tsx` (card component with header/footer/body)
  - `ui/badge.tsx` (for intent types, status)
  - `ui/button.tsx` (primary, secondary, ghost variants)
  - `ui/data-table.tsx` (reusable table component)
  - `ui/spinner.tsx` (loading indicator)
  - `ui/empty-state.tsx` (empty queue, no data)
  - `ui/toast.tsx` (notifications)
  - `layout/sidebar.tsx` (collapsible, with Krionics logo + nav items + operator avatar)
  - `layout/topbar.tsx` (breadcrumb, search, alerts, client switcher)
  - `layout/auth-shell.tsx` (for login/auth pages)

### 1.3 Rebuild Layout Shell
- Replace existing dashboard layout with new sidebar/topbar
- Sidebar: collapsible icon/label navigation, client logo at top, operator profile at bottom
- Topbar: breadcrumb navigation, global search bar, alert bell, client switcher dropdown
- Mobile responsive: hamburger menu that opens/closes sidebar on small screens
- Dark mode support (optional but nice)

### 1.4 Redesign Login Page
- Match krionics.com aesthetic (cream background, terracotta accents)
- Clear, minimal form
- Error/success messaging
- Remember email option
- Password reset link (can link to #TODO for now)
- Mobile responsive

### 1.5 Auth Upgrades
- Implement 6 roles in JWT:
  - `super_admin`
  - `admin`
  - `campaign_manager`
  - `reply_reviewer`
  - `analyst`
  - `support_operator`
- Add role-gated route middleware in `middleware.ts`
- Create `lib/auth-helpers.ts`:
  - `requireRole(role)` — middleware for API routes
  - `hasPermission(operator, action, resource)` — granular permission check
  - `canAccessClient(operator, clientId)` — client-level isolation
- Update `app/dashboard/layout.tsx` to:
  - Check role on page load
  - Redirect non-admins away from admin pages
  - Show role-appropriate sidebar items

### 1.6 Session Management
- Add session timeout warning (10 min idle)
- Refresh token before expiry
- Graceful logout on token expiry
- Fix any auth edge cases from Phase 2

**Files to Create/Modify:**
- `apps/dashboard/tailwind.config.ts` — add theme tokens
- `apps/dashboard/components/ui/*` — new component library
- `apps/dashboard/components/layout/*` — sidebar, topbar, shells
- `apps/dashboard/app/login/page.tsx` — redesigned login
- `apps/dashboard/lib/auth-helpers.ts` — role/permission checks
- `apps/dashboard/middleware.ts` — role-based routing
- `apps/dashboard/app/dashboard/layout.tsx` — role checks
- `apps/dashboard/app/api/auth/*` — session management improvements

**Tech Stack:**
- shadcn/ui + Tailwind CSS
- Playfair Display + Inter (Google Fonts or system fonts)
- Next.js middleware for auth

**Testing:**
- Login with different roles (admin vs reviewer) — verify sidebar differs
- Test mobile: hamburger menu opens/closes
- Test session timeout warning
- Test redirect for unauthorized access
- E2E test in `scripts/e2e-dashboard.ts` should still pass

**Wiki Updates:**
- Create `wiki/projects/2026-05-23-dashboard-phase1-foundation.md` documenting:
  - Design tokens (colors, typography)
  - Component inventory
  - Auth role definitions
  - Layout structure
  - Mobile breakpoints

---

## Phase 2 — Reply Review System (Core Ops, Most Critical)

**Branch:** `feature/dashboard-phase2-review-system`

**Objective:**
Build the core reply review inbox and detail page. This is what operators live in. Make it beautiful and functional.

**What to do:**

### 2.1 Review Inbox Page (`/dashboard/review`)
- **Layout:** Full-width table + filters sidebar
- **Table columns:**
  - Lead email (clickable → detail page)
  - Company
  - Intent badge (POSITIVE/BOOKING_INTENT/OBJECTION/FAQ, color-coded)
  - Confidence % (numeric)
  - SLA countdown (live timer, color: green/yellow/red)
  - Assigned operator (dropdown to reassign)
  - Created timestamp
- **Filters panel (collapsible):**
  - Status: pending / SLA warning / past SLA
  - Intent: POSITIVE / BOOKING_INTENT / OBJECTION / FAQ / NURTURE
  - By client (dropdown, if operator has multi-client access)
  - By operator (if admin viewing)
  - SLA: GREEN / YELLOW / RED only
- **Search bar:** Lead name, email, company, keyword in reply text
- **Sorting:** Clickable column headers (SLA ascending for urgent first)
- **Pagination:** 25 rows per page
- **Real-time updates:** Use SWR with 3s refresh interval (already in Phase 2)
- **Empty state:** "No pending reviews" with helpful message

### 2.2 Draft Detail Page (`/dashboard/review/[id]`)
- **Three-column layout:**
  1. **Left (40%):** Conversation context
     - Full email thread (all replies in thread)
     - Timestamps on each message
     - From/to info
     - Lead enrichment: name, title, company, LinkedIn (if available)
     - Campaign info: campaign name, client
  2. **Center/Right (60%):** AI draft editor
     - **Classification breakdown (read-only):**
       - Intent: badge (POSITIVE, etc.)
       - Confidence: % with bar
       - Reasoning: Claude's one-sentence explanation
       - Objection type (if intent=OBJECTION): specific category
       - FAQ topic (if intent=FAQ)
       - Key signals: list of phrases that drove classification
       - Sentiment: POSITIVE/NEUTRAL/NEGATIVE
       - Urgency: HIGH/MEDIUM/LOW
     - **Editable draft:**
       - Subject line (text input)
       - Body (markdown editor with 3 tabs: Edit/Preview/Split)
       - Character count
       - Tone indicator (based on template used)
       - Required fields validation (subject + body not empty)
     - **Actions (button row):**
       - Approve (green, primary) → sends to approved queue
       - Approve with edits (green) → approves the edited version
       - Reject (red) → opens modal for rejection reason
       - Regenerate (secondary) → calls Claude again with same inputs
       - Escalate (secondary) → assigns to admin
       - Assign to operator (dropdown)
     - **Live SLA timer:** Big countdown at top, red if overdue
     - **Diff viewer (optional):** Show original AI draft vs. current edits

### 2.3 Improve Markdown Editor (`components/markdown-editor.tsx`)
- Already exists from Phase 2, but enhance:
  - Syntax highlighting (code blocks, bold, italic)
  - Character counter
  - Line numbers
  - Undo/redo
  - Paste markdown URL → auto-linkify
  - All 3 tabs: Edit / Preview / Split (left/right side-by-side)

### 2.4 SLA Management
- Live countdown timers on each row (24h SLA default, configurable per client)
- Color coding: green (>1h left), yellow (30min-1h), red (overdue)
- Escalation trigger: when SLA breaches, flag operator
- Operator load balancing hint: "High volume — recommend next reviewer"

### 2.5 API Endpoints
- `GET /api/dashboard/review?status=pending&intent=POSITIVE&page=1`
  - Return filtered/paginated reply_items with classifications
- `GET /api/dashboard/review/[replyItemId]`
  - Return full conversation thread, lead context, classification, draft
- `POST /api/dashboard/review/[replyItemId]/approve`
  - Body: `{ edits?: string, approvedBy: operatorId }`
  - Updates reply_items.status → APPROVED
  - Marks reply_drafts.approved_at
- `POST /api/dashboard/review/[replyItemId]/reject`
  - Body: `{ reason: string, rejectedBy: operatorId }`
  - Updates status → REJECTED
- `POST /api/dashboard/review/[replyItemId]/regenerate`
  - Re-calls Claude classification + draft generation
- `POST /api/dashboard/review/[replyItemId]/assign`
  - Body: `{ operatorId: uuid }`
  - Updates reply_items.assigned_to_operator_id
- `GET /api/dashboard/review/[replyItemId]/diff`
  - Returns original vs. current draft for diff viewer

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/review/page.tsx` — inbox (enhance existing)
- `apps/dashboard/app/dashboard/review/[id]/page.tsx` — detail (enhance existing)
- `apps/dashboard/components/review-filters.tsx` — filter sidebar
- `apps/dashboard/components/sla-timer.tsx` — live countdown
- `apps/dashboard/components/classification-badge.tsx` — intent display
- `apps/dashboard/components/markdown-editor.tsx` — enhance existing
- `apps/dashboard/app/api/dashboard/review/*` — new API routes
- `apps/dashboard/lib/review-helpers.ts` — SLA calculations, formatting

**Database:**
- No new tables needed, but verify:
  - `reply_items(id, status, assigned_to_operator_id, sla_expires_at, created_at)`
  - `reply_classifications(intent, confidence, key_signals, reasoning)`
  - `reply_drafts(subject, body_text, approved_at, rejected_at, rejected_reason)`
- Add index on `reply_items(status, sla_expires_at)` for SLA queries
- Add trigger: `reply_items.sla_expires_at = reply_items.created_at + INTERVAL '24h'`

**Testing:**
- Open review queue → see 4 pending items (from seed data)
- Click Sarah Chen → see full thread, classification, draft
- Edit draft subject → hit approve → redirected back to queue
- Queue now shows "Approved Today: 1"
- Click Michael Torres (overdue) → SLA timer is red
- Reject with reason → item removed from queue
- Test filters: show only POSITIVE → see Sarah Chen only
- Mobile: table horizontal scroll, touch-friendly
- E2E test: approve 1 item, check approved count

**Wiki Updates:**
- Create `wiki/projects/2026-05-23-dashboard-phase2-review-system.md` documenting:
  - Review queue UI/UX spec
  - Detail page layout
  - SLA calculation
  - Approval/reject workflow
  - API endpoints

---

## Phase 3 — Global Ops Dashboard

**Branch:** `feature/dashboard-phase3-global-ops-dashboard`

**Objective:**
Build the main overview dashboard showing KPIs, activity feed, and system health.

**What to do:**

### 3.1 KPI Cards (10+)
- Create card component with number + label + sparkline or trend
- Cards:
  1. Total active clients (count)
  2. Active campaigns (count)
  3. Emails sent today (count)
  4. Replies received today (count)
  5. Positive replies today (count, POSITIVE intent only)
  6. Meetings booked today (count, intent=BOOKING_INTENT that were approved)
  7. Queue health (BullMQ depth, red if >100)
  8. AI cost today ($, based on token usage logs)
  9. Failure rate % (failed jobs / total jobs)
  10. Operator workload (pending items waiting for [operator name])

### 3.2 Real-Time Activity Feed
- Sidebar or bottom section showing live events (last 20):
  - `[02:34 PM] New reply received: Sarah Chen (Acme Corp) — POSITIVE`
  - `[02:31 PM] Meeting booked: James Wilson approved → sent → booked`
  - `[02:28 PM] ⚠️ SLA breach: Michael Torres overdue 5m`
  - `[02:25 PM] Workflow failed: classify job failed (retry #2)`
  - `[02:22 PM] Draft approved: Lisa Park approved by Admin`
- Events: new reply, meeting booked, SLA breached, workflow failed, bounce spike, draft approved
- Powered by Supabase Realtime or SWR polling

### 3.3 System Health Bar
- Horizontal bar showing 6 service statuses:
  - Redis (green/red dot + latency)
  - Supabase (green/red dot + status)
  - BullMQ workers (green/red dot + active workers count)
  - Claude API (green/red dot + latency)
  - Instantly API (green/red dot)
  - [Any other critical service]
- Click to expand details

### 3.4 Quick Stats Card
- "This month so far": meetings booked, reply rate %, positive %, cost
- Trend arrows (up/down/flat)

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/page.tsx` — main overview
- `apps/dashboard/components/kpi-card.tsx` — reusable KPI card
- `apps/dashboard/components/activity-feed.tsx` — live event feed
- `apps/dashboard/components/system-health.tsx` — service status bar
- `apps/dashboard/app/api/dashboard/stats` — endpoints for KPI data
- `apps/dashboard/lib/realtime-hooks.ts` — Supabase Realtime subscription

**Database:**
- Verify tables exist: clients, campaigns, reply_items, reply_classifications, reply_drafts
- Create indexes for date-based queries: `reply_items(created_at)`

**Testing:**
- Load `/dashboard` → see all KPI cards with real data
- Cards update live as new replies arrive (test with seed script)
- Activity feed shows new events in real-time
- System health shows all green (no real down services)
- Mobile: cards stack vertically, feed scrollable

**Wiki Updates:**
- Create `wiki/projects/2026-05-23-dashboard-phase3-global-ops.md` documenting:
  - KPI definitions
  - Activity event types
  - System health checks
  - Realtime architecture

---

## Phase 4 — Queue Monitoring + Dead Letter Queue Inspector

**Branch:** `feature/dashboard-phase4-queue-monitoring`

**Objective:**
Give ops visibility into BullMQ queue health and failed jobs.

**What to do:**

### 4.1 Queue Dashboard (`/dashboard/queues`)
- Table of all BullMQ queues with columns:
  - Queue name (replies:ingest, replies:classify, drafts:generate, drafts:send, crm:sync, dead_letter, etc.)
  - Pending (count)
  - Active (count)
  - Failed (count)
  - Processing rate (jobs/sec)
  - Oldest pending job age (minutes)
  - Worker count
  - Status (green/yellow/red based on depth)
- Actions per queue:
  - Pause queue
  - Resume queue
  - Retry all failed jobs
  - Flush queue (danger action)
- Click queue name → detail page

### 4.2 Queue Detail Page
- Graph: queue depth over time (last 1h, 24h, 7d)
- Active jobs list: job ID, payload preview, worker, elapsed time
- Failed jobs (redirects to DLQ or shows here)

### 4.3 Dead Letter Queue Inspector (`/dashboard/dlq`)
- Failed jobs table:
  - Job ID / trace ID
  - Queue (which queue failed)
  - Workflow (which step in RICR)
  - Client (tenant)
  - Error message (first 100 chars)
  - Retry count
  - Failed timestamp
  - Status: failed / retried / discarded
- Filters: by queue, by workflow, by client
- Search: by error message, trace ID
- Click job → detail view:
  - Full payload (input)
  - Full error (stack trace)
  - Retry history (all attempts)
  - Execution logs (if available)
  - Actions: Retry / Retry with modification / Discard / Escalate to admin

### 4.4 BullMQ Integration
- Create `lib/bull-redis.ts`:
  - Connect to Redis (use DATABASE_URL connection string)
  - Export queue instances: ingest, classify, draft, send, crm
- Create `lib/queue-hooks.ts`:
  - `useQueueStatus()` — hook to get queue depth, stats
  - `useFailedJobs()` — hook to get DLQ jobs
- Create `app/api/dashboard/queues/*` endpoints:
  - `GET /api/dashboard/queues` — list all queues with stats
  - `GET /api/dashboard/queues/[queueName]` — queue detail + graph data
  - `GET /api/dashboard/dlq` — failed jobs list
  - `GET /api/dashboard/dlq/[jobId]` — job detail
  - `POST /api/dashboard/dlq/[jobId]/retry` — retry a job
  - `POST /api/dashboard/dlq/[jobId]/discard` — discard a job
  - `POST /api/dashboard/queues/[queueName]/pause`
  - `POST /api/dashboard/queues/[queueName]/resume`

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/queues/page.tsx` — queue list
- `apps/dashboard/app/dashboard/queues/[name]/page.tsx` — queue detail
- `apps/dashboard/app/dashboard/dlq/page.tsx` — DLQ list
- `apps/dashboard/app/dashboard/dlq/[jobId]/page.tsx` — job detail
- `apps/dashboard/lib/bull-redis.ts` — Redis/BullMQ setup
- `apps/dashboard/lib/queue-hooks.ts` — data fetching hooks
- `apps/dashboard/app/api/dashboard/queues/*` — API endpoints
- `apps/dashboard/components/queue-graph.tsx` — chart of queue depth over time

**Tech:**
- BullMQ (already installed in monorepo)
- Recharts for queue depth graph

**Testing:**
- Seed demo data → see all queues populate
- Open `/dashboard/queues` → see queue depths
- Artificially fail a job (test harness) → see in DLQ
- Retry job from DLQ → job moves back to queue
- Pause queue → no new jobs process
- Resume queue → jobs continue
- E2E: queue stays healthy during demo data seeding

**Wiki Updates:**
- Create `wiki/projects/2026-05-23-dashboard-phase4-queue-monitoring.md` documenting:
  - Queue architecture
  - DLQ inspection workflow
  - API endpoints

---

## Phase 5 — Client Management

**Branch:** `feature/dashboard-phase5-client-management`

**Objective:**
Build pages for Krionics ops to manage client accounts, configs, and settings.

**What to do:**

### 5.1 Client List (`/dashboard/clients`)
- Table with columns:
  - Client name (clickable → detail page)
  - Status (active / paused / archived)
  - Active campaigns
  - Meetings booked (30d)
  - Reply rate %
  - Automation level (1 / 2 / 3)
  - Infrastructure health (green/yellow/red)
  - MRR ($)
  - Onboarding stage (setup / warmup / sending / scaling)
- Filters: by status, by onboarding stage
- Actions: click to open detail page, pause, archive

### 5.2 Client Profile Page (`/dashboard/clients/[clientSlug]`)
- Tabs:
  - **Overview:** KPIs, recent activity
  - **Business Info:** company name, contact person, timezone, contract date, MRR
  - **ICP Config:** target industries, company size, titles, geographies, exclusions, buying signals
  - **Campaign Config:** sending limits, inbox pools, sequences, CTA style, tone
  - **Automation:** automation level, auto-send rules, approval rules, escalation rules
  - **CRM Config:** CRM type, API status, field mappings, sync health
  - **Slack Config:** webhook status, alert channels, escalation routing
  - **AI Config:** prompt overrides, tone settings, forbidden claims, personalization depth
  - **Team:** list of operators assigned to this client

- All fields editable (admin only)
- Save button triggers update API
- Validation on required fields

### 5.3 APIs
- `GET /api/dashboard/clients` — list with filters
- `GET /api/dashboard/clients/[slug]` — detail
- `PATCH /api/dashboard/clients/[slug]` — update any field
- `POST /api/dashboard/clients` — create new client (admin)
- `POST /api/dashboard/clients/[slug]/pause` — pause
- `POST /api/dashboard/clients/[slug]/archive` — archive

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/clients/page.tsx`
- `apps/dashboard/app/dashboard/clients/[slug]/page.tsx`
- `apps/dashboard/components/client-form.tsx` — form for editing
- `apps/dashboard/app/api/dashboard/clients/*` — API endpoints

**Database:**
- `clients` table already exists, verify all fields are there

**Testing:**
- Open `/dashboard/clients` → see TechFlow Solutions
- Click TechFlow → see all tabs, edit a field, save
- List updates after save
- Mobile: responsive tabs

---

## Phase 6 — Campaign Management

**Branch:** `feature/dashboard-phase6-campaign-management`

**Objective:**
Build campaign list and detail pages showing performance and funnel.

**What to do:**

### 6.1 Campaign List (`/dashboard/campaigns`)
- Table with columns:
  - Campaign name
  - Client
  - Status (active / paused / archived)
  - Inbox count
  - Leads
  - Reply rate %
  - Positive rate %
  - Meetings booked
  - Bounce rate %
  - Warmup status
- Filters: by client, by status
- Actions: pause, resume, archive, duplicate, export leads

### 6.2 Campaign Detail (`/dashboard/campaigns/[campaignId]`)
- Tabs:
  - **Overview:** main metrics
  - **Funnel:** visual funnel (leads → enriched → personalized → sent → replied → booked)
  - **Sequence:** per-step performance (step 1, 2, 3... showing open %, reply %, click %, positive %)
  - **Inbox:** sending volume, reputation, bounce rates, spam indicators
  - **Leads:** state distribution (not replied, replied, positive, meeting booked, bounced), distribution chart
  - **Activity:** recent events in this campaign

- Use Recharts for funnel and charts
- Live updating (SWR)

### 6.3 APIs
- `GET /api/dashboard/campaigns` — list with filters
- `GET /api/dashboard/campaigns/[id]` — detail with metrics
- `GET /api/dashboard/campaigns/[id]/funnel` — funnel data
- `GET /api/dashboard/campaigns/[id]/sequence-stats` — per-step breakdown
- `PATCH /api/dashboard/campaigns/[id]` — pause/resume/archive

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/campaigns/page.tsx`
- `apps/dashboard/app/dashboard/campaigns/[id]/page.tsx`
- `apps/dashboard/components/funnel-chart.tsx` — Recharts funnel
- `apps/dashboard/app/api/dashboard/campaigns/*` — APIs

**Testing:**
- Open `/dashboard/campaigns` → see Q2 SaaS campaign
- Click campaign → see funnel (all 6 leads in chart)
- Check funnel numbers match seed data

---

## Phase 7 — AI Operations

**Branch:** `feature/dashboard-phase7-ai-operations`

**Objective:**
Manage AI prompts and monitor AI invocations.

**What to do:**

### 7.1 Prompt Management (`/dashboard/ai/prompts`)
- Table: prompt name, type, version, model, client, active/inactive
- Click → detail page with:
  - System prompt (editable textarea)
  - User template (markdown, with {{variables}})
  - Variables list
  - Model selector (claude-3-5-sonnet)
  - Temperature slider (0.0 - 1.0)
  - Max tokens
  - Save button
- Test runner:
  - Input test variables
  - Preview rendered prompt
  - Call Claude API
  - Show output
  - Validation checks (length, content)
- Versioning: can view/restore previous versions

### 7.2 AI Invocation Logs (`/dashboard/ai/logs`)
- Table: timestamp, invocation type (classify / draft / regenerate), latency (ms), input tokens, output tokens, cost ($), status (success / fail)
- Filters: by type, by status, date range
- Click → detail showing full prompt + response

### 7.3 AI Analytics (`/dashboard/ai/analytics`)
- Cards:
  - Daily AI cost (today)
  - Tokens consumed (today)
  - Cache hit rate %
  - Hallucination failures (count)
  - Average latency (ms)
  - Regenerate frequency (% of replies regenerated)
- Charts:
  - Cost trend (7d, 30d)
  - Token usage trend
  - Latency percentiles

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/ai/prompts/page.tsx`
- `apps/dashboard/app/dashboard/ai/prompts/[id]/page.tsx`
- `apps/dashboard/app/dashboard/ai/logs/page.tsx`
- `apps/dashboard/app/dashboard/ai/analytics/page.tsx`
- `apps/dashboard/app/api/dashboard/ai/*` — APIs

**Testing:**
- Open `/dashboard/ai/prompts` → see classification prompt
- Edit prompt → save → verify via API
- Test runner: run test → see Claude response
- Check logs for recent invocations

---

## Phase 8 — Infrastructure Monitoring

**Branch:** `feature/dashboard-phase8-infrastructure`

**Objective:**
Monitor inbox health, domain reputation, and sending infrastructure.

**What to do:**

### 8.1 Inbox Monitoring (`/dashboard/infra/inboxes`)
- Table of all inboxes being used:
  - Email address
  - Client
  - SPF (valid/invalid)
  - DKIM (valid/invalid)
  - DMARC (valid/invalid)
  - Warmup status (day X/30, % complete)
  - Reputation score (0-100)
  - Bounce rate %
  - Spam rate %
  - Last sent: [time ago]
  - Status (healthy / warning / critical)
- Click → detail showing full DNS records, warmup schedule

### 8.2 Domain Monitoring (`/dashboard/infra/domains`)
- Table: domain, client, reputation, DNS validity, blacklist status, deliverability score
- Charts: reputation trend, bounce trend, spam trend

### 8.3 Sending Infrastructure (`/dashboard/infra/sending`)
- Config view:
  - Inbox rotation (which inboxes send from per day)
  - Send limits (emails/day per inbox)
  - Warmup schedules
  - Sending windows (hours of day to send)
  - Ramp-up plan (if ramping volume)

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/infra/inboxes/page.tsx`
- `apps/dashboard/app/dashboard/infra/domains/page.tsx`
- `apps/dashboard/app/dashboard/infra/sending/page.tsx`

**Database:**
- Create `inboxes` table (if not exists):
  - email, client_id, spf_valid, dkim_valid, dmarc_valid, warmup_day, reputation_score, bounce_rate, spam_rate, status
- Create `domains` table (if not exists):
  - domain, client_id, reputation_score, dns_valid, blacklist_status

---

## Phase 9 — Analytics & Reporting

**Branch:** `feature/dashboard-phase9-analytics`

**Objective:**
Build dashboards for trends, operator performance, and campaign analytics.

**What to do:**

### 9.1 Operational Analytics (`/dashboard/analytics/operations`)
- Cards:
  - Operator productivity (avg items approved/rejected per operator per day)
  - Approval turnaround time (median time from received to approved)
  - SLA adherence (% of items approved before SLA)
  - Workflow success rate (% of jobs that succeed on first try)
- Table: operator, items approved, avg turnaround (h), SLA adherence %, accuracy

### 9.2 Campaign Analytics (`/dashboard/analytics/campaigns`)
- Trends (charts):
  - Reply rate over time (7d, 30d, 90d)
  - Positive rate over time
  - Meeting rate over time
  - Bounce rate over time
  - Cost per meeting trend
- By campaign dropdown: filter by campaign
- By client dropdown: filter by client

### 9.3 AI Analytics (`/dashboard/analytics/ai`)
- Charts:
  - AI approval rate (% approved without edits) over time
  - Edit percentage (% edited before approval) over time
  - Regenerate frequency (% regenerated) over time
  - Hallucination detection rate (% flagged by validator)

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/analytics/operations/page.tsx`
- `apps/dashboard/app/dashboard/analytics/campaigns/page.tsx`
- `apps/dashboard/app/dashboard/analytics/ai/page.tsx`
- `apps/dashboard/app/api/dashboard/analytics/*` — APIs

**Tech:**
- Recharts for all trend charts
- Aggregate queries in API endpoints

---

## Phase 10 — Notifications & Alerts

**Branch:** `feature/dashboard-phase10-alerts`

**Objective:**
Alert operators to urgent issues via dashboard, Slack, and email.

**What to do:**

### 10.1 Alert Center (`/dashboard/alerts`)
- Table of all active alerts:
  - Type (SLA breach, queue overload, workflow failure, bounce spike, inbox issue, CRM failure, AI failure)
  - Severity (critical / warning / info)
  - Affected client
  - Timestamp
  - Status (new / acknowledged / resolved)
- Filters: by severity, by type
- Action: acknowledge (mark as read)

### 10.2 Alert Rules Config (`/dashboard/settings/alerts`)
- Configure which alerts trigger:
  - SLA breach (send alert when item past SLA)
  - Queue overload (when depth > threshold)
  - Workflow failure (when job fails)
  - Bounce spike (when bounce rate > threshold)
  - Inbox issue (when deliverability drops)
- For each: set destination (Slack channel, email, both)
- Toggle on/off

### 10.3 Integration
- Slack webhook: send alert messages to #alerts channel
- Email: send to ops team list
- Dashboard toast: show immediate notification

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/alerts/page.tsx`
- `apps/dashboard/app/dashboard/settings/alerts/page.tsx`
- `apps/dashboard/lib/alert-service.ts` — logic for triggering alerts
- `apps/dashboard/app/api/webhooks/alerts` — endpoint for external services to trigger alerts

---

## Phase 11 — Audit & Compliance

**Branch:** `feature/dashboard-phase11-audit`

**Objective:**
Track all changes and operator actions for compliance.

**What to do:**

### 11.1 Audit Logs (`/dashboard/audit`)
- Table of all events:
  - Timestamp
  - Operator
  - Action (approved, rejected, edited, created, deleted, config changed)
  - Resource (client, campaign, reply, draft)
  - Resource ID
  - Before value (if applicable)
  - After value (if applicable)
- Filters: by operator, by action, by resource type, date range
- Search: by resource name
- Export: as CSV

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/audit/page.tsx`
- `apps/dashboard/lib/audit-service.ts` — middleware to log all actions
- `apps/dashboard/app/api/audit/*` — API

**Database:**
- Create `audit_logs` table:
  - id, timestamp, operator_id, action, resource_type, resource_id, before_value, after_value

---

## Phase 12 — Voice Agent Dashboard

**Branch:** `feature/dashboard-phase12-voice-agents`

**Objective:**
Monitor voice calls and agent performance.

**What to do:**

### 12.1 Voice Calls Dashboard (`/dashboard/voice`)
- Stats: active calls, completed today, escalated, booked meetings
- Table: call ID, lead, duration, status (completed / escalated / failed), sentiment, meeting booked
- Click → call detail:
  - Transcript viewer (with timestamps)
  - Sentiment breakdown
  - Summary (auto-generated or agent notes)
  - Recording playback
  - Escalation flag (if applicable)
  - Linked reply (if from RICR)

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/voice/page.tsx`
- `apps/dashboard/app/dashboard/voice/[callId]/page.tsx`

---

## Phase 13 — Admin & Configuration

**Branch:** `feature/dashboard-phase13-admin-config`

**Objective:**
Global system configuration and feature toggles.

**What to do:**

### 13.1 Feature Flags (`/dashboard/admin/features`)
- Toggle switches:
  - Auto-send enabled
  - Voice agents enabled
  - CRM sync enabled
  - Analytics modules enabled
  - Duplicate emails prevention (enabled / warn / disabled)

### 13.2 Global Config (`/dashboard/admin/config`)
- Forms for:
  - Claude API provider settings
  - Retry policies (max retries, backoff strategy)
  - Queue limits (max depth warnings)
  - Global prompts (classification, drafting)
  - SLA defaults (hours before overdue)
  - Email sending limits (per inbox, per day)

**Files to Create/Modify:**
- `apps/dashboard/app/dashboard/admin/features/page.tsx`
- `apps/dashboard/app/dashboard/admin/config/page.tsx`

---

## Phase 14 — Search & Command Palette

**Branch:** `feature/dashboard-phase14-search`

**Objective:**
Quick global search and command execution.

**What to do:**

### 14.1 Global Search (`Cmd+K`)
- Command palette: search across:
  - Clients
  - Leads
  - Campaigns
  - Replies
  - Workflows
  - Meetings
- Results grouped by type
- Click → navigate to detail page
- Keyboard shortcuts: up/down arrows, enter, esc

### 14.2 Quick Actions
- `Open client [name]` → navigate to client detail
- `Retry workflow [id]` → trigger retry
- `Approve draft [id]` → approve from palette
- `Pause campaign [name]` → pause from palette

**Files to Create/Modify:**
- `apps/dashboard/components/command-palette.tsx`
- `apps/dashboard/lib/command-hooks.ts` — search logic
- `apps/dashboard/app/api/search` — search API endpoint

---

# Workflow for Each Phase

1. **Create branch** with the name provided
2. **Read AGENTS.md** and wiki/log.md to understand the project
3. **Implement** the features described
4. **Test thoroughly:**
   - Run `npm run dev` in `apps/dashboard`
   - Test on mobile (F12 → mobile view)
   - Run `scripts/e2e-dashboard.ts` to ensure no regressions
5. **Create wiki page:**
   - `wiki/projects/2026-05-23-dashboard-phase[N]-[name].md`
   - Document what you built, design decisions, API endpoints
6. **Update wiki/index.md** with link to new project page
7. **Append to wiki/log.md:**
   - `## [2026-05-23] phase | Dashboard Phase [N] — [description]`
8. **Push to branch** (do NOT merge to main yet)
9. **Notify user** of completion with link to branch

---

# Design Tokens (Reference)

```
Background: #F5EFE0 (warm cream)
Primary: #C4521C (burnt terracotta)
Text primary: #1A1A1A
Text secondary: #666666
Border: #E5DDD0
Success: #10B981
Warning: #F59E0B
Danger: #EF4444
Info: #3B82F6

Typography:
- Serif (headings, numbers): Playfair Display
- Sans (body, labels): Inter

Shadows:
- sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
- md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
- lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)

Border radius: 8px (cards, buttons), 4px (small elements)
```

---

# Tech Stack Summary

- **Framework:** Next.js 14 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Data:** SWR for client-side fetching
- **Realtime:** Supabase Realtime (WebSockets)
- **Database:** Supabase (PostgreSQL)
- **Auth:** JWT + httpOnly cookies
- **Queues:** BullMQ (Redis)
- **Charts:** Recharts
- **Search:** Global command palette (Cmd+K)
- **Icons:** lucide-react (in shadcn/ui)

---

# Key Resources

- Architecture: `/home/user/krionics-os/krionics_os_architecture.md`
- Blueprint: `/home/user/krionics-os/krionics_os_blueprint.md`
- Reply subsystem: `/home/user/krionics-os/krionics-os-reply-subsystem.md`
- AGENTS.md: `/home/user/krionics-os/AGENTS.md` (READ FIRST)
- Wiki: `/home/user/krionics-os/wiki/`
- Dashboard code: `/home/user/krionics-os/apps/dashboard/`
- Demo guide: `/home/user/krionics-os/DEMO_GUIDE.md`
