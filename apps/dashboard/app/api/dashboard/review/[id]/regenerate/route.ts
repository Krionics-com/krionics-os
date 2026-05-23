import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

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

  const [replyItem] = await sql<{
    id: string;
    client_id: string;
    trace_id: string;
  }[]>`
    SELECT id, client_id, trace_id
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

  // Reset status to PENDING_REVIEW
  await sql`
    UPDATE reply_items
    SET status = 'PENDING_REVIEW', updated_at = NOW()
    WHERE id = ${id}
  `;

  // Audit log
  await sql`
    INSERT INTO audit_log (client_id, actor_type, actor_id, action, entity_type, entity_id, trace_id)
    VALUES (${replyItem.client_id}, 'operator', ${operator.sub}, 'REGENERATE_DRAFT', 'reply_item', ${replyItem.id}, ${replyItem.trace_id})
  `;

  return NextResponse.json({ success: true, message: "Regeneration queued" });
}
