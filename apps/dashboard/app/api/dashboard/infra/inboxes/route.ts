import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

// NOTE: Reputation / warmup / SPF-DKIM-DMARC validity are not tracked
// in the database yet. This endpoint returns only the real send/event
// metrics that exist; the UI shows "—" for missing fields until a real
// inbox-monitoring integration (Instantly inbox API or warmup provider)
// is wired up. See wiki/projects/2026-05-31-audit-fixes for the
// V2 plan.

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbInboxes = await sql<any[]>`
      SELECT
        inbox_email,
        COUNT(id) FILTER (WHERE event_type = 'sent')::int as sent_count,
        COUNT(id) FILTER (WHERE event_type = 'opened')::int as open_count,
        COUNT(id) FILTER (WHERE event_type = 'clicked')::int as click_count,
        COUNT(id) FILTER (WHERE event_type = 'bounced')::int as bounce_count,
        COUNT(id) FILTER (WHERE event_type = 'spam' OR event_type = 'complained')::int as spam_count,
        COUNT(DISTINCT campaign_id)::int as campaign_count
      FROM email_events
      WHERE inbox_email IS NOT NULL AND inbox_email != ''
      GROUP BY inbox_email
      ORDER BY inbox_email ASC
    `;

    const inboxes = dbInboxes.map((item) => {
      const sent = item.sent_count || 0;
      const openRate = sent > 0 ? (item.open_count / sent) * 100 : 0;
      const clickRate = sent > 0 ? (item.click_count / sent) * 100 : 0;
      const bounceRate = sent > 0 ? (item.bounce_count / sent) * 100 : 0;
      const spamRate = sent > 0 ? (item.spam_count / sent) * 100 : 0;

      return {
        inbox_email: item.inbox_email,
        campaign_count: item.campaign_count || 0,
        sent_count: sent,
        open_rate: parseFloat(openRate.toFixed(1)),
        click_rate: parseFloat(clickRate.toFixed(1)),
        bounce_rate: parseFloat(bounceRate.toFixed(1)),
        spam_rate: parseFloat(spamRate.toFixed(1)),
        // Reputation/warmup/DNS validity not tracked yet — null until
        // a real provider integration is in place.
        reputation_score: null,
        warmup_status: null,
        spf: null,
        dkim: null,
        dmarc: null,
      };
    });

    return NextResponse.json({ inboxes });
  } catch (err: any) {
    console.error("GET inboxes error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
