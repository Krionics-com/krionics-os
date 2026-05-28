import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { reviewDispatchQueue, scheduledSendQueue } from "../queues.js";
import { replyPriority, shouldAutoSend } from "../utils.js";
import { emitEvent } from "../emit-event.js";
import { calculateSendTime } from "../scheduling.js";

const ReviewDispatchSchema = z.object({
  replyItemId: z.string().uuid(),
  classificationId: z.string().uuid(),
  draftId: z.string().uuid().nullable(),
  traceId: z.string().uuid().nullable().optional()
});

type ReviewDispatchJob = z.infer<typeof ReviewDispatchSchema>;

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

export function createReviewDispatchWorker(): Worker<ReviewDispatchJob> {
  return new Worker(
    reviewDispatchQueue.name,
    async (job) => {
      const payload = ReviewDispatchSchema.parse(job.data);

      const [replyItem] = await sql<{
        id: string;
        client_id: string;
        raw_reply_id: string;
        lead_id: string;
      }[]>`
        SELECT id, client_id, raw_reply_id, lead_id
        FROM reply_items
        WHERE id = ${payload.replyItemId}
      `;

      if (!replyItem) {
        throw new Error(`Missing reply_item ${payload.replyItemId}`);
      }

      const [lead] = await sql<{ timezone: string | null }[]>`
        SELECT timezone FROM leads WHERE id = ${replyItem.lead_id}
      `;

      const [client] = await sql<{
        automation_level: number;
      }[]>`
        SELECT automation_level
        FROM clients
        WHERE id = ${replyItem.client_id}
      `;

      if (!client) {
        throw new Error(`Missing client ${replyItem.client_id}`);
      }

      const [classification] = await sql<{
        intent: string;
        confidence: number;
        requires_human: boolean;
      }[]>`
        SELECT intent, confidence, requires_human
        FROM reply_classifications
        WHERE id = ${payload.classificationId}
      `;

      if (!classification) {
        throw new Error(`Missing classification ${payload.classificationId}`);
      }

      const [rawReply] = await sql<{
        from_email: string;
        to_email: string | null;
      }[]>`
        SELECT from_email, to_email
        FROM raw_replies
        WHERE id = ${replyItem.raw_reply_id}
      `;

      if (!rawReply) {
        throw new Error(`Missing raw_reply ${replyItem.raw_reply_id}`);
      }

      if (!rawReply.to_email) {
        throw new Error(
          `Cannot schedule send: raw_reply ${replyItem.raw_reply_id} has no to_email (sending inbox unknown)`
        );
      }

      const config = await loadConfig([
        "classification.confidence.auto_route",
        "send.default_delay_minutes"
      ]);
      const autoRouteThreshold = Number(config["classification.confidence.auto_route"] ?? "0.85");
      const sendDelayMinutes = Number(config["send.default_delay_minutes"] ?? "15");

      const intent = classification.intent as "POSITIVE" | "OBJECTION" | "FAQ" | "BOOKING_INTENT" | "NURTURE" | "UNSUBSCRIBE" | "NOT_RELEVANT" | "UNKNOWN";
      const autoSend = payload.draftId
        ? shouldAutoSend(client.automation_level, intent, Number(classification.confidence), classification.requires_human, autoRouteThreshold)
        : false;

      if (!payload.draftId || !autoSend) {
        const [reviewItem] = await sql<{ id: string }[]>`
          INSERT INTO review_items (
            reply_item_id,
            draft_id,
            classification_id,
            client_id,
            priority,
            send_delay_minutes
          ) VALUES (
            ${payload.replyItemId},
            ${payload.draftId},
            ${payload.classificationId},
            ${replyItem.client_id},
            ${replyPriority(intent)},
            ${sendDelayMinutes}
          )
          RETURNING id
        `;

        await sql`
          UPDATE reply_items
          SET status = 'PENDING_REVIEW', review_item_id = ${reviewItem.id}
          WHERE id = ${payload.replyItemId}
        `;

        await emitEvent({
          clientId: replyItem.client_id,
          leadId: replyItem.lead_id,
          eventType: "review_queued",
          metadata: {
            reply_item_id: payload.replyItemId,
            review_item_id: reviewItem.id,
            draft_id: payload.draftId,
            classification_id: payload.classificationId
          },
          traceId: payload.traceId ?? null
        });

        return { status: "queued", reviewItemId: reviewItem.id };
      }

      const [draft] = await sql<{
        subject: string;
        body_text: string;
        body_html: string | null;
      }[]>`
        SELECT subject, body_text, body_html
        FROM reply_drafts
        WHERE id = ${payload.draftId}
      `;

      if (!draft) {
        throw new Error(`Missing draft ${payload.draftId}`);
      }

      const scheduledAt = await calculateSendTime(
        replyItem.client_id,
        classification.intent,
        lead?.timezone ?? null,
        sendDelayMinutes
      );

      const [scheduled] = await sql<{ id: string }[]>`
        INSERT INTO scheduled_sends (
          reply_item_id,
          draft_id,
          to_email,
          from_email,
          subject,
          body_text,
          body_html,
          scheduled_at
        ) VALUES (
          ${payload.replyItemId},
          ${payload.draftId},
          ${rawReply.from_email},
          ${rawReply.to_email ?? ""},
          ${draft.subject},
          ${draft.body_text},
          ${draft.body_html},
          ${scheduledAt.toISOString()}
        )
        RETURNING id
      `;

      await sql`
        UPDATE reply_items
        SET status = 'SCHEDULED', scheduled_send_id = ${scheduled.id}
        WHERE id = ${payload.replyItemId}
      `;

      await sql`
        UPDATE reply_drafts
        SET status = 'approved', approved_at = NOW(), reviewed_at = NOW()
        WHERE id = ${payload.draftId}
      `;

      await emitEvent({
        clientId: replyItem.client_id,
        leadId: replyItem.lead_id,
        eventType: "auto_send_queued",
        metadata: {
          reply_item_id: payload.replyItemId,
          scheduled_send_id: scheduled.id,
          draft_id: payload.draftId,
          classification_id: payload.classificationId,
          scheduled_at: scheduledAt.toISOString()
        },
        traceId: payload.traceId ?? null
      });

      await scheduledSendQueue.add("scheduled_send", {
        scheduledSendId: scheduled.id,
        replyItemId: payload.replyItemId,
        traceId: payload.traceId ?? null
      });

      return { status: "scheduled", scheduledSendId: scheduled.id };
    },
    { connection: reviewDispatchQueue.opts.connection }
  );
}
