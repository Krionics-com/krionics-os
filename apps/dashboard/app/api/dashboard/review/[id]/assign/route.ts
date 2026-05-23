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
  const { operator_id } = body;

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

  // Update assigned operator
  let targetOperatorId = operator_id;
  if (operator_id === "admin") {
    const [adminOp] = await sql<{ id: string }[]>`
      SELECT id FROM operators WHERE role = 'admin' AND is_active = TRUE LIMIT 1
    `;
    if (adminOp) {
      targetOperatorId = adminOp.id;
    } else {
      // Fallback to first operator if no admin
      const [firstOp] = await sql<{ id: string }[]>`
        SELECT id FROM operators WHERE is_active = TRUE LIMIT 1
      `;
      targetOperatorId = firstOp?.id || null;
    }
  }

  await sql`
    UPDATE reply_items
    SET assigned_to_operator_id = ${targetOperatorId ? targetOperatorId : null}, updated_at = NOW()
    WHERE id = ${id}
  `;

  await recordAudit({
    operator_id: operator.sub,
    action: "assigned",
    resource_type: "reply",
    resource_id: replyItem.id,
    summary: `Assigned reply item ${replyItem.id} to operator ${targetOperatorId ?? "unassigned"}`,
    before_value: {},
    after_value: { assigned_to_operator_id: targetOperatorId }
  });

  return NextResponse.json({ success: true });
}
