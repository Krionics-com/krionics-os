import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Build client access condition if operator is restricted
  const clientFilter = operator.client_access && operator.client_access.length > 0
    ? sql`AND client_id = ANY(${operator.client_access})`
    : sql``;

  // Pending Count
  const [pending] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count 
    FROM reply_items 
    WHERE status = 'PENDING_REVIEW' ${clientFilter}
  `;

  // Approved today
  const [approved] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count 
    FROM reply_items 
    WHERE status = 'APPROVED' AND updated_at >= DATE_TRUNC('day', NOW()) ${clientFilter}
  `;

  // Suppressed today
  const [suppressed] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count 
    FROM reply_items 
    WHERE status = 'SUPPRESSED' AND updated_at >= DATE_TRUNC('day', NOW()) ${clientFilter}
  `;

  // Sent today
  const [sent] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count 
    FROM reply_items 
    WHERE status = 'SENT' AND updated_at >= DATE_TRUNC('day', NOW()) ${clientFilter}
  `;

  return NextResponse.json({
    pending: pending?.count ?? 0,
    approved: approved?.count ?? 0,
    suppressed: suppressed?.count ?? 0,
    sent: sent?.count ?? 0
  });
}
