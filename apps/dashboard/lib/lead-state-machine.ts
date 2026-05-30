import { sql } from "@/lib/db";

export type LeadState =
  | "raw_imported"
  | "deduplicated"
  | "enrichment_pending"
  | "enrichment_failed"
  | "enriched"
  | "personalized"
  | "campaign_ready"
  | "queued_for_sending"
  | "sending_active"
  | "email_bounced"
  | "no_response"
  | "reply_received"
  | "positive_reply"
  | "faq_reply"
  | "objection_reply"
  | "nurture_reply"
  | "unsubscribe"
  | "wrong_contact"
  | "ooo"
  | "ai_draft_pending"
  | "reply_sent"
  | "conversation_active"
  | "awaiting_booking"
  | "nurture_active"
  | "meeting_booked"
  | "qualified_opportunity"
  | "closed_positive"
  | "closed_negative";

const STATE_TRANSITIONS: Record<LeadState, LeadState[]> = {
  raw_imported: ["deduplicated"],
  deduplicated: ["enrichment_pending"],
  enrichment_pending: ["enriched", "enrichment_failed"],
  enrichment_failed: ["enrichment_pending"],
  enriched: ["personalized"],
  personalized: ["campaign_ready"],
  campaign_ready: ["queued_for_sending"],
  queued_for_sending: ["sending_active", "email_bounced"],
  sending_active: [
    "reply_received",
    "email_bounced",
    "no_response",
  ],
  email_bounced: ["no_response"],
  no_response: ["campaign_ready"],
  reply_received: [
    "positive_reply",
    "faq_reply",
    "objection_reply",
    "nurture_reply",
    "unsubscribe",
    "wrong_contact",
    "ooo",
  ],
  positive_reply: ["ai_draft_pending", "awaiting_booking"],
  faq_reply: ["ai_draft_pending"],
  objection_reply: ["ai_draft_pending"],
  nurture_reply: ["ai_draft_pending", "nurture_active"],
  unsubscribe: ["closed_negative"],
  wrong_contact: ["closed_negative"],
  ooo: ["nurture_active"],
  ai_draft_pending: ["reply_sent"],
  reply_sent: ["conversation_active", "awaiting_booking"],
  conversation_active: ["awaiting_booking", "reply_received"],
  awaiting_booking: ["meeting_booked", "nurture_active", "closed_negative"],
  nurture_active: ["reply_received", "awaiting_booking", "closed_negative"],
  meeting_booked: ["qualified_opportunity"],
  qualified_opportunity: ["closed_positive", "closed_negative"],
  closed_positive: [],
  closed_negative: [],
};

interface TransitionContext {
  reason?: string;
  triggeredByEventId?: string;
  actorOperatorId?: string;
}

export async function transitionLeadState(
  leadId: string,
  clientId: string,
  toState: LeadState,
  context: TransitionContext = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch current lead state
    const [lead] = await sql<{ lead_status: LeadState; id: string }[]>`
      SELECT id, lead_status FROM leads WHERE id = ${leadId}
    `;

    if (!lead) {
      return { success: false, error: "Lead not found" };
    }

    const fromState = lead.lead_status;

    // Validate state transition
    const validNextStates = STATE_TRANSITIONS[fromState] || [];
    if (!validNextStates.includes(toState)) {
      return {
        success: false,
        error: `Invalid transition from ${fromState} to ${toState}`,
      };
    }

    // Start transaction
    await sql.begin(async (tx) => {
      // Calculate duration in previous state
      const [durationResult] = await tx<{ duration_ms: number }[]>`
        SELECT EXTRACT(EPOCH FROM (NOW() - status_updated_at)) * 1000 as duration_ms
        FROM leads
        WHERE id = ${leadId}
      `;
      const durationMs = Math.round(durationResult?.duration_ms || 0);

      // Update lead status
      await tx`
        UPDATE leads
        SET
          lead_status = ${toState},
          prev_status = ${fromState},
          status_updated_at = NOW(),
          status_reason = ${context.reason || null},
          updated_at = NOW()
        WHERE id = ${leadId}
      `;

      // Record state transition
      await tx`
        INSERT INTO lead_state_history (
          lead_id,
          client_id,
          from_state,
          to_state,
          transition_reason,
          triggered_by_event_id,
          triggered_by,
          actor_operator_id,
          transitioned_at,
          duration_in_state_ms
        ) VALUES (
          ${leadId},
          ${clientId},
          ${fromState},
          ${toState},
          ${context.reason || null},
          ${context.triggeredByEventId || null},
          'system',
          ${context.actorOperatorId || null},
          NOW(),
          ${durationMs}
        )
      `;
    });

    return { success: true };
  } catch (error) {
    console.error("Error transitioning lead state:", error);
    return { success: false, error: String(error) };
  }
}

export function getValidNextStates(currentState: LeadState): LeadState[] {
  return STATE_TRANSITIONS[currentState] || [];
}

export function isValidTransition(
  fromState: LeadState,
  toState: LeadState
): boolean {
  return (STATE_TRANSITIONS[fromState] || []).includes(toState);
}
