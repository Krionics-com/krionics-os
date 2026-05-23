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
  const { reason } = body;

  if (!reason || typeof reason !== "string" || reason.trim() === "") {
    return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
  }

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
    // Update draft status
    await tx`
      UPDATE reply_drafts
      SET status = 'rejected', rejection_reason = ${reason}, reviewed_at = NOW(), operator_id = ${operator.sub}
      WHERE id = ${replyItem.draft_id}
    `;

    // Update item status
    await tx`
      UPDATE reply_items
      SET status = 'REJECTED'
      WHERE id = ${replyItem.id}
    `;

  });

  await recordAudit({
    operator_id: operator.sub,
    action: "rejected",
    resource_type: "reply",
    resource_id: replyItem.id,
    summary: `Rejected draft reply for reply item ${replyItem.id} (Reason: ${reason})`,
    before_value: { status: "PENDING_REVIEW" },
    after_value: { status: "REJECTED", reason }
  });

  return NextResponse.json({ success: true });
}
