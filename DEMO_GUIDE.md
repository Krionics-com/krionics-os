# Running the Demo

This guide walks you through running the operator dashboard locally with realistic sample data — no Instantly credentials needed.

---

## Prerequisites

- Node.js 18+
- A `.env` file at the repo root with `DATABASE_URL` set (Supabase session pooler URL)
- Supabase migrations already run (`pnpm db:migrate`)

---

## Step 1 — Set up the dashboard `.env`

Create `apps/dashboard/.env.local`:

```
DATABASE_URL=postgresql://postgres.[your-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
JWT_SECRET=any-random-string-at-least-32-chars
NODE_ENV=development
```

> `JWT_SECRET` can be anything locally, e.g. `super-secret-dev-key-krionics-2026`

---

## Step 2 — Seed demo data

From the repo root:

```bash
# Make sure DATABASE_URL is in your root .env
npx tsx scripts/seed-demo-data.ts
```

You should see:

```
🌱  Seeding demo data...

✓  Client:    TechFlow Solutions  (uuid...)
✓  Campaign:  Q2 SaaS Decision-Makers 2026  (uuid...)

✓  POSITIVE        Sarah Chen      → PENDING_REVIEW   🟢 SLA OK
✓  BOOKING_INTENT  James Wilson    → PENDING_REVIEW   🟢 SLA OK
✓  OBJECTION       Michael Torres  → PENDING_REVIEW   🔴 OVERDUE
✓  FAQ             Lisa Park       → PENDING_REVIEW   🟡 SLA WARNING
✓  BOUNCE_OOO      David Kim       → DISMISSED
✓  UNSUBSCRIBE     Emma Johnson    → SUPPRESSED

✅  Demo data seeded successfully!
```

Re-running the script is safe — it skips already-seeded items.

---

## Step 3 — Install dashboard dependencies

```bash
cd apps/dashboard
npm install
```

---

## Step 4 — Start the dashboard

```bash
# Inside apps/dashboard/
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Step 5 — Log in

```
Email:    admin@krionics.com
Password: admin123
```

---

## What You'll See & What You Can Do

### Dashboard Overview (`/dashboard`)

Four stats cards showing live counts from the database:

| Card | What it shows |
|------|---------------|
| Pending Review | 4 (the PENDING_REVIEW items waiting for action) |
| Approved Today | 0 (until you approve something) |
| Suppressed Today | 1 (Emma Johnson — UNSUBSCRIBE) |
| Sent Today | 0 (until approved items are sent) |

---

### Review Queue (`/dashboard/review`)

A live table of all `PENDING_REVIEW` replies. Refreshes every 3 seconds.

You'll see 4 rows:

| Lead | Company | Intent | Confidence | SLA |
|------|---------|--------|-----------|-----|
| sarah.chen@acmecorp.com | Acme Corp | POSITIVE | 92% | 🟢 ~2h left |
| james.wilson@startupstack.io | StartupStack | BOOKING INTENT | 97% | 🟢 ~3.5h left |
| m.torres@enterprise-sol.com | Enterprise Solutions | OBJECTION | 88% | 🔴 Overdue |
| lisa.park@growthlabs.co | GrowthLabs | FAQ | 85% | 🟡 ~20min left |

**Click any row** to open the detail page.

---

### Reply Detail Page (`/dashboard/review/{id}`)

Two-column layout:

**LEFT column — Context:**
- Raw reply text from the lead
- Lead info (name, company, title)
- Classification breakdown (intent badge, confidence %, sentiment, urgency, key signals)

**RIGHT column — Draft Editor:**
- AI-generated draft subject and body
- Three editor tabs: **Edit** | **Preview** | **Split**
  - Edit = raw text editing
  - Preview = rendered markdown view
  - Split = edit on left, preview on right (side by side)
- **Approve** button (green) — approves the draft as-is or with edits
- **Reject** button (red) — requires a rejection reason

**Try this flow:**
1. Open Sarah Chen's reply (POSITIVE intent)
2. Read the draft — it's a warm response about pricing + Calendly link
3. Switch to **Preview** tab to see it rendered as markdown
4. Edit something in the **Edit** tab (change a sentence)
5. Hit **Approve** — you'll be redirected back to the queue
6. The dashboard stat card now shows "Approved Today: 1"

---

### What Each Demo Reply Represents

#### 1. Sarah Chen — `POSITIVE` 🟢
```
"Hey Alex, this actually looks really interesting.
 Can you tell me more about pricing and implementation?"
