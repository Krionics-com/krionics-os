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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING_REVIEW";
  const intent = searchParams.get("intent");
  const clientId = searchParams.get("client_id");
  const skip = Number(searchParams.get("skip") ?? "0");
  const limit = Number(searchParams.get("limit") ?? "20");

  const conditions = [sql`ri.status = ${status}`];

  if (clientId) {
    conditions.push(sql`ri.client_id = ${clientId}`);
  }

  if (intent) {
    conditions.push(sql`rc.intent = ${intent}`);
  }

  if (operator.client_access && operator.client_access.length > 0) {
    conditions.push(sql`ri.client_id = ANY(${operator.client_access})`);
  }

  let whereClause = conditions[0];
  for (let i = 1; i < conditions.length; i += 1) {
    whereClause = sql`${whereClause} AND ${conditions[i]}`;
  }

  const rows = await sql`
    SELECT
      ri.id, ri.status, ri.created_at, ri.trace_id,
      rc.intent, rc.confidence, rc.sentiment, rc.urgency,
      rd.subject as draft_subject,
      l.email as lead_email, l.first_name, l.last_name, l.company,
      c.company_name as client_name,
      rr.from_email, rr.subject as reply_subject, rr.body_text
    FROM reply_items ri
    LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
    LEFT JOIN reply_drafts rd ON rd.id = ri.draft_id
    LEFT JOIN leads l ON l.id = ri.lead_id
    LEFT JOIN clients c ON c.id = ri.client_id
    LEFT JOIN raw_replies rr ON rr.id = ri.raw_reply_id
    WHERE ${whereClause}
    ORDER BY ri.created_at DESC
    LIMIT ${limit} OFFSET ${skip}
  `;

  const [countRow] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM reply_items ri
    LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
    WHERE ${whereClause}
  `;

  return NextResponse.json({ data: rows, total: countRow?.count ?? 0 });
}
