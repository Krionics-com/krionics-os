import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { ingestQueue } from "@/lib/queues";

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

  // Validate required fields
  if (!payload.reply_id || !payload.from_email || !payload.body_text) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Enqueue to ingest queue without awaiting
  ingestQueue
    .add("ingest_reply", {
      reply_id: payload.reply_id,
      email_id: payload.email_id,
      campaign_id: payload.campaign_id,
      from_email: payload.from_email,
      from_name: payload.from_name,
      to_email: payload.to_email,
      subject: payload.subject,
      body_text: payload.body_text,
      body_html: payload.body_html,
      received_at: payload.received_at,
      headers: payload.headers,
      raw_payload: payload,
    })
    .catch((err) => {
      console.error(`Failed to enqueue reply ${payload.reply_id}:`, err);
    });

  return NextResponse.json({ status: "queued" }, { status: 202 });
}
