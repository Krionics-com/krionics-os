import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { clayEnrichmentQueue } from "../queues.js";
import { getEnv } from "../env.js";
import { emitEvent } from "../emit-event.js";
import { triggerClayEnrichment } from "../clients/clay.js";

const ClayEnrichmentJobSchema = z.object({
  clientId: z.string().uuid(),
  leadId: z.string().uuid(),
  traceId: z.string().uuid().nullable().optional()
});

type ClayEnrichmentJob = z.infer<typeof ClayEnrichmentJobSchema>;

export function createClayEnrichmentWorker(): Worker<ClayEnrichmentJob> {
  const env = getEnv();
  const apiKey = env.clayApiKey;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!apiKey) {
    throw new Error("Missing CLAY_API_KEY");
  }
  if (!appUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL or APP_URL");
  }

  const callbackUrl = `${appUrl}/api/webhooks/clay`;

  return new Worker(
    clayEnrichmentQueue.name,
    async (job) => {
      const payload = ClayEnrichmentJobSchema.parse(job.data);

      const [lead] = await sql<{
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        linkedin_url: string | null;
        company_domain: string | null;
        company: string | null;
        client_id: string;
      }[]>`
        SELECT id, email, first_name, last_name, linkedin_url, company_domain, company, client_id
        FROM leads
        WHERE id = ${payload.leadId}::uuid
      `;

      if (!lead) {
        throw new Error(`Missing lead ${payload.leadId}`);
      }

      await emitEvent({
        clientId: payload.clientId,
        leadId: payload.leadId,
        eventType: "enrichment_queued",
        metadata: { lead_id: payload.leadId },
        traceId: payload.traceId ?? null
      });

      const result = await triggerClayEnrichment(apiKey, callbackUrl, {
        email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        linkedin_url: lead.linkedin_url,
        company_domain: lead.company_domain,
        company_name: lead.company,
        external_id: lead.id
      });

      return { status: "triggered", request_id: result.request_id ?? null };
    },
    { connection: clayEnrichmentQueue.opts.connection }
  );
}
