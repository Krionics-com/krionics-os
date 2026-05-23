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
  const typeFilter = searchParams.get("type");
  const statusFilter = searchParams.get("status");
  const rangeFilter = searchParams.get("range"); // today, 7d, 30d
  
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];

    if (typeFilter && typeFilter !== "") {
      conditions.push(sql`invocation_type = ${typeFilter}`);
    }

    if (statusFilter && statusFilter !== "") {
      if (statusFilter === "success") {
        conditions.push(sql`success = true`);
      } else if (statusFilter === "failure") {
        conditions.push(sql`success = false`);
      }
    }

    if (rangeFilter === "today") {
      conditions.push(sql`invoked_at >= DATE_TRUNC('day', NOW())`);
    } else if (rangeFilter === "7d") {
      conditions.push(sql`invoked_at >= NOW() - INTERVAL '7 days'`);
    } else if (rangeFilter === "30d") {
      conditions.push(sql`invoked_at >= NOW() - INTERVAL '30 days'`);
    }

    let whereClause = sql`TRUE`;
    if (conditions.length > 0) {
      whereClause = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        whereClause = sql`${whereClause} AND ${conditions[i]}`;
      }
    }

    const logs = await sql<any[]>`
      SELECT 
        id,
        invoked_at as created_at,
        invocation_type,
        latency_ms,
        input_tokens,
        output_tokens,
        (cost_usd_micro::double precision / 1000000.0) as cost_usd,
        CASE WHEN success = true THEN 'success' ELSE 'failure' END as status,
        error_code as error_message,
        entity_id as reply_item_id
      FROM ai_invocations
      WHERE ${whereClause}
      ORDER BY invoked_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ count }] = await sql<any[]>`
      SELECT COUNT(*)::int as count
      FROM ai_invocations
      WHERE ${whereClause}
    `;

    return NextResponse.json({
      logs,
      page,
      totalPages: Math.ceil(count / limit) || 1,
      totalCount: count
    });
  } catch (err: any) {
    console.error("GET AI logs error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
