import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ replyItemId: string }> }
) {
  const { replyItemId } = await params;
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

  const [row] = await sql<{
    reply_item_id: string;
    raw_reply_id: string;
    client_id: string;
    lead_id: string;
    status: string;
    trace_id: string;
    created_at: string;
    classification_id: string | null;
    draft_id: string | null;
    intent: string | null;
    confidence: number | null;
    sentiment: string | null;
    urgency: string | null;
    key_signals: string[] | null;
    reasoning: string | null;
    draft_subject: string | null;
    draft_body_text: string | null;
    draft_body_html: string | null;
    draft_status: string | null;
    edited_body_text: string | null;
    edited_at: string | null;
    edited_by: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    from_email: string | null;
    reply_subject: string | null;
    reply_body_text: string | null;
    raw_payload: unknown;
    lead_email: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    company_name: string | null;
    service_description: string | null;
  }[]>`
    SELECT
      ri.id as reply_item_id,
      ri.raw_reply_id,
      ri.client_id,
      ri.lead_id,
      ri.status,
      ri.trace_id,
      ri.created_at,
      ri.classification_id,
      ri.draft_id,
      rc.intent,
      rc.confidence,
      rc.sentiment,
      rc.urgency,
      rc.key_signals,
      rc.reasoning,
      rd.subject as draft_subject,
      rd.body_text as draft_body_text,
      rd.body_html as draft_body_html,
      rd.status as draft_status,
      rd.edited_body_text,
      rd.edited_at,
      rd.edited_by,
      rd.approved_at,
      rd.rejection_reason,
      rr.from_email,
      rr.subject as reply_subject,
      rr.body_text as reply_body_text,
      rr.raw_payload,
      l.email as lead_email,
      l.first_name,
      l.last_name,
      l.company,
      c.company_name,
      c.service_description
    FROM reply_items ri
    LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
    LEFT JOIN reply_drafts rd ON rd.id = ri.draft_id
    LEFT JOIN raw_replies rr ON rr.id = ri.raw_reply_id
    LEFT JOIN leads l ON l.id = ri.lead_id
    LEFT JOIN clients c ON c.id = ri.client_id
    WHERE ri.id = ${replyItemId}
    LIMIT 1
  `;

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (operator.client_access && operator.client_access.length > 0) {
    if (!operator.client_access.includes(row.client_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const rawPayload = row.raw_payload ?? {};
  const originalBody = (rawPayload as { original_body?: string }).original_body ?? "[Original email not available]";

  return NextResponse.json({
    reply_item: {
      id: row.reply_item_id,
      raw_reply_id: row.raw_reply_id,
      client_id: row.client_id,
      lead_id: row.lead_id,
      status: row.status,
      trace_id: row.trace_id,
      created_at: row.created_at
    },
    classification: row.classification_id
      ? {
          id: row.classification_id,
          intent: row.intent,
          confidence: row.confidence !== null ? Number(row.confidence) : null,
          sentiment: row.sentiment,
          urgency: row.urgency,
          key_signals: row.key_signals ?? [],
          reasoning: row.reasoning
        }
      : null,
    draft: row.draft_id
      ? {
          id: row.draft_id,
          subject: row.draft_subject,
          body_text: row.draft_body_text,
          body_html: row.draft_body_html,
          status: row.draft_status,
          edited_body_text: row.edited_body_text,
          edited_at: row.edited_at,
          edited_by: row.edited_by,
          approved_at: row.approved_at,
          rejection_reason: row.rejection_reason
        }
      : null,
    raw_reply: {
      from_email: row.from_email,
      subject: row.reply_subject,
      body_text: row.reply_body_text,
      original_body: originalBody
    },
    lead: {
      email: row.lead_email,
      first_name: row.first_name,
      last_name: row.last_name,
      company: row.company
    },
    client: {
      company_name: row.company_name,
      service_description: row.service_description
    }
  });
}
