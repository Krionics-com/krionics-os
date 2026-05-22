import { Worker } from "bullmq";
import { z } from "zod";
import { createAIProvider } from "@krionics/ai-provider";
import { ClassificationOutputSchema } from "@krionics/schema";
import { sql } from "../db.js";
import { classificationQueue, draftQueue, reviewDispatchQueue } from "../queues.js";
import { getEnv } from "../env.js";
import { sentimentFromScore, urgencyFromScore } from "../utils.js";

const ClassificationJobSchema = z.object({
  replyItemId: z.string().uuid(),
  rawReplyId: z.string().uuid(),
  traceId: z.string().uuid().optional(),
  originalBody: z.string().nullable().optional(),
  originalSubject: z.string().nullable().optional()
});

type ClassificationJob = z.infer<typeof ClassificationJobSchema>;

type ConfigRow = { key: string; value: unknown };

async function loadConfig(keys: string[]): Promise<Record<string, string>> {
  const rows = await sql<ConfigRow[]>`
    SELECT key, value FROM config
    WHERE key = ANY(${keys})
  `;

  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
    return acc;
  }, {});
}

export function createClassifyWorker(): Worker<ClassificationJob> {
  const env = getEnv();
  const provider = createAIProvider({
    provider: env.aiProvider,
    anthropicApiKey: env.anthropicApiKey,
    anthropicModel: env.anthropicModel,
    openaiApiKey: env.openaiApiKey,
    openaiBaseUrl: env.openaiBaseUrl,
    openaiModel: env.openaiModel
  });

  return new Worker(
    classificationQueue.name,
    async (job) => {
      const payload = ClassificationJobSchema.parse(job.data);

      await sql`
        UPDATE reply_items
        SET status = 'CLASSIFYING'
        WHERE id = ${payload.replyItemId}
      `;

      const [rawReply] = await sql<{
        id: string;
        from_email: string;
        subject: string | null;
        body_text: string;
        raw_payload: unknown;
      }[]>`
        SELECT id, from_email, subject, body_text, raw_payload
        FROM raw_replies
        WHERE id = ${payload.rawReplyId}
      `;

      if (!rawReply) {
        throw new Error(`Missing raw_reply ${payload.rawReplyId}`);
      }

      const [replyItem] = await sql<{ client_id: string }[]>`
        SELECT client_id
        FROM reply_items
        WHERE id = ${payload.replyItemId}
      `;

      if (!replyItem) {
        throw new Error(`Missing reply_item ${payload.replyItemId}`);
      }

      const [client] = await sql<{
        company_name: string;
        service_description: string | null;
        icp_description: string | null;
        sales_lead_name: string | null;
        calendly_link: string | null;
        automation_level: number;
      }[]>`
        SELECT company_name, service_description, icp_description, sales_lead_name, calendly_link, automation_level
        FROM clients
        WHERE id = ${replyItem.client_id}
      `;

      if (!client) {
        throw new Error(`Missing client ${replyItem.client_id}`);
      }

      const config = await loadConfig([
        "classification.confidence.auto_route",
        "classification.confidence.soft_route",
        "classification.prompt_version",
        "ai.default_model"
      ]);

      const autoRouteThreshold = Number(config["classification.confidence.auto_route"] ?? "0.85");
      const softRouteThreshold = Number(config["classification.confidence.soft_route"] ?? "0.65");
      const promptVersion = config["classification.prompt_version"] ?? "v1.0";
      const modelUsed = config["ai.default_model"] ?? env.anthropicModel;

      const originalBody = payload.originalBody ?? (rawReply.raw_payload as { original_body?: string } | null)?.original_body ?? rawReply.body_text;
      const originalSubject = payload.originalSubject ?? rawReply.subject;

      const start = Date.now();
      const output = await provider.classify({
        reply_body: rawReply.body_text,
        original_body: originalBody,
        original_subject: originalSubject ?? null,
        from_email: rawReply.from_email,
        client_context: {
          company_name: client.company_name,
          service_description: client.service_description ?? "",
          icp_description: client.icp_description ?? ""
        }
      });
      const durationMs = Date.now() - start;

      const validated = ClassificationOutputSchema.parse(output);
      const confidence = Number(validated.confidence.toFixed(3));
      const sentiment = sentimentFromScore(validated.sentiment_score);
      const urgency = urgencyFromScore(validated.urgency_score);
      const keySignals = validated.buying_signals.slice(0, 5);

      const requiresDraft = ["POSITIVE", "OBJECTION", "FAQ", "BOOKING_INTENT"].includes(validated.intent);
      const requiresHuman = confidence < autoRouteThreshold;
      const routingDecision = confidence >= autoRouteThreshold
        ? "auto-route"
        : confidence >= softRouteThreshold
          ? "soft-route"
          : "human-route";

      const [classification] = await sql<{ id: string }[]>`
        INSERT INTO reply_classifications (
          reply_item_id,
          intent,
          confidence,
          sentiment,
          urgency,
          key_signals,
          objection_type,
          faq_topic,
          reasoning,
          requires_draft,
          requires_human,
          routing_decision,
          model_used,
          prompt_version,
          raw_model_output,
          classification_ms
        ) VALUES (
          ${payload.replyItemId},
          ${validated.intent},
          ${confidence},
          ${sentiment},
          ${urgency},
          ${keySignals},
          ${validated.objection_type},
          NULL,
          ${validated.reasoning},
          ${requiresDraft},
          ${requiresHuman},
          ${routingDecision},
          ${modelUsed},
          ${promptVersion},
          ${validated},
          ${durationMs}
        )
        RETURNING id
      `;

      await sql`
        UPDATE reply_items
        SET status = 'CLASSIFIED', classification_id = ${classification.id}
        WHERE id = ${payload.replyItemId}
      `;

      if (validated.intent === "UNSUBSCRIBE") {
        await sql`
          INSERT INTO suppression_list (email, client_id, reason, reply_item_id, suppressed_by)
          VALUES (${rawReply.from_email}, ${replyItem.client_id}, 'UNSUBSCRIBE', ${payload.replyItemId}, 'system')
          ON CONFLICT (email) DO NOTHING
        `;
        await sql`
          UPDATE reply_items
          SET status = 'SUPPRESSED', resolved_at = NOW()
          WHERE id = ${payload.replyItemId}
        `;
        return { status: "suppressed" };
      }

      if (validated.intent === "NOT_RELEVANT") {
        await sql`
          UPDATE reply_items
          SET status = 'DISMISSED', resolved_at = NOW()
          WHERE id = ${payload.replyItemId}
        `;
        return { status: "dismissed" };
      }

      if (validated.intent === "NURTURE") {
        await sql`
          UPDATE reply_items
          SET status = 'NURTURE_ENROLLED', resolved_at = NOW()
          WHERE id = ${payload.replyItemId}
        `;
        return { status: "nurture" };
      }

      if (validated.intent === "BOUNCE_OOO") {
        await sql`
          UPDATE reply_items
          SET status = 'DISMISSED', resolved_at = NOW()
          WHERE id = ${payload.replyItemId}
        `;
        await sql`
          UPDATE leads
          SET lead_status = 'ooo'
          WHERE id = (SELECT lead_id FROM reply_items WHERE id = ${payload.replyItemId})
        `;
        return { status: "dismissed_ooo" };
      }

      if (validated.intent === "HOSTILE") {
        await sql`
          INSERT INTO suppression_list (email, client_id, reason, reply_item_id, suppressed_by)
          VALUES (${rawReply.from_email}, ${replyItem.client_id}, 'HOSTILE', ${payload.replyItemId}, 'system')
          ON CONFLICT (email) DO NOTHING
        `;
        await sql`
          UPDATE reply_items
          SET status = 'SUPPRESSED', resolved_at = NOW()
          WHERE id = ${payload.replyItemId}
        `;
        return { status: "suppressed_hostile" };
      }

      if (requiresDraft) {
        await draftQueue.add("generate_draft", {
          replyItemId: payload.replyItemId,
          classificationId: classification.id,
          traceId: payload.traceId ?? null
        });
      } else {
        await reviewDispatchQueue.add("review_dispatch", {
          replyItemId: payload.replyItemId,
          classificationId: classification.id,
          draftId: null,
          traceId: payload.traceId ?? null
        });
      }

      return { status: "classified", classificationId: classification.id };
    },
    { connection: classificationQueue.opts.connection }
  );
}
