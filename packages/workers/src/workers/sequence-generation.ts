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

type ClientRow = {
  company_name: string;
  sales_lead_name: string | null;
  service_description: string | null;
  icp_description: string | null;
  calcom_link: string | null;
  positioning_statement: string | null;
  value_proposition: string | null;
  ai_knowledge_base: string | null;
  ai_tone: string | null;
  forbidden_claims: string | null;
  review_mode: string;
  sequence_config: { steps: Array<{ step: number; name: string; delay_days: number }> } | null;
  instantly_config: { campaign_id?: string } | null;
};

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

      const [client] = await sql<ClientRow[]>`
        SELECT company_name, sales_lead_name, service_description, icp_description,
               calcom_link, positioning_statement, value_proposition,
               ai_knowledge_base, ai_tone, forbidden_claims,
               review_mode, sequence_config, instantly_config
        FROM clients WHERE id = ${payload.clientId}::uuid
      `;

      if (!client) throw new Error(`Missing client ${payload.clientId}`);
      if (!client.calcom_link) throw new Error(`Client ${payload.clientId} has no calcom_link`);

      // Derive step count from sequence_config; fall back to enrichment hint or default 3
      const sequenceSteps =
        client.sequence_config?.steps?.length
          ? client.sequence_config.steps.length
          : enriched?.recommended_depth === "deep"
            ? 5
            : 3;

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
            calcom_link: client.calcom_link
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

      // Save to generated_sequences (used by instantly-push worker)
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

      // Save generated sequence to lead and mark review_status = pending
      await sql`
        UPDATE leads
        SET lead_sequence = ${JSON.stringify(output.emails)}::jsonb,
            review_status = 'pending',
            lead_status   = 'personalized'
        WHERE id = ${payload.leadId}::uuid
      `;

      // Route based on review_mode
      const reviewMode = client.review_mode ?? "human";

      if (reviewMode === "human") {
        // Human must approve via POST /api/dashboard/leads/[id]/approve — no push enqueue
        await emitEvent({
          clientId: payload.clientId,
          leadId: payload.leadId,
          campaignId: payload.campaignId ?? null,
          eventType: "sequence_generated",
          metadata: {
            sequence_id: sequence!.id,
            email_count: output.emails.length,
            icp_fit_score: enriched?.icp_fit_score ?? null,
            generation_ms: latencyMs,
            review_mode: "human"
          },
          traceId
        });
      } else {
        // "auto" or "ai" — push to Instantly immediately
        const campaignId = client.instantly_config?.campaign_id;
        if (!campaignId) {
          throw new Error(
            `Client ${payload.clientId} has review_mode=${reviewMode} but no instantly_config.campaign_id`
          );
        }

        await instantlyPushQueue.add("push_sequence", {
          sequenceId: sequence!.id,
          clientId: payload.clientId,
          leadId: payload.leadId,
          campaignId,
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
            generation_ms: latencyMs,
            review_mode: reviewMode
          },
          traceId
        });
      }

      return {
        status: "generated",
        sequenceId: sequence!.id,
        emailCount: output.emails.length,
        reviewMode
      };
    },
    { connection: sequenceGenerationQueue.opts.connection }
  );
}
