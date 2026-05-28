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
  const skip = parseInt(searchParams.get("skip") ?? "0");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const conditions = [];

  if (operator.client_access && operator.client_access.length > 0) {
    conditions.push(sql`gs.client_id = ANY(${operator.client_access})`);
  }
  if (campaignId) conditions.push(sql`gs.campaign_id = ${campaignId}`);
  if (clientId) conditions.push(sql`gs.client_id = ${clientId}`);
  if (status) conditions.push(sql`gs.status = ${status}`);

  let where = sql`TRUE`;
  for (const c of conditions) where = sql`${where} AND ${c}`;

  try {
    const [{ count }] = await sql<{ count: number }[]>`SELECT COUNT(*)::int as count FROM generated_sequences gs WHERE ${where}`;

    const sequences = await sql<any[]>`
      SELECT
        gs.*,
        l.email as lead_email,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        l.company as lead_company,
        cl.company_name as client_name,
        ca.name as campaign_name
      FROM generated_sequences gs
      LEFT JOIN leads l ON l.id = gs.lead_id
      LEFT JOIN clients cl ON cl.id = gs.client_id
      LEFT JOIN campaigns ca ON ca.id = gs.campaign_id
      WHERE ${where}
      ORDER BY gs.created_at DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    return NextResponse.json({ sequences, total: count });
  } catch (err: any) {
    console.error("GET sequences error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
