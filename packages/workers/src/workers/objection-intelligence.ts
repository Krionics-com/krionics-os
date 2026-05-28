import { Worker } from "bullmq";
import { z } from "zod";
import { createAIProvider } from "@krionics/ai-provider";
import { sql } from "../db.js";
import { objectionIntelligenceQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";
import { logAIInvocation, estimateCostMicro } from "../log-ai-invocation.js";
import { notifyEscalation } from "../notify-slack.js";

const ObjectionIntelligenceJobSchema = z.object({
  replyItemId: z.string().uuid(),
  classificationId: z.string().uuid(),
  clientId: z.string().uuid(),
  traceId: z.string().uuid().nullable().optional()
});

type ObjectionIntelligenceJob = z.infer<typeof ObjectionIntelligenceJobSchema>;

export function createObjectionIntelligenceWorker(): Worker<ObjectionIntelligenceJob> {
  const provider = createAIProvider();

  return new Worker(
    objectionIntelligenceQueue.name,
    async (job) => {
      const payload = ObjectionIntelligenceJobSchema.parse(job.data);
      const traceId = payload.traceId ?? crypto.randomUUID();

      const [classification] = await sql<{
        intent: string;
        objection_type: string | null;
        reasoning: string | null;
      }[]>`
        SELECT intent, objection_type, reasoning
        FROM reply_classifications
        WHERE id = ${payload.classificationId}::uuid
      `;

      if (!classification) {
        throw new Error(`Missing classification ${payload.classificationId}`);
      }

      if (classification.intent !== "OBJECTION") {
        return { status: "skipped", reason: "not_objection" };
      }

      const [rawReply] = await sql<{ body_text: string }[]>`
        SELECT rr.body_text
        FROM raw_replies rr
        JOIN reply_items ri ON ri.raw_reply_id = rr.id
        WHERE ri.id = ${payload.replyItemId}::uuid
      `;

      if (!rawReply) {
        throw new Error(`Missing raw_reply for reply_item ${payload.replyItemId}`);
      }

      // Fetch prior conversation history (last 6 exchanges)
      const history = await sql<{ body_text: string; direction: string }[]>`
        SELECT rr.body_text, 'prospect' AS direction
        FROM raw_replies rr
        JOIN reply_items ri ON ri.raw_reply_id = rr.id
        WHERE ri.client_id = ${payload.clientId}::uuid
          AND ri.id != ${payload.replyItemId}::uuid
        ORDER BY rr.received_at DESC
        LIMIT 6
      `;

      const [client] = await sql<{
        company_name: string;
        service_description: string | null;
      }[]>`
        SELECT company_name, service_description
        FROM clients
        WHERE id = ${payload.clientId}::uuid
      `;

      if (!client) throw new Error(`Missing client ${payload.clientId}`);

      const start = Date.now();
      let output: Awaited<ReturnType<typeof provider.analyzeObjection>>;
      try {
        output = await provider.analyzeObjection({
          reply_body: rawReply.body_text,
          objection_type: classification.objection_type,
          conversation_history: history.map((h) => ({
            role: h.direction as "sender" | "prospect",
            body: h.body_text
          })),
          client_context: {
            company_name: client.company_name,
            service_description: client.service_description ?? ""
          }
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const latencyMs = Date.now() - start;
        await logAIInvocation({
          clientId: payload.clientId, invocationType: "sentiment_analysis",
          traceId, entityType: "reply", entityId: payload.replyItemId,
          model: "claude-sonnet-4-20250514", latencyMs,
          success: false, errorCode: error.message.slice(0, 100)
        });
        throw error;
      }
      const latencyMs = Date.now() - start;

      await logAIInvocation({
        clientId: payload.clientId, invocationType: "sentiment_analysis",
        traceId, entityType: "reply", entityId: payload.replyItemId,
        model: "claude-sonnet-4-20250514", latencyMs,
        success: true, validatedOutput: output, validationPassed: true,
        costUsdMicro: estimateCostMicro("claude-sonnet-4-20250514", 800, 500)
      });

      // Write analysis back to reply_classifications
      await sql`
        UPDATE reply_classifications
        SET
          objection_type     = ${output.objection_category},
          reasoning          = COALESCE(reasoning, '') || E'\n\n[Objection Analysis]\n' ||
                               'Category: ' || ${output.objection_category} || E'\n' ||
                               'Approach: ' || ${output.recommended_approach},
          updated_at         = NOW()
        WHERE id = ${payload.classificationId}::uuid
      `;

      await emitEvent({
        clientId: payload.clientId,
        eventType: "objection_analyzed",
        metadata: {
          reply_item_id: payload.replyItemId,
          classification_id: payload.classificationId,
          objection_category: output.objection_category,
          severity: output.severity,
          escalate: output.escalate,
          escalation_reason: output.escalation_reason,
          duration_ms: latencyMs
        },
        traceId
      });

      if (output.escalate) {
        await sql`
          UPDATE reply_items
          SET status = 'ESCALATED'
          WHERE id = ${payload.replyItemId}::uuid
            AND status NOT IN ('SENT', 'REJECTED', 'SUPPRESSED')
        `;
        await notifyEscalation({
          clientId: payload.clientId,
          replyItemId: payload.replyItemId,
          objectionCategory: output.objection_category,
          escalationReason: output.escalation_reason
        });
      }

      return {
        status: "analyzed",
        objectionCategory: output.objection_category,
        severity: output.severity,
        escalated: output.escalate
      };
    },
    { connection: objectionIntelligenceQueue.opts.connection }
  );
}
