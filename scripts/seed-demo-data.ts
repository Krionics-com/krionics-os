/**
 * Demo data seed script.
 * Inserts 6 realistic reply scenarios into the database so you can interact
 * with the dashboard without needing live Instantly credentials.
 *
 * Run: npx tsx scripts/seed-demo-data.ts
 *
 * Scenarios seeded:
 *  1. POSITIVE      — Sarah Chen         (2h ago, SLA OK, GREEN)
 *  2. BOOKING_INTENT — James Wilson       (30min ago, SLA OK, GREEN)
 *  3. OBJECTION     — Michael Torres     (5h ago, SLA OVERDUE, RED)
 *  4. FAQ           — Lisa Park          (3h40m ago, SLA WARNING, YELLOW)
 *  5. BOUNCE_OOO    — David Kim          (DISMISSED — auto-resolved, no draft)
 *  6. UNSUBSCRIBE   — Emma Johnson       (SUPPRESSED — auto-resolved, no draft)
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not set in .env");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1 });

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────
// Demo data definitions
// ─────────────────────────────────────────────────────────────

const ORIGINAL_EMAIL = `Hi {{first_name}},

I noticed {{company}} has been scaling its sales team recently.
At TechFlow Solutions, we help B2B teams like yours automate lead qualification
and personalised outreach using AI — cutting SDR prospecting time by 60%.

Would a 20-minute call make sense to explore if there's a fit?

Best,
Alex Rivera
TechFlow Solutions`;

const scenarios = [
  {
    // 1. POSITIVE — interested lead
    idempotencyKey: "demo-seed-001",
    instantlyReplyId: "instantly-demo-001",
    lead: {
      email: "sarah.chen@acmecorp.com",
      firstName: "Sarah",
      lastName: "Chen",
      company: "Acme Corp",
      title: "VP Marketing",
      status: "positive_reply" as const,
    },
    reply: {
      fromName: "Sarah Chen",
      subject: "Re: Quick question about Acme Corp's lead gen",
      bodyText:
        "Hey Alex, thanks for reaching out — this actually looks really interesting. We've been struggling with lead gen for the past few quarters. Can you tell me more about pricing and what the typical implementation timeline looks like?",
      toEmail: "alex@techflow.io",
    },
    classification: {
      intent: "POSITIVE" as const,
      confidence: 0.92,
      sentiment: "POSITIVE" as const,
      urgency: "MEDIUM" as const,
      keySignals: ["struggling with lead gen", "tell me more", "pricing", "implementation timeline"],
      reasoning: "Lead explicitly expresses interest and asks commercial questions about pricing.",
      requiresDraft: true,
      requiresHuman: true,
      routingDecision: "SEND_TO_REVIEW",
    },
    draft: {
      subject: "Re: Quick question about Acme Corp's lead gen",
      bodyText: `Hi Sarah,

Great to hear from you — glad the timing works!

Here's a quick overview:

**Pricing** — We work on a monthly retainer starting at $2,500/month depending on the number of active campaigns and volume. Most clients see positive ROI within 60 days.

**Implementation** — Typically 1–2 weeks to get your first campaign live. We handle setup, ICP calibration, and sequence copy with you.

I'd love to walk you through a live demo and show you exactly how it works for a company like Acme Corp.

Here's a link to grab 20 minutes: https://cal.com/alex-techflow/discovery

Looking forward to it,
Alex`,
      tone: "WARM" as const,
      ctaType: "BOOK_CALL" as const,
    },
    createdAt: hoursAgo(2),
    status: "PENDING_REVIEW" as const,
  },

  {
    // 2. BOOKING_INTENT — ready to book immediately
    idempotencyKey: "demo-seed-002",
    instantlyReplyId: "instantly-demo-002",
    lead: {
      email: "james.wilson@startupstack.io",
      firstName: "James",
      lastName: "Wilson",
      company: "StartupStack",
      title: "CEO",
      status: "positive_reply" as const,
    },
    reply: {
      fromName: "James Wilson",
      subject: "Re: Quick question about StartupStack's outreach",
      bodyText:
        "Alex, perfect timing — we're actively evaluating automation tools right now. I'd love to jump on a 30-min call this week. What does your calendar look like Thursday or Friday?",
      toEmail: "alex@techflow.io",
    },
    classification: {
      intent: "BOOKING_INTENT" as const,
      confidence: 0.97,
      sentiment: "POSITIVE" as const,
      urgency: "HIGH" as const,
      keySignals: ["actively evaluating", "jump on a call", "this week", "Thursday or Friday"],
      reasoning: "Lead is actively in buying mode and explicitly requesting a calendar slot.",
      requiresDraft: true,
      requiresHuman: true,
      routingDecision: "SEND_TO_REVIEW",
    },
    draft: {
      subject: "Re: Quick question about StartupStack's outreach",
      bodyText: `Hi James,

Thursday/Friday works perfectly — let's lock it in.

Here's my calendar link to grab a slot that suits you:
👉 https://cal.com/alex-techflow/discovery

I'll send over a quick prep doc beforehand so we can make the most of the 30 minutes.

Looking forward to it,
Alex`,
      tone: "DIRECT" as const,
      ctaType: "BOOK_CALL" as const,
    },
    createdAt: minutesAgo(30),
    status: "PENDING_REVIEW" as const,
  },

  {
    // 3. OBJECTION — competitor contract in place
    idempotencyKey: "demo-seed-003",
    instantlyReplyId: "instantly-demo-003",
    lead: {
      email: "m.torres@enterprise-sol.com",
      firstName: "Michael",
      lastName: "Torres",
      company: "Enterprise Solutions",
      title: "CTO",
      status: "objection_reply" as const,
    },
    reply: {
      fromName: "Michael Torres",
      subject: "Re: Quick question about Enterprise Solutions",
      bodyText:
        "Hi Alex, appreciate you reaching out. We actually just signed a 2-year contract with a competitor about 3 months ago so we're not in a position to switch right now. Thanks anyway.",
      toEmail: "alex@techflow.io",
    },
    classification: {
      intent: "OBJECTION" as const,
      confidence: 0.88,
      sentiment: "NEUTRAL" as const,
      urgency: "LOW" as const,
      keySignals: ["just signed a 2-year contract", "competitor", "not in a position to switch"],
      reasoning: "Lead has a recent long-term competitor contract — classic timing objection.",
      requiresDraft: true,
      requiresHuman: true,
      routingDecision: "SEND_TO_REVIEW",
    },
    draft: {
      subject: "Re: Quick question about Enterprise Solutions",
      bodyText: `Hi Michael,

Totally understand — a 2-year commitment makes switching a non-starter right now, and I respect that.

I'll keep you in mind for when the contract winds down. Would it be alright if I reached back out in about 18 months to see where things stand? A lot can change in that time and I'd love to show you what we've built by then.

Either way, best of luck with the current setup.

Cheers,
Alex`,
      tone: "EMPATHETIC" as const,
      ctaType: "FOLLOW_UP" as const,
    },
    createdAt: hoursAgo(5),
    status: "PENDING_REVIEW" as const,
  },

  {
    // 4. FAQ — technical questions before deciding
    idempotencyKey: "demo-seed-004",
    instantlyReplyId: "instantly-demo-004",
    lead: {
      email: "lisa.park@growthlabs.co",
      firstName: "Lisa",
      lastName: "Park",
      company: "GrowthLabs",
      title: "Head of Revenue",
      status: "faq_reply" as const,
    },
    reply: {
      fromName: "Lisa Park",
      subject: "Re: Quick question about GrowthLabs' sales process",
      bodyText:
        "Hi Alex, sounds interesting. Couple of quick questions before I pull in my team: do you integrate natively with HubSpot? And what does the typical setup look like for a 15-person sales team?",
      toEmail: "alex@techflow.io",
    },
    classification: {
      intent: "FAQ" as const,
      confidence: 0.85,
      sentiment: "POSITIVE" as const,
      urgency: "MEDIUM" as const,
      keySignals: ["integrate with HubSpot", "setup", "15-person sales team", "pull in my team"],
      reasoning: "Lead is asking pre-sales technical questions before involving decision-makers.",
      requiresDraft: true,
      requiresHuman: true,
      routingDecision: "SEND_TO_REVIEW",
    },
    draft: {
      subject: "Re: Quick question about GrowthLabs' sales process",
      bodyText: `Hi Lisa,

Happy to answer both!

**HubSpot Integration** — Yes, we have a native two-way HubSpot sync. Contacts, activity, deal stages and sequence enrollment all flow back automatically. Setup takes about 20 minutes.

**15-Person Team Setup** — For a team that size, our standard onboarding is:
- Week 1: ICP calibration + first campaign copy review
- Week 2: Campaign goes live, first results visible
- Ongoing: Weekly reporting + AI model tuning based on reply data

Most 15-rep teams are fully ramped within 3 weeks.

Worth a quick call to walk through a live demo with your team? Happy to do a group session:
👉 https://cal.com/alex-techflow/discovery

Best,
Alex`,
      tone: "PROFESSIONAL" as const,
      ctaType: "BOOK_CALL" as const,
    },
    createdAt: hoursAgo(3) as unknown as Date,
    status: "PENDING_REVIEW" as const,
  },

  {
    // 5. BOUNCE_OOO — auto-dismissed, no draft
    idempotencyKey: "demo-seed-005",
    instantlyReplyId: "instantly-demo-005",
    lead: {
      email: "d.kim@bigcorp-intl.com",
      firstName: "David",
      lastName: "Kim",
      company: "BigCorp International",
      title: "Director of Sales",
      status: "ooo" as const,
    },
    reply: {
      fromName: "David Kim (Auto-Reply)",
      subject: "Re: Quick question about BigCorp's pipeline",
      bodyText:
        "I am currently out of the office from May 20th and will return June 1st, 2026. I will have limited access to email. For urgent matters, please contact my assistant Sarah at s.lee@bigcorp-intl.com.",
      toEmail: "alex@techflow.io",
    },
    classification: {
      intent: "BOUNCE_OOO" as const,
      confidence: 0.99,
      sentiment: "NEUTRAL" as const,
      urgency: "LOW" as const,
      keySignals: ["out of the office", "return June 1st", "limited access to email"],
      reasoning: "Automated out-of-office reply. No action needed, re-queue after return date.",
      requiresDraft: false,
      requiresHuman: false,
      routingDecision: "DISMISS",
    },
    draft: null,
    createdAt: hoursAgo(6),
    status: "DISMISSED" as const,
  },

  {
    // 6. UNSUBSCRIBE — auto-suppressed, no draft
    idempotencyKey: "demo-seed-006",
    instantlyReplyId: "instantly-demo-006",
    lead: {
      email: "emma.johnson@scaleup.io",
      firstName: "Emma",
      lastName: "Johnson",
      company: "ScaleUp.io",
      title: "Marketing Manager",
      status: "unsubscribed" as const,
    },
    reply: {
      fromName: "Emma Johnson",
      subject: "Re: Quick question about ScaleUp's marketing stack",
      bodyText: "Please remove me from your mailing list. I am not interested. Thank you.",
      toEmail: "alex@techflow.io",
    },
    classification: {
      intent: "UNSUBSCRIBE" as const,
      confidence: 0.99,
      sentiment: "NEGATIVE" as const,
      urgency: "HIGH" as const,
      keySignals: ["remove me from your mailing list", "not interested"],
      reasoning: "Explicit unsubscribe request. Must be honoured immediately and lead suppressed.",
      requiresDraft: false,
      requiresHuman: false,
      routingDecision: "SUPPRESS",
    },
    draft: null,
    createdAt: hoursAgo(4),
    status: "SUPPRESSED" as const,
  },
];

// ─────────────────────────────────────────────────────────────
// Seed runner
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding demo data...\n");

  // ── 1. Client ──────────────────────────────────────────────
  const [client] = await sql`
    INSERT INTO clients (
      slug, company_name, contact_email, contact_name,
      timezone, service_type, status, automation_level,
      service_description, icp_description, calcom_link
    )
    VALUES (
      'techflow-demo',
      'TechFlow Solutions',
      'alex@techflow.io',
      'Alex Rivera',
      'America/New_York',
      'cold_outbound',
      'active',
      1,
      'We help B2B sales teams automate lead qualification and personalised outreach using AI — cutting SDR prospecting time by 60%.',
      'VP Sales, Head of Revenue, CRO at Series A–C SaaS companies with 50–500 employees.',
      'https://cal.com/alex-techflow/discovery'
    )
    ON CONFLICT (slug) DO UPDATE SET
      service_description = EXCLUDED.service_description,
      calcom_link = EXCLUDED.calcom_link
    RETURNING id
  `;
  console.log(`✓  Client:    TechFlow Solutions  (${client.id})`);

  // ── 2. Campaign ────────────────────────────────────────────
  let campaign: { id: string };
  const [existingCampaign] = await sql<{ id: string }[]>`
    SELECT id FROM campaigns WHERE instantly_campaign_id = 'demo-campaign-q2-2026' LIMIT 1
  `;
  if (existingCampaign) {
    campaign = existingCampaign;
    await sql`
      UPDATE campaigns
      SET name = 'Q2 SaaS Decision-Makers 2026', status = 'active'
      WHERE id = ${campaign.id}
    `;
  } else {
    const [newCampaign] = await sql<{ id: string }[]>`
      INSERT INTO campaigns (
        client_id, name, status, instantly_campaign_id,
        total_leads, emails_sent, replies_received
      )
      VALUES (
        ${client.id},
        'Q2 SaaS Decision-Makers 2026',
        'active',
        'demo-campaign-q2-2026',
        6, 6, 6
      )
      RETURNING id
    `;
    campaign = newCampaign;
  }
  console.log(`✓  Campaign:  Q2 SaaS Decision-Makers 2026  (${campaign.id})\n`);

  // ── 3–6. One pass per scenario ────────────────────────────
  for (const s of scenarios) {
    // Lead
    const [existingLead] = await sql<{ id: string }[]>`
      SELECT id FROM leads WHERE email = ${s.lead.email} AND client_id = ${client.id} LIMIT 1
    `;

    let leadId: string;
    if (existingLead) {
      leadId = existingLead.id;
    } else {
      const [newLead] = await sql<{ id: string }[]>`
        INSERT INTO leads (
          client_id, campaign_id, email, first_name, last_name,
          company, title, lead_status, replied_at
        )
        VALUES (
          ${client.id}, ${campaign.id},
          ${s.lead.email}, ${s.lead.firstName}, ${s.lead.lastName},
          ${s.lead.company}, ${s.lead.title}, ${s.lead.status},
          ${s.createdAt.toISOString()}
        )
        RETURNING id
      `;
      leadId = newLead.id;
    }

    // raw_reply
    const [existingRaw] = await sql<{ id: string }[]>`
      SELECT id FROM raw_replies WHERE idempotency_key = ${s.idempotencyKey} LIMIT 1
    `;

    let rawReplyId: string;
    if (existingRaw) {
      rawReplyId = existingRaw.id;
    } else {
      const rawPayload = {
        reply_id: s.instantlyReplyId,
        from: s.reply.fromName,
        from_email: s.lead.email,
        to_email: s.reply.toEmail,
        subject: s.reply.subject,
        body: s.reply.bodyText,
        original_body: ORIGINAL_EMAIL.replace("{{first_name}}", s.lead.firstName).replace(
          "{{company}}",
          s.lead.company
        ),
        received_at: s.createdAt.toISOString(),
      };

      const [newRaw] = await sql<{ id: string }[]>`
        INSERT INTO raw_replies (
          idempotency_key, campaign_id, lead_id,
          instantly_reply_id, from_email, from_name, to_email,
          subject, body_text, received_at, raw_payload
        )
        VALUES (
          ${s.idempotencyKey}, ${campaign.id}, ${leadId},
          ${s.instantlyReplyId}, ${s.lead.email}, ${s.reply.fromName},
          ${s.reply.toEmail}, ${s.reply.subject}, ${s.reply.bodyText},
          ${s.createdAt.toISOString()}, ${sql.json(rawPayload)}
        )
        RETURNING id
      `;
      rawReplyId = newRaw.id;
    }

    // reply_item (skip if already exists for this raw_reply)
    const [existingItem] = await sql<{ id: string }[]>`
      SELECT id FROM reply_items WHERE raw_reply_id = ${rawReplyId} LIMIT 1
    `;

    if (existingItem) {
      console.log(
        `↷  Skipped:   ${s.lead.firstName} ${s.lead.lastName} (already seeded)`
      );
      continue;
    }

    const traceId = crypto.randomUUID();

    const [replyItem] = await sql<{ id: string }[]>`
      INSERT INTO reply_items (
        raw_reply_id, campaign_id, lead_id, client_id,
        status, trace_id, created_at, updated_at,
        resolved_at
      )
      VALUES (
        ${rawReplyId}, ${campaign.id}, ${leadId}, ${client.id},
        ${s.status}, ${traceId},
        ${s.createdAt.toISOString()}, ${s.createdAt.toISOString()},
        ${s.status === "DISMISSED" || s.status === "SUPPRESSED"
          ? s.createdAt.toISOString()
          : null}
      )
      RETURNING id
    `;

    // classification
    const [classification] = await sql<{ id: string }[]>`
      INSERT INTO reply_classifications (
        reply_item_id, intent, confidence, sentiment, urgency,
        key_signals, reasoning, requires_draft, requires_human,
        routing_decision, model_used, prompt_version, raw_model_output
      )
      VALUES (
        ${replyItem.id},
        ${s.classification.intent},
        ${s.classification.confidence},
        ${s.classification.sentiment},
        ${s.classification.urgency},
        ${s.classification.keySignals},
        ${s.classification.reasoning},
        ${s.classification.requiresDraft},
        ${s.classification.requiresHuman},
        ${s.classification.routingDecision},
        'claude-sonnet-4-6',
        'v1.0',
        ${sql.json({ demo: true })}
      )
      RETURNING id
    `;

    // Link classification back to reply_item
    await sql`
      UPDATE reply_items
      SET classification_id = ${classification.id}
      WHERE id = ${replyItem.id}
    `;

    // draft (only for PENDING_REVIEW items)
    if (s.draft && s.status === "PENDING_REVIEW") {
      const slaDeadline = new Date(s.createdAt.getTime() + 4 * 60 * 60 * 1000);

      const [draft] = await sql<{ id: string }[]>`
        INSERT INTO reply_drafts (
          reply_item_id, classification_id, client_id, lead_id,
          subject, body_text, tone, cta_type,
          status, model_used, prompt_version, raw_model_output,
          sla_deadline, trace_id, generated_at
        )
        VALUES (
          ${replyItem.id}, ${classification.id}, ${client.id}, ${leadId},
          ${s.draft.subject}, ${s.draft.bodyText},
          ${s.draft.tone}, ${s.draft.ctaType},
          'pending_review', 'claude-sonnet-4-6', 'v1.0',
          ${sql.json({ demo: true })},
          ${slaDeadline.toISOString()},
          ${traceId},
          ${s.createdAt.toISOString()}
        )
        RETURNING id
      `;

      // Link draft back to reply_item
      await sql`
        UPDATE reply_items
        SET draft_id = ${draft.id}
        WHERE id = ${replyItem.id}
      `;
    }

    // Suppression list entry for UNSUBSCRIBE
    if (s.classification.intent === "UNSUBSCRIBE") {
      await sql`
        INSERT INTO suppression_list (email, client_id, reason, reply_item_id, suppressed_by)
        VALUES (${s.lead.email}, ${client.id}, 'UNSUBSCRIBE', ${replyItem.id}, 'system')
        ON CONFLICT (email) DO NOTHING
      `;
    }

    const slaMark =
      s.status === "PENDING_REVIEW"
        ? s.createdAt < hoursAgo(4)
          ? "🔴 OVERDUE"
          : s.createdAt < hoursAgo(3.5)
          ? "🟡 SLA WARNING"
          : "🟢 SLA OK"
        : "";

    console.log(
      `✓  ${s.classification.intent.padEnd(15)} ${s.lead.firstName} ${s.lead.lastName.padEnd(10)} → ${s.status.padEnd(16)} ${slaMark}`
    );
  }

  console.log("\n✅  Demo data seeded successfully!\n");
  console.log("──────────────────────────────────────────");
  console.log("Next steps:");
  console.log("  cd apps/dashboard && npm run dev");
  console.log("  Open: http://localhost:3000");
  console.log("  Login: admin@krionics.com  /  admin123");
  console.log("──────────────────────────────────────────\n");

  await sql.end();
}

main().catch((err) => {
  console.error("❌  Seed failed:", err);
  sql.end();
  process.exit(1);
});
