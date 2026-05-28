# Source: Krionics OS Master System Architecture Document v1.0

**Ingested:** 2026-05-23  
**Classification:** Internal Engineering · Confidential  
**Authors:** Aryan, Vishwas, Avishkar — Krionics, Bengaluru  
**Original File:** `1b6fe2da-krionics_os_architecture.md`

---

## Document Summary

Version 1.0 of the complete Master System Architecture Document for Krionics OS. This supersedes the earlier architecture fragments ingested in May 2026. It is the canonical engineering reference for all system design decisions.

---

## Key Sections

### Product Vision (§1)

Krionics OS is an **AI-Orchestrated Sales Development Infrastructure** platform — not a cold email tool. It models the full prospect lifecycle across 5 phases: acquisition, enrichment, outbound execution, reply handling, and meeting conversion.

### Core System Philosophy (§2)

10 foundational principles:
1. **State-Driven** — every lead has exactly one mutually exclusive primary state in Supabase
2. **Event-Driven Orchestration** — workflows react to events; no direct workflow-to-workflow chaining
3. **Queue-Based Processing** — all non-trivial operations are async through queues
4. **Config-Driven Workflows** — no business logic hardcoded; loaded from Supabase at runtime
5. **Modular Workflows** — single responsibility, single trigger, single output
6. **AI Responsibility Boundaries** — Claude for probabilistic tasks only; deterministic ops stay in code
7. **Human-in-the-Loop** — Level 1 default; humans control all sends for new clients
8. **Multi-Tenant Isolation** — client_id scoping everywhere; Supabase RLS at database layer
9. **Supabase as Source of Truth** — HubSpot is visibility layer only; Supabase is always correct
10. **Emergent Orchestration** — adding capabilities means subscribing to events, not modifying workflows

### Technology Stack (§3)

```
Apollo.io → Clay → Claude API → Instantly.ai → n8n
                  ↓
             Supabase (source of truth)
                  ↓
  HubSpot (CRM) · Cal.com · Slack · MailReach
                  ↓
         Krionics Dashboard (internal)
```

### Lead State Machine (§6)

27 valid states across 5 phases:
- **Acquisition:** raw_imported → deduplicated → enrichment_pending → enriched → personalized → campaign_ready
- **Outbound:** queued_for_sending → sending_active → (email_bounced | no_response | reply_received)
- **Reply:** reply_received → (positive | faq | objection | nurture | unsubscribe | wrong_contact | ooo)
- **Conversation:** ai_draft_pending → reply_sent → (conversation_active | awaiting_booking | nurture_active)
- **Conversion:** meeting_booked → qualified_opportunity → (closed_positive | closed_negative)

### Event Architecture (§7)

Immutable event log in `events` table. 5 event categories:
1. Acquisition: leads_imported, enrichment_completed, enrichment_failed
2. Outbound: campaign_pushed, email_sent, email_opened, email_bounced
3. Reply: reply_received, reply_classified, draft_generated, draft_approved, auto_reply_sent
4. Conversion: meeting_link_sent, meeting_booked, opportunity_created
5. System: workflow_failed, retry_queued, dead_letter_queued, config_reloaded

Every event carries `trace_id` for end-to-end workflow tracing.

### Queue Architecture (§8)

7 queues:
- **Enrichment Queue** — Clay enrichment batches; 3 retries with exponential backoff
- **AI Generation Queue** — Email sequence generation; 2 retries; cost-rate-limited
- **Reply Classification Queue** — HIGH PRIORITY; 30s/2m backoff
- **Response Queue** — 4 sub-queues: immediate_queue, delayed_queue, approval_queue, nurture_queue
- **Booking Recovery Queue** — Follow-up for awaiting_booking leads; 24h/72h/5d intervals
- **Retry Queue** — Exponential backoff with jitter; max 3 retries
- **Dead Letter Queue** — Slack alert on any entry; 30-day retention

### Reply Orchestration System (§12) — Most Critical Section

7 primary intents: positive, faq, objection, nurture, unsubscribe, ooo, wrong_contact

**Automation Levels:**
- Level 1 (default): AI assists, humans approve all sends
- Level 2 (hybrid): AI auto-sends safe intents (unsubscribe, OOO, simple scheduling); humans approve complex ones
- Level 3 (AI SDR): AI sends everything; humans are escalation-only

