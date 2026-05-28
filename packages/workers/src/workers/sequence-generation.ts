import { Worker } from "bullmq";
import { z } from "zod";
import { createAIProvider } from "@krionics/ai-provider";
import { sql } from "../db.js";
import { sequenceGenerationQueue, instantlyPushQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";
import { logAIInvocation, estimateCostMicro } from "../log-ai-invocation.js";

const SequenceGenerationJobSchema = z.object({
  clientId: z.string().uuid(),
  leadId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  traceId: z.string().uuid().nullable().optional()
});

type SequenceGenerationJob = z.infer<typeof SequenceGenerationJobSchema>;

export function createSequenceGenerationWorker(): Worker<SequenceGenerationJob> {
  const provider = createAIProvider();

  return new Worker(
    sequenceGenerationQueue.name,
    async (job) => {
      const payload = SequenceGenerationJobSchema.parse(job.data);
      const traceId = payload.traceId ?? crypto.randomUUID();

      const [lead] = await sql<{
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        title: string | null;
        company: string | null;
        lead_status: string;
      }[]>`
        SELECT id, email, first_name, last_name, title, company, lead_status
        FROM leads
        WHERE id = ${payload.leadId}::uuid
      `;

      if (!lead) throw new Error(`Missing lead ${payload.leadId}`);

      const [enriched] = await sql<{
        icp_fit_score: number | null;
        buying_signals: string[] | null;
        personalization_hooks: string[] | null;
        recommended_depth: string | null;
      }[]>`
        SELECT icp_fit_score, buying_signals, personalization_hooks, recommended_depth
        FROM enriched_leads
        WHERE lead_id = ${payload.leadId}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const [client] = await sql<{
        company_name: string;
        sales_lead_name: string | null;
        service_description: string | null;
        icp_description: string | null;
        calendly_link: string | null;
        instantly_campaign_id: string | null;
      }[]>`
        SELECT company_name, sales_lead_name, service_description,
               icp_description, calendly_link, instantly_campaign_id
        FROM clients
        WHERE id = ${payload.clientId}::uuid
      `;

      if (!client) throw new Error(`Missing client ${payload.clientId}`);
      if (!client.calendly_link) throw new Error(`Client ${payload.clientId} has no calendly_link`);
      if (!client.instantly_campaign_id) {
        throw new Error(`Client ${payload.clientId} has no instantly_campaign_id`);
      }

      const sequenceSteps = enriched?.recommended_depth === "deep" ? 5 : 3;

      const start = Date.now();
      let output: Awaited<ReturnType<typeof provider.generateSequence>>;
      try {
        output = await provider.generateSequence({
          lead: {
            full_name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email,
            title: lead.title,
            company_name: lead.company ?? "Unknown"
          },
          icp_fit_score: enriched?.icp_fit_score ?? 0.5,
          signals: (enriched?.buying_signals ?? []).map((s) => ({
            signal_type: "buying_signal",
            description: s,
            strength: "moderate" as const
          })),
          personalization_hooks: enriched?.personalization_hooks ?? [],
          client_context: {
            company_name: client.company_name,
            sales_lead_name: client.sales_lead_name ?? "Team",
            service_description: client.service_description ?? "",
            calendly_link: client.calendly_link
          },
          sequence_steps: sequenceSteps
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const latencyMs = Date.now() - start;
        await logAIInvocation({
          clientId: payload.clientId, invocationType: "personalization",
          traceId, entityType: "lead", entityId: payload.leadId,
          model: "claude-sonnet-4-20250514", latencyMs,
          success: false, errorCode: error.message.slice(0, 100)
        });
        throw error;
      }
      const latencyMs = Date.now() - start;

      await logAIInvocation({
        clientId: payload.clientId, invocationType: "personalization",
        traceId, entityType: "lead", entityId: payload.leadId,
        model: "claude-sonnet-4-20250514", latencyMs,
        success: true, validatedOutput: output, validationPassed: true,
        costUsdMicro: estimateCostMicro("claude-sonnet-4-20250514", 1500, 1200)
      });

      const [sequence] = await sql<{ id: string }[]>`
        INSERT INTO generated_sequences (
          client_id, campaign_id, lead_id,
          emails, strategy_notes,
          model_used, icp_fit_score, generation_ms, trace_id
        ) VALUES (
          ${payload.clientId}::uuid,
          ${payload.campaignId ?? null}::uuid,
          ${payload.leadId}::uuid,
          ${JSON.stringify(output.emails)}::jsonb,
          ${output.strategy_notes},
          'claude-sonnet-4-20250514',
          ${enriched?.icp_fit_score ?? null},
          ${latencyMs},
          ${traceId}::uuid
        )
        RETURNING id
      `;

      await sql`
        UPDATE leads SET lead_status = 'campaign_ready' WHERE id = ${payload.leadId}::uuid
      `;

      await instantlyPushQueue.add("push_sequence", {
        sequenceId: sequence!.id,
        clientId: payload.clientId,
        leadId: payload.leadId,
        campaignId: client.instantly_campaign_id,
        traceId
      }, { jobId: `instantly-push:${sequence!.id}` });

      await emitEvent({
        clientId: payload.clientId,
        leadId: payload.leadId,
        campaignId: payload.campaignId ?? null,
        eventType: "sequence_generated",
        metadata: {
          sequence_id: sequence!.id,
          email_count: output.emails.length,
          icp_fit_score: enriched?.icp_fit_score ?? null,
          generation_ms: latencyMs
        },
        traceId
      });

      return {
        status: "generated",
        sequenceId: sequence!.id,
        emailCount: output.emails.length
      };
    },
    { connection: sequenceGenerationQueue.opts.connection }
  );
}
