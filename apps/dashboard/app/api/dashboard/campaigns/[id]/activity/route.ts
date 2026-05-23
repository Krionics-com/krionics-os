import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const events = await sql<any[]>`
      SELECT 
        e.occurred_at as timestamp,
        e.event_type,
        e.inbox_email,
        e.subject,
        e.body_snippet,
        l.email as lead_email,
        NULL as reply_status,
        NULL as reply_intent
      FROM email_events e
      LEFT JOIN leads l ON l.id = e.lead_id
      WHERE e.campaign_id = ${id}
      
      UNION ALL
      
      SELECT 
        ri.created_at as timestamp,
        'reply_received' as event_type,
        NULL as inbox_email,
        NULL as subject,
        NULL as body_snippet,
        l.email as lead_email,
        ri.status::text as reply_status,
        rc.intent::text as reply_intent
      FROM reply_items ri
      LEFT JOIN leads l ON l.id = ri.lead_id
      LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
      WHERE ri.campaign_id = ${id}
      
      ORDER BY timestamp DESC
      LIMIT 20
    `;

    return NextResponse.json({ events });
  } catch (err: any) {
    console.error("GET campaign activity error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
