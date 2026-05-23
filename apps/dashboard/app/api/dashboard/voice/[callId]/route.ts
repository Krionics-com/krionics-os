import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await params;

  try {
    const [call] = await sql<any[]>`
      SELECT 
        v.id,
        v.lead_id,
        v.client_id,
        v.reply_item_id,
        v.duration_seconds,
        v.status,
        v.sentiment,
        v.meeting_booked,
        v.escalation_note,
        v.summary,
        v.transcript,
        v.started_at,
        v.ended_at,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        l.email as lead_email,
        c.company_name as client_company_name
      FROM voice_calls v
      LEFT JOIN leads l ON l.id = v.lead_id
      LEFT JOIN clients c ON c.id = v.client_id
      WHERE v.id = ${callId}
    `;

    if (!call) {
      return NextResponse.json({ error: "Voice call not found" }, { status: 404 });
    }

    return NextResponse.json({ call });
  } catch (err: any) {
    console.error("GET voice call detail error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
