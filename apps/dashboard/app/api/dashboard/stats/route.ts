import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getQueue, QUEUE_NAMES } from "@/lib/bull-redis";

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

  try {
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

    // Positive Replies
    const [positive] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count 
      FROM reply_items ri
      JOIN reply_classifications rc ON rc.id = ri.classification_id
      WHERE ri.status = 'PENDING_REVIEW' AND rc.intent = 'POSITIVE'
      ${operator.client_access && operator.client_access.length > 0 ? sql`AND ri.client_id = ANY(${operator.client_access})` : sql``}
    `;

    // Active Campaigns
    const [campaigns] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count 
      FROM campaigns
      WHERE status = 'active' ${clientFilter}
    `;

    // Avg SLA Remaining (hours)
    const [sla] = await sql<{ avg_hours: number }[]>`
      SELECT EXTRACT(EPOCH FROM AVG(sla_expires_at - NOW())) / 3600 as avg_hours
      FROM reply_items
      WHERE status = 'PENDING_REVIEW' ${clientFilter}
    `;

    // Overdue reviews (SLA expired, still pending)
    const [overdue] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count
      FROM reply_items
      WHERE status = 'PENDING_REVIEW' AND sla_expires_at < NOW() ${clientFilter}
    `;

    // Clients currently in onboarding
    const [onboarding] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM clients WHERE status = 'onboarding'
    `;

    // Real queue health from BullMQ
    let queue_health = 0;
    let totalFailed = 0;
    let totalAll = 0;
    try {
      for (const qName of QUEUE_NAMES) {
        const q = getQueue(qName);
        const counts = await q.getJobCounts("waiting", "active", "failed");
        queue_health += counts.waiting ?? 0;
        totalFailed += counts.failed ?? 0;
        totalAll += (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.failed ?? 0);
      }
    } catch {
      // Redis may be unavailable — fall back to 0
    }

    // Real daily AI cost from ai_invocations (today)
    let ai_cost = 0;
    try {
      const [aiRow] = await sql<{ cost: number }[]>`
        SELECT COALESCE(SUM(cost_usd_micro)::double precision / 1000000.0, 0) AS cost
        FROM ai_invocations
        WHERE invoked_at >= DATE_TRUNC('day', NOW())
      `;
      ai_cost = aiRow?.cost ?? 0;
    } catch {
      // ai_invocations may not have data; default to 0
    }

    // Real failure rate: (failed / total) * 100, rounded to 1 decimal
    const failure_rate = totalAll > 0
      ? Math.round((totalFailed / totalAll) * 1000) / 10
      : 0;

    return NextResponse.json({
      pending: pending?.count ?? 0,
      approved: approved?.count ?? 0,
      suppressed: suppressed?.count ?? 0,
      sent: sent?.count ?? 0,
      positive: positive?.count ?? 0,
      active_campaigns: campaigns?.count ?? 0,
      queue_health,
      ai_cost,
      failure_rate,
      avg_sla_remaining: sla?.avg_hours ?? 0,
      overdue_reviews: overdue?.count ?? 0,
      onboarding_count: onboarding?.count ?? 0,
    });
  } catch (err: any) {
    console.error("Stats endpoint error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
