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

  const [seq] = await sql<any[]>`SELECT status FROM generated_sequences WHERE id = ${id}`;
  if (!seq) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  if (seq.status === "pushed") return NextResponse.json({ error: "Cannot cancel an already-pushed sequence" }, { status: 409 });
  if (seq.status === "pushing") return NextResponse.json({ error: "Cannot cancel while pushing is in progress" }, { status: 409 });

  await sql`UPDATE generated_sequences SET status = 'failed', push_error = 'Cancelled by operator', updated_at = NOW() WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
