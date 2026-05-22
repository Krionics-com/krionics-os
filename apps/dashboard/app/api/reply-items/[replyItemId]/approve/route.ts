import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

const ApproveSchema = z.object({
  edited_body_text: z.string().optional(),
  edited_subject: z.string().optional()
});

export async function POST(req: NextRequest, { params }: { params: { replyItemId: string } }) {
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
  const parsed = ApproveSchema.safeParse(body ?? {});
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
    WHERE id = ${params.replyItemId}
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

  const { edited_body_text, edited_subject } = parsed.data;

  await sql.begin(async (tx) => {
    if (edited_body_text || edited_subject) {
      await tx`
        UPDATE reply_drafts
        SET edited_body_text = COALESCE(${edited_body_text ?? null}, edited_body_text),
            subject = COALESCE(${edited_subject ?? null}, subject),
            edited_at = NOW(),
            edited_by = ${operator.sub}
        WHERE id = ${replyItem.draft_id}
      `;
    }

    await tx`
      UPDATE reply_drafts
      SET status = 'approved', approved_at = NOW(), operator_id = ${operator.sub}, reviewed_at = NOW()
      WHERE id = ${replyItem.draft_id}
    `;

    await tx`
      UPDATE reply_items
      SET status = 'APPROVED'
      WHERE id = ${replyItem.id}
    `;

    await tx`
      INSERT INTO audit_log (client_id, actor_type, actor_id, action, entity_type, entity_id, trace_id)
      VALUES (${replyItem.client_id}, 'operator', ${operator.sub}, 'APPROVE_DRAFT', 'reply_item', ${replyItem.id}, ${replyItem.trace_id})
    `;
  });

  return NextResponse.json({ ok: true });
}
