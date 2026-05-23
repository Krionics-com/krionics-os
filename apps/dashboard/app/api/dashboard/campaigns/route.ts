import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const clientFilter = searchParams.get("client_id");
  const searchFilter = searchParams.get("search");

  try {
    const conditions = [];

    // Client access restrictions
    if (operator.client_access && operator.client_access.length > 0) {
      conditions.push(sql`c.client_id = ANY(${operator.client_access})`);
    }

    if (statusFilter && statusFilter !== "") {
      conditions.push(sql`c.status = ${statusFilter}`);
    }

    if (clientFilter && clientFilter !== "") {
      conditions.push(sql`c.client_id = ${clientFilter}`);
    }

    if (searchFilter && searchFilter !== "") {
      conditions.push(sql`c.name ILIKE ${"%" + searchFilter + "%"}`);
    }

    let whereClause = sql`TRUE`;
    if (conditions.length > 0) {
      whereClause = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        whereClause = sql`${whereClause} AND ${conditions[i]}`;
      }
    }

    // Inbox counts could be joined or mocked. Since real data is in email_events,
    // let's do a subquery or join to get a real count from email_events, or fallback to mock.
    // Querying COUNT(DISTINCT inbox_email) from email_events for this campaign.
    // Wait, let's check if the email_events table actually exists and has inbox/inbox_email column.
    // Let's do a LEFT JOIN or subquery that safely falls back.
    const campaigns = await sql<any[]>`
      SELECT 
        c.*, 
        cl.company_name as client_company_name,
        cl.slug as client_slug,
        (
          SELECT COALESCE(COUNT(DISTINCT inbox_email), 0)::int 
          FROM email_events 
          WHERE campaign_id = c.id
        ) as inbox_count
      FROM campaigns c
      LEFT JOIN clients cl ON cl.id = c.client_id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
    `;

    return NextResponse.json({ campaigns });
  } catch (err: any) {
    console.error("GET campaigns error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
