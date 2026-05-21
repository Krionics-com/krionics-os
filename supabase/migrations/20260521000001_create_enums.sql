-- ============================================================
-- 000001: All enum type definitions
-- ============================================================

-- Client lifecycle
DO $$ BEGIN
  CREATE TYPE client_status AS ENUM (
    'onboarding', 'active', 'paused', 'churned', 'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Campaign state machine
DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM (
    'draft', 'warming', 'active', 'paused', 'completed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Lead interaction states
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM (
    'raw_imported', 'deduplicated', 'enrichment_pending', 'enriched',
    'personalized', 'campaign_ready', 'queued_for_sending', 'sending_active',
    'email_bounced', 'no_response', 'reply_received',
    'positive_reply', 'faq_reply', 'objection_reply', 'nurture_reply',
    'unsubscribe', 'wrong_contact', 'ooo',
    'ai_draft_pending', 'reply_sent', 'conversation_active',
    'awaiting_booking', 'nurture_active',
    'meeting_booked', 'qualified_opportunity', 'closed_positive', 'closed_negative',
    -- legacy / dashboard convenience
    'prospecting', 'contacted', 'replied', 'positive',
    'negative', 'disqualified', 'unsubscribed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reply intent (RICR classifier output)
DO $$ BEGIN
  CREATE TYPE reply_intent AS ENUM (
    'POSITIVE', 'OBJECTION', 'FAQ', 'BOOKING_INTENT',
    'NURTURE', 'UNSUBSCRIBE', 'NOT_RELEVANT',
    'BOUNCE_OOO', 'HOSTILE', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reply item lifecycle (RICR state machine)
DO $$ BEGIN
  CREATE TYPE reply_status AS ENUM (
    'RECEIVED',
    'CLASSIFYING',
    'CLASSIFIED',
    'CLASSIFICATION_FAILED',
    'DRAFT_GENERATING',
    'DRAFT_FAILED',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'ESCALATED',
    'SCHEDULED',
    'SENT',
    'SEND_FAILED',
    'SUPPRESSED',
    'DISMISSED',
    'NURTURE_ENROLLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Review queue action
DO $$ BEGIN
  CREATE TYPE review_action AS ENUM (
    'APPROVE', 'REJECT', 'EDIT_AND_APPROVE', 'ESCALATE', 'RECLASSIFY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Scheduled send state
DO $$ BEGIN
  CREATE TYPE send_status AS ENUM (
    'PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Draft review states
DO $$ BEGIN
  CREATE TYPE draft_status AS ENUM (
    'pending_review', 'approved', 'rejected', 'edited_approved', 'sent', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Workflow execution states
DO $$ BEGIN
  CREATE TYPE execution_status AS ENUM (
    'queued', 'running', 'completed', 'failed', 'retrying', 'dead_lettered'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Meeting states
DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM (
    'scheduled', 'confirmed', 'cancelled', 'no_show', 'completed', 'rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service type
DO $$ BEGIN
  CREATE TYPE service_type AS ENUM ('cold_outbound', 'voice_agent', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI invocation type
DO $$ BEGIN
  CREATE TYPE ai_invocation_type AS ENUM (
    'reply_classification', 'draft_generation', 'personalization',
    'signal_extraction', 'lead_scoring', 'analytics_intelligence',
    'sentiment_analysis', 'escalation_detection'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Voice call outcome
DO $$ BEGIN
  CREATE TYPE call_outcome AS ENUM (
    'meeting_booked', 'callback_requested', 'not_interested',
    'wrong_number', 'escalated', 'voicemail', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reply sentiment (blueprint / high-level)
DO $$ BEGIN
  CREATE TYPE reply_sentiment AS ENUM (
    'positive', 'negative', 'neutral', 'out_of_office', 'unsubscribe', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
