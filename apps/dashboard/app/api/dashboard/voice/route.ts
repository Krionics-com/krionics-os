import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const sentiment = searchParams.get("sentiment") || "";
  const clientId = searchParams.get("clientId") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";

  try {
    const calls = await sql<any[]>`
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
      ORDER BY v.started_at DESC
    `;

    // High performance in-memory filter to ensure perfect database engine compatibility
    let filtered = [...calls];

    if (status) {
      filtered = filtered.filter((x) => x.status === status);
    }
    if (sentiment) {
      filtered = filtered.filter((x) => x.sentiment === sentiment);
    }
    if (clientId) {
      filtered = filtered.filter((x) => x.client_id === clientId);
    }
    if (dateFrom) {
      const fromTime = new Date(dateFrom).getTime();
      filtered = filtered.filter((x) => new Date(x.started_at).getTime() >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(dateTo).getTime() + 86400000;
      filtered = filtered.filter((x) => new Date(x.started_at).getTime() <= toTime);
    }

    return NextResponse.json({ calls: filtered });
  } catch (err: any) {
    console.error("GET voice calls error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
