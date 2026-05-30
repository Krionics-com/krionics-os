import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let operator;
  try { operator = await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaign_id") ?? "";
  const clientId = searchParams.get("client_id") ?? "";
  const status = searchParams.get("status") ?? "";
  const reviewStatus = searchParams.get("review_status") ?? ""; // 'pending' | 'approved' | 'rejected'
  const suppressed = searchParams.get("suppressed") ?? "";
  const search = searchParams.get("search") ?? "";
  const skip = parseInt(searchParams.get("skip") ?? "0");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const conditions = [];

  if (operator.client_access && operator.client_access.length > 0) {
    conditions.push(sql`l.client_id = ANY(${operator.client_access})`);
  }
  if (campaignId) conditions.push(sql`l.campaign_id = ${campaignId}`);
  if (clientId) conditions.push(sql`l.client_id = ${clientId}`);
  if (status) conditions.push(sql`l.lead_status = ${status}`);
  if (reviewStatus) conditions.push(sql`l.review_status = ${reviewStatus}`);
  if (suppressed === "true") conditions.push(sql`l.is_suppressed = TRUE`);
  if (suppressed === "false") conditions.push(sql`l.is_suppressed = FALSE`);
  if (search) {
    const q = `%${search}%`;
    conditions.push(sql`(l.email ILIKE ${q} OR l.first_name ILIKE ${q} OR l.last_name ILIKE ${q} OR l.company ILIKE ${q})`);
  }

  let where = sql`TRUE`;
  for (const c of conditions) where = sql`${where} AND ${c}`;

  try {
    const [{ count }] = await sql<{ count: number }[]>`SELECT COUNT(*)::int as count FROM leads l WHERE ${where}`;

    const leads = await sql<any[]>`
      SELECT
        l.id, l.email, l.first_name, l.last_name, l.company, l.title,
        l.lead_status, l.is_suppressed, l.suppression_reason,
        l.lqs_score, l.source, l.crm_synced,
        l.last_contacted_at, l.replied_at, l.meeting_booked_at,
        l.review_status, l.enriched_data, l.lead_sequence,
        l.reviewed_at, l.review_notes,
        l.created_at, l.updated_at,
        cl.company_name as client_name,
        ca.name as campaign_name
      FROM leads l
      LEFT JOIN clients cl ON cl.id = l.client_id
      LEFT JOIN campaigns ca ON ca.id = l.campaign_id
      WHERE ${where}
      ORDER BY l.created_at DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    return NextResponse.json({ leads, total: count });
  } catch (err: any) {
    console.error("GET leads error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
