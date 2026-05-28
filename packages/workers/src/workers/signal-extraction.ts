import { Worker } from "bullmq";
import { z } from "zod";
import { createAIProvider } from "@krionics/ai-provider";
import { sql } from "../db.js";
import { signalExtractionQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";
import { logAIInvocation, estimateCostMicro } from "../log-ai-invocation.js";

const SignalExtractionJobSchema = z.object({
  clientId: z.string().uuid(),
  leadId: z.string().uuid(),
  enrichedLeadId: z.string().uuid(),
  traceId: z.string().uuid().nullable().optional()
});

type SignalExtractionJob = z.infer<typeof SignalExtractionJobSchema>;

export function createSignalExtractionWorker(): Worker<SignalExtractionJob> {
  const provider = createAIProvider();

  return new Worker(
    signalExtractionQueue.name,
    async (job) => {
      const payload = SignalExtractionJobSchema.parse(job.data);

      const [lead] = await sql<{
        first_name: string | null;
        last_name: string | null;
        title: string | null;
        company: string | null;
        company_industry: string | null;
        seniority: string | null;
        linkedin_url: string | null;
      }[]>`
        SELECT first_name, last_name, title, company, company_industry, seniority, linkedin_url
        FROM leads
        WHERE id = ${payload.leadId}::uuid
      `;

      if (!lead) {
        throw new Error(`Missing lead ${payload.leadId}`);
      }

      const [enriched] = await sql<{
        id: string;
        linkedin_headline: string | null;
        linkedin_summary: string | null;
        company_summary: string | null;
        company_growth_signals: string[] | null;
        hiring_signals: string[] | null;
        tech_stack: string[] | null;
        website_summary: string | null;
        recent_news: string[] | null;
      }[]>`
        SELECT id, linkedin_headline, linkedin_summary, company_summary,
               company_growth_signals, hiring_signals, tech_stack, website_summary, recent_news
        FROM enriched_leads
        WHERE id = ${payload.enrichedLeadId}::uuid
      `;

      if (!enriched) {
        throw new Error(`Missing enriched_lead ${payload.enrichedLeadId}`);
      }

      const [client] = await sql<{
        company_name: string;
        service_description: string | null;
        icp_description: string | null;
      }[]>`
        SELECT company_name, service_description, icp_description
        FROM clients
        WHERE id = ${payload.clientId}::uuid
      `;

      if (!client) {
        throw new Error(`Missing client ${payload.clientId}`);
      }

      const enrichmentData: Record<string, unknown> = {
        linkedin_headline: enriched.linkedin_headline,
        linkedin_summary: enriched.linkedin_summary,
        company_summary: enriched.company_summary,
        company_growth_signals: enriched.company_growth_signals,
        hiring_signals: enriched.hiring_signals,
        tech_stack: enriched.tech_stack,
        website_summary: enriched.website_summary,
        recent_news: enriched.recent_news
      };

      const sigTraceId = payload.traceId ?? crypto.randomUUID();
      const start = Date.now();
      const output = await provider.extractSignals({
        lead: {
          full_name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown",
          title: lead.title,
          company_name: lead.company ?? "Unknown",
          linkedin_url: lead.linkedin_url,
          industry: lead.company_industry,
          seniority: lead.seniority
        },
        enrichment_data: enrichmentData,
        client_context: {
          company_name: client.company_name,
          service_description: client.service_description ?? "",
          icp_description: client.icp_description ?? ""
        }
      });
      const durationMs = Date.now() - start;

      await logAIInvocation({
        clientId: payload.clientId, invocationType: "signal_extraction",
        traceId: sigTraceId, entityType: "lead", entityId: payload.leadId,
        model: "claude-sonnet-4-20250514", latencyMs: durationMs,
        success: true, validatedOutput: output, validationPassed: true,
        costUsdMicro: estimateCostMicro("claude-sonnet-4-20250514", 1200, 600)
      });

      await sql`
        UPDATE enriched_leads
        SET
          icp_fit_score         = ${output.icp_fit_score},
          icp_fit_reasoning     = ${output.icp_fit_reasoning},
          buying_signals        = ${output.signals.map((s) => s.description)},
          personalization_hooks = ${output.personalization_hooks},
          recommended_depth     = ${output.recommended_sequence_type},
          enrichment_version    = 'v1',
          updated_at            = NOW()
        WHERE id = ${payload.enrichedLeadId}::uuid
      `;

      await emitEvent({
        clientId: payload.clientId,
        leadId: payload.leadId,
        eventType: "enrichment_completed",
        metadata: {
          enriched_lead_id: payload.enrichedLeadId,
          icp_fit_score: output.icp_fit_score,
          signal_count: output.signals.length,
          recommended_sequence_type: output.recommended_sequence_type,
          duration_ms: durationMs
        },
        traceId: payload.traceId ?? null
      });

      return {
        status: "extracted",
        icp_fit_score: output.icp_fit_score,
        signal_count: output.signals.length
      };
    },
    { connection: signalExtractionQueue.opts.connection }
  );
}
