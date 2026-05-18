# KRIONICS OS
## Master System Architecture Document
### AI-Orchestrated Multi-Tenant Outbound Infrastructure Platform

**Classification:** Internal Engineering Architecture · Confidential  
**Version:** 1.0  
**Authors:** Aryan · Vishwas · Avishkar  
**Organization:** Krionics, Bengaluru, India  
**Serving:** US · UK · EU · CA · AU  

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Core System Philosophy](#2-core-system-philosophy)
3. [Technology Stack](#3-technology-stack)
4. [Client Discovery & Operating Profile Architecture](#4-client-discovery--operating-profile-architecture)
5. [End-to-End Workflow Architecture](#5-end-to-end-workflow-architecture)
6. [Lead State Machine](#6-lead-state-machine)
7. [Event Architecture](#7-event-architecture)
8. [Queue Architecture](#8-queue-architecture)
9. [Workflow Architecture](#9-workflow-architecture)
10. [AI Invocation Architecture](#10-ai-invocation-architecture)
11. [Prompt & Context Engineering](#11-prompt--context-engineering)
12. [Reply Orchestration System](#12-reply-orchestration-system)
13. [CRM / Dashboard / Slack / Database Separation](#13-crm--dashboard--slack--database-separation)
14. [Configuration System](#14-configuration-system)
15. [Observability & Logging](#15-observability--logging)
16. [Scaling & Reliability](#16-scaling--reliability)
17. [Future Expansion](#17-future-expansion)

---

## 1. Product Vision

### 1.1 What Krionics OS Is

Krionics OS is not a cold email tool. It is not a campaign scheduler. It is not a lead list generator wrapped in an automation layer.

Krionics OS is a **programmable outbound infrastructure platform** — a multi-tenant, AI-orchestrated, state-driven operating system for B2B pipeline generation, designed to be deployed on behalf of clients and operated as a managed service.

The distinction matters. A cold email tool executes a sequence. Krionics OS models the entire lifecycle of a prospect — from raw acquisition through enrichment, personalization, outbound execution, conversational reply handling, meeting booking, pipeline creation, and nurture routing — as a coherent, observable, configurable system.

### 1.2 System Category

Krionics OS occupies the category of **AI-Orchestrated Sales Development Infrastructure**. The closest analogies are not SaaS products — they are internal platforms built by category-leading B2B outbound organizations. The difference between simple automation and programmable outbound infrastructure can be summarized as follows:

| Dimension | Simple Automation | Krionics OS |
|---|---|---|
| State management | None (conditional logic in workflows) | Explicit lead state machine |
| Event model | Direct workflow chaining | Event-driven, decoupled consumers |
| Configuration | Hardcoded in workflow nodes | Runtime-loaded from centralized config |
| AI usage | Ad-hoc LLM calls | Defined invocation contracts with structured outputs |
| Failure handling | Silent failures | Retry queues, dead-letter queues, audit logs |
| Multi-tenancy | Duplicated workflows per client | Generic workflows + per-client config injection |
| Observability | Webhook logs | Full execution trace, event history, operational dashboards |
| Reply handling | Webhook → Slack notification | AI classification → policy routing → response scheduling → delivery |

### 1.3 What the System Handles

Krionics OS orchestrates the following operational domains:

- **Lead Acquisition:** ICP-filtered prospect discovery from Apollo
- **Enrichment:** Multi-pass intelligence generation via Clay (LinkedIn, company signals, hiring data, tech stack)
- **AI Personalization:** Structured dynamic sequence generation via Claude API
- **Outbound Execution:** Multi-inbox campaign management via Instantly
- **Reply Orchestration:** Classification, intent routing, response generation, delay scheduling, human approval queues
- **Meeting Booking:** Cal.com integration with booking recovery and conversion tracking
- **CRM Synchronization:** Isolated, event-triggered sync of sales-significant events to HubSpot
- **Nurture Management:** State-driven future follow-up routing
- **Analytics & Observability:** Event-aggregated metrics, funnel tracking, operational dashboards
- **Workflow Orchestration:** n8n-based modular event-driven workflow execution

---

## 2. Core System Philosophy

### 2.1 State-Driven Architecture

Every lead in Krionics OS is governed by an explicit, mutually exclusive primary state. No conditional logic embedded in workflows determines a lead's situation — the state stored in Supabase is the authoritative source of current truth.

This matters because state-driven systems are the only architecture that scales cleanly. When state transitions drive automation, workflows become reactive consumers of state changes rather than procedural scripts that embed business logic. This separation enables workflows to be replaced, extended, or debugged without affecting the state model. It enables dashboards to be computed directly from state distributions. It eliminates the category of bugs where multiple workflows operate simultaneously on the same lead with conflicting assumptions.

The state machine is described in full in [Section 6](#6-lead-state-machine).

### 2.2 Event-Driven Orchestration

When something meaningful happens in Krionics OS — a reply arrives, a lead is enriched, a meeting is booked — the system emits an immutable event. All interested services react to that event independently. No workflow directly invokes another workflow.

This architectural choice prevents tight coupling. A reply processing workflow should not know that a CRM workflow exists. The reply processing workflow emits `reply_classified`. The CRM workflow subscribes to `reply_classified` and decides whether to sync. These are independent concerns, independently deployable, independently debuggable.

Events are the historical truth of the system. States are the current truth. This separation is foundational.

### 2.3 Queue-Based Processing

All non-trivial operations are executed asynchronously through queues. When a reply arrives, it is not processed synchronously before the webhook acknowledges. The reply is stored immediately, an event is emitted, and processing happens in the background through the appropriate queue.

Queues provide: retry semantics for transient failures, parallel processing for scale, observable backlogs for operational awareness, and fault isolation so a failure in the enrichment queue does not affect the reply queue.

### 2.4 Config-Driven Workflows

No business logic is hardcoded into workflow nodes. When a reply arrives, the reply orchestration workflow does not contain `if intent == positive: wait 10 minutes`. It reads `config.response_delay.positive_reply.max` from the configuration system at runtime.

This distinction is what separates an automation from a platform. Config-driven workflows mean that behavior changes do not require workflow changes. A client's automation level can be upgraded from Level 1 to Level 2 without touching a single workflow. Response delay windows can be tuned without a deployment. New feature flags can be activated per client without workflow forks.

### 2.5 Modular Workflow Design

Krionics OS contains over 30 distinct workflows, each with a single clearly defined responsibility, a single triggering event, and a single emitted output event. No workflow is a mega-flow. No workflow directly couples two unrelated operational domains.

The test for a well-designed workflow: can it be understood, tested, and replaced without reading any other workflow? If yes, it is appropriately scoped. If a workflow must be understood in the context of three other workflows to make sense, it has violated the modularity principle.

### 2.6 AI Responsibility Boundaries

Claude is a cognitive service in Krionics OS. It is invoked at explicitly defined points where probabilistic interpretation, contextual language generation, or fuzzy judgment is required. It is not invoked for deterministic operations.

State transitions are not AI decisions — they are workflow logic decisions triggered by AI outputs. Campaign routing is not an AI task — it is an orchestration task informed by AI classification. This boundary prevents the architectural failure mode where AI becomes an uncontrolled dependency embedded throughout the system, making debugging impossible and costs unpredictable.

AI invocation contracts — defined inputs, defined outputs — are documented in [Section 10](#10-ai-invocation-architecture).

### 2.7 Human-in-the-Loop Operations

At Automation Level 1 (default for all new clients), humans review and approve all AI-generated replies before send. At Level 2, humans handle only strategically sensitive conversations. At Level 3, humans are escalation handlers only.

The human-in-the-loop principle is not a limitation of AI capability — it is a design choice that protects client relationships, builds trust in the system, and generates the ground-truth dataset needed to eventually operate at higher automation levels safely.

### 2.8 Multi-Tenant Isolation

Every lead, campaign, configuration, event, and workflow execution in Krionics OS is scoped to a `client_id`. Generic workflows load client-specific configuration at runtime. No client's data can influence another client's operation. Supabase row-level security enforces isolation at the database layer. The dashboard enforces isolation at the authentication layer.

### 2.9 Supabase as Operational Source of Truth

HubSpot is not the backend of Krionics OS. HubSpot is the sales visibility layer — a read-optimized view of sales-significant events for the client's sales team.

Supabase is the operational source of truth: it stores every raw lead, every enrichment result, every AI-generated sequence, every reply, every state transition, every event, every configuration. If a discrepancy exists between Supabase and HubSpot, Supabase is correct. HubSpot is eventually consistent with Supabase — not the other way around.

### 2.10 Orchestration via Events and States, Not Direct Chaining

The orchestration model of Krionics OS is emergent, not procedural. No master workflow calls sub-workflows in sequence. Instead, events propagate through the system and workflows react. States represent checkpoints in the lead lifecycle and trigger downstream automation.

This means that adding a new capability to the system — say, an SMS follow-up after a meeting is booked — does not require modifying any existing workflow. It requires creating a new workflow that subscribes to the `meeting_booked` event. The existing system remains unchanged.

---

## 3. Technology Stack

### 3.1 Stack Overview

```
Apollo.io          →  Lead discovery and ICP targeting
     ↓
Clay               →  Enrichment and personalization intelligence
     ↓
Claude API         →  AI reasoning, generation, and classification
     ↓
Instantly.ai       →  Cold email infrastructure and campaign execution
     ↓
n8n                →  Workflow orchestration and event processing
     ↓
Supabase           →  Operational database and source of truth
     ↓
HubSpot            →  Sales pipeline visibility (CRM)
     ↓
Cal.com            →  Meeting scheduling infrastructure
     ↓
Krionics Dashboard →  Multi-tenant client observability
     ↓
Slack              →  Operational alerts and human-action triggers
```

### 3.2 Tool Responsibilities

#### HubSpot CRM
**Architectural Role:** Sales visibility layer — not operational backend.

HubSpot receives only sales-significant events: positive replies, qualified conversations, meeting bookings, opportunity creation. It provides the client's sales team a clean, familiar view of pipeline activity. It does not store raw leads, enrichment data, AI outputs, workflow states, or sequence data. That information belongs in Supabase.

HubSpot is replaceable. Clients using Pipedrive, Salesforce, or GoHighLevel receive the same sync — only the CRM sync workflow changes. The rest of the system is CRM-agnostic.

#### Apollo.io
**Architectural Role:** Lead discovery — finds who exists, not who matters.

Apollo executes ICP filter queries derived from the Client Operating Profile and returns raw lead records: name, company, title, email, LinkedIn URL, website. Apollo's output is deliberately narrow. It knows nothing about sequences, personalization, dashboards, or reply logic. ICP filters are the only thing Apollo ever receives.

#### Clay
**Architectural Role:** Enrichment and personalization intelligence layer.

Clay transforms raw Apollo leads into intelligent prospects. It performs multi-pass enrichment: LinkedIn data, company growth signals, hiring signals, tech stack identification, website summarization, founder activity. The output is not just enriched data — it is structured personalization context that feeds the AI generation layer.

Clay is also where the transition from "who exists" to "who matters" happens. A lead with a hiring signal for SDRs, an HubSpot integration, and a recently expanded sales team is a different prospect operationally than one without those signals. Clay surfaces those differences.

#### Anthropic Claude API
**Architectural Role:** AI intelligence layer — probabilistic and generative tasks only.

Claude is invoked at six explicitly defined points in the system (see Section 10). It performs reply classification, cold email generation, objection intelligence extraction, enrichment interpretation, and — in later stages — campaign analytics intelligence. It does not make orchestration decisions, routing decisions, or state transition decisions. Those are workflow concerns, informed by Claude's structured outputs.

Claude is used over alternatives because of superior contextual reasoning quality for nuanced outbound scenarios — nuanced replies, objection handling, and contextual personalization that needs to feel human without being hallucinated.

#### Instantly.ai
**Architectural Role:** Cold email infrastructure and campaign execution engine.

Instantly handles inbox rotation, warmup, sending schedules, sequence execution, deliverability monitoring, and reply webhook emission. It is the execution layer — it receives the final prepared payload (email, sequence, inbox assignment) and sends. It makes no decisions about content, timing policy, or lead routing. When a reply arrives, Instantly emits a webhook to n8n, and its role ends. All reply processing happens in Krionics OS infrastructure.

Importantly, Instantly is not just for cold outbound. It serves as the campaign state execution layer — handling nurture campaigns, booking recovery campaigns, and re-engagement campaigns as well. The distinction is that Instantly never decides which campaign type a lead should be in. That decision belongs to the orchestration layer.

#### n8n
**Architectural Role:** Workflow orchestration — the event-processing glue.

n8n is not the backend of Krionics OS. It does not store data, make business logic decisions, or manage state. n8n receives events, loads configuration from Supabase, executes the appropriate operation, emits output events, and stores results. Each n8n workflow is a single-responsibility orchestration unit.

n8n is self-hosted to enable custom workflow patterns, avoid platform vendor lock-in, and control execution costs at scale.

#### Supabase
**Architectural Role:** Operational source of truth — the real backend of Krionics OS.

Supabase is the central nervous system. It stores:
- All lead data across every lifecycle stage
- All enrichment results
- All AI-generated sequences
- All reply history and AI classification results
- All workflow state transitions
- All events (immutable event log)
- All configurations (client, campaign, global, timing, feature flags)
- All operational metrics for dashboard aggregation

Every workflow reads from Supabase and writes to Supabase. No other service is the authoritative record of operational data. When integrations fail, data is recoverable from Supabase. When workflows are rebuilt, they rehydrate from Supabase. Its role as the single source of truth is non-negotiable.

#### Cal.com
**Architectural Role:** Meeting scheduling infrastructure.

Cal.com is chosen over Calendly for its API-first design, developer-friendly customization, and long-term flexibility for routing logic (round-robin assignment, availability management, multi-host routing). Cal.com emits booking events that trigger the booking synchronization workflow — updating lead states, CRM pipeline stages, and dashboard metrics.

#### Slack
**Architectural Role:** Operational event visibility and human-action triggers.

Slack receives only events that require human attention or represent meaningful wins: positive reply alerts, pending approval notifications, system failure alerts, deliverability warnings, high-intent lead escalations. It is not an analytics platform and it does not receive operational noise. The Slack alert philosophy is: if a human does not need to act or be informed, no alert is sent.

#### Google Workspace
**Architectural Role:** Email sending infrastructure.

Google Workspace provides the actual SMTP infrastructure for cold outbound. Lookalike domains are provisioned with SPF, DKIM, and DMARC. The client's primary domain is never used for cold outbound. Inbox warmup via MailReach protects domain reputation before any campaign sends.

#### MailReach
**Architectural Role:** Deliverability protection — infrastructure insurance.

MailReach manages inbox warmup and ongoing deliverability monitoring. Deliverability is not an afterthought — a crashed domain reputation can end a client's campaign and a client's relationship. MailReach provides continuous inbox health monitoring and spam rate visibility.

#### Krionics Dashboard (Custom Multi-Tenant)
**Architectural Role:** Client observability layer.

The dashboard is a single shared platform with authentication, permissions, and client isolation. It is not a custom dashboard per client. Clients see their own data — meetings booked, reply analytics, sequence monitoring, infrastructure health, pipeline tracking, deliverability visibility. The dashboard reads aggregated metrics from Supabase — it does not contain raw operational data, AI reasoning, workflow internals, or draft replies.

---

## 4. Client Discovery & Operating Profile Architecture

### 4.1 The Discovery Call as System Design Session

The client discovery call is not a sales call. The sale has already happened. The discovery call is a **system design session** — a structured engineering interview whose output is the Client Operating Profile, the configuration document that powers every downstream workflow.

Poor discovery creates cascading failures: bad ICP filters in Apollo → irrelevant leads → poor enrichment signals → low-quality personalization → bad sequences → low reply rates → client churn. Every hour invested in discovery quality multiplies across the entire campaign lifecycle.

The mental model for running this call: *"If we were this client's internal outbound team, what would we need to know to operate successfully?"*

### 4.2 Discovery Call Structure — Six Phases

#### Phase 1: Business Understanding

Goal: Understand the business deeply — not surface-level. This is where business context that will later inform personalization, copywriting, and objection handling is gathered.

**Core Business Questions:**
- What exactly do you sell? What transformation does a client get?
- What is the average contract value and sales cycle length?
- Who typically buys? Is this transactional or relationship-driven?

**Offer Understanding Questions:**
- What is your flagship offer and what problems does it solve?
- Why do clients choose you over competitors?
- What usually convinces clients to buy? What objections appear most often?

**Revenue Understanding Questions:**
- Which client types are most profitable? Which do you not want?
- Which vertical converts best and has highest retention?

This information directly feeds: personalization context, objection handling knowledge base, ICP targeting logic, and lead scoring criteria.

#### Phase 2: ICP Architecture

Goal: Achieve operational ICP clarity — specific enough to configure Apollo filters, specific enough to train Clay enrichment signals, specific enough to configure lead scoring.

**Company-Level ICP Questions:**
- Target industries, company size, revenue range, geography
- Startup vs. established, service business vs. SaaS
- Industries to explicitly exclude

**Buyer-Level ICP Questions:**
- Decision-maker title (Founder? Head of Growth? Sales Director?)
- Who else influences the purchase decision?

**Buying Signals (Critical):**
- What indicates someone is ready to buy?
- Common signals: hiring SDRs, recently funded, scaling sales team, new market expansion, poor outbound performance currently

These buying signals become the lead qualification logic embedded in the Clay enrichment workflow and the Lead Quality Scoring (LQS) calculation.

#### Phase 3: Current Sales Process Analysis

Goal: Diagnose operational maturity. This changes system design. A client with no CRM, no pipeline, and no sales process requires more operational support than one with a mature sales infrastructure.

**Process Questions:**
- How do you currently get clients? What % from referrals?
- Do you do outbound? What tools? What worked? What failed and why?
- How are leads handled today? Who handles replies? Who runs sales calls?
- How are meetings booked? What CRM process exists?

#### Phase 4: Tech Stack Confirmation

Krionics OS standardizes its tech stack across all clients. The discovery call confirms which CRM the client uses (HubSpot, Pipedrive, Salesforce, GoHighLevel) and what calendar integration is required. The stack itself is decided by Krionics, not the client.

#### Phase 5: Campaign Design

Goal: Design the actual outbound system — messaging, tone, sequence strategy, and meeting routing logic.

**Messaging Questions:**
- What tone works best? Direct, consultative, technical, founder-led?
- What exact outcome are we pitching? Meetings, ROI, revenue, efficiency?

**Sequence Strategy Questions:**
- Pure cold email, LinkedIn + email, founder-led outbound?
- Short emails or long-form? SDR-style or conversational?

**Meeting Routing Questions:**
- Who receives positive replies? Who books calls?
- Should meetings auto-book or require manual qualification first?
- Round-robin routing or assigned rep?

The meeting routing answers define the booking orchestration configuration. The tone and messaging answers feed directly into prompt template configuration and the AI generation context layer.

#### Phase 6: Success & Operations Alignment

Goal: Align on KPIs, success definition, and operational expectations. Most agencies skip this. Skipping it creates retention risk — clients churn when expectations diverge.

**Success Questions:**
- What does success look like at 30, 60, and 90 days?
- KPIs: meetings booked, positive reply rate, pipeline created, closed deals?

**Operational Questions:**
- Who approves copy? How fast should replies be handled?
- Who owns follow-up? Weekly reporting expectations?
- Slack channel integration? Escalation process?

### 4.3 Client Operating Profile — Output Schema

The discovery call produces a structured Client Operating Profile that is stored in Supabase and referenced by every downstream workflow.

```
Client Operating Profile
├── Business Context
│   ├── company_summary
│   ├── offer_description
│   ├── target_transformation
│   ├── average_contract_value
│   └── sales_cycle_length
│
├── ICP Configuration
│   ├── target_industries[]
│   ├── employee_range { min, max }
│   ├── revenue_range { min, max }
│   ├── geographies[]
│   ├── target_titles[]
│   ├── excluded_industries[]
│   └── buying_signals[]
│
├── Campaign Configuration
│   ├── sequence_type
│   ├── tone
│   ├── cta_style
│   ├── daily_send_limit
│   ├── follow_up_cadence_days
│   └── inbox_pool_id
│
├── Automation Configuration
│   ├── automation_level (1 | 2 | 3)
│   ├── reply_policies { per intent }
│   ├── response_delay_windows { per intent }
│   └── booking_followup_delay_hours
│
├── Infrastructure Configuration
│   ├── domains[]
│   ├── inboxes[]
│   ├── crm_type
│   ├── crm_integration_id
│   └── calendar_integration_id
│
├── Knowledge Assets
│   ├── faq_responses[]
│   ├── objection_library[]
│   ├── case_studies[]
│   ├── positioning_statement
│   └── communication_rules
│
└── Operational Configuration
    ├── kpis[]
    ├── reporting_frequency
    ├── escalation_contact
    ├── timezone
    └── slack_channel_id
```

---

## 5. End-to-End Workflow Architecture

### 5.1 Architectural Pipeline Overview

```
[Phase 1: Infrastructure]
Domain Setup → Inbox Creation → SPF/DKIM/DMARC → Warmup
                              ↓
                    [Supabase: infrastructure_configs updated]

[Phase 2: Acquisition]
Client Operating Profile → Apollo ICP Filters → Raw Lead Pull
                              ↓
                    [Supabase: raw_leads table]
                              ↓
              Deduplication + Suppression Check
                              ↓
                    [Supabase: lead_status = enrichment_pending]

[Phase 3: Enrichment]
Enrichment Queue → Clay (LinkedIn + Company + Signals)
                              ↓
                    [Supabase: enriched_leads table]
                              ↓
              AI Signal Extraction (Claude)
                              ↓
                    [Supabase: enrichment complete]

[Phase 4: Personalization]
AI Generation Queue → Claude (Subject + Email 1 + Follow-ups + Breakup)
                              ↓
                    [Supabase: generated_sequences table]
                              ↓
              (Optional) Human QA Review → Approval
                              ↓
                    [Supabase: lead_status = campaign_ready]

[Phase 5: Outbound Execution]
Campaign Queue → Instantly (Push leads + sequences + inbox assignment)
                              ↓
                    [Supabase: lead_status = queued_for_sending]
                              ↓
              Sending Status Sync (sent / opened / bounced)

[Phase 6: Reply Processing]
Instantly Webhook → n8n Reply Intake
                              ↓
                    [Supabase: raw reply stored]
                              ↓
              Reply Classification Queue → Claude
                              ↓
                    [Supabase: intent + confidence stored]
                              ↓
              State Transition → Response Routing Policy
                              ↓
           ┌──────────────────┼──────────────────┐
     Auto-Send Queue    Approval Queue      Nurture Queue
           ↓                  ↓                   ↓
     Response           Human Review        Scheduled
     Scheduling         Interface           Follow-up

[Phase 7: Conversation & Conversion]
Response Sent → Thread Continues / Meeting Link Sent
                              ↓
           ┌──────────────────┼──────────────────┐
     Meeting Booked    Booking Recovery    Conversation Continues
           ↓                  ↓                   ↓
     [CRM: Deal]       Reminder Queue      Classification Loop
     [Dashboard]       Booking Recovery    (repeats)
     [Slack Alert]     Campaigns
     [Stop Campaigns]
```

### 5.2 Separation of Concerns — What Goes Where

The following architectural principle governs every data routing decision in the system:

| System | Receives | Never Receives |
|---|---|---|
| **Supabase** | Everything — raw data, AI outputs, states, events, configs | N/A — it is the source of truth |
| **Dashboard** | Aggregated analytics, summarized metrics, infrastructure status | Raw reply text, AI drafts, workflow internals |
| **HubSpot CRM** | Sales-significant events only: positive replies, qualified conversations, meeting bookings, opportunities | Raw leads, enrichment data, workflow states, AI classification |
| **Slack** | Events requiring human attention or action: positive replies, pending approvals, system failures, deliverability alerts | Routine workflow events, OOO responses, unsubscribes |
| **Instantly** | Final executable outbound payload: email, sequence, inbox assignment | Business intelligence, enrichment context, personalization data |

### 5.3 CRM Entry Logic

```
Intent                    CRM Update Required?
──────────────────────────────────────────────
positive                  YES — contact + reply summary + pipeline stage
faq                       YES — conversation started
objection                 YES — potential opportunity exists
nurture                   OPTIONAL — client preference
unsubscribe               NO — internal suppression only
OOO                       NO — not meaningful sales engagement
wrong_contact             NO (unless referral contact provided)
meeting_booked            YES — deal stage update + opportunity creation
```

---

## 6. Lead State Machine

### 6.1 Architecture Rationale

The lead state machine is the backbone of Krionics OS. Every automation in the system is a reaction to a state transition, not a procedural script executing a sequence of steps. Without an explicit state machine, the system eventually develops: conflicting campaign conditions, impossible debugging scenarios, duplicate automations, and undefined behavior at edge cases.

The state machine enforces mutual exclusivity — a lead has exactly one primary state at any time. Secondary flags (boolean markers like `has_positive_reply`, `was_enriched`) can coexist for analytics purposes, but orchestration logic depends only on the primary state.

### 6.2 Complete Lead State Definitions

#### Phase 1 — Acquisition States

| State | Meaning | Trigger |
|---|---|---|
| `raw_imported` | Imported from Apollo, no processing yet | Apollo import workflow completes |
| `deduplicated` | Passed duplicate and suppression checks | Deduplication workflow completes |
| `enrichment_pending` | Queued for Clay enrichment | Placed into enrichment queue |
| `enriched` | Clay enrichment successfully completed | Enrichment workflow completes |
| `personalized` | AI sequence generation completed | Personalization workflow completes |
| `campaign_ready` | Ready for Instantly push | QA/human review completed (if required) |

#### Phase 2 — Outbound States

| State | Meaning | Trigger |
|---|---|---|
| `queued_for_sending` | Pushed to Instantly, pending execution | Campaign push workflow completes |
| `sending_active` | At least one email sent, sequence active | Instantly send confirmation received |
| `email_bounced` | Email delivery failed | Instantly bounce webhook |
| `no_response` | Sequence complete, no engagement | Sequence completion without reply |

#### Phase 3 — Reply States

| State | Meaning | Trigger |
|---|---|---|
| `reply_received` | Reply arrived, classification pending | Instantly reply webhook |
| `positive_reply` | Classified as interested | Claude classification output |
| `faq_reply` | Classified as question | Claude classification output |
| `objection_reply` | Classified as objection or concern | Claude classification output |
| `nurture_reply` | Classified as not-now / future timing | Claude classification output |
| `unsubscribe` | Opted out of communication | Claude classification output |
| `wrong_contact` | Reply indicates wrong person reached | Claude classification output |
| `ooo` | Out-of-office auto-response | Claude classification output |

#### Phase 4 — Conversation States

| State | Meaning | Trigger |
|---|---|---|
| `ai_draft_pending` | AI draft generated, awaiting human approval | Draft placed in approval queue |
| `reply_sent` | Response sent to prospect | Reply send workflow completes |
| `conversation_active` | Active back-and-forth in progress | Second reply received in thread |
| `awaiting_booking` | Booking link sent, waiting for prospect to schedule | Booking link included in reply |
| `nurture_active` | Future follow-up scheduled, lead in hold state | Nurture routing workflow completes |

#### Phase 5 — Conversion States

| State | Meaning | Trigger |
|---|---|---|
| `meeting_booked` | Call successfully scheduled | Cal.com booking webhook |
| `qualified_opportunity` | Lead confirmed as real pipeline opportunity | Manual or AI qualification signal |
| `closed_positive` | Became a client | Manual update |
| `closed_negative` | Not interested, not a fit | Negative classification or manual close |

### 6.3 State Transition Diagram

```
                    [raw_imported]
                         ↓
                  [deduplicated]
                         ↓
               [enrichment_pending]
                         ↓
                    [enriched]
                         ↓
                  [personalized]
                         ↓
                 [campaign_ready]
                         ↓
              [queued_for_sending]
                         ↓
                [sending_active] ←────────────────────────────────┐
                         ↓                                         │
        ┌────────────────┼────────────────┐                       │
  [email_bounced]  [no_response]   [reply_received]               │
                                          ↓                        │
              ┌───────────────────────────┼─────────────────────┐ │
              ↓           ↓           ↓       ↓        ↓        ↓ │
       [positive]    [faq_reply] [objection] [ooo] [nurture] [unsubscribe]
              ↓           ↓           ↓
     [awaiting_booking] [ai_draft_pending]  [nurture_active] → after delay → [sending_active]
              ↓                  ↓
      [meeting_booked]    [reply_sent]
              ↓                  ↓
   [qualified_opportunity] [conversation_active]
              ↓                  ↓
      [closed_positive]  [awaiting_booking] or [nurture_active]
                                 ↓
                         [meeting_booked]
```

### 6.4 State → Instantly Campaign Action Map

| Lead State | Instantly Action |
|---|---|
| `sending_active` | Continue sequence |
| `conversation_active` | Pause sequence |
| `nurture_active` | Move to nurture campaign |
| `awaiting_booking` | Trigger booking recovery campaign |
| `meeting_booked` | Stop all campaigns |
| `unsubscribe` | Stop all campaigns, add to global suppression |
| `closed_negative` | Stop all campaigns |
| `ooo` | Pause sequence until follow-up window |

### 6.5 State → Dashboard Metrics Map

| Lead State | Dashboard Metric Updated |
|---|---|
| `enriched` | Leads enriched count |
| `sending_active` | Active campaign count |
| `positive_reply` | Positive reply rate |
| `meeting_booked` | Meetings booked, booking rate |
| `nurture_active` | Nurture pipeline count |
| `closed_positive` | Client conversion |

---

## 7. Event Architecture

### 7.1 Events as Historical Truth

Events in Krionics OS are immutable records of things that happened. They are never updated, never deleted, and never retroactively modified. A `reply_received` event is true regardless of what happens to the lead afterward. Even if the lead later unsubscribes or closes negative, the historical event record stands.

This immutability is what makes events valuable for analytics. The event timeline of any lead can be reconstructed: when they entered the system, when they were enriched, when they replied, when they converted or declined. Funnel analytics, response lag analysis, and campaign attribution are all derived from event history.

Events live in Supabase in the `events` table:

```sql
events (
  event_id        UUID PRIMARY KEY,
  client_id       UUID NOT NULL,
  lead_id         UUID REFERENCES leads(lead_id),
  campaign_id     UUID,
  event_type      TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB,
  created_by      TEXT  -- 'system' | 'ai' | 'human' | workflow name
)
```

### 7.2 Event Catalog

#### Category 1 — Acquisition Events

| Event | Trigger | Key Metadata |
|---|---|---|
| `leads_imported` | Apollo import workflow completes | `count`, `source`, `campaign_id` |
| `duplicate_detected` | Lead already exists in system | `existing_lead_id`, `detection_method` |
| `enrichment_queued` | Lead placed in enrichment queue | `queue_position`, `priority` |
| `enrichment_completed` | Clay enrichment returns results | `signals_found[]`, `enrichment_version` |
| `enrichment_failed` | Clay API error or timeout | `error_type`, `retry_count` |
| `personalization_completed` | AI sequence generation done | `generation_version`, `model_used` |

#### Category 2 — Outbound Events

| Event | Trigger | Key Metadata |
|---|---|---|
| `campaign_pushed` | Lead pushed to Instantly | `inbox_id`, `sequence_id` |
| `email_sent` | Instantly confirms send | `email_number`, `subject`, `inbox_id` |
| `email_opened` | Instantly tracks open | `open_count`, `device` |
| `email_bounced` | Delivery failure | `bounce_type`, `error_code` |
| `sequence_paused` | Orchestration pause command | `reason`, `paused_by` |
| `sequence_resumed` | Orchestration resume command | `reason`, `resumed_by` |

#### Category 3 — Reply Events

| Event | Trigger | Key Metadata |
|---|---|---|
| `reply_received` | Instantly webhook fires | `reply_text`, `thread_id`, `sender` |
| `reply_classified` | Claude classification completes | `intent`, `confidence`, `sentiment` |
| `draft_generated` | AI response generation complete | `draft_id`, `draft_type`, `auto_send_eligible` |
| `draft_approved` | Human approves AI draft | `approved_by`, `edits_made` |
| `auto_reply_sent` | AI sends response automatically | `delay_applied_ms`, `model_used` |
| `human_reply_sent` | Human sends response | `sender_id`, `response_time_minutes` |

#### Category 4 — Conversion Events

| Event | Trigger | Key Metadata |
|---|---|---|
| `meeting_link_sent` | Booking link included in reply | `cal_link`, `context` |
| `booking_reminder_triggered` | No booking after threshold | `reminder_number`, `delay_hours` |
| `meeting_booked` | Cal.com webhook fires | `meeting_time`, `calendar_owner`, `booking_source` |
| `meeting_cancelled` | Cal.com cancellation webhook | `cancellation_reason`, `rescheduled` |
| `opportunity_created` | CRM deal created | `crm_id`, `pipeline_stage`, `deal_value` |

#### Category 5 — System Events

| Event | Trigger | Key Metadata |
|---|---|---|
| `workflow_failed` | n8n workflow execution error | `workflow_name`, `error_message`, `retry_count` |
| `retry_queued` | Failed job placed in retry queue | `original_event_id`, `retry_attempt` |
| `dead_letter_queued` | Max retries exceeded | `original_event_id`, `failure_reason` |
| `deliverability_warning` | Bounce rate exceeds threshold | `inbox_id`, `bounce_rate`, `threshold` |
| `inbox_health_alert` | Infrastructure issue detected | `domain`, `issue_type` |
| `config_reloaded` | Runtime configuration refreshed | `config_type`, `changed_keys[]` |

### 7.3 Event → Reaction Map

```
Event: reply_received
  → Supabase: store raw reply record
  → Reply Classification Queue: enqueue for Claude
  → Dashboard: increment total reply counter
  → Orchestrator: update lead state to reply_received

Event: reply_classified (intent = positive)
  → Lead State: transition to positive_reply
  → Instantly: pause active outbound sequence
  → CRM Workflow: create/update contact and pipeline stage
  → AI Response Queue: enqueue response generation
  → Slack: send positive reply alert

Event: reply_classified (intent = unsubscribe)
  → Lead State: transition to unsubscribe
  → Instantly: stop all campaigns for this lead
  → Suppression List: add email globally
  → Supabase: log suppression event

Event: meeting_booked
  → Lead State: transition to meeting_booked
  → Instantly: stop all campaigns
  → CRM Workflow: update deal stage to Meeting Scheduled
  → Dashboard: increment meetings booked metric
  → Slack: send meeting booked alert with lead details

Event: enrichment_failed (retry_count < max)
  → Retry Queue: enqueue with backoff
  → Supabase: log retry event

Event: enrichment_failed (retry_count >= max)
  → Dead Letter Queue: move failed job
  → Slack: send system failure alert
  → Supabase: log unrecoverable failure
```

---

## 8. Queue Architecture

### 8.1 Why Queues Exist

Synchronous processing is fragile. If a reply arrives and the system attempts to synchronously: store the reply, call Claude for classification, update the CRM, update the dashboard, send a Slack alert, and generate a response — any single failure crashes the entire operation. The webhook acknowledgment timeout is exceeded. The reply may be lost.

Queues solve this by accepting work immediately and processing it asynchronously. The webhook acknowledges instantly. Work is placed in the appropriate queue. Background workers process each queue independently. A failure in CRM sync does not affect reply classification. A Clay timeout does not block email generation.

Queues also provide: retry semantics (failed jobs are retried with backoff), observable backlogs (queue depth is an operational health metric), parallel processing (multiple workers can consume the same queue), and natural rate limiting (queue consumption rate controls throughput).

### 8.2 Queue Definitions

#### Enrichment Queue
**Purpose:** Process raw leads through Clay enrichment in batches  
**Producer:** Lead deduplication workflow  
**Consumer:** Clay enrichment workflow  
**Retry Policy:** 3 retries with exponential backoff (1m, 5m, 15m)  
**Dead Letter:** Enrichment dead letter queue → Slack alert  
**Rate Limit:** Governed by Clay API rate limits per client tier  

#### AI Generation Queue
**Purpose:** Generate email sequences for campaign-ready leads  
**Producer:** Enrichment completion workflow  
**Consumer:** Personalization workflow  
**Retry Policy:** 2 retries (Claude API is generally reliable; failures are usually timeout-related)  
**Rate Limit:** Governed by Anthropic API rate limits; batched to control cost  

#### Reply Classification Queue
**Purpose:** Classify incoming replies via Claude  
**Producer:** Reply intake workflow  
**Consumer:** Reply classification workflow  
**Priority:** HIGH — reply processing latency directly affects prospect experience  
**Retry Policy:** 2 retries with short backoff (30s, 2m)  

#### Response Queue (with sub-queues)
**Purpose:** Stage and schedule outbound replies  
**Sub-queues:**

| Sub-Queue | Contents | Timing Policy |
|---|---|---|
| `immediate_queue` | Unsubscribes, OOO confirmations | Send within 1 minute |
| `delayed_queue` | Positive replies, FAQ responses | Send within configured delay window (randomized) |
| `approval_queue` | Objection drafts, complex FAQ drafts | Hold until human approves |
| `nurture_queue` | Future follow-ups, scheduled reactivations | Send on configured future date |

**Architecture Note:** The response queue is distinct from Instantly campaigns. Responses that continue an active thread are handled through the response queue. Only new campaign sequences or recovery campaigns go through Instantly.

#### Booking Recovery Queue
**Purpose:** Manage follow-up for leads who received booking links but haven't scheduled  
**Producer:** Booking state transition workflow  
**Consumer:** Booking recovery workflow  
**Timing:** Configurable per client (default: 24h for first reminder, 72h for second, final at 5 days)  

#### Retry Queue
**Purpose:** Re-process failed workflow executions  
**Strategy:** Exponential backoff with jitter  
**Max Retries:** 3 (configurable globally and per workflow type)  
**Post-Max:** Dead letter queue  

#### Dead Letter Queue
**Purpose:** Capture unrecoverable failures for investigation  
**Consumers:** Slack alert workflow, audit log workflow  
**Retention:** 30 days  
**Operational Response:** Manual investigation required for all dead letter entries  

### 8.3 Queue Depth Monitoring

Queue depth is a first-class operational metric in Krionics OS. Dashboards expose queue depth per queue type. Alerts fire when:
- Enrichment queue depth exceeds 500 leads (Clay throughput concern)
- Approval queue depth exceeds 20 items (human operator bandwidth concern)
- Retry queue depth exceeds 50 (systemic failure signal)
- Dead letter queue receives any entry (immediate investigation required)

---

## 9. Workflow Architecture

### 9.1 Workflow Design Principles

Every workflow in Krionics OS adheres to the following constraints:

1. **Single responsibility:** One workflow handles one operational concern. It does not touch concerns owned by other workflows.
2. **Event-triggered:** Workflows are triggered by events, not by other workflows calling them directly.
3. **Config-driven:** Business logic parameters are loaded from Supabase configuration tables at runtime, not hardcoded.
4. **Structured output:** Workflows produce deterministic outputs — state updates, events emitted, queue entries — not side effects scattered across systems.
5. **Failure-safe:** Every workflow handles its own failure cases — retry logic, error logging, and dead letter routing.

### 9.2 Complete Workflow Map

#### Domain 1: Client Onboarding

**1.1 Client Configuration Workflow**  
Triggered by: Manual activation post-discovery  
Responsibility: Create client workspace in Supabase — client record, ICP profile, campaign config, automation policies, timing rules, feature flags  
Emits: `client_configured`

**1.2 Infrastructure Provisioning Workflow**  
Triggered by: `client_configured`  
Responsibility: Track domain setup, inbox creation, SPF/DKIM/DMARC configuration, inbox-to-pool assignment  
Emits: `infrastructure_ready`

**1.3 Warmup Monitoring Workflow**  
Triggered by: Scheduled (daily)  
Responsibility: Check inbox warmup status via MailReach, update infrastructure health in Supabase, emit alert if issues detected  
Emits: `inbox_health_updated` | `inbox_health_alert`

#### Domain 2: Lead Acquisition

**2.1 Apollo Import Workflow**  
Triggered by: Manual trigger or scheduled per campaign cadence  
Responsibility: Execute Apollo ICP query using client's filter config, normalize response schema to Universal Lead Schema, write to `raw_leads` table  
Emits: `leads_imported`

**2.2 Lead Deduplication Workflow**  
Triggered by: `leads_imported`  
Responsibility: Check against existing leads, suppression list, email fatigue rules. Mark duplicates. Place clean leads in enrichment queue.  
Emits: `duplicates_filtered`, `enrichment_queued`

**2.3 Lead Qualification Workflow**  
Triggered by: `enrichment_completed`  
Responsibility: AI-assisted ICP fit scoring. Compute Lead Quality Score (LQS) based on enrichment signals matched against client's ICP definition. Update lead with LQS.  
Emits: `lead_scored`

#### Domain 3: Enrichment

**3.1 Clay Enrichment Workflow**  
Triggered by: `enrichment_queued` (queue consumer)  
Responsibility: Execute Clay enrichment passes — LinkedIn, company metadata, hiring signals, tech stack, website summary. Store structured enrichment data in `enriched_leads` table.  
Emits: `enrichment_completed` | `enrichment_failed`

**3.2 AI Signal Extraction Workflow**  
Triggered by: `enrichment_completed`  
Responsibility: Pass enrichment data to Claude for structured intelligence extraction — buying signals, personalization hooks, ICP fit assessment. Store output as structured prospect intelligence.  
Emits: `signals_extracted`

**3.3 Personalization Context Workflow**  
Triggered by: `signals_extracted`  
Responsibility: Assemble the personalization context object that will feed sequence generation — combining enrichment data, signal extraction, and client knowledge assets into a focused context payload.  
Emits: `personalization_context_ready`

#### Domain 4: Campaign Generation

**4.1 Sequence Generation Workflow**  
Triggered by: `personalization_context_ready`  
Responsibility: Invoke Claude with assembled context + sequence framework + client messaging config. Generate: subject line, Email 1, follow-up email, breakup email. Store in `generated_sequences`.  
Emits: `personalization_completed`

**4.2 Campaign Assignment Workflow**  
Triggered by: `personalization_completed`  
Responsibility: Assign sequence to inbox pool, determine sending window, set campaign type. Update lead state to `campaign_ready`.  
Emits: `campaign_assigned`

**4.3 QA / Human Review Workflow**  
Triggered by: `campaign_assigned` (if review required per client config)  
Responsibility: Place generated sequences in review interface. Hold campaign push until human approval received.  
Emits: `campaign_approved` | `sequence_revision_requested`

#### Domain 5: Outbound Execution

**5.1 Instantly Campaign Push Workflow**  
Triggered by: `campaign_approved` (or `campaign_assigned` if no review required)  
Responsibility: Push campaign-ready leads to Instantly with final payload: email content, subject variants, inbox assignment, sequence schedule.  
Emits: `campaign_pushed`

**5.2 Sending Status Sync Workflow**  
Triggered by: Instantly webhook events (sent, opened, bounced)  
Responsibility: Sync outbound activity events to Supabase `outbound_events` table. Update lead state for bounces.  
Emits: `email_sent` | `email_opened` | `email_bounced`

**5.3 Deliverability Monitoring Workflow**  
Triggered by: Scheduled (every 4 hours during active sends)  
Responsibility: Check bounce rates per domain and inbox via MailReach API. Compare against configured thresholds. Escalate if thresholds exceeded.  
Emits: `deliverability_warning` (if threshold exceeded)

#### Domain 6: Reply Processing

```
Instantly Webhook
      ↓
6.1 Reply Intake Workflow
      ↓
6.2 Reply Classification Workflow (Claude)
      ↓
6.3 Reply State Transition Workflow
      ↓
6.4 AI Reply Generation Workflow
      ↓
      ├── 6.5 Human Approval Workflow (if approval_queue)
      │         ↓
      │   Human Reviews + Edits
      │         ↓
      └── 6.6 Response Scheduling Workflow
                ↓
          6.7 Reply Send Workflow
```

**6.1 Reply Intake Workflow**  
Triggered by: Instantly reply webhook  
Responsibility: Store raw reply (text, sender, timestamp, thread_id, campaign_id, lead_id) immediately to Supabase. Emit event. Enqueue for classification.  
Critical: Must acknowledge webhook within 200ms. All processing is async after storage.  
Emits: `reply_received`

**6.2 Reply Classification Workflow**  
Triggered by: `reply_received` (via classification queue)  
Responsibility: Build classification prompt with thread context + client rules. Invoke Claude. Receive structured classification output (intent, confidence, sentiment, suggested_action). Store in Supabase. Apply automation policy check.  
Emits: `reply_classified`

**6.3 Reply State Transition Workflow**  
Triggered by: `reply_classified`  
Responsibility: Update lead primary state based on classification. Pause Instantly sequence if conversation_active. Route to appropriate next queue (response queue, approval queue, nurture queue).  
Emits: `state_transitioned`, `sequence_paused` (if applicable)

**6.4 AI Reply Generation Workflow**  
Triggered by: `reply_classified` (for intents requiring response)  
Responsibility: Assemble context (thread history + intent + knowledge base + automation policy). Invoke Claude response generation. Validate output (length, forbidden claims, required elements). Place result in appropriate response sub-queue.  
Emits: `draft_generated`

**6.5 Human Approval Workflow**  
Triggered by: `draft_generated` when automation policy = draft_only for that intent  
Responsibility: Store draft in approval queue. Send Slack notification to operator. Expose draft in review interface. Accept human edits. Release approved draft to scheduling workflow.  
Emits: `draft_approved` | `draft_rejected`

**6.6 Response Scheduling Workflow**  
Triggered by: `draft_generated` (auto-send) or `draft_approved` (human-approved)  
Responsibility: Apply configured delay window (randomized within min/max bounds). Enforce business hours constraint. Schedule send for correct timestamp.  
Emits: `response_scheduled`

**6.7 Reply Send Workflow**  
Triggered by: `response_scheduled` (at scheduled time)  
Responsibility: Send reply via Instantly thread continuation or direct email. Confirm delivery. Update lead state to `reply_sent`.  
Emits: `reply_sent` | `auto_reply_sent` | `human_reply_sent`

#### Domain 7: Conversation Management

**7.1 Conversation Pause Workflow**  
Triggered by: State transition to `conversation_active`  
Responsibility: Send pause command to Instantly for all active sequences on this lead. Prevent automated follow-up from firing while conversation is live.  
Emits: `sequence_paused`

**7.2 Conversation Follow-Up Workflow**  
Triggered by: Scheduled check on `conversation_active` leads with no response for > N days  
Responsibility: Generate contextual thread follow-up (not a restart of cold sequence). Route through response scheduling workflow.  
Emits: `followup_triggered`

**7.3 Nurture Routing Workflow**  
Triggered by: State transition to `nurture_active`  
Responsibility: Parse nurture timing from AI classification output (e.g., "reach back in Q4"). Configure nurture campaign assignment in Instantly. Schedule future reactivation.  
Emits: `nurture_scheduled`

**7.4 Booking Recovery Workflow**  
Triggered by: State transition to `awaiting_booking` + timer expiry  
Responsibility: Generate humanized booking reminder. Route through response scheduling. Track reminder count. After max reminders with no booking, escalate to operator.  
Emits: `booking_reminder_triggered`

#### Domain 8: Meeting Workflows

**8.1 Cal.com Booking Sync Workflow**  
Triggered by: Cal.com booking webhook  
Responsibility: Receive booking event. Update lead state to `meeting_booked`. Stop all Instantly campaigns. Prepare downstream sync events.  
Emits: `meeting_booked`

**8.2 Meeting State Workflow**  
Triggered by: `meeting_booked`  
Responsibility: Update CRM deal stage. Increment dashboard metrics. Trigger Slack alert.  
Emits: (consumed by CRM, Dashboard, Slack workflows)

#### Domain 9: CRM Workflows

**9.1 CRM Contact Sync Workflow**  
Triggered by: `reply_classified` (sales-significant intents only)  
Responsibility: Create or update contact and company records in HubSpot (or configured CRM). Map lead enrichment data to CRM field schema.  
Emits: `crm_contact_synced`

**9.2 CRM Deal Workflow**  
Triggered by: `meeting_booked`, `opportunity_created`  
Responsibility: Create or update deal/opportunity. Move pipeline stage. Assign to appropriate rep.  
Emits: `crm_deal_updated`

**9.3 CRM Activity Logging Workflow**  
Triggered by: `reply_sent`, `meeting_booked`  
Responsibility: Log conversation summaries, call notes, reply threads as CRM activities/notes on the contact record.  
Emits: `crm_activity_logged`

#### Domain 10: Analytics Workflows

**10.1 Event Aggregation Workflow**  
Triggered by: Scheduled (every 15 minutes)  
Responsibility: Aggregate operational events from the events table into metric summaries by client, campaign, date. Write to `analytics_snapshots` table.  
Emits: `metrics_updated`

**10.2 Dashboard Metrics Workflow**  
Triggered by: `metrics_updated`  
Responsibility: Compute derived metrics (reply rate, booking rate, conversion rate) from aggregated events. Update dashboard data layer.  
Emits: `dashboard_updated`

---

## 10. AI Invocation Architecture

### 10.1 AI Responsibility Boundaries

Claude is a cognitive service — invoked for tasks where probabilistic interpretation, contextual generation, or fuzzy judgment is required. It is not invoked for tasks where deterministic logic suffices.

**Appropriate AI Tasks:**
| Task | Why AI Required |
|---|---|
| Reply classification | Requires linguistic interpretation and intent inference |
| Cold email generation | Requires contextual language generation within a framework |
| Objection intelligence | Requires nuanced reasoning about concerns and responses |
| Signal extraction from enrichment | Requires abstraction from unstructured data |
| Lead quality scoring | Requires fuzzy judgment against ICP criteria |
| Analytics intelligence (later) | Requires pattern recognition across campaign data |

**Inappropriate AI Tasks:**
| Task | Better Solution |
|---|---|
| Response delay calculation | Deterministic config lookup |
| State transition decisions | Workflow policy logic |
| Duplicate detection | Database query |
| Campaign routing based on state | Orchestration logic consuming AI classification output |
| Inbox assignment | Deterministic load balancing |
| Suppression list check | Database query |

### 10.2 AI Invocation Points

#### Invocation Point 1: Enrichment Signal Extraction

**When:** After Clay enrichment completes  
**Purpose:** Extract structured intelligence from unstructured enrichment data  

**Input Contract:**
```json
{
  "website_summary": "string",
  "linkedin_summary": "string",
  "hiring_signals": ["string"],
  "tech_stack": ["string"],
  "company_metadata": { ... },
  "client_icp": { ... }
}
```

**Output Contract:**
```json
{
  "buying_signals": ["string"],
  "personalization_hooks": ["string"],
  "icp_fit_score": 0.87,
  "icp_fit_reasoning": "string",
  "recommended_personalization_depth": "L1|L2|L3|L4"
}
```

#### Invocation Point 2: Cold Email Sequence Generation

**When:** After personalization context is assembled  
**Purpose:** Generate complete, structured email sequence within the campaign framework  

**Input Contract:**
```json
{
  "sequence_framework": { "email_1_goal": "...", "email_2_goal": "...", "email_3_goal": "..." },
  "client_messaging": { "pain": "...", "outcome": "...", "tone": "...", "cta_style": "..." },
  "prospect_intelligence": { "personalization_hooks": [...], "buying_signals": [...], ... },
  "personalization_depth": "L2",
  "max_word_count_per_email": 120
}
```

**Output Contract:**
```json
{
  "subject_line": "string",
  "email_1": "string",
  "email_2": "string",
  "email_3": "string",
  "generation_version": "string",
  "quality_flags": []
}
```

#### Invocation Point 3: Reply Classification (Most Critical)

**When:** Every time a reply arrives  
**Purpose:** Classify intent and determine automation routing  

**Input Contract:**
```json
{
  "latest_reply": "string",
  "thread_history": ["string"],
  "lead_context": { "name": "...", "company": "...", "title": "..." },
  "client_rules": { "escalation_keywords": [...], "auto_close_phrases": [...] }
}
```

**Output Contract:**
```json
{
  "intent": "positive|faq|objection|nurture|unsubscribe|wrong_contact|ooo",
  "confidence": 0.94,
  "sentiment": "interested|curious|skeptical|negative|neutral",
  "requires_human": false,
  "suggested_action": "auto_send|draft_only|escalate|suppress|pause",
  "objection_type": "pricing|timing|trust|competitor|not_relevant",
  "nurture_timing_hint": "Q4|next_month|6_months|null"
}
```

#### Invocation Point 4: Response Generation

**When:** After classification, when response is required  
**Purpose:** Generate contextual, humanized reply within client communication policy  

**Input Contract:**
```json
{
  "intent": "string",
  "thread_history": ["string"],
  "latest_reply": "string",
  "client_knowledge": {
    "relevant_faqs": [...],
    "relevant_objection_responses": [...],
    "positioning": "string",
    "tone": "string",
    "cta_style": "string"
  },
  "automation_policy": { "max_length_words": 120, "include_booking_link": true },
  "forbidden_claims": ["string"],
  "output_rules": { "no_em_dashes": true, "no_ai_phrases": true }
}
```

**Output Contract:**
```json
{
  "reply_body": "string",
  "includes_booking_link": false,
  "word_count": 98,
  "tone_assessment": "consultative",
  "quality_flags": [],
  "confidence": 0.91
}
```

#### Invocation Point 5: Objection Intelligence

**When:** Reply classified as objection  
**Purpose:** Extract objection type, underlying concern, and optimal response angle before generating response  

**Input Contract:**
```json
{
  "objection_text": "string",
  "thread_history": ["string"],
  "lead_context": { ... },
  "client_positioning": "string"
}
```

**Output Contract:**
```json
{
  "objection_category": "pricing|timing|trust|competitor|not_relevant|scope",
  "underlying_concern": "string",
  "best_response_angle": "string",
  "reframe_suggestion": "string",
  "escalation_recommended": false
}
```

#### Invocation Point 6: Analytics Intelligence (Future)

**When:** Periodic campaign performance analysis  
**Purpose:** Identify patterns, winning elements, and optimization opportunities across campaigns  

**Input Contract:**
```json
{
  "campaign_metrics": { "reply_rate": 0.042, "positive_rate": 0.018, ... },
  "top_performing_sequences": [...],
  "common_objections": [...],
  "conversion_funnel": { ... }
}
```

**Output Contract:**
```json
{
  "performance_insights": ["string"],
  "winning_patterns": ["string"],
  "suggested_improvements": ["string"],
  "a_b_test_recommendations": ["string"]
}
```

### 10.3 AI Chaining Policy

AI chains (Claude → Claude → Claude) are avoided. AI outputs feed workflow logic, which makes deterministic routing decisions, which may optionally invoke a second AI step. This prevents cost explosion from cascading AI calls, maintains debuggability, enables caching of intermediate outputs, and allows model replacement without cascading changes.

```
Correct pattern:
Claude (classify) → structured output → workflow logic → Claude (generate) → structured output → workflow logic

Avoid:
Claude → Claude → Claude → workflow
```

---

## 11. Prompt & Context Engineering

### 11.1 Composable Prompt Architecture

Monolithic prompts fail. Sending all client data, all lead data, all FAQs, all objection responses, the full thread history, and a vague instruction into a single prompt creates: inconsistent outputs, hallucination-prone responses, expensive token usage, and impossible debugging.

Krionics OS uses composable prompt architecture: prompts are assembled at runtime from structured context blocks. Each block is independently sourced, independently cacheable, and independently updateable.

### 11.2 Prompt Layer Structure

Every Claude invocation in Krionics OS assembles a prompt from the following ordered layers:

**Layer 1 — System Role**  
Defines who Claude is in this invocation. Does not change per-request.  
```
You are assisting a B2B outbound sales operation. Your purpose is to [specific task].
Sound human. Be concise. Do not sound automated. Do not fabricate claims.
```

**Layer 2 — Task Instruction**  
Defines what Claude must do in this specific invocation.  
```
Classify the following reply into one of these intent categories: [list].
Return a JSON object matching the output contract provided.
```

**Layer 3 — Client Context**  
Inject client-specific business context: positioning, offer summary, communication style. Loaded from `client_knowledge` table.  
```
Client context: [company summary], [offer description], [tone rules], [forbidden claims]
```

**Layer 4 — Conversation Context**  
Inject the active thread history and latest message. Loaded from `replies` and `generated_sequences` tables.  
```
Thread so far: [prior messages in order]
Latest message: [incoming reply]
```

**Layer 5 — Knowledge Context**  
Inject only the knowledge relevant to this specific task. Do not dump the entire knowledge base. Determine relevance from the classified intent.  
```
Relevant FAQs: [only FAQs matching topic of inquiry]
Relevant objection responses: [only if objection was classified]
```

**Layer 6 — Output Rules**  
Enforce communication policy constraints. This layer directly prevents AI-sounding language.  
```
Do not use: em dashes, "hope this helps", "great question", "certainly", "absolutely"
Maximum length: 120 words
Response format: plain text, no markdown, no lists unless essential
```

### 11.3 Context Prioritization

When context windows must be managed, the following priority order applies:

| Priority | Context Block | Why |
|---|---|---|
| 1 (Highest) | Latest incoming message | The thing Claude is responding to |
| 2 | Relevant thread history | Conversational continuity |
| 3 | Relevant knowledge assets | Accuracy and grounding |
| 4 | Client positioning | Tone and brand alignment |
| 5 | Lead enrichment context | Personalization hooks |
| 6 (Lowest) | Campaign metadata | Rarely needed for generation tasks |

### 11.4 Prompt Versioning

Prompt templates are stored in Supabase with versioning. Every AI invocation records which prompt template version was used, enabling:
- Precise debugging (which prompt version produced this output?)
- Safe iteration (deploy new prompt version to subset of requests before full rollout)
- A/B testing (compare output quality between prompt versions)
- Rollback (revert to previous version if new version degrades quality)

```sql
prompt_templates (
  template_id    UUID PRIMARY KEY,
  client_id      UUID,  -- NULL for global templates
  task_type      TEXT,  -- 'classification' | 'generation' | 'objection' | ...
  version        INTEGER,
  template_body  TEXT,
  is_active      BOOLEAN,
  created_at     TIMESTAMPTZ,
  performance_notes TEXT
)
```

### 11.5 Output Validation

Before any AI-generated content is placed in the response queue or returned to a workflow, it passes validation:

| Validation Check | Failure Action |
|---|---|
| Word count exceeds limit | Truncate or retry with tighter instruction |
| Forbidden phrases detected | Retry with explicit exclusion |
| Required elements missing (e.g., booking link) | Inject required elements or retry |
| JSON output malformed | Retry with schema reminder |
| Confidence below threshold | Route to approval queue regardless of automation level |
| Hallucinated numbers or claims detected | Reject and route to human |

### 11.6 Thread Memory and Conversational Continuity

Every Claude invocation for response generation includes the full thread history (up to the context window limit), prior AI-generated responses, and the sequence of intent states in the conversation. This prevents the failure mode where an AI response ignores context from earlier in the thread — a behavior that breaks prospect trust immediately.

---

## 12. Reply Orchestration System

### 12.1 System Overview

Reply orchestration is the most operationally complex subsystem in Krionics OS. It is where the system transitions from outbound machine to conversational pipeline infrastructure. The quality of reply handling determines client retention more than any other single factor.

The reply orchestration system handles: intent classification, automation policy routing, response generation, human approval flows, response delay scheduling, meeting booking initiation, nurture routing, and conversation lifecycle management.

### 12.2 Intent Classification

Every inbound reply is classified into one of seven primary intents:

| Intent | Description | Example |
|---|---|---|
| `positive` | Genuine interest, wants to learn more or move forward | "Yes, I'd like to learn more about this." |
| `faq` | Asking a factual or process question | "How long does setup take?" |
| `objection` | Concern, hesitation, or pushback | "We already tried this and it didn't work." |
| `nurture` | Interested but wrong timing | "Reach back in Q4, we're heads-down right now." |
| `unsubscribe` | Opted out, do not contact | "Please remove me from your list." |
| `ooo` | Auto-responder out of office | "I'm out of office until..." |
| `wrong_contact` | Wrong person reached | "I'm not the right person for this." |

### 12.3 Automation Level Architecture

Automation levels are client-level configuration. They are not hardcoded into workflows. Workflows call `strategy.canAutoSend(intent, client_id)` which resolves against the client's automation policy configuration. Clients can change automation levels without any workflow changes.

#### Level 1 — Human-Centric AI Assist
Philosophy: AI assists. Humans control every outbound communication.

AI responsibilities: classify all replies, extract intent, generate drafts, suggest next actions, update CRM, update dashboard, trigger Slack alerts.
Human responsibilities: review all replies, edit all messaging, approve all sends, handle all strategic conversations.
Best for: first clients, premium services, founder-led sales, early-stage operations.

#### Level 2 — Hybrid Automation
Philosophy: AI handles operationally safe conversations. Humans handle strategically important ones.

AI sends automatically: unsubscribes, OOO responses, meeting booking confirmations, simple scheduling replies, wrong-contact routing.
AI drafts (human approves): objections, complex FAQs, pricing discussions, nuanced qualification conversations.
Best for: scaling operations, medium reply volume, balanced automation needs.

#### Level 3 — Full AI SDR Mode
Philosophy: AI operates as autonomous outbound SDR. Humans are escalation handlers only.

AI sends everything: FAQs, objections, nurture replies, scheduling, qualification, follow-ups, routing, reactivation.
Humans handle: escalations, edge cases, VIP leads, periodic QA review.
Best for: high-volume outbound, mature prompt systems, strong knowledge base, very high operational confidence.

### 12.4 Reply Orchestration Matrix

| Intent Type | Contextual Depth | Level 1 | Level 2 | Level 3 |
|---|---|---|---|---|
| `unsubscribe` | Low | AI Sends | AI Sends | AI Sends |
| `ooo` | Low | AI Sends | AI Sends | AI Sends |
| `wrong_contact` | Low-Medium | AI Drafts | AI Sends | AI Sends |
| `nurture` | Medium | AI Drafts | AI Drafts | AI Sends |
| `faq` | High | AI Drafts | AI Drafts | AI Sends |
| `objection` | Very High | AI Drafts | AI Drafts | AI Sends |
| `positive` | High | AI Drafts | AI Sends | AI Sends |

### 12.5 Response Delay Architecture

Instant AI replies are architecturally bad for outbound. They signal automation. They erode trust. They reduce conversion. Krionics OS introduces configurable response delay orchestration that simulates human-like response timing.

**Configured Delay Windows:**
```yaml
response_delay:
  unsubscribe:
    min: 0m
    max: 1m
  ooo:
    min: 0m
    max: 2m
  positive_reply:
    min: 5m
    max: 25m
  faq:
    min: 15m
    max: 60m
  objection:
    min: 30m
    max: 240m
  nurture:
    min: 2h
    max: 6h
```

Delays are randomized within the min/max window, not fixed. A fixed 10-minute delay is obviously automated. A delay that varies between 8 and 23 minutes is not.

Additionally, the system enforces business hours sending: no AI replies are sent between 10 PM and 7 AM in the prospect's timezone. Replies that would fall in the quiet window are held and sent at the next business-hours window.

### 12.6 Meeting Booking Orchestration

#### Lead State: `awaiting_booking`

When a positive reply escalates to a booking link being sent, the lead enters the `awaiting_booking` state. This is a distinct state from `positive_reply` — it represents that buying intent has been established and the critical conversion event (booking) is now pending.

#### Booking Recovery Flow

```
meeting_link_sent
      ↓
Timer: 24 hours
      ↓
[Check: has meeting been booked?]
      ├── YES → state = meeting_booked (flow ends)
      └── NO → trigger booking_recovery_24h campaign
              ↓
           Timer: 72 hours from link sent
              ↓
           [Check: has meeting been booked?]
              ├── YES → state = meeting_booked
              └── NO → trigger booking_recovery_72h campaign
                      ↓
                   Final check: 5 days
                      ↓
                   [Check: has meeting been booked?]
                      ├── YES → meeting_booked
                      └── NO → Slack escalation → human handles
```

Booking recovery messages must not feel automated. Correct approach:
> "Wanted to follow up in case scheduling slipped through the cracks. Happy to walk through how this fits your Q3 pipeline goals. Here's the link again: [link]"

Not:
> "Reminder: You have not booked your meeting."

#### Booking Conversion Tracking

The positive reply → meeting booked conversion rate is a first-class KPI. It is tracked as the ratio of `meeting_link_sent` events to `meeting_booked` events per client per campaign. This metric directly reflects the quality of the booking orchestration system.

---

## 13. CRM / Dashboard / Slack / Database Separation

### 13.1 The Separation Principle

One of the most common architectural failures in outbound agencies is treating HubSpot as the operational backend. It is not. HubSpot is a sales visibility tool — it shows account executives and founders what pipeline exists and what the status of each deal is. It is not where workflow logic should live, not where raw data should be stored, and not where AI outputs should be recorded.

The correct architecture enforces strict separation of concerns across four systems:

### 13.2 Supabase — Operational Source of Truth

Supabase stores everything. It is the operational memory of Krionics OS.

**What belongs in Supabase:**
- All raw lead records across all lifecycle stages
- All enrichment data and AI signal outputs
- All generated email sequences
- All reply records (raw text, classification results, AI drafts)
- All lead state history and state transitions
- All event records (immutable log)
- All workflow configuration (global, client, campaign, timing, feature flags)
- All prompt template versions
- All analytics aggregations for dashboard rendering
- All queue state and job tracking
- All audit logs

**What does NOT belong in Supabase:**
- Long-term archival of sent email bodies beyond retention window (external storage)
- Voice call recordings (if Service B is integrated — separate storage)

### 13.3 HubSpot — Sales Pipeline Visibility

HubSpot is written to only when a sales-significant event occurs. It is eventually consistent with Supabase.

**What belongs in HubSpot:**
- Contact and company records for engaged prospects
- Deal/opportunity records with pipeline stages
- Conversation summaries (not raw transcripts)
- Meeting booking records
- Activity logs (call notes, email notes — summarized)

**What does NOT belong in HubSpot:**
- Raw leads before engagement (pre-reply)
- Enrichment data (lives in Supabase)
- AI draft history
- Workflow states or automation metadata
- OOO or unsubscribe records (internal Supabase suppression only)
- Bounce data (Supabase only)

### 13.4 Krionics Dashboard — Client Observability

The dashboard presents aggregated, client-appropriate analytics. It is a read-only view of Supabase analytics tables, not a direct query against operational tables.

**What the dashboard shows:**
- Emails sent, reply rate, positive reply rate
- Meetings booked, booking rate
- Enrichment progress, campaign status
- Infrastructure health (domain/inbox status)
- Sequence performance by variant
- Funnel conversion metrics

**What the dashboard never shows:**
- Raw reply text or AI draft content
- Workflow execution internals
- Other clients' data (tenant isolation enforced at auth layer)
- Retry counts, dead letter entries (these are in the internal control panel)

### 13.5 Slack — Human-Action Events

Slack is operational noise reduction. Every alert that fires reduces the signal value of the channel. Alerts fire only when a human needs to act or needs to know.

**Slack receives:**
- Positive reply notifications (with lead name, company, snippet)
- Pending approval notifications (for AI drafts in approval queue)
- High-intent lead escalations (multiple booking reminders, no booking)
- System failure alerts (dead letter queue entries, workflow failures)
- Deliverability alerts (bounce rate threshold exceeded)

**Slack does not receive:**
- OOO responses
- Unsubscribes (unless spam threshold is triggered)
- Routine enrichment completions
- Standard analytics updates

---

## 14. Configuration System

### 14.1 Why Configuration-Driven Architecture Matters

The alternative to configuration-driven architecture is logic-driven architecture: business rules embedded in workflow nodes, hardcoded delays, hardcoded automation policies, hardcoded AI parameters. This works for one client. It fails at three. It is unmaintainable at ten.

Configuration-driven architecture means workflows are generic execution engines. They load configuration at runtime, execute behavior defined by that configuration, and produce outputs. Changing a client's automation level does not require touching a workflow. Tuning response delays does not require a deployment. Adding a new feature flag does not require duplicating a workflow.

This is the DI (dependency injection) principle applied to workflow orchestration.

### 14.2 Two Operational Interfaces

Krionics OS has two distinct interfaces that are never conflated:

**Client Dashboard:** Read-only analytics and observability for clients. They see their pipeline data.

**Krionics Control Panel (Internal):** The orchestration configuration interface used by the Krionics team. This is where client automation levels are set, where timing configurations are adjusted, where feature flags are toggled, where prompt templates are managed, where AI parameters are tuned. Clients never access this interface.

### 14.3 Configuration Schema

#### Global Configuration
Applies system-wide across all clients.

```sql
global_configs (
  key          TEXT PRIMARY KEY,
  value        JSONB,
  description  TEXT,
  updated_at   TIMESTAMPTZ
)
```

Example entries: `default_ai_model`, `max_retry_count`, `global_bounce_threshold`, `business_hours_policy`, `global_suppression_enabled`

#### Client Configuration
Per-client behavior parameters.

```sql
client_configs (
  client_id         UUID PRIMARY KEY,
  automation_level  INTEGER DEFAULT 1,
  crm_type          TEXT,
  crm_enabled       BOOLEAN DEFAULT TRUE,
  timezone          TEXT,
  slack_channel_id  TEXT,
  meeting_routing   JSONB,
  custom_rules      JSONB,
  updated_at        TIMESTAMPTZ
)
```

#### Reply Policies
Per-client, per-intent automation policy.

```sql
reply_policies (
  client_id   UUID,
  intent      TEXT,
  action      TEXT,  -- 'auto_send' | 'draft_only' | 'escalate' | 'suppress'
  PRIMARY KEY (client_id, intent)
)
```

#### Timing Rules
Configurable response delay windows.

```sql
timing_rules (
  client_id    UUID,
  intent       TEXT,
  delay_min_s  INTEGER,
  delay_max_s  INTEGER,
  PRIMARY KEY  (client_id, intent)
)
```

#### Feature Flags
Per-client feature activation.

```sql
feature_flags (
  client_id     UUID,
  flag_name     TEXT,
  is_enabled    BOOLEAN DEFAULT FALSE,
  PRIMARY KEY   (client_id, flag_name)
)
```

Available flags: `booking_reminders_enabled`, `auto_nurture_enabled`, `ai_objection_handling_enabled`, `crm_auto_sync_enabled`, `response_delay_enabled`, `ai_analytics_enabled`

#### Campaign Configurations
Per-campaign behavior.

```sql
campaign_configs (
  campaign_id       UUID PRIMARY KEY,
  client_id         UUID,
  sequence_type     TEXT,
  daily_send_limit  INTEGER,
  inbox_pool_id     UUID,
  cta_style         TEXT,
  follow_up_cadence_days INTEGER,
  tone              TEXT,
  active            BOOLEAN
)
```

### 14.4 Runtime Configuration Loading

All workflows load their configuration at the start of execution using the client_id from the triggering event. Configuration is not passed in the event payload (this would allow configuration to become stale mid-execution). Configuration is always fresh-loaded from Supabase at workflow start.

A configuration cache layer (Redis or Supabase edge cache) reduces database load for high-frequency workflows like reply classification.

---

## 15. Observability & Logging

### 15.1 Execution Logs

Every workflow execution is logged with: workflow name, triggering event ID, client ID, start timestamp, completion timestamp, success/failure status, error message (if failed), retry attempt number.

```sql
execution_logs (
  log_id         UUID PRIMARY KEY,
  workflow_name  TEXT,
  trigger_event  UUID,
  client_id      UUID,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  status         TEXT,  -- 'success' | 'failed' | 'retrying'
  error_message  TEXT,
  retry_attempt  INTEGER DEFAULT 0,
  metadata       JSONB
)
```

### 15.2 Audit Logs

Audit logs record every action taken by AI, every action taken by a human operator, and every significant system decision.

```sql
audit_logs (
  audit_id     UUID PRIMARY KEY,
  client_id    UUID,
  lead_id      UUID,
  action_type  TEXT,  -- 'ai_generated' | 'human_approved' | 'human_edited' | 'auto_sent' | 'state_changed'
  actor        TEXT,  -- 'claude-sonnet-4' | 'operator_email' | 'system'
  before_value JSONB,
  after_value  JSONB,
  timestamp    TIMESTAMPTZ
)
```

Audit logs support: compliance investigations, quality assurance reviews, client disputes, and AI behavior analysis.

### 15.3 AI Invocation Logs

Every Claude API call is logged independently to enable cost tracking, output quality analysis, and prompt performance comparison.

```sql
ai_invocation_logs (
  invocation_id    UUID PRIMARY KEY,
  client_id        UUID,
  task_type        TEXT,
  prompt_template  TEXT,
  template_version INTEGER,
  input_tokens     INTEGER,
  output_tokens    INTEGER,
  model_used       TEXT,
  confidence       FLOAT,
  latency_ms       INTEGER,
  output_summary   JSONB,
  timestamp        TIMESTAMPTZ
)
```

### 15.4 Queue Health Monitoring

Queue depth metrics are recorded every 5 minutes for all active queues. Alerts fire when:

| Queue | Alert Threshold | Severity |
|---|---|---|
| Enrichment queue | > 500 items | Warning |
| AI generation queue | > 200 items | Warning |
| Reply classification queue | > 50 items | High |
| Approval queue | > 20 items | Warning (operator bandwidth) |
| Retry queue | > 50 items | High |
| Dead letter queue | > 0 items | Critical |

### 15.5 Workflow Tracing

Each triggering event carries a `trace_id` that is propagated through all downstream workflows and queue jobs triggered by that event. This enables full end-to-end tracing: a reply arrives, is classified, generates a draft, enters the approval queue, is approved, is scheduled, and is sent — all traced under a single `trace_id`. Debugging any issue requires only looking up the trace.

---

## 16. Scaling & Reliability

### 16.1 Retry Architecture

All queue-based workflows implement retry logic with exponential backoff:

- **Attempt 1:** Immediate
- **Attempt 2:** +1 minute
- **Attempt 3:** +5 minutes
- **Post max retries:** Dead letter queue + Slack alert

Retries are idempotent by design. Every workflow operation checks whether it has already been completed (by checking for the existence of the output event in the events table) before executing. This prevents duplicate processing on retry.

### 16.2 Failure Isolation

Queue isolation means failures are contained. An enrichment queue failure does not affect reply processing. A CRM sync failure does not affect meeting booking. Each domain's queue is independently managed, independently monitored, and independently scaled.

### 16.3 Async Processing

No operation that can be deferred is executed synchronously. The webhook acknowledgment is the only synchronous operation in reply intake. Everything after webhook receipt is asynchronous. This means: no webhook timeouts, no cascading failures from slow AI responses, and no single operation blocking the flow of others.

### 16.4 Caching

- **Configuration caching:** Client configuration loaded at workflow start is cached for the duration of the workflow execution. Not refreshed mid-execution.
- **AI output caching:** For identical enrichment data generating identical leads, AI outputs can be cached to reduce redundant API calls. Cache key: hash of input contract. Cache TTL: 24 hours.
- **Prompt template caching:** Active prompt templates are cached in memory for high-frequency invocations (reply classification runs on every reply).

### 16.5 Multi-Tenant Isolation at Scale

Generic workflows scale horizontally without client isolation concerns because client isolation is enforced at the data layer (Supabase RLS), not the workflow layer. A single `reply-classification-workflow` instance can process replies from any client without risk of data crossover.

### 16.6 Supabase Optimization

At scale, the following Supabase optimizations are applied:

- Indexes on `client_id`, `lead_id`, `event_type`, and `timestamp` columns across all high-read tables
- `events` table partitioned by month for efficient historical queries
- `analytics_snapshots` table as the primary source for dashboard queries (pre-aggregated, avoids operational table scans)
- Row-level security policies enforcing client_id isolation at the database layer

---

## 17. Future Expansion

### 17.1 Confidence-Based Routing

In the current architecture, automation level (1/2/3) determines whether AI auto-sends or drafts. A future enhancement introduces confidence thresholds as a secondary routing dimension:

```
if classification.confidence > 0.95 AND automation_level >= 2:
    → auto_send
elif classification.confidence > 0.85 AND automation_level >= 2:
    → delayed_send (with shorter delay)
else:
    → draft_only (regardless of automation level)
```

This creates adaptive reply orchestration: the system automatically becomes more conservative when it is less certain, without requiring human configuration.

### 17.2 Lead Quality Scoring (LQS) V2

The initial LQS is a weighted signal score from enrichment data. V2 introduces campaign-feedback learning: leads that converted to meetings in the past (with similar ICP characteristics and buying signals) score higher, feeding better prioritization and sequencing assignment.

### 17.3 AI Campaign Analytics

Invocation Point 6 (Analytics Intelligence) — described in Section 10 — enables AI to analyze campaign performance across sequences, identify winning patterns, flag underperforming variants, and generate optimization recommendations. This moves the system from passive observability to active optimization intelligence.

### 17.4 Autonomous SDR Mode (Level 4)

A conceptual Level 4 automation — beyond Level 3 — where the system not only handles all reply types autonomously but also makes independent decisions about campaign strategy changes, ICP filter refinements, and nurture timing based on performance data. This requires: mature prompt systems, extensive ground-truth datasets from Levels 1-3 operations, robust confidence scoring, and strong human oversight for QA review.

### 17.5 Voice Agent Integration

Service B (AI Voice Agents) integrates with the same Supabase backend and event architecture. Meeting booking events from voice agents write the same `meeting_booked` event. Lead states transition through the same state machine. The dashboard unifies outbound email and voice qualification metrics under the same client view. The architecture is designed for this integration from day one.

### 17.6 Personalization Depth Optimization

Automated personalization depth selection based on lead quality score:

| LQS Range | Personalization Depth | AI Cost Level |
|---|---|---|
| 0.0 — 0.4 | L1 (basic company mention) | Low |
| 0.4 — 0.6 | L2 (company + growth signal) | Medium |
| 0.6 — 0.8 | L3 (company + role + business pain) | Medium-High |
| 0.8 — 1.0 | L4 (deep contextual personalization) | High |

This optimizes AI API costs while directing the highest personalization investment toward the highest-quality leads.

---

## Appendix A: Universal Lead Schema

Every lead in Krionics OS is stored in the Universal Lead Schema in Supabase. This is the canonical representation of a lead regardless of source.

```sql
leads (
  lead_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(client_id),
  campaign_id      UUID REFERENCES campaigns(campaign_id),

  -- Identity
  first_name       TEXT,
  last_name        TEXT,
  email            TEXT NOT NULL,
  phone            TEXT,
  linkedin_url     TEXT,

  -- Company
  company_name     TEXT,
  company_domain   TEXT,
  company_industry TEXT,
  company_size     TEXT,
  company_revenue  TEXT,
  company_location TEXT,

  -- Role
  title            TEXT,
  seniority        TEXT,

  -- Source
  source           TEXT DEFAULT 'apollo',
  source_id        TEXT,
  fetched_at       TIMESTAMPTZ DEFAULT now(),

  -- State
  lead_status      TEXT NOT NULL DEFAULT 'raw_imported',
  prev_status      TEXT,
  status_updated_at TIMESTAMPTZ DEFAULT now(),

  -- Quality
  lqs_score        FLOAT,
  lqs_computed_at  TIMESTAMPTZ,
  personalization_depth TEXT DEFAULT 'L2',

  -- Suppression
  is_suppressed    BOOLEAN DEFAULT FALSE,
  suppression_reason TEXT,
  suppressed_at    TIMESTAMPTZ,

  -- Timestamps
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
)
```

---

## Appendix B: Key Supabase Tables Reference

| Table | Purpose |
|---|---|
| `clients` | Client workspace records |
| `leads` | Universal lead records (all stages) |
| `enriched_leads` | Clay enrichment output per lead |
| `generated_sequences` | AI-generated email sequences |
| `replies` | Raw reply records |
| `reply_classifications` | Claude classification outputs |
| `ai_drafts` | AI-generated response drafts |
| `outbound_events` | Sending activity from Instantly |
| `events` | Immutable system event log |
| `lead_state_history` | Audit trail of state transitions |
| `global_configs` | System-wide configuration |
| `client_configs` | Per-client configuration |
| `campaign_configs` | Per-campaign configuration |
| `reply_policies` | Per-client, per-intent automation policies |
| `timing_rules` | Response delay windows |
| `feature_flags` | Per-client feature toggles |
| `prompt_templates` | Versioned prompt templates |
| `client_faqs` | FAQ knowledge assets |
| `objection_library` | Objection response assets |
| `client_positioning` | Business context assets |
| `analytics_snapshots` | Pre-aggregated dashboard metrics |
| `execution_logs` | Workflow execution history |
| `audit_logs` | AI and human action audit trail |
| `ai_invocation_logs` | Claude API call records |
| `infrastructure_configs` | Domain, inbox, DNS configuration |
| `suppression_list` | Global email suppression |

---

*Document End*  
*Krionics OS · Master Architecture Specification · Version 1.0 · May 2026*  
*Classification: Internal Engineering · Confidential*
