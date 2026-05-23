# Antigravity — Krionics OS Operator Dashboard Build

Hello Antigravity team,

This document explains how to work on the Krionics Operator Dashboard full build using the prompts prepared for you.

---

## What You're Building

**Krionics OS** is an AI-powered B2B outbound infrastructure platform. The **Operator Dashboard** is the internal control panel for Krionics' ops team (Vishwas, Aryan, Avishkar) to review and approve AI-generated replies in real-time.

This is a **14-phase build** covering:
1. Design foundation (shadcn/ui, design tokens, layout)
2. Reply review system (core feature — ops review inbox)
3. Global ops dashboard (KPIs, activity feed)
4. Queue monitoring (BullMQ visibility)
5-14. Client management, campaigns, AI ops, infrastructure, analytics, alerts, audit, voice agents, admin, search

---

## Before You Start

### 1. Read AGENTS.md (Required)
Read `/home/user/krionics-os/AGENTS.md` **first**. This is the project's knowledge base system. It explains:
- How to structure your work
- How to update the wiki
- How to document decisions
- How to cite sources

### 2. Read Project Context
- `wiki/index.md` — understand what's already been documented
- `wiki/log.md` — see the timeline of past work
- `wiki/projects/2026-05-22-operator-dashboard-phase2.md` — what was built in Phase 2

### 3. Read Architecture Docs
- `krionics_os_architecture.md` — overall system design
- `krionics_os_blueprint.md` — implementation blueprint
- `krionics-os-reply-subsystem.md` — reply pipeline (RICR)

### 4. Check Current State
- `apps/dashboard/` — Next.js app (Phase 2 is partially done)
- Run `npm run dev` in `apps/dashboard/` to see the current UI
- Run `npm run seed:demo` to load test data
- Login with: `admin@krionics.com` / `admin123`

---

## How to Use the Prompts

### For Phase 1 (Foundation)

1. **Read** `ANTIGRAVITY_PROMPTS.md` → Phase 1 section
2. **Create branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/dashboard-foundation-design-system
   ```
3. **Follow the prompt:**
   - Install shadcn/ui
   - Add design tokens (colors, fonts from krionics.com)
   - Build layout shell (sidebar, topbar)
   - Redesign login page
   - Implement role-based auth
4. **Update the wiki:**
   - Create `wiki/projects/2026-05-23-dashboard-phase1-foundation.md`
   - Document design decisions, component inventory, auth roles
   - Update `wiki/index.md` to link to your new project page
   - Append to `wiki/log.md`: `## [2026-05-23] phase | Dashboard Phase 1 — Design Foundation`
5. **Test:**
   - Run `npm run dev`
   - Login with different roles
   - Test mobile responsive
   - Verify existing e2e tests pass: `npx tsx scripts/e2e-dashboard.ts`
6. **Push to branch** (do NOT merge to main yet):
   ```bash
   git add -A
   git commit -m "feat(dashboard): phase 1 foundation — design system, auth, layout"
   git push -u origin feature/dashboard-foundation-design-system
   ```
7. **Notify** the user when complete (Vishwas)

### For Phases 2-14

Same workflow:
1. Read the prompt for that phase
2. Create branch: `feature/dashboard-phase[N]-[name]`
3. Implement features per spec
4. Update wiki
5. Push to branch
6. Notify user

---

## Current State (Phase 2 Analysis)

Phase 2 was partially completed. What's working:
- ✅ Login (JWT + httpOnly cookies)
- ✅ Basic review queue table (4 columns)
- ✅ Draft detail page (editor tabs: Edit/Preview/Split)
- ✅ Operator settings & password change
- ✅ Admin operator management
- ✅ Dashboard stat cards (4 metrics)
- ✅ Mobile responsive layout

What's incomplete:
- ❌ UI doesn't match krionics.com brand (no design tokens)
- ❌ shadcn/ui not installed (using raw Tailwind)
- ❌ Sidebar/topbar not properly styled
- ❌ Review queue missing filters, search, proper SLA display
- ❌ No role-based access control (all operators see everything)
- ❌ No queue monitoring
- ❌ No client management
- ❌ No analytics

**Phase 1 will fix the UI foundation** and get shadcn/ui set up. After that, Phase 2 can be enhanced.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** shadcn/ui + Tailwind CSS (to be installed in Phase 1)
- **Auth:** JWT + httpOnly cookies + bcrypt
- **Database:** Supabase (PostgreSQL)
- **Data fetching:** SWR (3s refresh)
- **Queues:** BullMQ (Redis)
- **Charts:** Recharts
- **Icons:** lucide-react
- **Fonts:** Playfair Display (serif) + Inter (sans)

---

## Database Schema (Summary)

Key tables:
- `clients` — tenant accounts
- `campaigns` — outbound campaigns
- `leads` — people targeted
- `reply_items` — incoming replies (status: RECEIVED → APPROVED → SENT)
- `reply_classifications` — Claude's intent/confidence analysis
- `reply_drafts` — AI-generated responses
- `raw_replies` — immutable first-write of each reply
- `operators` — Krionics team members (with role, password_hash)

