import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { crmSyncQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";
import { createCRMProvider, type CRMType } from "../clients/crm/factory.js";

const CRMSyncJobSchema = z.object({
  clientId: z.string().uuid(),
  leadId: z.string().uuid(),
  meetingId: z.string().uuid().nullable().optional(),
  triggerEvent: z.string(),
  traceId: z.string().uuid().nullable().optional()
});

type CRMSyncJob = z.infer<typeof CRMSyncJobSchema>;

export function createCRMSyncWorker(): Worker<CRMSyncJob> {
  return new Worker(
    crmSyncQueue.name,
    async (job) => {
      const payload = CRMSyncJobSchema.parse(job.data);

      const [client] = await sql<{
        id: string;
        company_name: string;
        crm_type: string | null;
      }[]>`
        SELECT id, company_name, crm_type
        FROM clients
        WHERE id = ${payload.clientId}::uuid
      `;

      if (!client) {
        throw new Error(`Missing client ${payload.clientId}`);
      }

      const crmType = (client.crm_type ?? "none") as CRMType;
      const provider = createCRMProvider(crmType);

      if (!provider) {
        return { status: "skipped", reason: "no_crm_configured" };
      }

      const [lead] = await sql<{
        email: string;
        first_name: string | null;
        last_name: string | null;
        title: string | null;
        company: string | null;
        phone: string | null;
        linkedin_url: string | null;
        crm_contact_id: string | null;
      }[]>`
        SELECT email, first_name, last_name, title, company, phone, linkedin_url, crm_contact_id
        FROM leads
        WHERE id = ${payload.leadId}::uuid
      `;

      if (!lead) {
        throw new Error(`Missing lead ${payload.leadId}`);
      }

      // Upsert contact
      const { id: contactId } = await provider.upsertContact({
        email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        title: lead.title,
        company: lead.company,
        phone: lead.phone,
        linkedin_url: lead.linkedin_url
      });

      await sql`
        UPDATE leads
        SET crm_contact_id = ${contactId},
            crm_synced     = TRUE,
            crm_synced_at  = NOW()
        WHERE id = ${payload.leadId}::uuid
      `;

      let dealId: string | undefined;

      // Create deal when triggered by a meeting booking
      if (payload.triggerEvent === "meeting_booked" && payload.meetingId) {
        const [meeting] = await sql<{
          scheduled_at: string;
          meeting_type: string | null;
          attendee_name: string | null;
        }[]>`
          SELECT scheduled_at, meeting_type, attendee_name
          FROM meetings
          WHERE id = ${payload.meetingId}::uuid
        `;

        if (meeting) {
          const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ")
            || lead.email;
          const { id } = await provider.createDeal({
            name: `${leadName} — ${client.company_name}`,
            contact_id: contactId,
            stage: "appointmentscheduled",
            close_date: new Date(
              new Date(meeting.scheduled_at).getTime() + 30 * 24 * 60 * 60 * 1000
            )
              .toISOString()
              .split("T")[0]
          });
          dealId = id;

          await sql`
            UPDATE meetings
            SET crm_deal_id = ${id}, crm_synced = TRUE
            WHERE id = ${payload.meetingId}::uuid
          `;
        }
      }

      await emitEvent({
        clientId: payload.clientId,
        leadId: payload.leadId,
        eventType: "opportunity_created",
        metadata: {
          crm_type: crmType,
          contact_id: contactId,
          deal_id: dealId ?? null,
          trigger_event: payload.triggerEvent
        },
        traceId: payload.traceId ?? null
      });

      return {
        status: "synced",
        crm: crmType,
        contactId,
        dealId: dealId ?? null
      };
    },
    { connection: crmSyncQueue.opts.connection }
  );
}
