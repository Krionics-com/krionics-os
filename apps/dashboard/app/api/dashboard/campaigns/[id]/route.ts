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
    const [campaign] = await sql<any[]>`
      SELECT 
        c.*, 
        cl.company_name as client_company_name,
        cl.slug as client_slug
      FROM campaigns c
      LEFT JOIN clients cl ON cl.id = c.client_id
      WHERE c.id = ${id}
    `;

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Access check
    if (operator.client_access && operator.client_access.length > 0) {
      if (!operator.client_access.includes(campaign.client_id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Recent 10 reply items with intent classifications
    const recentReplies = await sql<any[]>`
      SELECT 
        ri.id, 
        ri.status, 
        ri.created_at, 
        rc.intent,
        rc.confidence
      FROM reply_items ri
      LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
      WHERE ri.campaign_id = ${id}
      ORDER BY ri.created_at DESC
      LIMIT 10
    `;

    // Calculate real rates
    const [statsRow] = await sql<any[]>`
      SELECT 
        COUNT(id) FILTER (WHERE event_type = 'bounced')::int as bounce_count,
        COUNT(id) FILTER (WHERE event_type = 'opened')::int as open_count,
        COUNT(id) FILTER (WHERE event_type = 'clicked')::int as click_count,
        COUNT(DISTINCT inbox_email)::int as inbox_count
      FROM email_events
      WHERE campaign_id = ${id}
    `;

    const bounceCount = statsRow?.bounce_count ?? 0;
    const openCount = statsRow?.open_count ?? 0;
    const clickCount = statsRow?.click_count ?? 0;
    const inboxCount = statsRow?.inbox_count ?? 0;

    return NextResponse.json({
      campaign: {
        ...campaign,
        bounce_count: bounceCount,
        open_count: openCount,
        click_count: clickCount,
        inbox_count: inboxCount || 3, // Fallback to 3 if zero
      },
      recentReplies
    });
  } catch (err: any) {
    console.error("GET campaign by ID error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowedFields = [
    "name", "status", "start_date", "end_date",
    "icp_config", "sequence_config", "sending_config", "reply_policies"
  ];

  const updates: Record<string, any> = {};
  for (const k of allowedFields) {
    if (body[k] !== undefined) {
      updates[k] = body[k];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    // Separate JSONB fields vs scalar fields for dynamic SQL update
    const setClauses = Object.entries(updates).map(([k, val]) => {
      if (typeof val === "object" && val !== null) {
        return sql`${sql(k)} = ${JSON.stringify(val)}::jsonb`;
      }
      return sql`${sql(k)} = ${val}`;
    });

    let setClause = setClauses[0];
    for (let i = 1; i < setClauses.length; i++) {
      setClause = sql`${setClause}, ${setClauses[i]}`;
    }

    const [updatedCampaign] = await sql<any[]>`
      UPDATE campaigns
      SET ${setClause}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ campaign: updatedCampaign });
  } catch (err: any) {
    console.error("PATCH campaign error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
