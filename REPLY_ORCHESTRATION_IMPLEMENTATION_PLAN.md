# Krionics OS: Reply Orchestration System Implementation Plan

**Status:** Detailed implementation plan for full reply flow  
**Target:** Complete reply pipeline from Instantly webhook → sent response  
**Architecture Reference:** Master System Architecture Document (Sections 6, 9.2 Domain 6, 12, Appendices A & B)  
**Build Approach:** Code-only (no n8n), using BullMQ for queue orchestration  

---

## Table of Contents

1. [Phase 1: Database Schema & Migrations](#phase-1-database-schema--migrations)
2. [Phase 2: Webhook Handler & Reply Intake](#phase-2-webhook-handler--reply-intake)
3. [Phase 3: Lead State Machine](#phase-3-lead-state-machine)
4. [Phase 4: Reply Classification (Claude)](#phase-4-reply-classification-claude)
5. [Phase 5: AI Draft Generation (Claude)](#phase-5-ai-draft-generation-claude)
6. [Phase 6: Response Scheduling & Sending](#phase-6-response-scheduling--sending)
7. [Phase 7: Integration with Dashboard](#phase-7-integration-with-dashboard)
8. [Phase 8: Event Logging & Observability](#phase-8-event-logging--observability)
9. [Phase 9: Testing & Validation](#phase-9-testing--validation)
10. [Deployment Strategy](#deployment-strategy)

---

## Phase 1: Database Schema & Migrations

### 1.1 New Supabase Tables Required

#### Table 1.1.1: `leads` — Universal Lead Schema
**Purpose:** Canonical lead record across all lifecycle stages (replaces current partial schema)  
**File:** `supabase/migrations/20260524000001_create_leads_universal_schema.sql`

```sql
CREATE TABLE leads (
  lead_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              UUID NOT NULL REFERENCES clients(client_id),
  campaign_id            UUID REFERENCES campaigns(campaign_id),

  -- Identity
  first_name             TEXT,
  last_name              TEXT,
  email                  TEXT NOT NULL,
  phone                  TEXT,
  linkedin_url           TEXT,

  -- Company
  company_name           TEXT,
  company_domain         TEXT,
  company_industry       TEXT,
  company_size           TEXT,
  company_revenue        TEXT,
  company_location       TEXT,

  -- Role
  title                  TEXT,
  seniority              TEXT,

  -- Source
  source                 TEXT DEFAULT 'apollo',  -- 'apollo' | 'imported' | 'manual'
  source_id              TEXT,
  fetched_at             TIMESTAMPTZ DEFAULT now(),

  -- State Machine (PRIMARY STATE — mutually exclusive)
  lead_status            TEXT NOT NULL DEFAULT 'raw_imported',
  -- Valid values: raw_imported, deduplicated, enrichment_pending, enriched, personalized,
  -- campaign_ready, queued_for_sending, sending_active, email_bounced, no_response,
  -- reply_received, positive_reply, faq_reply, objection_reply, nurture_reply,
  -- unsubscribe, wrong_contact, ooo, ai_draft_pending, reply_sent,
  -- conversation_active, awaiting_booking, nurture_active, meeting_booked,
  -- qualified_opportunity, closed_positive, closed_negative

  prev_status            TEXT,  -- Previous state for transition audit
  status_updated_at      TIMESTAMPTZ DEFAULT now(),
  status_reason          TEXT,  -- Why state changed (e.g., 'enrichment_failed', 'positive_reply_classified')

  -- Secondary Flags (for analytics, non-authoritative for orchestration)
  has_positive_reply     BOOLEAN DEFAULT FALSE,
  has_reply              BOOLEAN DEFAULT FALSE,
  has_meeting_booked     BOOLEAN DEFAULT FALSE,
  is_suppressed          BOOLEAN DEFAULT FALSE,
  suppression_reason     TEXT,  -- 'unsubscribe' | 'bounced' | 'manual' | 'spam'
  suppressed_at          TIMESTAMPTZ,

  -- Quality & Personalization
  lqs_score              FLOAT,  -- Lead Quality Score (0.0 - 1.0)
  lqs_computed_at        TIMESTAMPTZ,
  personalization_depth  TEXT DEFAULT 'L2',  -- L1 | L2 | L3 | L4

  -- Assignment & Routing
  assigned_to_operator_id UUID REFERENCES operators(id),
  routing_policy         TEXT,  -- Auto determined based on automation_level

  -- SLA Tracking
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  enrichment_started_at  TIMESTAMPTZ,
  enrichment_completed_at TIMESTAMPTZ,
  first_reply_at         TIMESTAMPTZ,
  first_booking_link_sent_at TIMESTAMPTZ,
  meeting_booked_at      TIMESTAMPTZ,

  -- Metadata
  metadata               JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_leads_client_id ON leads(client_id);
CREATE INDEX idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX idx_leads_lead_status ON leads(lead_status);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_has_reply ON leads(has_reply) WHERE has_reply = TRUE;
CREATE INDEX idx_leads_assigned_operator ON leads(assigned_to_operator_id) WHERE assigned_to_operator_id IS NOT NULL;
```

---

#### Table 1.1.2: `enriched_leads` — Clay Enrichment Output
**Purpose:** Structured enrichment data from Clay API  
**File:** `supabase/migrations/20260524000002_create_enriched_leads.sql`

```sql
CREATE TABLE enriched_leads (
  enrichment_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID NOT NULL UNIQUE REFERENCES leads(lead_id),
  client_id             UUID NOT NULL REFERENCES clients(client_id),

  -- LinkedIn Data
  linkedin_profile_url  TEXT,
  linkedin_headline     TEXT,
  linkedin_summary      TEXT,
  linkedin_updated_at   TIMESTAMPTZ,

  -- Company Intelligence
  company_summary       TEXT,
  company_growth_signals TEXT[],  -- ['Series B funded', 'Hired 50 SDRs', 'IPO filing']
  hiring_signals        TEXT[],   -- ['SDR openings', 'Growth role posted', 'Sales team expanding']
  tech_stack            TEXT[],   -- ['HubSpot', 'Salesforce', 'Slack']
  website_summary       TEXT,
  recent_news           TEXT[],

  -- Signal Extraction (AI-processed)
  buying_signals        TEXT[],
  personalization_hooks TEXT[],
  icp_fit_score         FLOAT,
  icp_fit_reasoning     TEXT,
  recommended_depth     TEXT,  -- L1 | L2 | L3 | L4

  -- Metadata
  enrichment_version    TEXT,  -- Track which Clay/AI version processed this
  clay_request_id       TEXT,
  enriched_at           TIMESTAMPTZ DEFAULT now(),
  is_stale              BOOLEAN DEFAULT FALSE,
  stale_reason          TEXT
);

CREATE INDEX idx_enriched_leads_lead_id ON enriched_leads(lead_id);
CREATE INDEX idx_enriched_leads_client_id ON enriched_leads(client_id);
```

---

#### Table 1.1.3: `replies` — Raw Reply Records
**Purpose:** Store all incoming replies from Instantly  
**File:** `supabase/migrations/20260524000003_create_replies.sql`

```sql
CREATE TABLE replies (
  reply_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(client_id),
  lead_id               UUID NOT NULL REFERENCES leads(lead_id),
  campaign_id           UUID REFERENCES campaigns(campaign_id),

  -- Email Metadata
  thread_id             TEXT NOT NULL,  -- Instantly thread ID
  sender_email          TEXT NOT NULL,
  sender_name           TEXT,
  received_at           TIMESTAMPTZ NOT NULL,

  -- Content
  reply_subject         TEXT,
  reply_body            TEXT NOT NULL,
  reply_body_html       TEXT,

  -- Incoming Sequence Context
  email_sequence_number INTEGER,  -- Which email in sequence was replied to (1, 2, 3, or break)
  last_sent_subject     TEXT,
  last_sent_at          TIMESTAMPTZ,

  -- Processing Status
  classification_status TEXT DEFAULT 'pending',  -- pending | classified | failed
  classification_error  TEXT,

  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  processed_at          TIMESTAMPTZ
);

CREATE INDEX idx_replies_client_id ON replies(client_id);
CREATE INDEX idx_replies_lead_id ON replies(lead_id);
CREATE INDEX idx_replies_thread_id ON replies(thread_id);
CREATE INDEX idx_replies_received_at ON replies(received_at DESC);
CREATE INDEX idx_replies_classification_status ON replies(classification_status);
```

---

#### Table 1.1.4: `reply_classifications` — Claude Classification Output
**Purpose:** Store intent classification, confidence, and routing decision  
**File:** `supabase/migrations/20260524000004_create_reply_classifications.sql`

```sql
CREATE TABLE reply_classifications (
  classification_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id              UUID NOT NULL UNIQUE REFERENCES replies(reply_id),
  lead_id               UUID NOT NULL REFERENCES leads(lead_id),
  client_id             UUID NOT NULL REFERENCES clients(client_id),

  -- Classification Output
  intent                TEXT NOT NULL,
  -- Values: positive | faq | objection | nurture | unsubscribe | wrong_contact | ooo

  confidence            FLOAT NOT NULL,  -- 0.0 - 1.0
  sentiment             TEXT,  -- interested | curious | skeptical | negative | neutral
  requires_human        BOOLEAN DEFAULT FALSE,

  -- AI Decision
  suggested_action      TEXT,
  -- Values: auto_send | draft_only | escalate | suppress | pause

  -- Intent-Specific Intelligence
  objection_type        TEXT,  -- pricing | timing | trust | competitor | not_relevant | scope
  objection_reasoning   TEXT,
  nurture_timing_hint   TEXT,  -- Q4 | next_month | 6_months | immediate

  -- Prompt & Model
  prompt_template_id    UUID,  -- Reference to versioned prompt
  prompt_template_version INTEGER,
  model_used            TEXT,  -- claude-sonnet-4-6, etc.
  input_tokens          INTEGER,
  output_tokens         INTEGER,
  processing_latency_ms INTEGER,

  -- Classification Metadata
  classified_at         TIMESTAMPTZ DEFAULT now(),
  automation_level_applied INTEGER  -- Which client automation level was active
);

CREATE INDEX idx_reply_classifications_reply_id ON reply_classifications(reply_id);
CREATE INDEX idx_reply_classifications_lead_id ON reply_classifications(lead_id);
CREATE INDEX idx_reply_classifications_intent ON reply_classifications(intent);
CREATE INDEX idx_reply_classifications_confidence ON reply_classifications(confidence DESC);
```

---

#### Table 1.1.5: `ai_drafts` — AI-Generated Response Drafts
**Purpose:** Store AI-generated replies before human approval or auto-send  
**File:** `supabase/migrations/20260524000005_create_ai_drafts.sql`

```sql
CREATE TABLE ai_drafts (
  draft_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id              UUID NOT NULL REFERENCES replies(reply_id),
  lead_id               UUID NOT NULL REFERENCES leads(lead_id),
  client_id             UUID NOT NULL REFERENCES clients(client_id),

  -- Draft Content
  draft_subject         TEXT,
  draft_body            TEXT NOT NULL,

  -- Generation Context
  intent_classified_as  TEXT NOT NULL,  -- The intent this draft responds to
  includes_booking_link BOOLEAN DEFAULT FALSE,
  booking_link_url      TEXT,

  -- Quality Metrics
  word_count            INTEGER,
  tone_assessment       TEXT,
  quality_flags         TEXT[],  -- Empty array = pass; filled = has issues
  confidence            FLOAT,

  -- Generation Process
  prompt_template_id    UUID,
  prompt_template_version INTEGER,
  model_used            TEXT,
  input_tokens          INTEGER,
  output_tokens         INTEGER,
  generation_latency_ms INTEGER,

  -- Approval Status
  approval_status       TEXT DEFAULT 'pending_review',
  -- Values: pending_review | approved | rejected | edited_and_approved | auto_sent

  approved_by           UUID REFERENCES operators(id),
  approval_notes        TEXT,
  approved_at           TIMESTAMPTZ,

  human_edits           TEXT,  -- If operator edited, store original + edits
  edited_by             UUID REFERENCES operators(id),
  edited_at             TIMESTAMPTZ,

  -- Send Status
  sent_at               TIMESTAMPTZ,
  send_status           TEXT,  -- pending | scheduled | sent | failed
  send_error            TEXT,

  -- Metadata
  generated_at          TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_drafts_reply_id ON ai_drafts(reply_id);
CREATE INDEX idx_ai_drafts_lead_id ON ai_drafts(lead_id);
CREATE INDEX idx_ai_drafts_approval_status ON ai_drafts(approval_status);
CREATE INDEX idx_ai_drafts_client_id ON ai_drafts(client_id);
```

---

#### Table 1.1.6: `events` — Immutable System Event Log
**Purpose:** Historical record of all system events (append-only)  
**File:** `supabase/migrations/20260524000006_create_events.sql`

```sql
CREATE TABLE events (
  event_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(client_id),
  lead_id               UUID REFERENCES leads(lead_id),
  campaign_id           UUID REFERENCES campaigns(campaign_id),

  -- Event Classification
  event_type            TEXT NOT NULL,
  -- Categories:
  -- Acquisition: leads_imported, duplicate_detected, enrichment_queued, enrichment_completed, enrichment_failed
  -- Outbound: campaign_pushed, email_sent, email_opened, email_bounced, sequence_paused, sequence_resumed
  -- Reply: reply_received, reply_classified, draft_generated, draft_approved, draft_rejected, auto_reply_sent, human_reply_sent
  -- Conversion: meeting_link_sent, booking_reminder_triggered, meeting_booked, opportunity_created
  -- System: workflow_failed, retry_queued, dead_letter_queued, deliverability_warning, config_reloaded

  event_timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            TEXT,  -- 'system' | 'ai' | 'human' | workflow name

  -- Event Metadata (polymorphic structure)
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Examples:
  -- reply_received: { reply_id, thread_id, sender_email }
  -- reply_classified: { reply_id, intent, confidence, suggested_action }
  -- draft_generated: { draft_id, word_count, confidence }
  -- draft_approved: { draft_id, approved_by, edits_made }

  -- Tracing
  trace_id              UUID,  -- Links related events through a workflow
  parent_event_id       UUID REFERENCES events(event_id)
);

CREATE INDEX idx_events_client_id ON events(client_id);
CREATE INDEX idx_events_lead_id ON events(lead_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(event_timestamp DESC);
CREATE INDEX idx_events_trace_id ON events(trace_id);

-- Partition by month for efficient historical queries
CREATE TABLE events_202605 PARTITION OF events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

---

#### Table 1.1.7: `lead_state_history` — State Transition Audit Trail
**Purpose:** Immutable record of every state change  
**File:** `supabase/migrations/20260524000007_create_lead_state_history.sql`

```sql
CREATE TABLE lead_state_history (
  state_history_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID NOT NULL REFERENCES leads(lead_id),
  client_id             UUID NOT NULL REFERENCES clients(client_id),

  -- State Transition
  from_state            TEXT NOT NULL,
  to_state              TEXT NOT NULL,
  transition_reason     TEXT,  -- Why the state changed

  -- Triggering Event
  triggered_by_event_id UUID REFERENCES events(event_id),
  triggered_by          TEXT,  -- 'system' | 'ai' | 'human' | workflow name

  -- Actor (if human)
  actor_operator_id     UUID REFERENCES operators(id),

  -- Timing
  transitioned_at       TIMESTAMPTZ DEFAULT now(),
  duration_in_state_ms  BIGINT  -- How long lead was in `from_state`
);

CREATE INDEX idx_lead_state_history_lead_id ON lead_state_history(lead_id);
CREATE INDEX idx_lead_state_history_from_state ON lead_state_history(from_state);
CREATE INDEX idx_lead_state_history_to_state ON lead_state_history(to_state);
```

---

#### Table 1.1.8: `reply_policies` — Automation Routing Rules
**Purpose:** Per-client, per-intent automation decisions  
**File:** `supabase/migrations/20260524000008_create_reply_policies.sql`

```sql
CREATE TABLE reply_policies (
  policy_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(client_id),
  intent                TEXT NOT NULL,
  -- Valid intents: positive | faq | objection | nurture | unsubscribe | wrong_contact | ooo

  -- Action based on automation level
  action_level_1        TEXT NOT NULL,  -- 'auto_send' | 'draft_only' | 'escalate'
  action_level_2        TEXT NOT NULL,
  action_level_3        TEXT NOT NULL,

  -- Confidence-based override (future enhancement)
  confidence_threshold  FLOAT DEFAULT 0.85,  -- Below this → draft_only regardless of level

  -- Special routing
  escalation_keywords   TEXT[],  -- If found in reply, escalate to human
  auto_suppress_phrases TEXT[],  -- Patterns that trigger unsubscribe suppression

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (client_id, intent)
);

CREATE INDEX idx_reply_policies_client_id ON reply_policies(client_id);
```

---

#### Table 1.1.9: `timing_rules` — Response Delay Configuration
**Purpose:** Per-client delay windows for human-like response timing  
**File:** `supabase/migrations/20260524000009_create_timing_rules.sql`

```sql
CREATE TABLE timing_rules (
  timing_rule_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(client_id),
  intent                TEXT NOT NULL,

  -- Delay Window (in minutes)
  delay_min_minutes     INTEGER NOT NULL,
  delay_max_minutes     INTEGER NOT NULL,

  -- Business Hours
  enforce_business_hours BOOLEAN DEFAULT TRUE,
  business_hours_start  TIME DEFAULT '07:00:00',  -- 7 AM
  business_hours_end    TIME DEFAULT '22:00:00',  -- 10 PM
  timezone              TEXT DEFAULT 'America/New_York',

  -- Lead Timezone Handling
  send_in_prospect_timezone BOOLEAN DEFAULT TRUE,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (client_id, intent)
);

CREATE INDEX idx_timing_rules_client_id ON timing_rules(client_id);
```

---

#### Table 1.1.10: `response_queue` — Pending Scheduled Responses
**Purpose:** Track responses waiting to be sent  
**File:** `supabase/migrations/20260524000010_create_response_queue.sql`

```sql
CREATE TABLE response_queue (
  queue_entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id              UUID NOT NULL UNIQUE REFERENCES ai_drafts(draft_id),
  lead_id               UUID NOT NULL REFERENCES leads(lead_id),
  client_id             UUID NOT NULL REFERENCES clients(client_id),

  -- Scheduling
  scheduled_send_at     TIMESTAMPTZ NOT NULL,
  actual_sent_at        TIMESTAMPTZ,
  send_status           TEXT DEFAULT 'pending',  -- pending | scheduled | sent | failed

  -- Queue Classification
  queue_type            TEXT NOT NULL,
  -- Values: immediate_queue | delayed_queue | approval_queue | nurture_queue

  -- Send Attempt Tracking
  send_attempts         INTEGER DEFAULT 0,
  last_send_error       TEXT,

  -- Metadata
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_response_queue_scheduled_send_at ON response_queue(scheduled_send_at);
CREATE INDEX idx_response_queue_send_status ON response_queue(send_status);
CREATE INDEX idx_response_queue_queue_type ON response_queue(queue_type);
CREATE INDEX idx_response_queue_client_id ON response_queue(client_id);
```

---

### 1.2 Schema Modifications to Existing Tables

#### Modify `reply_items` table
**Purpose:** Keep for backward compatibility with dashboard, link to new `replies` table  
**Changes:**

```sql
ALTER TABLE reply_items ADD COLUMN reply_id UUID REFERENCES replies(reply_id);
ALTER TABLE reply_items ADD COLUMN draft_id UUID REFERENCES ai_drafts(draft_id);
ALTER TABLE reply_items ADD COLUMN classification_id UUID REFERENCES reply_classifications(classification_id);
ALTER TABLE reply_items ADD COLUMN trace_id UUID;  -- For end-to-end tracing
```

---

#### Modify `clients` table
**Purpose:** Add automation configuration  
**Changes:**

```sql
ALTER TABLE clients ADD COLUMN automation_level INTEGER DEFAULT 1;  -- 1 | 2 | 3
ALTER TABLE clients ADD COLUMN reply_processing_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE clients ADD COLUMN auto_send_enabled BOOLEAN DEFAULT FALSE;
```

---

### 1.3 Deployment Order for Phase 1

```
1. Create events table + partitioning
2. Create leads table (universal schema)
3. Create enriched_leads table
4. Create replies table
5. Create reply_classifications table
6. Create ai_drafts table
7. Create lead_state_history table
8. Create reply_policies table
9. Create timing_rules table
10. Create response_queue table
11. Alter reply_items (add new columns)
12. Alter clients (add automation config)
13. Run data migration: import existing reply_items → replies + reply_classifications
14. Add RLS policies for client isolation
```

---

## Phase 2: Webhook Handler & Reply Intake

### 2.1 Instantly Reply Webhook Handler

**File:** `apps/dashboard/app/api/webhooks/instantly/route.ts`

**Purpose:** Receive Instantly reply webhooks, store raw reply, enqueue for classification

**Requirements:**
- Acknowledge webhook within 200ms (all processing async)
- Validate webhook signature from Instantly
- Store raw reply immediately
- Enqueue for classification queue
- Emit `reply_received` event
- Generate trace_id for end-to-end tracing

**Implementation:**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { replyClassificationQueue } from "@/lib/queues";

// Verify Instantly webhook signature
function verifyInstantlySignature(
  req: NextRequest,
  payload: string
): boolean {
  const signature = req.headers.get("x-instantly-signature");
  const webhookSecret = process.env.INSTANTLY_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) return false;
  
  const hash = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");
  
  return hash === signature;
}

export async function POST(req: NextRequest) {
  // Step 1: Validate signature immediately
  const rawBody = await req.text();
  
  if (!verifyInstantlySignature(req, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const traceId = uuidv4();

  // Step 2: Fast-path validation (minimal checks)
  const {
    type,
    thread_id,
    from_email,
    from_name,
    subject,
    body,
    received_at,
    campaign_id,
    email_number
  } = payload;

  if (type !== "reply" || !thread_id || !from_email || !body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Step 3: Start async processing (don't await)
  processReplyAsync(
    {
      thread_id,
      from_email,
      from_name,
      subject: subject || "(no subject)",
      body,
      received_at: new Date(received_at),
      campaign_id,
      email_number: email_number || 0,
      instantly_payload: payload
    },
    traceId
  ).catch((err) => {
    console.error(`Failed to process reply ${thread_id}:`, err);
    // Slack alert would go here for critical errors
  });

  // Step 4: Return immediately (within 200ms)
  return NextResponse.json({ status: "queued" }, { status: 202 });
}

async function processReplyAsync(
  replyData: any,
  traceId: string
): Promise<void> {
  // This runs AFTER webhook acknowledgment

  try {
    // Step 1: Find the lead by thread_id and campaign
    const [lead] = await sql`
      SELECT l.lead_id, l.client_id, l.lead_status, l.assigned_to_operator_id
      FROM leads l
      WHERE l.thread_id = ${replyData.thread_id}
      LIMIT 1
    `;

    if (!lead) {
      console.warn(`No lead found for thread ${replyData.thread_id}`);
      // Could be orphaned thread or Instantly test — don't error, just log
      return;
    }

    const { lead_id, client_id } = lead;

    // Step 2: Store raw reply
    const [reply] = await sql`
      INSERT INTO replies (
        client_id,
        lead_id,
        campaign_id,
        thread_id,
        sender_email,
        sender_name,
        received_at,
        reply_subject,
        reply_body,
        email_sequence_number
      ) VALUES (
        ${client_id},
        ${lead_id},
        ${replyData.campaign_id},
        ${replyData.thread_id},
        ${replyData.from_email},
        ${replyData.from_name},
        ${replyData.received_at},
        ${replyData.subject},
        ${replyData.body},
        ${replyData.email_number}
      )
      RETURNING reply_id
    `;

    const { reply_id } = reply;

    // Step 3: Emit reply_received event
    await sql`
      INSERT INTO events (
        client_id,
        lead_id,
        event_type,
        created_by,
        metadata,
        trace_id
      ) VALUES (
        ${client_id},
        ${lead_id},
        'reply_received',
        'system',
        ${JSON.stringify({
          reply_id,
          thread_id: replyData.thread_id,
          sender_email: replyData.from_email
        })}::jsonb,
        ${traceId}
      )
    `;

    // Step 4: Enqueue for classification (async worker will pick this up)
    await replyClassificationQueue.add(
      "classify-reply",
      {
        reply_id,
        lead_id,
        client_id,
        trace_id
      },
      {
        priority: 10,  // HIGH priority
        attempts: 2,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true
      }
    );

    // Step 5: Update lead status to reply_received (idempotent)
    await transitionLeadState(
      lead_id,
      "reply_received",
      "reply_received",
      reply_id
    );

  } catch (err) {
    console.error(`Critical error in processReplyAsync for ${replyData.thread_id}:`, err);
    // Send to dead letter queue / Slack alert
    throw err;
  }
}
```

**Testing Requirements:**
- Validate webhook signature verification works
- Test with realistic Instantly webhook payloads
- Verify acknowledgment happens within 200ms
- Verify async processing continues after 202 response
- Test with missing lead (orphaned thread)
- Test with malformed payload

---

### 2.2 Helper: `transitionLeadState()` Utility

**File:** `apps/dashboard/lib/lead-state-machine.ts`

**Purpose:** Centralized lead state transition logic with validation

```typescript
export async function transitionLeadState(
  leadId: string,
  fromState: string,
  toState: string,
  reason?: string,
  triggeredByEventId?: string,
  triggerActor?: string
): Promise<void> {
  // Step 1: Verify current state matches
  const [lead] = await sql`
    SELECT lead_status FROM leads WHERE lead_id = ${leadId}
  `;

  if (lead.lead_status !== fromState) {
    throw new Error(
      `State mismatch: expected ${fromState}, found ${lead.lead_status}`
    );
  }

  // Step 2: Update lead status
  await sql`
    UPDATE leads
    SET lead_status = ${toState},
        prev_status = ${fromState},
        status_updated_at = NOW(),
        status_reason = ${reason || null}
    WHERE lead_id = ${leadId}
  `;

  // Step 3: Record in state history
  await sql`
    INSERT INTO lead_state_history (
      lead_id,
      from_state,
      to_state,
      transition_reason,
      triggered_by_event_id,
      triggered_by
    ) VALUES (
      ${leadId},
      ${fromState},
      ${toState},
      ${reason},
      ${triggeredByEventId},
      ${triggerActor || 'system'}
    )
  `;

  // Step 4: Determine and trigger downstream actions
  await routeLeadStateChange(leadId, toState);
}

async function routeLeadStateChange(leadId: string, toState: string) {
  // Route based on new state
  if (toState === 'reply_received') {
    // Queued for classification (already done in webhook handler)
  } else if (toState === 'positive_reply') {
    // Pause Instantly campaign, enqueue for draft generation
  } else if (toState === 'unsubscribe') {
    // Add to suppression list, stop all campaigns
  }
  // ... other states
}
```

---

## Phase 3: Lead State Machine

### 3.1 State Machine Service

**File:** `apps/dashboard/lib/state-machine.ts`

**Purpose:** Immutable state machine with valid transitions

```typescript
// Define valid state transitions
const STATE_TRANSITIONS: Record<string, string[]> = {
  'raw_imported': ['deduplicated'],
  'deduplicated': ['enrichment_pending'],
  'enrichment_pending': ['enriched', 'enrichment_failed'],  // enrichment_failed → enrichment_pending (retry)
  'enriched': ['personalized'],
  'personalized': ['campaign_ready'],
  'campaign_ready': ['queued_for_sending'],
  'queued_for_sending': ['sending_active', 'email_bounced'],
  'sending_active': ['reply_received', 'email_bounced', 'no_response'],
  'email_bounced': ['closed_negative'],
  'no_response': ['closed_negative'],
  
  // Reply phase
  'reply_received': ['positive_reply', 'faq_reply', 'objection_reply', 'nurture_reply', 'unsubscribe', 'wrong_contact', 'ooo'],
  'positive_reply': ['ai_draft_pending', 'awaiting_booking'],
  'faq_reply': ['ai_draft_pending'],
  'objection_reply': ['ai_draft_pending'],
  'nurture_reply': ['nurture_active'],
  'unsubscribe': [],  // Terminal (+ mark suppressed)
  'wrong_contact': [],  // Terminal
  'ooo': ['sending_active'],  // Re-enter active after pause window
  
  // Draft & Send
  'ai_draft_pending': ['reply_sent', 'ai_draft_pending'],  // Can edit drafts
  'reply_sent': ['conversation_active', 'awaiting_booking', 'conversation_active'],
  'conversation_active': ['reply_received', 'awaiting_booking'],  // Loop back for more replies
  
  // Booking
  'awaiting_booking': ['meeting_booked', 'nurture_active'],
  'meeting_booked': ['qualified_opportunity'],
  'qualified_opportunity': ['closed_positive'],
  
  // Nurture
  'nurture_active': ['sending_active'],  // Reactivate after delay
  
  // Finals
  'closed_positive': [],
  'closed_negative': []
};

export function isValidTransition(fromState: string, toState: string): boolean {
  const validNextStates = STATE_TRANSITIONS[fromState];
  if (!validNextStates) {
    throw new Error(`Unknown state: ${fromState}`);
  }
  return validNextStates.includes(toState);
}

export function validateAndTransition(
  fromState: string,
  toState: string
): void {
  if (!isValidTransition(fromState, toState)) {
    throw new Error(
      `Invalid transition: ${fromState} → ${toState}`
    );
  }
}
```

---

## Phase 4: Reply Classification (Claude)

### 4.1 BullMQ Worker: Reply Classification

**File:** `apps/dashboard/lib/queues/reply-classification.worker.ts`

**Purpose:** Process replies through Claude classification, emit `reply_classified` event

**Implementation:**

```typescript
import { Worker, Queue } from "bullmq";
import { Anthropic } from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";

const client = new Anthropic();
const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379")
};

export const replyClassificationQueue = new Queue(
  "reply-classification",
  { connection: redisConnection }
);

const replyClassificationWorker = new Worker(
  "reply-classification",
  async (job) => {
    const { reply_id, lead_id, client_id, trace_id } = job.data;

    try {
      // Step 1: Fetch reply and client context
      const [reply] = await sql`
        SELECT 
          r.reply_id, r.reply_body, r.reply_subject, 
          r.email_sequence_number, r.last_sent_subject,
          l.first_name, l.last_name, l.company_name, l.title
        FROM replies r
        JOIN leads l ON r.lead_id = l.lead_id
        WHERE r.reply_id = ${reply_id}
      `;

      const [clientConfig] = await sql`
        SELECT automation_level
        FROM clients
        WHERE client_id = ${client_id}
      `;

      // Step 2: Get thread history
      const threadHistory = await sql`
        SELECT reply_body FROM replies
        WHERE lead_id = ${lead_id}
        ORDER BY received_at ASC
        LIMIT 5
      `;

      // Step 3: Build classification prompt (Composable Layer 1-6)
      const systemPrompt = `You are an AI assistant for a B2B outbound sales operation. Your task is to classify incoming prospect replies into intent categories.

Return ONLY valid JSON matching this schema:
{
  "intent": "positive|faq|objection|nurture|unsubscribe|wrong_contact|ooo",
  "confidence": 0.0-1.0,
  "sentiment": "interested|curious|skeptical|negative|neutral",
  "requires_human": boolean,
  "suggested_action": "auto_send|draft_only|escalate|suppress|pause",
  "objection_type": "pricing|timing|trust|competitor|not_relevant|scope|null",
  "objection_reasoning": "string or null",
  "nurture_timing_hint": "Q4|next_month|6_months|immediate|null"
}`;

      const classificationPrompt = `
Classify this prospect reply:

Prospect: ${reply.first_name} ${reply.last_name} at ${reply.company_name} (${reply.title})

Latest Reply:
Subject: ${reply.reply_subject}
Body: ${reply.reply_body}

Thread Context (prior emails in sequence):
${threadHistory.map((r: any) => `- ${r.reply_body.substring(0, 100)}...`).join("\n")}

Classification Rules:
- "positive" = genuine interest, wants to proceed
- "faq" = asking a factual question about your product/process
- "objection" = concern, hesitation, or pushback
- "nurture" = interested but wrong timing (e.g., "reach back in Q4")
- "unsubscribe" = opted out explicitly
- "wrong_contact" = "I'm not the right person"
- "ooo" = out-of-office auto-response

Classify this reply.`;

      // Step 4: Call Claude
      const startTime = Date.now();
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: classificationPrompt
          }
        ]
      });

      const latencyMs = Date.now() - startTime;
      const classificationOutput = JSON.parse(
        response.content[0].type === "text" ? response.content[0].text : "{}"
      );

      // Step 5: Store classification
      const [classification] = await sql`
        INSERT INTO reply_classifications (
          reply_id,
          lead_id,
          client_id,
          intent,
          confidence,
          sentiment,
          requires_human,
          suggested_action,
          objection_type,
          objection_reasoning,
          nurture_timing_hint,
          model_used,
          input_tokens,
          output_tokens,
          processing_latency_ms,
          automation_level_applied
        ) VALUES (
          ${reply_id},
          ${lead_id},
          ${client_id},
          ${classificationOutput.intent},
          ${classificationOutput.confidence},
          ${classificationOutput.sentiment},
          ${classificationOutput.requires_human},
          ${classificationOutput.suggested_action},
          ${classificationOutput.objection_type},
          ${classificationOutput.objection_reasoning},
          ${classificationOutput.nurture_timing_hint},
          'claude-sonnet-4-6',
          ${response.usage.input_tokens},
          ${response.usage.output_tokens},
          ${latencyMs},
          ${clientConfig.automation_level}
        )
        RETURNING classification_id
      `;

      // Step 6: Emit reply_classified event
      await sql`
        INSERT INTO events (
          client_id,
          lead_id,
          event_type,
          created_by,
          metadata,
          trace_id
        ) VALUES (
          ${client_id},
          ${lead_id},
          'reply_classified',
          'ai',
          ${JSON.stringify({
            reply_id,
            intent: classificationOutput.intent,
            confidence: classificationOutput.confidence,
            suggested_action: classificationOutput.suggested_action
          })}::jsonb,
          ${trace_id}
        )
      `;

      // Step 7: Update reply classification status
      await sql`
        UPDATE replies
        SET classification_status = 'classified', processed_at = NOW()
        WHERE reply_id = ${reply_id}
      `;

      // Step 8: Transition lead state based on intent
      await transitionLeadState(
        lead_id,
        "reply_received",
        classificationOutput.intent,
        `Classified as ${classificationOutput.intent}`,
        classification.classification_id,
        "ai"
      );

      // Step 9: Enqueue draft generation if response needed
      if (['faq_reply', 'objection_reply', 'positive_reply'].includes(classificationOutput.intent)) {
        await draftGenerationQueue.add(
          "generate-draft",
          {
            reply_id,
            lead_id,
            client_id,
            intent: classificationOutput.intent,
            trace_id
          },
          {
            priority: classificationOutput.intent === 'positive_reply' ? 20 : 10,
            delay: 100  // Small delay to let state transition settle
          }
        );
      }

      return { success: true, intent: classificationOutput.intent };

    } catch (err) {
      console.error(`Classification failed for reply ${reply_id}:`, err);
      
      // Mark reply as failed
      await sql`
        UPDATE replies
        SET classification_status = 'failed', classification_error = ${(err as Error).message}
        WHERE reply_id = ${reply_id}
      `;

      throw err;
    }
  },
  { connection: redisConnection }
);

replyClassificationWorker.on("failed", async (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
  // Send to Slack alert
});
```

---

## Phase 5: AI Draft Generation (Claude)

### 5.1 BullMQ Worker: Draft Generation

**File:** `apps/dashboard/lib/queues/draft-generation.worker.ts`

**Implementation:**

```typescript
import { Worker, Queue } from "bullmq";
import { Anthropic } from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";

const client = new Anthropic();
const redisConnection = { /* ... */ };

export const draftGenerationQueue = new Queue("draft-generation", { connection: redisConnection });

const draftGenerationWorker = new Worker(
  "draft-generation",
  async (job) => {
    const { reply_id, lead_id, client_id, intent, trace_id } = job.data;

    try {
      // Step 1: Fetch reply and lead context
      const [reply] = await sql`
        SELECT r.reply_body, r.thread_id, l.first_name, l.company_name, l.title
        FROM replies r
        JOIN leads l ON r.lead_id = l.lead_id
        WHERE r.reply_id = ${reply_id}
      `;

      // Step 2: Fetch client knowledge assets
      const [clientKnowledge] = await sql`
        SELECT 
          company_summary, tone, positioning_statement,
          faq_responses, objection_library, forbidden_claims
        FROM client_knowledge
        WHERE client_id = ${client_id}
      `;

      // Step 3: Fetch thread history
      const threadHistory = await sql`
        SELECT draft_body FROM ai_drafts
        WHERE lead_id = ${lead_id}
        ORDER BY generated_at DESC
        LIMIT 3
      `;

      // Step 4: Build response generation prompt (Composable)
      const systemPrompt = `You are an AI assistant generating professional B2B sales replies.
Return ONLY valid JSON:
{
  "reply_body": "string (max 120 words)",
  "includes_booking_link": boolean,
  "word_count": integer,
  "tone_assessment": "string",
  "confidence": 0.0-1.0
}`;

      const generationPrompt = `Generate a professional reply to this prospect:

Prospect: ${reply.first_name} at ${reply.company_name}
Latest Message: ${reply.reply_body.substring(0, 300)}...

Intent: ${intent}

Our Company: ${clientKnowledge.positioning_statement}
Tone: ${clientKnowledge.tone}

Relevant Knowledge:
${intent === 'faq' ? `FAQs: ${clientKnowledge.faq_responses.join('; ')}` : ''}
${intent === 'objection_reply' ? `Objection handling: ${clientKnowledge.objection_library.join('; ')}` : ''}

Rules:
- Maximum 120 words
- Professional, human tone
- No forbidden claims: ${clientKnowledge.forbidden_claims.join(', ')}
- No em-dashes, no AI phrases like "certainly" or "happy to"
${intent === 'positive_reply' ? '- Include a calendar link placeholder [BOOKING_LINK]' : ''}

Generate the reply.`;

      // Step 5: Call Claude
      const startTime = Date.now();
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: generationPrompt }]
      });

      const latencyMs = Date.now() - startTime;
      const draftOutput = JSON.parse(
        response.content[0].type === "text" ? response.content[0].text : "{}"
      );

      // Step 6: Validate draft quality
      const qualityFlags: string[] = [];
      if (draftOutput.word_count > 120) qualityFlags.push("exceeds_word_count");
      if (draftOutput.reply_body.includes("certainly")) qualityFlags.push("forbidden_phrase");
      if (draftOutput.confidence < 0.75) qualityFlags.push("low_confidence");

      // Step 7: Store draft
      const [draft] = await sql`
        INSERT INTO ai_drafts (
          reply_id,
          lead_id,
          client_id,
          draft_subject,
          draft_body,
          intent_classified_as,
          includes_booking_link,
          word_count,
          tone_assessment,
          quality_flags,
          confidence,
          model_used,
          input_tokens,
          output_tokens,
          generation_latency_ms,
          approval_status
        ) VALUES (
          ${reply_id},
          ${lead_id},
          ${client_id},
          'Re: ' + ${reply.subject || '(no subject)'},
          ${draftOutput.reply_body},
          ${intent},
          ${draftOutput.includes_booking_link},
          ${draftOutput.word_count},
          ${draftOutput.tone_assessment},
          ${JSON.stringify(qualityFlags)}::text[],
          ${draftOutput.confidence},
          'claude-sonnet-4-6',
          ${response.usage.input_tokens},
          ${response.usage.output_tokens},
          ${latencyMs},
          ${qualityFlags.length > 0 ? 'pending_review' : 'pending_review'}
        )
        RETURNING draft_id
      `;

      // Step 8: Emit draft_generated event
      await sql`
        INSERT INTO events (
          client_id,
          lead_id,
          event_type,
          created_by,
          metadata,
          trace_id
        ) VALUES (
          ${client_id},
          ${lead_id},
          'draft_generated',
          'ai',
          ${JSON.stringify({
            draft_id: draft.draft_id,
            word_count: draftOutput.word_count,
            confidence: draftOutput.confidence,
            quality_flags: qualityFlags
          })}::jsonb,
          ${trace_id}
        )
      `;

      // Step 9: Route to approval or auto-send queue
      const [replyPolicy] = await sql`
        SELECT action_level_1, action_level_2, action_level_3
        FROM reply_policies
        WHERE client_id = ${client_id} AND intent = ${intent}
      `;

      const [clientConfig] = await sql`
        SELECT automation_level FROM clients WHERE client_id = ${client_id}
      `;

      const automationAction = {
        1: replyPolicy.action_level_1,
        2: replyPolicy.action_level_2,
        3: replyPolicy.action_level_3
      }[clientConfig.automation_level] || 'draft_only';

      if (automationAction === 'auto_send' && qualityFlags.length === 0) {
        // Enqueue for scheduling
        await responseSchedulingQueue.add("schedule-response", {
          draft_id: draft.draft_id,
          lead_id,
          client_id,
          intent,
          trace_id
        });
      } else {
        // Queue for human review
        await sql`
          UPDATE ai_drafts
          SET approval_status = 'pending_review'
          WHERE draft_id = ${draft.draft_id}
        `;
        // Notify operator via Slack
      }

      return { success: true, draft_id: draft.draft_id };

    } catch (err) {
      console.error(`Draft generation failed for reply ${reply_id}:`, err);
      throw err;
    }
  },
  { connection: redisConnection }
);
```

---

## Phase 6: Response Scheduling & Sending

### 6.1 BullMQ Worker: Response Scheduling

**File:** `apps/dashboard/lib/queues/response-scheduling.worker.ts`

**Purpose:** Apply delay windows, business hours, calculate send time

```typescript
// Calculate scheduled send time based on intent and client config
async function calculateScheduledSendTime(
  leadId: string,
  clientId: string,
  intent: string
): Promise<Date> {
  // Fetch timing rules
  const [timingRule] = await sql`
    SELECT delay_min_minutes, delay_max_minutes, enforce_business_hours, timezone
    FROM timing_rules
    WHERE client_id = ${clientId} AND intent = ${intent}
  `;

  // Randomize within window
  const delayMs = getRandomDelay(
    timingRule.delay_min_minutes * 60 * 1000,
    timingRule.delay_max_minutes * 60 * 1000
  );

  let scheduledTime = new Date(Date.now() + delayMs);

  // Enforce business hours
  if (timingRule.enforce_business_hours) {
    scheduledTime = moveToBusinessHours(scheduledTime, timingRule.timezone);
  }

  return scheduledTime;
}

// Move datetime to business hours window
function moveToBusinessHours(dt: Date, timezone: string): Date {
  // If already in business hours, return as-is
  // Otherwise move to next business hours start
  // Implementation uses timezone conversion library
  // Returns datetime in prospect's timezone
}

const responseSchedulingWorker = new Worker(
  "response-scheduling",
  async (job) => {
    const { draft_id, lead_id, client_id, intent, trace_id } = job.data;

    try {
      // Calculate scheduled send time
      const scheduledSendAt = await calculateScheduledSendTime(
        lead_id,
        client_id,
        intent
      );

      // Insert into response_queue with scheduling
      await sql`
        INSERT INTO response_queue (
          draft_id,
          lead_id,
          client_id,
          scheduled_send_at,
          queue_type
        ) VALUES (
          ${draft_id},
          ${lead_id},
          ${client_id},
          ${scheduledSendAt},
          ${determineQueueType(intent)}
        )
      `;

      // Re-enqueue this job to fire at scheduled time
      await replySendQueue.add(
        "send-reply",
        { draft_id, lead_id, client_id, trace_id },
        { delay: scheduledSendAt.getTime() - Date.now() }
      );

      return { scheduled_at: scheduledSendAt };

    } catch (err) {
      console.error(`Response scheduling failed:`, err);
      throw err;
    }
  },
  { connection: redisConnection }
);
```

### 6.2 BullMQ Worker: Reply Sender

**File:** `apps/dashboard/lib/queues/reply-sender.worker.ts`

**Purpose:** Send reply via Instantly thread API

```typescript
const replySendWorker = new Worker(
  "reply-send",
  async (job) => {
    const { draft_id, lead_id, client_id, trace_id } = job.data;

    try {
      // Fetch draft and thread info
      const [draft] = await sql`
        SELECT d.draft_body, d.draft_subject, r.thread_id
        FROM ai_drafts d
        JOIN replies r ON d.reply_id = r.reply_id
        WHERE d.draft_id = ${draft_id}
      `;

      // Call Instantly API to send thread reply
      const instantlyResponse = await fetch(
        'https://api.instantly.ai/api/v1/campaign/thread/reply',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.INSTANTLY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            thread_id: draft.thread_id,
            body: draft.draft_body,
            subject: draft.draft_subject
          })
        }
      );

      if (!instantlyResponse.ok) {
        throw new Error(`Instantly API error: ${instantlyResponse.statusText}`);
      }

      // Mark draft as sent
      await sql`
        UPDATE ai_drafts
        SET approval_status = 'auto_sent', sent_at = NOW()
        WHERE draft_id = ${draft_id}
      `;

      // Emit auto_reply_sent event
      await sql`
        INSERT INTO events (
          client_id,
          lead_id,
          event_type,
          created_by,
          metadata,
          trace_id
        ) VALUES (
          ${client_id},
          ${lead_id},
          'auto_reply_sent',
          'ai',
          ${JSON.stringify({ draft_id })}::jsonb,
          ${trace_id}
        )
      `;

      // Transition lead to reply_sent
      await transitionLeadState(
        lead_id,
        'ai_draft_pending',
        'reply_sent',
        'AI reply sent automatically'
      );

      return { sent: true };

    } catch (err) {
      console.error(`Reply send failed:`, err);
      throw err;
    }
  },
  { connection: redisConnection }
);
```

---

## Phase 7: Integration with Dashboard

### 7.1 Modify Review Queue to Use New Schema

**File:** `apps/dashboard/app/dashboard/review/page.tsx`

**Changes:**
- Read from `replies` + `reply_classifications` + `ai_drafts` tables
- Show classification intent and confidence
- Display auto-generated draft with approval/rejection interface
- Track approval status transitions

### 7.2 Modify Approve/Reject Routes

**File:** `apps/dashboard/app/api/dashboard/review/[id]/approve/route.ts`

**Changes:**
```typescript
// Now uses ai_drafts instead of inline draft generation
const [draft] = await sql`
  SELECT draft_id, draft_body FROM ai_drafts
  WHERE lead_id = ${id}
  ORDER BY generated_at DESC
  LIMIT 1
`;

// If operator edited, save edits
if (subject || body_text) {
  await sql`
    UPDATE ai_drafts
    SET draft_body = ${body_text || draft.draft_body},
        human_edits = ${JSON.stringify({ edited_by: operator.sub, original: draft.draft_body })}::jsonb,
        edited_by = ${operator.sub},
        edited_at = NOW()
    WHERE draft_id = ${draft.draft_id}
  `;
}

// Approve draft
await sql`
  UPDATE ai_drafts
  SET approval_status = 'approved',
      approved_by = ${operator.sub},
      approved_at = NOW()
  WHERE draft_id = ${draft.draft_id}
`;

// Enqueue for response scheduling
await responseSchedulingQueue.add("schedule-response", {
  draft_id: draft.draft_id,
  lead_id: id,
  intent: classification.intent
});
```

---

## Phase 8: Event Logging & Observability

### 8.1 Implement Event Aggregation

**File:** `apps/dashboard/lib/queues/event-aggregation.worker.ts`

**Purpose:** Run every 15 minutes to pre-aggregate metrics for dashboard

```typescript
const eventAggregationWorker = new Worker(
  "event-aggregation",
  async (job) => {
    // Aggregate events into analytics_snapshots
    // Compute derived metrics:
    // - replies_received
    // - positive_replies_count
    // - positive_reply_rate
    // - meetings_booked
    // - booking_rate
    // etc.
  },
  { connection: redisConnection }
);

// Schedule to run every 15 minutes
cron.schedule("*/15 * * * *", () => {
  eventAggregationQueue.add("aggregate", {}, { repeat: { every: 900000 } });
});
```

---

## Phase 9: Testing & Validation

### 9.1 Unit Tests

- State machine transitions (all valid/invalid paths)
- Webhook signature verification
- Claude prompt output parsing
- Time calculation (delay windows, business hours, timezones)
- Draft quality validation

### 9.2 Integration Tests

- Full reply flow from webhook → classified → drafted → scheduled → sent
- Human approval flow
- Lead state transitions
- Event emission and tracing
- Error handling and retry logic

### 9.3 E2E Tests

- Simulate Instantly webhook delivery
- Verify end-to-end trace
- Check database state at each step
- Verify UI updates in dashboard

---

## Deployment Strategy

### Step 1: Database Preparation (Zero Downtime)
```
1. Deploy migrations in order (Phase 1.3)
2. Add new columns to reply_items and clients tables
3. NO data migration yet — just schema
4. Deploy new API handlers (webhook handler)
```

### Step 2: Queue Workers (Async)
```
1. Deploy BullMQ workers (Phases 4-6)
2. Workers start but don't process anything yet
3. Webhook handler active but receives no traffic
```

### Step 3: Enable on Test Client
```
1. Set one test client: automation_level = 1 (human review only)
2. Redirect test webhooks to new endpoint
3. Monitor queue depth and error rates
4. Verify dashboard shows replies correctly
```

### Step 4: Enable on Early Clients
```
1. Gradually roll out to 5-10 clients
2. Gradual rollback if issues appear
3. Monitor Slack alerts, queue health
```

### Step 5: Full Production Rollout
```
1. Enable for all clients
2. Monitor 24/7 for first week
```

---

## Success Criteria

✅ Reply webhook received and stored within 200ms  
✅ Reply classified by Claude (intent + confidence)  
✅ AI draft generated and placed in approval queue  
✅ Human can approve/reject/edit in dashboard  
✅ Approved draft scheduled with randomized delay  
✅ Draft sent via Instantly at scheduled time  
✅ Full event trace from webhook → sent  
✅ Lead state machine reflects accurate status  
✅ Dashboard shows accurate metrics  
✅ Zero data loss on failures (all operations idempotent)  
✅ Sub-200ms webhook acknowledgment  
✅ Queue depth monitoring + Slack alerts  

---

**Next Step:** Begin Phase 1 (Database Migrations)

