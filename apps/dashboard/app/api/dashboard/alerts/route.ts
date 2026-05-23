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
  const severity = searchParams.get("severity") || "";
  const type = searchParams.get("type") || "";

  try {
    // Select all alerts joined with clients
    const dbAlerts = await sql<any[]>`
      SELECT 
        a.id,
        a.type,
        a.severity,
        a.client_id,
        a.title,
        a.description,
        a.status,
        a.created_at,
        a.acknowledged_at,
        a.resolved_at,
        c.company_name as client_name
      FROM alerts a
      LEFT JOIN clients c ON c.id = a.client_id
      ORDER BY a.created_at DESC
    `;

    // Filter in-memory for ease and robustness
    let filtered = [...dbAlerts];

    if (status) {
      filtered = filtered.filter((x) => x.status.toLowerCase() === status.toLowerCase());
    }
    if (severity) {
      filtered = filtered.filter((x) => x.severity.toLowerCase() === severity.toLowerCase());
    }
    if (type) {
      filtered = filtered.filter((x) => x.type.toLowerCase().includes(type.toLowerCase()));
    }

    return NextResponse.json({ alerts: filtered });
  } catch (err: any) {
    console.error("GET alerts error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
