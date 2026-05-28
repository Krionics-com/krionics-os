import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;

  const [seq] = await sql<any[]>`
    SELECT
      gs.*,
      l.email as lead_email,
      l.first_name as lead_first_name,
      l.last_name as lead_last_name,
      l.company as lead_company,
      l.title as lead_title,
      cl.company_name as client_name,
      ca.name as campaign_name
    FROM generated_sequences gs
    LEFT JOIN leads l ON l.id = gs.lead_id
    LEFT JOIN clients cl ON cl.id = gs.client_id
    LEFT JOIN campaigns ca ON ca.id = gs.campaign_id
    WHERE gs.id = ${id}
  `;

  if (!seq) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  return NextResponse.json({ sequence: seq });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [existing] = await sql<any[]>`SELECT status FROM generated_sequences WHERE id = ${id}`;
  if (!existing) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  if (existing.status === "pushing" || existing.status === "pushed") {
    return NextResponse.json({ error: "Cannot edit a sequence that has been pushed or is pushing" }, { status: 409 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!Array.isArray(body.emails)) return NextResponse.json({ error: "emails must be an array" }, { status: 400 });

  const [updated] = await sql<any[]>`
    UPDATE generated_sequences
    SET emails = ${JSON.stringify(body.emails)}::jsonb,
        strategy_notes = COALESCE(${body.strategy_notes ?? null}, strategy_notes),
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json({ sequence: updated });
}
