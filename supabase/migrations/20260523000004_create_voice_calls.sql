-- ============================================================
-- 20260523000004: voice_calls table recreation and seeding
-- ============================================================

-- Drop legacy table constraints and tables safely
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS voice_calls CASCADE;

CREATE TABLE voice_calls (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID         REFERENCES leads(id),
  client_id       UUID         REFERENCES clients(id),
  reply_item_id   UUID         REFERENCES reply_items(id),
  duration_seconds INTEGER,
  status          TEXT         NOT NULL DEFAULT 'completed' CHECK (status IN ('in-progress', 'completed', 'escalated', 'failed')),
  sentiment       TEXT         CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  meeting_booked  BOOLEAN      NOT NULL DEFAULT FALSE,
  escalation_note TEXT,
  summary         TEXT,
  transcript      JSONB,
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_client   ON voice_calls(client_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status   ON voice_calls(status);
CREATE INDEX IF NOT EXISTS idx_voice_calls_started  ON voice_calls(started_at DESC);

-- Recreate meetings table referencing the new voice_calls table
CREATE TABLE meetings (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID            NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id             UUID            REFERENCES leads(id),
  campaign_id         UUID            REFERENCES campaigns(id),
  voice_call_id       UUID            REFERENCES voice_calls(id),
  calendly_event_id   TEXT,
  cal_booking_id      TEXT,
  status              TEXT            NOT NULL DEFAULT 'scheduled',
  scheduled_at        TIMESTAMPTZ     NOT NULL,
  duration_minutes    INTEGER         NOT NULL DEFAULT 30,
  attendee_email      TEXT            NOT NULL,
  attendee_name       TEXT,
  attendee_company    TEXT,
  meeting_type        TEXT            CHECK (meeting_type IN ('discovery', 'demo', 'qualification', 'follow_up')),
  source              TEXT            NOT NULL CHECK (source IN ('cold_email', 'voice_agent', 'inbound')),
  crm_deal_id         TEXT,
  crm_synced          BOOLEAN         NOT NULL DEFAULT FALSE,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_at        TIMESTAMPTZ,
  notes               TEXT,
  metadata            JSONB           NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_client   ON meetings(client_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_lead     ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_campaign ON meetings(campaign_id);

-- Seed mock voice calls
DO $$
DECLARE
  v_lead_id UUID;
  v_client_id UUID;
  v_reply_id UUID;
BEGIN
  SELECT id INTO v_lead_id FROM leads LIMIT 1;
  SELECT id INTO v_client_id FROM clients LIMIT 1;
  SELECT id INTO v_reply_id FROM reply_items LIMIT 1;

  INSERT INTO voice_calls (lead_id, client_id, reply_item_id, duration_seconds, status, sentiment, meeting_booked, escalation_note, summary, transcript, started_at, ended_at) VALUES
    -- Call 1: Completed, Positive, Meeting Booked
    (v_lead_id, v_client_id, v_reply_id, 142, 'completed', 'positive', TRUE, NULL, 'Lead expressed high interest in integration capability. Voice agent successfully scheduled a demo for Thursday morning.', 
     '[
       {"timestamp": "00:02", "speaker": "Agent", "text": "Hello, is this Sarah Chen?"},
       {"timestamp": "00:05", "speaker": "Lead", "text": "Yes, this is Sarah. Who is calling?"},
       {"timestamp": "00:09", "speaker": "Agent", "text": "Hi Sarah, I am calling from Krionics. I noticed you replied to our outreach email about scaling your cold outbound delivery. Do you have two minutes to discuss?"},
       {"timestamp": "00:18", "speaker": "Lead", "text": "Actually, yes. Your email mentioned that you automate draft review queues. How does that sync with HubSpot?"},
       {"timestamp": "00:26", "speaker": "Agent", "text": "Great question! We support native two-way HubSpot API synchronizations so operators can assign drafts directly inside our unified dashboards without changing tabs."},
       {"timestamp": "00:38", "speaker": "Lead", "text": "That is exactly what we have been trying to solve. Our team spends hours copy-pasting outbound sequences. Can we see a demo?"},
       {"timestamp": "00:46", "speaker": "Agent", "text": "Absolutely! I can book a 15-minute quick walkthrough with our lead sales lead for this Thursday. How does 10:00 AM Eastern look?"},
       {"timestamp": "00:54", "speaker": "Lead", "text": "10:00 AM on Thursday works perfectly for me. Send over the invite to my email."},
       {"timestamp": "01:01", "speaker": "Agent", "text": "Will do, Sarah. I have got that demo booked. Have a fantastic day!"}
     ]'::jsonb, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '12 minutes'),

    -- Call 2: Escalated to Operator
    (v_lead_id, v_client_id, v_reply_id, 94, 'escalated', 'neutral', FALSE, 'Lead requested technical clarification regarding enterprise SPF/DKIM warmup volumes.', 'Voice call escalated. Lead asked complex technical questions regarding SMTP warmup sequences that exceeded default voice handler boundaries.', 
     '[
       {"timestamp": "00:03", "speaker": "Agent", "text": "Hello, is this Sarah?"},
       {"timestamp": "00:06", "speaker": "Lead", "text": "Yes, hello. I am following up on the email you sent about SPF delivery."},
       {"timestamp": "00:11", "speaker": "Agent", "text": "Hi Sarah. Yes! We monitor warmup configurations dynamically to prevent domain reputation drop-offs. Would you like me to book a demo?"},
       {"timestamp": "00:22", "speaker": "Lead", "text": "Before booking, can you tell me exactly how many warmup emails are sent from custom subdomains on day one?"},
       {"timestamp": "00:31", "speaker": "Agent", "text": "Our warmup system automatically ramps from 5 emails per day up to 50, aligning with SPF records thresholds."},
       {"timestamp": "00:41", "speaker": "Lead", "text": "Wait, but if I have multiple secondary domains under a shared IP pool, how does the DMARC alignment handle SPF soft-fails?"},
       {"timestamp": "00:51", "speaker": "Agent", "text": "I want to make sure we give you the exact technical answer for shared IP subnets. Let me connect you directly to our lead platform engineer right now."},
       {"timestamp": "01:02", "speaker": "Lead", "text": "Okay, please do. I want to clear this up before we configure any domains."}
     ]'::jsonb, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '58 minutes'),

    -- Call 3: In-Progress
    (v_lead_id, v_client_id, v_reply_id, 45, 'in-progress', 'neutral', FALSE, NULL, 'Call currently active. Agent introducing Krionics value proposition to the prospect.', 
     '[
       {"timestamp": "00:02", "speaker": "Agent", "text": "Hello, is this Sarah?"},
       {"timestamp": "00:05", "speaker": "Lead", "text": "Speaking. Who is this?"},
       {"timestamp": "00:08", "speaker": "Agent", "text": "Hi Sarah, I am calling from the outreach operations team. We received your positive reply regarding campaign personalization templates. Have you got a moment?"},
       {"timestamp": "00:19", "speaker": "Lead", "text": "Sure, tell me a bit more. What kind of personalization prompts do you support?"}
     ]'::jsonb, NOW() - INTERVAL '45 seconds', NULL),

    -- Call 4: Completed, Negative
    (v_lead_id, v_client_id, NULL, 62, 'completed', 'negative', FALSE, NULL, 'Lead expressed frustration with previous cold calls. Expressed no interest in outbound solutions.', 
     '[
       {"timestamp": "00:02", "speaker": "Agent", "text": "Hello, is this Sarah Chen?"},
       {"timestamp": "00:05", "speaker": "Lead", "text": "Yes, but I am in a meeting. What is this about?"},
       {"timestamp": "00:09", "speaker": "Agent", "text": "Hi Sarah, I was following up on our cold email sequence regarding automation levels."},
       {"timestamp": "00:15", "speaker": "Lead", "text": "Please remove me from your list. I get five of these calls every day and we are not looking for outreach software. Do not call me again."},
       {"timestamp": "00:23", "speaker": "Agent", "text": "I completely understand, Sarah. I will update your opt-out settings immediately. Apologies for the disturbance."},
       {"timestamp": "00:29", "speaker": "Lead", "text": "Thank you."}
     ]'::jsonb, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),

    -- Call 5: Failed Call
    (v_lead_id, v_client_id, NULL, 12, 'failed', NULL, FALSE, 'SIP Connection timed out or voicemail detected.', 'Call connection failed. Voicemail detected. SIP system terminated call automatically.', 
     '[
       {"timestamp": "00:01", "speaker": "Agent", "text": "[Ringing tone]"},
       {"timestamp": "00:08", "speaker": "Lead", "text": "Your call has been forwarded to an automatic voicemail box. At the tone, please..."}
     ]'::jsonb, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),

    -- Call 6: Completed, Neutral
    (v_lead_id, v_client_id, v_reply_id, 110, 'completed', 'neutral', FALSE, NULL, 'Lead was polite but busy. Requested an email with a pricing sheet before committing to any demo.', 
     '[
       {"timestamp": "00:02", "speaker": "Agent", "text": "Hello, is this Sarah Chen?"},
       {"timestamp": "00:06", "speaker": "Lead", "text": "Yes, speaking. How can I help you?"},
       {"timestamp": "00:10", "speaker": "Agent", "text": "Hi Sarah. I noticed your interest in the campaigns performance sequence. I was hoping to schedule a demo walkthrough of our analytics module."},
       {"timestamp": "00:21", "speaker": "Lead", "text": "I am actually heads down on a launch today. Could you send over a pricing brochure first?"},
       {"timestamp": "00:30", "speaker": "Agent", "text": "Of course! I will send over our standard tier packages sheet to sarah@acme.com right now."},
       {"timestamp": "00:39", "speaker": "Lead", "text": "Perfect, send that over and I will review it early next week. Thanks."},
       {"timestamp": "00:44", "speaker": "Agent", "text": "Thank you Sarah, speak soon."}
     ]'::jsonb, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),

    -- Call 7: Completed, Positive, Meeting Booked
    (v_lead_id, v_client_id, v_reply_id, 185, 'completed', 'positive', TRUE, NULL, 'Highly productive call. Lead had specific questions about Claude LLM token consumption pricing that were answered, and scheduled demo.', 
     '[
       {"timestamp": "00:02", "speaker": "Agent", "text": "Hello, is this Sarah Chen?"},
       {"timestamp": "00:05", "speaker": "Lead", "text": "Yes, hello."}
     ]'::jsonb, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),

    -- Call 8: Completed, Neutral
    (v_lead_id, v_client_id, v_reply_id, 80, 'completed', 'neutral', FALSE, NULL, 'Call completed. Lead was informative about their ICP requirements but asked to follow up next month.', 
     '[
       {"timestamp": "00:02", "speaker": "Agent", "text": "Hello, is this Sarah?"},
       {"timestamp": "00:05", "speaker": "Lead", "text": "Yes. Who is calling?"}
     ]'::jsonb, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours');
END $$;