```
- Lead is interested and asking commercial questions
- AI draft: Warm response with pricing overview + Calendly link
- **Your job**: Review the draft, optionally edit, then approve

#### 2. James Wilson — `BOOKING_INTENT` 🟢 (urgent)
```
"Alex, perfect timing — I'd love to jump on a 30-min call this week."
```
- Lead is ready to book right now (highest buying intent)
- AI draft: Short direct response with Calendly link
- **Your job**: Approve quickly (high confidence, high urgency)

#### 3. Michael Torres — `OBJECTION` 🔴 (overdue)
```
"We just signed a 2-year contract with a competitor."
```
- Lead has a timing objection — classic competitor lock-in
- AI draft: Empathetic response, ask to reconnect in 18 months
- **Your job**: Approve to stay top-of-mind for future, or reject

#### 4. Lisa Park — `FAQ` 🟡 (SLA warning)
```
"Do you integrate with HubSpot? What's setup like for 15 reps?"
```
- Lead is doing pre-sales technical due diligence
- AI draft: Detailed FAQ answer addressing both questions
- **Your job**: Verify the draft answers correctly, approve

#### 5. David Kim — `BOUNCE_OOO` (auto-dismissed)
```
"I'm currently out of office until June 1st..."
```
- Auto-resolved by the RICR pipeline — no action needed
- Does NOT appear in the review queue
- Visible only on the Dashboard overview (not in pending count)

#### 6. Emma Johnson — `UNSUBSCRIBE` (auto-suppressed)
```
"Please remove me from your mailing list."
```
- Auto-resolved and added to suppression list
- Counts in "Suppressed Today" on Dashboard overview
- Does NOT appear in the review queue

---

### Settings Page (`/dashboard/settings`)

- Shows your operator profile (admin@krionics.com, Admin, role: admin)
- Change your password from here

### Admin Page (`/dashboard/admin`)

- Lists all operators
- Create new operators (reviewer or admin role)
- Toggle active/inactive
- Try creating a new reviewer: `reviewer@techflow.io` / `password123`

---

## Simulating the Full RICR Flow

To simulate what would happen if a new reply arrived (without Instantly):

```bash
# Add one more reply manually to the queue
npx tsx scripts/seed-demo-data.ts
# (already idempotent — won't duplicate)
```

To clear all demo data and start fresh, run in Supabase SQL editor:

```sql
DELETE FROM reply_drafts    WHERE trace_id IN (SELECT trace_id FROM reply_items WHERE client_id IN (SELECT id FROM clients WHERE slug = 'techflow-demo'));
DELETE FROM reply_classifications WHERE reply_item_id IN (SELECT id FROM reply_items WHERE client_id IN (SELECT id FROM clients WHERE slug = 'techflow-demo'));
DELETE FROM reply_items     WHERE client_id IN (SELECT id FROM clients WHERE slug = 'techflow-demo');
DELETE FROM raw_replies     WHERE idempotency_key LIKE 'demo-seed-%';
DELETE FROM leads           WHERE client_id IN (SELECT id FROM clients WHERE slug = 'techflow-demo');
DELETE FROM campaigns       WHERE client_id IN (SELECT id FROM clients WHERE slug = 'techflow-demo');
DELETE FROM clients         WHERE slug = 'techflow-demo';
```

Then re-run `npx tsx scripts/seed-demo-data.ts` to get fresh data.

---

## Summary of Demo Credentials

| What | Value |
|------|-------|
| Dashboard URL | http://localhost:3000 |
| Admin login | admin@krionics.com / admin123 |
| Demo client | TechFlow Solutions |
| Demo campaign | Q2 SaaS Decision-Makers 2026 |
| Items in queue | 4 (PENDING_REVIEW) |
| Auto-resolved | 2 (DISMISSED + SUPPRESSED) |
