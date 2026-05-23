# Phase 9 — Analytics & Reporting

This document covers the Phase 9 implementation details of the Krionics Operator Dashboard, focusing on team productivity statistics, outreach campaign trends, and AI draft accuracy validations.

## Performance Metrics & Formulas

### 1. Operator Productivity Calculations
Operational indicators analyze individual operator review queue velocities and actions taken on the review board:
*   **Daily Productivity average:** `Total review decisions (approve + reject) / (Active Operators Count * Days in Scope)`
*   **SLA Adherence Rate:** `% of review items resolved <= (created_at + INTERVAL '4 hours')`
*   **Accuracy (Approved No Edits):** `% of approved reply drafts resolved without operator keyboard overrides`

### 2. Campaign Deliverability Metrics
*   **Reply Rate:** `Replies received / Total sent * 100`
*   **Positive Intent Rate:** `Replies classified positive / Total replies * 100`
*   **Meeting Booked Rate:** `Meetings booked / Replies classified positive * 100` (derived from intent classifications)
*   **Bounce Rate:** `Bounces / Total sent * 100` (safety benchmark: keep <2.0%)
*   **Cost Per Meeting Trend:** `Total daily operations cost (AI prompts + warmups + custom domain DNS checks) / Total booked meetings`

### 3. AI Quality Validation Metrics
*   **AI Approval Rate:** `% of drafts approved immediately by operators without custom manual edits`
*   **Edit Percentage:** `% of outbound drafts modified before approval`
*   **Regenerate Frequency:** `% of drafts discarded and regenerated entirely via Claude prompts test runs`
*   **Hallucination Rate:** `% of drafts blocked automatically by exclusions, length, or semantic validation tests`

---

## API Aggregation & Filtering Logic

*   `GET /api/dashboard/analytics/operations?dateFrom=`
    *   Joins `operators` (email, name, role) with `review_items` (action_taken, action_at, created_at, action_by).
    *   Computes operator leaderboard details sorting by items approved descending.
*   `GET /api/dashboard/analytics/campaigns?dateFrom=&clientId=&campaignId=`
    *   Groups sending counts daily using standard `DATE_TRUNC('day', occurred_at)` bucketing.
    *   Calculates daily conversion rate curves over time (7d / 30d / 90d toggle).
*   `GET /api/dashboard/analytics/ai?dateFrom=`
    *   Aggregates daily AI quality and validation percentiles trends.

---

## UI Views & Navigation Routing
1. **Root Redirect (`/dashboard/analytics`):** Safely redirects to operations dashboard default view.
2. **Operations Dashboard (`/dashboard/analytics/operations`):** Lists SLA indices, operator leaderboards, productivity cards, and median hours turnaround times.
3. **Campaign Trends (`/dashboard/analytics/campaigns`):** Multi-axis AreaChart trend selector graphing send ratios, click rates, and cost per meetings across date ranges, client selectors, and campaign bounds.
4. **AI Quality Metrics (`/dashboard/analytics/ai`):** Displays 4 side-by-side LineCharts tracking blocking ratios, draft regenerations, and edit ratios.
5. **Sidebar:** Integrated direct parent navigation icon link after AI Analytics.
