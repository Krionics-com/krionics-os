import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { instantlyPushQueue } from "../queues.js";
import { getEnv } from "../env.js";
import { addLeadToInstantlyCampaign } from "../clients/instantly-outbound.js";
import { emitEvent } from "../emit-event.js";

const InstantlyPushJobSchema = z.object({
  sequenceId: z.string().uuid(),
  clientId: z.string().uuid(),
  leadId: z.string().uuid(),
  campaignId: z.string().min(1),
  traceId: z.string().nullable().optional()
});

type InstantlyPushJob = z.infer<typeof InstantlyPushJobSchema>;

export function createInstantlyPushWorker(): Worker<InstantlyPushJob> {
  const env = getEnv();

  return new Worker(
    instantlyPushQueue.name,
    async (job) => {
      const payload = InstantlyPushJobSchema.parse(job.data);

      if (!env.instantlyApiKey) {
        throw new Error("Missing INSTANTLY_API_KEY");
      }

      const [sequence] = await sql<{
        id: string;
        emails: Array<{ step: number; delay_days: number; subject: string; body: string }>;
        status: string;
      }[]>`
        SELECT id, emails, status
        FROM generated_sequences
        WHERE id = ${payload.sequenceId}::uuid
      `;

      if (!sequence) throw new Error(`Missing generated_sequence ${payload.sequenceId}`);
      if (sequence.status === "pushed") {
        return { status: "skipped", reason: "already_pushed" };
      }

      const [lead] = await sql<{
        email: string;
        first_name: string | null;
        last_name: string | null;
        company: string | null;
      }[]>`
        SELECT email, first_name, last_name, company
        FROM leads
        WHERE id = ${payload.leadId}::uuid
      `;

      if (!lead) throw new Error(`Missing lead ${payload.leadId}`);

      await sql`
        UPDATE generated_sequences SET status = 'pushing', updated_at = NOW()
        WHERE id = ${payload.sequenceId}::uuid
      `;

      let instantlyContactId: string;
      try {
        const result = await addLeadToInstantlyCampaign({
          apiKey: env.instantlyApiKey,
          campaignId: payload.campaignId,
          email: lead.email,
          firstName: lead.first_name,
          lastName: lead.last_name,
          companyName: lead.company,
          emails: sequence.emails.map((e) => ({
            subject: e.subject,
            body: e.body,
            delay_days: e.delay_days
          }))
        });
        instantlyContactId = result.leadId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        await sql`
          UPDATE generated_sequences
          SET status = 'failed', push_error = ${error.message}, updated_at = NOW()
          WHERE id = ${payload.sequenceId}::uuid
        `;
        throw error;
      }

      await sql`
        UPDATE generated_sequences
        SET status          = 'pushed',
            instantly_campaign_id = ${payload.campaignId},
            instantly_contact_id  = ${instantlyContactId},
            pushed_at       = NOW(),
            updated_at      = NOW()
        WHERE id = ${payload.sequenceId}::uuid
      `;

      await sql`
        UPDATE leads
        SET lead_status        = 'queued_for_sending',
            instantly_contact_id = ${instantlyContactId}
        WHERE id = ${payload.leadId}::uuid
      `;

      await emitEvent({
        clientId: payload.clientId,
        leadId: payload.leadId,
        eventType: "campaign_pushed",
        metadata: {
          sequence_id: payload.sequenceId,
          instantly_campaign_id: payload.campaignId,
          instantly_contact_id: instantlyContactId,
          email_count: sequence.emails.length
        },
        traceId: payload.traceId ?? null
      });

      return {
        status: "pushed",
        instantlyContactId,
        emailCount: sequence.emails.length
      };
    },
    { connection: instantlyPushQueue.opts.connection }
  );
}
