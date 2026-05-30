import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;
  const body = await req.json().catch(() => ({}));
  const notes = body.notes ?? null;

  const [lead] = await sql<{ id: string; client_id: string; review_status: string }[]>`
    SELECT id, client_id, review_status FROM leads WHERE id = ${leadId}::uuid
  `;
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (operator.client_access?.length && !operator.client_access.includes(lead.client_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await sql`
    UPDATE leads
    SET review_status = 'rejected',
        review_notes = ${notes},
        reviewed_by = ${operator.id}::uuid,
        reviewed_at = NOW(),
        lead_status = 'suppressed'
    WHERE id = ${leadId}::uuid
  `;

  return NextResponse.json({ ok: true });
}