All scoped by `client_id` for multi-tenancy. RLS (Row Level Security) enforces isolation.

---

## APIs Structure

All new endpoints follow this pattern:
```
GET /api/dashboard/[resource]?filters=...&page=...
GET /api/dashboard/[resource]/[id]
PATCH /api/dashboard/[resource]/[id]
POST /api/dashboard/[resource]/[id]/[action]
```

Example:
```
GET /api/dashboard/review?status=pending&intent=POSITIVE&page=1
GET /api/dashboard/review/[replyItemId]
POST /api/dashboard/review/[replyItemId]/approve
POST /api/dashboard/review/[replyItemId]/reject
```

---

## Wiki Workflow (Important)

For **each phase**, create a project page:

1. **Create file:** `wiki/projects/2026-05-23-dashboard-phase[N]-[name].md`
2. **Structure:**
   ```markdown
   # Dashboard Phase [N] — [Name]

   ## Objective
   [What you're building]

   ## What Was Built
   - Feature 1
   - Feature 2
   - [component names]
   - [API endpoints]

   ## Design Decisions
   - Why shadcn/ui instead of [alternative]
   - Why [component pattern] for [use case]

   ## Database Changes
   - Created tables: [list]
   - Added indexes: [list]

   ## API Endpoints
   - GET /api/dashboard/...
   - POST /api/dashboard/.../[action]

   ## Testing
   - [test cases you wrote]
   - E2E: [e2e test results]

   ## Performance Notes
   - [if applicable: query optimization, caching]

   ## Sources
   - ANTIGRAVITY_PROMPTS.md (Phase [N])
   - [any other references]
   ```

3. **Update `wiki/index.md`:**
   - Add link to your new project page

4. **Append to `wiki/log.md`:**
   ```
   ## [2026-05-23] phase | Dashboard Phase [N] — [name]
   - Completed [components/endpoints]
   - Updated [which docs]
   ```

---

## Code Standards

- Use **shadcn/ui components** (not custom HTML)
- Use **Tailwind CSS** for styling (follow design tokens)
- Use **SWR** for data fetching (with 3s refresh for realtime)
- Use **TypeScript** (strict mode)
- Use **Supabase RLS** for multi-tenancy (never trust user_id from client)
- Use **bcrypt** for password hashing
- Use **error boundaries** for resilience
- Add **loading states** (spinner, skeleton)
- Add **empty states** (helpful messages)

---

## Testing Checklist

Before pushing each phase:

- [ ] `npm run dev` works without errors
- [ ] Page loads and renders
- [ ] Filters/search work
- [ ] Forms save without errors
- [ ] Mobile responsive (test in F12 mobile view)
- [ ] Dark mode if applicable (toggle in settings)
- [ ] E2E tests pass: `npx tsx scripts/e2e-dashboard.ts`
- [ ] No console errors or warnings
- [ ] No TypeScript errors: `npm run build`

---

## Common Gotchas

1. **Multi-tenancy:** Always filter by `client_id` in queries. Never show data from one client to another.
2. **RLS policies:** Supabase has row-level security. Make sure inserts/updates respect client isolation.
3. **Realtime updates:** Use SWR `revalidateOnFocus: true` for accurate data when tab regains focus.
4. **SLA calculations:** SLA is 24h by default. Verify `created_at + 24h` logic.
5. **Passwords:** Always hash with bcrypt (round 10) before storing. Use `bcrypt.compare()` for verification.
6. **Auth middleware:** Check JWT role + permissions before allowing actions.

---

## Contact & Questions

- **Architecture questions?** Read the docs: krionics_os_architecture.md
- **Schema questions?** Check: wiki/architecture/database-schema.md
- **Phase-specific questions?** Read the prompt in ANTIGRAVITY_PROMPTS.md
- **Wiki/docs questions?** Follow: AGENTS.md

---

## Quick Links

- Codebase: `/home/user/krionics-os/apps/dashboard/`
- Prompts: `/home/user/krionics-os/ANTIGRAVITY_PROMPTS.md`
- Wiki: `/home/user/krionics-os/wiki/`
- Architecture: `/home/user/krionics-os/krionics_os_architecture.md`
- Design system reference: krionics.com (screenshot shared with Vishwas)

---

## Phase Order

Suggested order (to minimize blockers):
1. **Phase 1** — Foundation (blocks everything else)
2. **Phase 2** — Review System (core feature, highest priority)
3. **Phase 3** — Global Dashboard (ops visibility)
4. **Phase 4** — Queue Monitoring (ops health)
5. **Phase 5** — Client Management (admin feature)
6. **Phase 6** — Campaign Management (secondary)
7. **Phase 7** — AI Operations (secondary)
8-14. Infrastructure, Analytics, Alerts, Voice, Admin, Search (lowest priority)

You can work on phases in parallel if needed, but Phase 1 must be done first.

---

## Ready to Start?

1. Create branch: `git checkout -b feature/dashboard-foundation-design-system`
2. Read Phase 1 in ANTIGRAVITY_PROMPTS.md
3. Follow the spec
4. Push when done
5. Update wiki

Good luck! 🚀
