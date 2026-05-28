import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clients = await sql<any[]>`
    SELECT id, company_name, slug, status, crm_type, crm_config, contact_email, contact_name, created_at
    FROM clients
    WHERE status = 'onboarding'
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ clients });
}
