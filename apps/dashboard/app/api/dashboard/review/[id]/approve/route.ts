import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST(
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

  const body = await req.json().catch(() => ({}));
  const { subject, body_text } = body;

  const [replyItem] = await sql<{
    id: string;
    client_id: string;
    trace_id: string;
    draft_id: string | null;
  }[]>`
    SELECT id, client_id, trace_id, draft_id
    FROM reply_items
    WHERE id = ${id}
  `;

  if (!replyItem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (operator.client_access && operator.client_access.length > 0) {
    if (!operator.client_access.includes(replyItem.client_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!replyItem.draft_id) {
    return NextResponse.json({ error: "Missing draft" }, { status: 400 });
  }

  await sql.begin(async (tx) => {
    // If the operator edited the draft, save the edits
    if (body_text || subject) {
      await tx`
        UPDATE reply_drafts
        SET edited_body_text = COALESCE(${body_text ?? null}, edited_body_text),
            subject = COALESCE(${subject ?? null}, subject),
            edited_at = NOW(),
            edited_by = ${operator.sub}
        WHERE id = ${replyItem.draft_id}
      `;
    }

    // Set status to approved
    await tx`
      UPDATE reply_drafts
      SET status = 'approved', approved_at = NOW(), operator_id = ${operator.sub}, reviewed_at = NOW()
      WHERE id = ${replyItem.draft_id}
    `;

    // Set status of reply item to APPROVED
    await tx`
      UPDATE reply_items
      SET status = 'APPROVED'
      WHERE id = ${replyItem.id}
    `;

  });

  await recordAudit({
    operator_id: operator.sub,
    action: "approved",
    resource_type: "reply",
    resource_id: replyItem.id,
    summary: `Approved draft reply for reply item ${replyItem.id}`,
    before_value: { status: "PENDING_REVIEW" },
    after_value: { status: "APPROVED", subject, body_text }
  });

  return NextResponse.json({ success: true });
}
