import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const reason = body.reason ?? "Manual suppression by operator";

  const [lead] = await sql<any[]>`
    UPDATE leads
    SET is_suppressed = TRUE, suppression_reason = ${reason}, suppressed_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, email, is_suppressed
  `;

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead });
}
