import { Worker } from "bullmq";
import { z } from "zod";
import { createAIProvider } from "@krionics/ai-provider";
import { DraftOutputSchema } from "@krionics/schema";
import { sql } from "../db.js";
import { draftQueue, reviewDispatchQueue } from "../queues.js";
import { getEnv } from "../env.js";

const DraftJobSchema = z.object({
  replyItemId: z.string().uuid(),
  classificationId: z.string().uuid(),
  traceId: z.string().uuid().nullable().optional()
});

type DraftJob = z.infer<typeof DraftJobSchema>;

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

export function createDraftWorker(): Worker<DraftJob> {
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
    draftQueue.name,
    async (job) => {
      const payload = DraftJobSchema.parse(job.data);

      await sql`
        UPDATE reply_items
        SET status = 'DRAFT_GENERATING'
        WHERE id = ${payload.replyItemId}
      `;

      const [replyItem] = await sql<{
        id: string;
        raw_reply_id: string;
        client_id: string;
        lead_id: string;
      }[]>`
        SELECT id, raw_reply_id, client_id, lead_id
        FROM reply_items
        WHERE id = ${payload.replyItemId}
      `;

      if (!replyItem) {
        throw new Error(`Missing reply_item ${payload.replyItemId}`);
      }

      const [rawReply] = await sql<{
        body_text: string;
        raw_payload: unknown;
      }[]>`
        SELECT body_text, raw_payload
        FROM raw_replies
        WHERE id = ${replyItem.raw_reply_id}
      `;

      if (!rawReply) {
        throw new Error(`Missing raw_reply ${replyItem.raw_reply_id}`);
      }

      const [classification] = await sql<{
        intent: string;
        reasoning: string | null;
      }[]>`
        SELECT intent, reasoning
        FROM reply_classifications
        WHERE id = ${payload.classificationId}
      `;

      if (!classification) {
        throw new Error(`Missing classification ${payload.classificationId}`);
      }

      const [client] = await sql<{
        company_name: string;
        sales_lead_name: string | null;
        service_description: string | null;
        calendly_link: string | null;
      }[]>`
        SELECT company_name, sales_lead_name, service_description, calendly_link
        FROM clients
        WHERE id = ${replyItem.client_id}
      `;

      if (!client) {
        throw new Error(`Missing client ${replyItem.client_id}`);
      }

      if (!client.calendly_link) {
        await sql`
          UPDATE reply_items
          SET status = 'PENDING_REVIEW'
          WHERE id = ${payload.replyItemId}
        `;

        await reviewDispatchQueue.add("review_dispatch", {
          replyItemId: payload.replyItemId,
          classificationId: payload.classificationId,
          draftId: null,
          traceId: payload.traceId ?? null
        });

        return { status: "queued_no_calendly" };
      }

      const config = await loadConfig(["draft.prompt_version", "review.sla_hours_default", "ai.default_model"]);
      const promptVersion = config["draft.prompt_version"] ?? "v1.0";
      const modelUsed = config["ai.default_model"] ?? env.anthropicModel;
      const slaHours = Number(config["review.sla_hours_default"] ?? "4");
      const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000);

      const start = Date.now();
      const output = await provider.generateDraft({
        reply_body: rawReply.body_text,
        original_body: (rawReply.raw_payload as { original_body?: string } | null)?.original_body ?? "[Original email not available]",
        intent: classification.intent as "POSITIVE" | "OBJECTION" | "FAQ" | "BOOKING_INTENT" | "NURTURE" | "UNSUBSCRIBE" | "NOT_RELEVANT" | "UNKNOWN",
        classification_reasoning: classification.reasoning ?? "",
        client_context: {
          company_name: client.company_name,
          sales_lead_name: client.sales_lead_name ?? "",
          service_description: client.service_description ?? "",
          calendly_link: client.calendly_link
        }
      });
      const durationMs = Date.now() - start;

      const validated = DraftOutputSchema.parse(output);

      const [draft] = await sql<{ id: string }[]>`
        INSERT INTO reply_drafts (
          reply_item_id,
          classification_id,
          client_id,
          lead_id,
          subject,
          body_text,
          model_used,
          prompt_version,
          raw_model_output,
          generation_ms,
          sla_deadline,
          trace_id
        ) VALUES (
          ${payload.replyItemId},
          ${payload.classificationId},
          ${replyItem.client_id},
          ${replyItem.lead_id},
          ${validated.subject},
          ${validated.body},
          ${modelUsed},
          ${promptVersion},
          ${validated},
          ${durationMs},
          ${slaDeadline.toISOString()},
          COALESCE(${payload.traceId ?? null}::uuid, gen_random_uuid())
        )
        RETURNING id
      `;

      await sql`
        UPDATE reply_items
        SET status = 'PENDING_REVIEW', draft_id = ${draft.id}
        WHERE id = ${payload.replyItemId}
      `;

      await reviewDispatchQueue.add("review_dispatch", {
        replyItemId: payload.replyItemId,
        classificationId: payload.classificationId,
        draftId: draft.id,
        traceId: payload.traceId ?? null
      });

      return { status: "drafted", draftId: draft.id };
    },
    { connection: draftQueue.opts.connection }
  );
}
