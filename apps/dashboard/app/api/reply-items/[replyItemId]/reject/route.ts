import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

const RejectSchema = z.object({
  rejection_reason: z.string().min(1)
});

export async function POST(
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

  const body = await req.json().catch(() => null);
  const parsed = RejectSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [replyItem] = await sql<{
    id: string;
    client_id: string;
    trace_id: string;
    draft_id: string | null;
  }[]>`
    SELECT id, client_id, trace_id, draft_id
    FROM reply_items
    WHERE id = ${replyItemId}
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
    await tx`
      UPDATE reply_drafts
      SET status = 'rejected', rejection_reason = ${parsed.data.rejection_reason}, reviewed_at = NOW()
      WHERE id = ${replyItem.draft_id}
    `;

    await tx`
      UPDATE reply_items
      SET status = 'REJECTED'
      WHERE id = ${replyItem.id}
    `;

    await tx`
      INSERT INTO audit_log (client_id, actor_type, actor_id, action, entity_type, entity_id, trace_id)
      VALUES (${replyItem.client_id}, 'operator', ${operator.sub}, 'REJECT_DRAFT', 'reply_item', ${replyItem.id}, ${replyItem.trace_id})
    `;
  });

  return NextResponse.json({ ok: true });
}
