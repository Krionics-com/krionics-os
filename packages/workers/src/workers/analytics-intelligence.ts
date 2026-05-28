import { Worker } from "bullmq";
import { z } from "zod";
import { createAIProvider } from "@krionics/ai-provider";
import { sql } from "../db.js";
import { analyticsIntelligenceQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";
import { logAIInvocation, estimateCostMicro } from "../log-ai-invocation.js";

const IntelligenceJobSchema = z.object({
  snapshotId: z.string().uuid(),
  clientId: z.string().uuid()
});

type IntelligenceJob = z.infer<typeof IntelligenceJobSchema>;

export function createAnalyticsIntelligenceWorker(): Worker<IntelligenceJob> {
  const provider = createAIProvider();

  return new Worker(
    analyticsIntelligenceQueue.name,
    async (job) => {
      const payload = IntelligenceJobSchema.parse(job.data);

      const [snapshot] = await sql<{
        id: string;
        period_start: string;
        period_end: string;
        granularity: string;
        total_replies: number;
        reply_rate: number;
        positive_rate: number;
        booking_rate: number;
        avg_response_time_hours: number;
        sequences_sent: number;
        intent_breakdown: Record<string, number>;
        top_objections: string[];
      }[]>`
        SELECT id, period_start, period_end, granularity,
               total_replies, reply_rate, positive_rate, booking_rate,
               avg_response_time_hours, sequences_sent,
               intent_breakdown, top_objections
        FROM analytics_snapshots
        WHERE id = ${payload.snapshotId}::uuid
      `;

      if (!snapshot) {
        throw new Error(`Missing analytics_snapshot ${payload.snapshotId}`);
      }

      const [client] = await sql<{
        company_name: string;
        service_description: string | null;
      }[]>`
        SELECT company_name, service_description
        FROM clients
        WHERE id = ${payload.clientId}::uuid
      `;

      if (!client) {
        throw new Error(`Missing client ${payload.clientId}`);
      }

      const analyticsTraceId = crypto.randomUUID();
      const start = Date.now();
      const output = await provider.analyzePerformance({
        period_start: new Date(snapshot.period_start).toISOString(),
        period_end: new Date(snapshot.period_end).toISOString(),
        client_id: payload.clientId,
        metrics: {
          total_replies: snapshot.total_replies,
          intent_breakdown: snapshot.intent_breakdown ?? {},
          reply_rate: snapshot.reply_rate,
          booking_rate: snapshot.booking_rate,
          positive_rate: snapshot.positive_rate,
          avg_response_time_hours: snapshot.avg_response_time_hours,
          sequences_sent: snapshot.sequences_sent
        },
        top_objections: snapshot.top_objections ?? [],
        client_context: {
          company_name: client.company_name,
          service_description: client.service_description ?? ""
        }
      });
      const durationMs = Date.now() - start;

      await logAIInvocation({
        clientId: payload.clientId, invocationType: "analytics_intelligence",
        traceId: analyticsTraceId, entityType: "campaign", entityId: payload.snapshotId,
        model: "claude-sonnet-4-20250514", latencyMs: durationMs,
        success: true, validatedOutput: output, validationPassed: true,
        costUsdMicro: estimateCostMicro("claude-sonnet-4-20250514", 1500, 800)
      });

      await sql`
        UPDATE analytics_snapshots
        SET
          ai_summary              = ${output.summary},
          ai_key_insights         = ${output.key_insights},
          ai_recommended_actions  = ${JSON.stringify(output.recommended_actions)},
          ai_sequence_suggestions = ${output.sequence_suggestions},
          ai_health_score         = ${output.health_score},
          ai_analyzed_at          = NOW()
        WHERE id = ${payload.snapshotId}::uuid
      `;

      await emitEvent({
        clientId: payload.clientId,
        eventType: "analytics_ai_analyzed",
        metadata: {
          snapshot_id: payload.snapshotId,
          health_score: output.health_score,
          insight_count: output.key_insights.length,
          action_count: output.recommended_actions.length,
          duration_ms: durationMs
        }
      });

      return {
        status: "analyzed",
        snapshotId: payload.snapshotId,
        healthScore: output.health_score,
        insightCount: output.key_insights.length
      };
    },
    { connection: analyticsIntelligenceQueue.opts.connection }
  );
}
