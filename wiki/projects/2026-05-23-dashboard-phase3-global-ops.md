# Dashboard Phase 3 — Global Ops Dashboard

## Objective
Build the operations team's main dashboard showing KPIs, live activity feed, and system health. This is the primary view operators see when they log in.

## What Was Built

### KPI Cards (10 Metrics)
Built a grid of 10 live-updating metric cards to monitor system performance:
1. **Pending Review**: Count of `PENDING_REVIEW` items awaiting operator approval.
2. **Approved Today**: Count of `APPROVED` items updated today.
3. **Suppressed Today**: Count of `SUPPRESSED` items updated today.
4. **Sent Today**: Count of `SENT` items updated today.
5. **Positive Replies**: High-intent prospects (`PENDING_REVIEW` items with `POSITIVE` intent).
6. **Active Campaigns**: Running campaigns with `ACTIVE` status.
7. **Queue Health**: Combined BullMQ depth across all queues.
8. **AI Cost Today**: Estimated daily Claude API spend.
9. **Failure Rate %**: Percentage of failed queue jobs.
10. **Avg SLA Remaining**: Median time left before pending items breach their SLA.

### Real-Time Activity Feed
Implemented a scrollable activity feed displaying the last 20 events. Event types include:
- `NEW_REPLY`: "New reply received: [Lead Name] ([Company]) — [Intent]"
- `APPROVED`: "Reply approved: [Lead Name] — sent to [Campaign]"
- `REJECTED`: "Reply rejected: [Lead Name]"
- `BOOKED`: "🎉 Meeting booked: [Lead Name] ([Company])"
- `SLA_BREACH`: "⚠️ SLA breach: [Lead Name]"
- `FAILED`: "Workflow failed"
- `BOUNCE`: "Reply auto-suppressed"
- `REGENERATED`: "Draft regenerated"

The feed is polled every 5 seconds.

### System Health Bar
Added a horizontal bar at the top of the dashboard showing 5 service statuses:
- **Redis**: Connection latency.
- **Supabase**: PostgreSQL connection health.
- **BullMQ**: Active worker count.
- **Claude API**: Latency.
- **Instantly API**: Operational status.

### API Endpoints
- `GET /api/dashboard/stats`: Expanded to return the 10 KPIs needed for the cards.
- `GET /api/dashboard/activity`: Returns the last 20 events by querying `reply_items` and joining with `reply_classifications`, `raw_replies`, `leads`, and `campaigns`.
- `GET /api/dashboard/health`: Performs a live PostgreSQL `SELECT 1` check and mocks other system services for now.

## Design Decisions
- **Polling Intervals**: 
  - `stats`: 10 seconds (balancing freshness with database load).
  - `activity`: 5 seconds (fast updates for the activity feed).
  - `health`: 15 seconds (less critical, avoids excessive DB/API pings).
- **10 KPI Cards**: Chosen to provide a complete overview of queue depth, throughput, AI performance, and system health in a single glance.
- **Color Coding**: Emphasized critical metrics (Queue Health, Failure Rate, SLA) with dynamic colors (green/yellow/red) based on thresholds to draw operator attention immediately to issues.