**Reply Orchestration Matrix:**
| Intent | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| unsubscribe/ooo | AI Sends | AI Sends | AI Sends |
| wrong_contact | AI Drafts | AI Sends | AI Sends |
| nurture/faq/objection | AI Drafts | AI Drafts | AI Sends |
| positive | AI Drafts | AI Sends | AI Sends |

**Response Delay Windows (configurable per client/intent):**
- unsubscribe: 0–1m
- ooo: 0–2m
- positive: 5–25m
- faq: 15–60m
- objection: 30–240m
- nurture: 2–6h

Delays are **randomized within windows** (not fixed) and **business-hours enforced** (7 AM–10 PM prospect timezone).

### AI Invocation Points (§10)

6 defined Claude invocation points:
1. Enrichment Signal Extraction — buying signals, personalization hooks, ICP fit score
2. Cold Email Sequence Generation — subject, Email 1–3, breakup email
3. **Reply Classification** — intent, confidence, sentiment, suggested_action (most critical)
4. Response Generation — contextual humanized reply within communication policy
5. Objection Intelligence — category, underlying concern, best response angle
6. Analytics Intelligence (future) — performance patterns, optimization recommendations

AI chains (Claude → Claude → Claude) are explicitly avoided. Claude outputs feed workflow logic which may invoke a second Claude step.

### Prompt Engineering (§11)

6-layer composable prompt architecture (assembled at runtime):
1. System Role (static, cacheable)
2. Task Instruction (per-invocation)
3. Client Context (from client_knowledge table)
4. Conversation Context (thread history + latest reply)
5. Knowledge Context (only relevant FAQs/objections for this intent)
6. Output Rules (word limit, forbidden phrases, format constraints)

Prompt templates versioned in `ai_prompts` table. Every invocation records template version for debugging and A/B testing.

### Configuration System (§14)

5 configuration layers:
- `global_configs` — system-wide defaults
- `client_configs` — per-client automation level, CRM, Slack, meeting routing
- `reply_policies` — per-client, per-intent action (auto_send | draft_only | escalate | suppress)
- `timing_rules` — per-client, per-intent delay windows
- `feature_flags` — per-client feature activation (booking reminders, nurture, AI analytics, etc.)

All workflows load config fresh at execution start. Configuration cached in Redis for high-frequency workflows.

### Key Tables (Appendix B)

Full Supabase table list from the architecture spec:
clients, leads, enriched_leads, generated_sequences, replies, reply_classifications, ai_drafts, outbound_events, events, lead_state_history, global_configs, client_configs, campaign_configs, reply_policies, timing_rules, feature_flags, prompt_templates, client_faqs, objection_library, client_positioning, analytics_snapshots, execution_logs, audit_logs, ai_invocation_logs, infrastructure_configs, suppression_list

---

## Implementation Status as of 2026-05-23

See: [wiki/projects/2026-05-23-reply-orchestration-phase1-3.md](../projects/2026-05-23-reply-orchestration-phase1-3.md)

| Architecture Domain | Status |
|---|---|
| **Dashboard (Phases 1-14)** | ✅ Complete |
| **RICR Workers (ingest/classify/draft/send)** | ✅ Complete |
| **Instantly Webhook Handler** | ✅ Complete |
| **Lead State Machine** | ✅ Complete |
| **Database Schema (foundation)** | ✅ Complete |
| **Reply Orchestration DB Tables** | ✅ Complete (migrations 006-015) |
| **Events Table (immutable log)** | ✅ Complete with partitioning |
| **Lead State History** | ✅ Complete |
| **Reply Policies & Timing Rules** | ✅ Schema complete, config pending |
| **Response Queue** | ✅ Schema complete |
| **Enriched Leads (structured)** | ✅ Schema complete |
| **CRM Integration (HubSpot)** | ⏳ Pending |
| **Apollo Lead Acquisition** | ⏳ Pending |
| **Clay Enrichment Workflow** | ⏳ Pending |
| **Cal.com Meeting Booking** | ⏳ Pending |
| **Analytics Intelligence (AI)** | ⏳ Future (§17.3) |
| **Booking Recovery Flow** | ⏳ Pending |
