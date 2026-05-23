import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await sql<any[]>`
    SELECT
      ri.id as reply_item_id,
      ri.status,
      ri.created_at,
      ri.sla_expires_at,
      ri.client_id,
      ri.lead_id,
      rr.from_email,
      rr.to_email,
      rr.subject as reply_subject,
      rr.body_text as reply_body_text,
      rr.received_at,
      rr.raw_payload,
      l.email as lead_email,
      l.first_name,
      l.last_name,
      l.company,
      l.title,
      l.linkedin_url,
      camp.name as campaign_name,
      c.company_name as client_name,
      rc.intent,
      rc.confidence,
      rc.reasoning,
      rc.sentiment,
      rc.urgency,
      rc.key_signals,
      rc.objection_type,
      rc.faq_topic,
      rd.id as draft_id,
      rd.subject as draft_subject,
      rd.body_text as draft_body_text
    FROM reply_items ri
    LEFT JOIN raw_replies rr ON rr.id = ri.raw_reply_id
    LEFT JOIN leads l ON l.id = ri.lead_id
    LEFT JOIN campaigns camp ON camp.id = ri.campaign_id
    LEFT JOIN clients c ON c.id = ri.client_id
    LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
    LEFT JOIN reply_drafts rd ON rd.id = ri.draft_id
    WHERE ri.id = ${id}
    LIMIT 1
  `;

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check access permissions
  if (operator.client_access && operator.client_access.length > 0) {
    if (!operator.client_access.includes(row.client_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Extract original outbound body from raw_payload if available
  const rawPayload = row.raw_payload ?? {};
  const originalBody = (rawPayload as { original_body?: string }).original_body ?? "Hi there,\n\nI noticed you have been scaling your team. Would you be open to a quick call?";

  const receivedDate = new Date(row.received_at || row.created_at);
  const outboundDate = new Date(receivedDate.getTime() - 24 * 60 * 60 * 1000); // 1 day earlier

  const thread = [
    {
      from: row.to_email || "alex@techflow.io",
      to: row.lead_email,
      subject: (row.reply_subject ?? "").replace(/^Re:\s*/i, ""),
      body_text: originalBody,
      received_at: outboundDate.toISOString()
    },
    {
      from: row.lead_email,
      to: row.to_email || "alex@techflow.io",
      subject: row.reply_subject ?? "Re: Quick question",
      body_text: row.reply_body_text,
      received_at: receivedDate.toISOString()
    }
  ];

  return NextResponse.json({
    reply_item: {
      id: row.reply_item_id,
      status: row.status,
      created_at: row.created_at,
      sla_expires_at: row.sla_expires_at
    },
    thread,
    lead: {
      email: row.lead_email,
      name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.lead_email,
      company: row.company || "Unknown",
      title: row.title || "",
      linkedin_url: row.linkedin_url || null
    },
    campaign: {
      name: row.campaign_name,
      client_name: row.client_name
    },
    classification: {
      intent: row.intent,
      confidence: row.confidence ? Math.round(Number(row.confidence) * 100) : 0,
      reasoning: row.reasoning || "",
      sentiment: row.sentiment || "NEUTRAL",
      urgency: row.urgency || "MEDIUM",
      key_signals: row.key_signals ?? [],
      objection_type: row.objection_type || null,
      faq_topic: row.faq_topic || null
    },
    draft: row.draft_id
      ? {
          id: row.draft_id,
          subject: row.draft_subject,
          body_text: row.draft_body_text
        }
      : null
  });
}
