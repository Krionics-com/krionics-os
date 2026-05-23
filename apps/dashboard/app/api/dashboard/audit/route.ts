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
  const operatorId = searchParams.get("operatorId") || "";
  const action = searchParams.get("action") || "";
  const resourceType = searchParams.get("resourceType") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  try {
    // We dynamically build or run a robust fetch and filter
    const dbLogs = await sql<any[]>`
      SELECT 
        a.id,
        a.operator_id,
        a.action,
        a.resource_type,
        a.resource_id,
        a.summary,
        a.before_value,
        a.after_value,
        a.created_at,
        op.name as operator_name,
        op.email as operator_email
      FROM audit_logs a
      LEFT JOIN operators op ON op.id = a.operator_id
      ORDER BY a.created_at DESC
    `;

    // Perform highly flexible in-memory search and filter to ensure 100% database compatibility and query safety
    let filtered = [...dbLogs];

    if (operatorId) {
      filtered = filtered.filter((x) => x.operator_id === operatorId);
    }
    if (action) {
      filtered = filtered.filter((x) => x.action.toLowerCase() === action.toLowerCase());
    }
    if (resourceType) {
      filtered = filtered.filter((x) => x.resource_type.toLowerCase() === resourceType.toLowerCase());
    }
    if (dateFrom) {
      const fromTime = new Date(dateFrom).getTime();
      filtered = filtered.filter((x) => new Date(x.created_at).getTime() >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(dateTo).getTime() + 86400000; // include end date
      filtered = filtered.filter((x) => new Date(x.created_at).getTime() <= toTime);
    }
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (x) =>
          x.summary.toLowerCase().includes(query) ||
          (x.operator_name && x.operator_name.toLowerCase().includes(query)) ||
          (x.operator_email && x.operator_email.toLowerCase().includes(query)) ||
          (x.resource_id && x.resource_id.toLowerCase().includes(query))
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      logs: paginated,
      total,
      page,
      limit
    });
  } catch (err: any) {
    console.error("GET audit logs error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
