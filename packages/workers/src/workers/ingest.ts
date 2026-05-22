import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { classificationQueue, ingestQueue } from "../queues.js";
import { sha256 } from "../utils.js";

const InstantlyWebhookSchema = z.object({
  reply_id: z.string().min(1),
  email_id: z.string().optional(),
  campaign_id: z.string().min(1),
  from_email: z.string().email(),
  from_name: z.string().optional(),
  to_email: z.string().optional(),
  subject: z.string().optional(),
  body_text: z.string().min(1),
  body_html: z.string().optional(),
  received_at: z.string().datetime(),
  headers: z.record(z.string()).optional(),
  raw_payload: z.record(z.unknown()).optional(),
  trace_id: z.string().uuid().optional(),
  original_body: z.string().optional(),
  original_subject: z.string().optional()
});

type InstantlyWebhookJob = z.infer<typeof InstantlyWebhookSchema>;

export function createIngestWorker(): Worker<InstantlyWebhookJob> {
  return new Worker(
    ingestQueue.name,
    async (job) => {
      const payload = InstantlyWebhookSchema.parse(job.data);
      const idempotencyKey = sha256(payload.reply_id);

      const existing = await sql<{ entity_id: string }[]>`
        SELECT entity_id FROM idempotency_keys
        WHERE key = ${idempotencyKey} AND expires_at > NOW()
      `;

      if (existing.length > 0) {
        return { status: "duplicate", replyItemId: existing[0].entity_id };
      }

      const [campaign] = await sql<{ id: string; client_id: string }[]>`
        SELECT id, client_id FROM campaigns
        WHERE instantly_campaign_id = ${payload.campaign_id}
        LIMIT 1
      `;

      if (!campaign) {
        throw new Error(`Unknown Instantly campaign_id: ${payload.campaign_id}`);
      }

      const [lead] = await sql<{ id: string }[]>`
        SELECT id FROM leads
        WHERE campaign_id = ${campaign.id} AND email = ${payload.from_email}
        LIMIT 1
      `;

      if (!lead) {
        throw new Error(`Lead not found for ${payload.from_email} in campaign ${campaign.id}`);
      }

      const result = await sql.begin(async (tx) => {
        const [rawReply] = await tx<{ id: string }[]>`
          INSERT INTO raw_replies (
            idempotency_key,
            campaign_id,
            lead_id,
            instantly_reply_id,
            instantly_email_id,
            from_email,
            from_name,
            to_email,
            subject,
            body_text,
            body_html,
            headers,
            received_at,
            raw_payload
          ) VALUES (
            ${idempotencyKey},
            ${campaign.id},
            ${lead.id},
            ${payload.reply_id},
            ${payload.email_id ?? null},
            ${payload.from_email},
            ${payload.from_name ?? null},
            ${payload.to_email ?? null},
            ${payload.subject ?? null},
            ${payload.body_text},
            ${payload.body_html ?? null},
            ${payload.headers ?? {}},
            ${payload.received_at},
            ${payload.raw_payload ?? payload}
          )
          RETURNING id
        `;

        const [replyItem] = await tx<{ id: string; trace_id: string }[]>`
          INSERT INTO reply_items (
            raw_reply_id,
            campaign_id,
            lead_id,
            client_id,
            status,
            trace_id
          ) VALUES (
            ${rawReply.id},
            ${campaign.id},
            ${lead.id},
            ${campaign.client_id},
            'RECEIVED',
            COALESCE(${payload.trace_id ?? null}::uuid, gen_random_uuid())
          )
          RETURNING id, trace_id
        `;

        await tx`
          INSERT INTO idempotency_keys (key, entity_id, entity_type)
          VALUES (${idempotencyKey}, ${replyItem.id}, 'reply_item')
        `;

        return { rawReplyId: rawReply.id, replyItemId: replyItem.id, traceId: replyItem.trace_id };
      });

      await classificationQueue.add("classify_reply", {
        replyItemId: result.replyItemId,
        rawReplyId: result.rawReplyId,
        traceId: result.traceId,
        originalBody: payload.original_body ?? null,
        originalSubject: payload.original_subject ?? null
      });

      return { status: "ingested", replyItemId: result.replyItemId };
    },
    { connection: ingestQueue.opts.connection }
  );
}
