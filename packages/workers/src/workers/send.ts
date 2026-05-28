import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { getEnv } from "../env.js";
import { scheduledSendQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";

const ScheduledSendJobSchema = z.object({
  scheduledSendId: z.string().uuid(),
  replyItemId: z.string().uuid(),
  traceId: z.string().uuid().nullable().optional()
});

type ScheduledSendJob = z.infer<typeof ScheduledSendJobSchema>;

const INSTANTLY_REPLY_URL = "https://api.instantly.ai/api/v2/emails/reply";

async function markFailure(
  scheduledSendId: string,
  replyItemId: string,
  error: Error
): Promise<number> {
  const [row] = await sql<{ attempt_count: number }[]>`
    UPDATE scheduled_sends
    SET attempt_count = attempt_count + 1,
        last_error = ${error.message}
    WHERE id = ${scheduledSendId}
    RETURNING attempt_count
  `;

  if (!row) {
    throw new Error(`Missing scheduled_send ${scheduledSendId}`);
  }

  if (row.attempt_count >= 5) {
    await sql`
      UPDATE scheduled_sends
      SET status = 'FAILED'
      WHERE id = ${scheduledSendId}
    `;
    await sql`
      UPDATE reply_items
      SET status = 'SEND_FAILED', resolved_at = NOW()
      WHERE id = ${replyItemId}
    `;
  }

  return row.attempt_count;
}

export function createScheduledSendWorker(): Worker<ScheduledSendJob> {
  const env = getEnv();
  const apiKey = env.instantlyApiKey;
  if (!apiKey) {
    throw new Error("Missing INSTANTLY_API_KEY");
  }

  return new Worker(
    scheduledSendQueue.name,
    async (job) => {
      const payload = ScheduledSendJobSchema.parse(job.data);

      const [scheduled] = await sql<{
        id: string;
        status: string;
        scheduled_at: string;
        subject: string;
        body_text: string;
        reply_item_id: string;
      }[]>`
        SELECT id, status, scheduled_at, subject, body_text, reply_item_id
        FROM scheduled_sends
        WHERE id = ${payload.scheduledSendId}
      `;

      if (!scheduled) {
        throw new Error(`Missing scheduled_send ${payload.scheduledSendId}`);
      }

      if (scheduled.status !== "PENDING") {
        return { status: "skipped", reason: "not_pending" };
      }

      if (new Date(scheduled.scheduled_at) > new Date()) {
        return { status: "skipped", reason: "not_due" };
      }

      const [rawReply] = await sql<{
        instantly_reply_id: string | null;
        client_id: string;
        lead_id: string;
      }[]>`
        SELECT rr.instantly_reply_id, ri.client_id, ri.lead_id
        FROM raw_replies rr
        JOIN reply_items ri ON ri.raw_reply_id = rr.id
        WHERE ri.id = ${payload.replyItemId}
      `;

      if (!rawReply?.instantly_reply_id) {
        throw new Error(`Missing instantly_reply_id for reply_item ${payload.replyItemId}`);
      }

      try {
        const response = await fetch(INSTANTLY_REPLY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            api_key: apiKey,
            reply_id: rawReply.instantly_reply_id,
            subject: scheduled.subject,
            body: scheduled.body_text
          })
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Instantly API error: ${response.status} ${text}`);
        }

        const data = (await response.json()) as { id?: string; message_id?: string };
        const messageId = data.id ?? data.message_id ?? null;

        await sql`
          UPDATE scheduled_sends
          SET status = 'SENT', sent_at = NOW(), instantly_message_id = ${messageId}
          WHERE id = ${payload.scheduledSendId}
        `;

        await sql`
          UPDATE reply_items
          SET status = 'SENT', resolved_at = NOW()
          WHERE id = ${payload.replyItemId}
        `;

        await emitEvent({
          clientId: rawReply.client_id,
          leadId: rawReply.lead_id,
          eventType: "auto_reply_sent",
          metadata: {
            reply_item_id: payload.replyItemId,
            scheduled_send_id: payload.scheduledSendId,
            instantly_message_id: messageId
          },
          traceId: payload.traceId ?? null
        });

        return { status: "sent", instantlyMessageId: messageId };
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown send error");
        const attemptCount = await markFailure(payload.scheduledSendId, payload.replyItemId, err);

        await emitEvent({
          clientId: rawReply.client_id,
          leadId: rawReply.lead_id,
          eventType: "send_failed",
          metadata: {
            reply_item_id: payload.replyItemId,
            scheduled_send_id: payload.scheduledSendId,
            attempt_count: attemptCount,
            error: err.message
          },
          traceId: payload.traceId ?? null
        });

        throw err;
      }
    },
    { connection: scheduledSendQueue.opts.connection }
  );
}
