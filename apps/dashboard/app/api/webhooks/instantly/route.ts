import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

function verifyInstantlySignature(req: NextRequest, payload: string): boolean {
  const signature = req.headers.get("x-instantly-signature");
  const webhookSecret = process.env.INSTANTLY_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) return false;

  const hash = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  return hash === signature;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyInstantlySignature(req, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const traceId = uuidv4();

  const {
    type,
    thread_id,
    from_email,
    from_name,
    subject,
    body,
    received_at,
    campaign_id,
    email_number,
  } = payload;

  if (type !== "reply" || !thread_id || !from_email || !body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Start async processing without awaiting
  processReplyAsync(
    {
      thread_id,
      from_email,
      from_name,
      subject: subject || "(no subject)",
      body,
      received_at: new Date(received_at),
      campaign_id,
      email_number: email_number || 0,
      instantly_payload: payload,
    },
    traceId
  ).catch((err) => {
    console.error(`Failed to process reply ${thread_id}:`, err);
  });

  return NextResponse.json({ status: "queued" }, { status: 202 });
}

async function processReplyAsync(
  replyData: any,
  traceId: string
): Promise<void> {
  try {
    // Find lead by thread_id
    const [lead] = await sql<{
      id: string;
      client_id: string;
      lead_status: string;
      assigned_to_operator_id: string;
    }[]>`
      SELECT id, client_id, lead_status, assigned_to_operator_id
      FROM leads
      WHERE thread_id = ${replyData.thread_id}
      LIMIT 1
    `;

    if (!lead) {
      console.warn(`No lead found for thread ${replyData.thread_id}`);
      return;
    }

    const { id: lead_id, client_id } = lead;

    // Store raw reply
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(replyData.instantly_payload.id || replyData.thread_id)
      .digest("hex");

    const [reply] = await sql<{ id: string }[]>`
      INSERT INTO raw_replies (
        idempotency_key,
        campaign_id,
        lead_id,
        client_id,
        thread_id,
        instantly_reply_id,
        from_email,
        from_name,
        subject,
        body_text,
        received_at,
        email_sequence_number,
        last_sent_subject,
        last_sent_at,
        classification_status,
        raw_payload
      ) VALUES (
        ${idempotencyKey},
        ${replyData.campaign_id},
        ${lead_id},
        ${client_id},
        ${replyData.thread_id},
        ${replyData.instantly_payload.id || uuidv4()},
        ${replyData.from_email},
        ${replyData.from_name},
        ${replyData.subject},
        ${replyData.body},
        ${replyData.received_at},
        ${replyData.email_number},
        ${replyData.instantly_payload.last_sent_subject},
        ${replyData.instantly_payload.last_sent_at},
        'pending',
        ${JSON.stringify(replyData.instantly_payload)}
      )
      ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `;

    if (!reply) {
      console.error(`Failed to store raw reply for thread ${replyData.thread_id}`);
      return;
    }

    const reply_id = reply.id;

    // Update lead status to reply_received
    await sql`
      UPDATE leads
      SET lead_status = 'reply_received',
          prev_status = lead_status,
          status_updated_at = NOW(),
          first_reply_at = COALESCE(first_reply_at, NOW()),
          updated_at = NOW()
      WHERE id = ${lead_id}
    `;

    // Emit reply_received event
    await sql`
      INSERT INTO events (
        client_id,
        lead_id,
        campaign_id,
        event_type,
        created_by,
        metadata,
        trace_id,
        event_timestamp
      ) VALUES (
        ${client_id},
        ${lead_id},
        ${replyData.campaign_id},
        'reply_received',
        'system',
        ${JSON.stringify({
          reply_id,
          thread_id: replyData.thread_id,
          sender_email: replyData.from_email,
          subject: replyData.subject,
        })},
        ${traceId},
        NOW()
      )
    `;

    // Record state transition
    await sql`
      INSERT INTO lead_state_history (
        lead_id,
        client_id,
        from_state,
        to_state,
        transition_reason,
        triggered_by,
        transitioned_at
      ) VALUES (
        ${lead_id},
        ${client_id},
        'sending_active',
        'reply_received',
        'reply_received_from_instantly',
        'system',
        NOW()
      )
    `;

    // Enqueue for classification
    // TODO: Integrate with BullMQ queue
    console.log(`Enqueued reply ${reply_id} for classification with trace ${traceId}`);
  } catch (error) {
    console.error("Error processing reply:", error);
    throw error;
  }
}
