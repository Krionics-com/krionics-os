import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  if (q.trim().length < 2) {
    return NextResponse.json({
      clients: [],
      campaigns: [],
      leads: [],
      replies: []
    });
  }

  const searchPattern = `%${q}%`;

  try {
    // 1. Clients
    const clients = await sql<any[]>`
      SELECT id, slug, company_name, status
      FROM clients
      WHERE company_name ILIKE ${searchPattern}
      LIMIT 5
    `;

    // 2. Campaigns
    const campaigns = await sql<any[]>`
      SELECT c.id, c.name, c.status, cl.company_name AS client_name
      FROM campaigns c
      JOIN clients cl ON c.client_id = cl.id
      WHERE c.name ILIKE ${searchPattern}
      LIMIT 5
    `;

    // 3. Leads
    const leads = await sql<any[]>`
      SELECT l.id, l.first_name, l.last_name, l.email, cl.company_name AS company, l.campaign_id
      FROM leads l
      JOIN clients cl ON l.client_id = cl.id
      WHERE (l.first_name || ' ' || l.last_name) ILIKE ${searchPattern}
         OR l.email ILIKE ${searchPattern}
      LIMIT 5
    `;

    // 4. Replies
    const replies = await sql<any[]>`
      SELECT 
        r.id, 
        l.first_name, 
        l.last_name, 
        r.status, 
        rc.intent
      FROM reply_items r
      JOIN leads l ON r.lead_id = l.id
      LEFT JOIN reply_classifications rc ON r.classification_id = rc.id
      WHERE (l.first_name || ' ' || l.last_name) ILIKE ${searchPattern}
         OR l.email ILIKE ${searchPattern}
         OR r.status::TEXT ILIKE ${searchPattern}
         OR rc.intent::TEXT ILIKE ${searchPattern}
      LIMIT 5
    `;

    return NextResponse.json({
      clients,
      campaigns,
      leads,
      replies
    });
  } catch (err: any) {
    console.error("GET search error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
