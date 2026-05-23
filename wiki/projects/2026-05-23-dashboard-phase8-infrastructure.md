# Phase 8 — Infrastructure Health & Domain Reputation

This document covers the Phase 8 implementation details of the Krionics Operator Dashboard, focusing on email inbox warmup progress, SPF/DKIM/DMARC DNS authentications, bounce/spam delivery percentiles, and domain sending health indexes.

## System Architecture & Operational Flows

### 1. Delivery Metrics Calculation
Email deliverability telemetry is calculated in real-time by aggregating logs from the `email_events` table (partitioned monthly) using these SQL filter formulas:
*   **Bounce Rate:** `COUNT(event_type = 'bounced') / COUNT(event_type = 'sent') * 100` (industry limit: <2%)
*   **Spam/Complaint Rate:** `COUNT(event_type = 'spam' OR event_type = 'complained') / COUNT(event_type = 'sent') * 100` (limit: <0.1%)
*   **Open Rate:** `COUNT(event_type = 'opened') / COUNT(event_type = 'sent') * 100`
*   **Click Rate:** `COUNT(event_type = 'clicked') / COUNT(event_type = 'sent') * 100`

### 2. Inbox Warmup Schedule Workflow
Each email inbox has a warmup status tracking its operational maturity. The warmup statuses are:
*   `Not started`: A newly configured inbox that has not started delivery warmups.
*   `Day X/30`: An active warmup in progress, scaling outbound volume incrementally.
*   `Complete`: Warmup is complete, ready for full campaign scale.

### 3. Domain Suffix Aggregator
Since domains do not exist as independent tables, the system dynamically parses the domain suffix directly from `inbox_email` addresses (e.g. splitting `contact@krionics.com` to `krionics.com`) using memory aggregations. This links multiple inboxes together to report combined performance and flag DNS health warnings.

---

## API Endpoints Built

*   `GET /api/dashboard/infra/inboxes` — Retrieves distinct sending inboxes with calculated and deterministic mock metrics (warmup, SPF, DKIM, DMARC, reputation).
*   `GET /api/dashboard/infra/inboxes/[email]` — Returns granular historical event timeline, 30-day reputation trends, and DNS authentication blocks for one inbox.
*   `GET /api/dashboard/infra/domains` — Aggregates and returns unique domains with combined delivery ratios.
*   `GET /api/dashboard/infra/domains/[domain]` — Provides domain details including combined metrics and the complete list of constituent sending inboxes.

---

## UI Views & Navigation Routing
1. **Inbox Master Grid (`/dashboard/infra/inboxes`):** Searchable list showing campaign volumes, delivery indexes, warmup stages, and DNS authentications. Clicking any row navigates to the detailed view.
2. **Inbox Detailed View (`/dashboard/infra/inboxes/[email]`):** Displays KPI cards, visual progress indicators, a Recharts 30-day reputation LineChart, a chronologically ordered 20-event feed, and full text copies of SPF/DKIM/DMARC records.
3. **Domains Master Grid (`/dashboard/infra/domains`):** Displays overall domain counts, aggregated deliverability metrics, and global check badges.
4. **Domain Detailed View (`/dashboard/infra/domains/[domain]`):** Aggregates total domain sent volumes and loops out individual inbox rows.
5. **Sidebar:** Integrated direct route navigation items after AI Analytics using `Mail` and `Globe` icons.
