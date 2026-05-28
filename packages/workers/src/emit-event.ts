import { sql } from "./db.js";

export interface EmitEventParams {
  clientId: string;
  leadId?: string | null;
  campaignId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  traceId?: string | null;
  parentEventId?: string | null;
  createdBy?: string;
}

/**
 * Appends an immutable event to the events log.
 * Errors are logged but never propagate — event emission must not block pipeline jobs.
 */
export async function emitEvent(params: EmitEventParams): Promise<void> {
  try {
    await sql`
      INSERT INTO events (
        client_id,
        lead_id,
        campaign_id,
        event_type,
        metadata,
        trace_id,
        parent_event_id,
        created_by
      ) VALUES (
        ${params.clientId}::uuid,
        ${params.leadId ?? null}::uuid,
        ${params.campaignId ?? null}::uuid,
        ${params.eventType},
        ${JSON.stringify(params.metadata ?? {})}::jsonb,
        ${params.traceId ?? null}::uuid,
        ${params.parentEventId ?? null}::uuid,
        ${params.createdBy ?? "system"}
      )
    `;
  } catch (err) {
    console.error("[emit-event] failed to write event", {
      eventType: params.eventType,
      clientId: params.clientId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
