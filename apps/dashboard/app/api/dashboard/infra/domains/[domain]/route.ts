import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ domain: string }> };

// Real data only — reputation / DNS / warmup not tracked yet.
// See wiki/projects/2026-05-31-audit-fixes for the V2 plan.

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domain: rawDomain } = await params;
  const domain = decodeURIComponent(rawDomain);

  try {
    const dbInboxes = await sql<any[]>`
      SELECT
        inbox_email,
        COUNT(id) FILTER (WHERE event_type = 'sent')::int as sent_count,
        COUNT(id) FILTER (WHERE event_type = 'opened')::int as open_count,
        COUNT(id) FILTER (WHERE event_type = 'clicked')::int as click_count,
        COUNT(id) FILTER (WHERE event_type = 'bounced')::int as bounce_count,
        COUNT(id) FILTER (WHERE event_type = 'spam' OR event_type = 'complained')::int as spam_count
      FROM email_events
      WHERE inbox_email ILIKE ${"%@" + domain}
      GROUP BY inbox_email
    `;

    let totalSent = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalBounced = 0;
    let totalSpam = 0;

    const inboxesList = dbInboxes.map((item) => {
      const sent = item.sent_count || 0;
      const openRate = sent > 0 ? (item.open_count / sent) * 100 : 0;
      const clickRate = sent > 0 ? (item.click_count / sent) * 100 : 0;
      const bounceRate = sent > 0 ? (item.bounce_count / sent) * 100 : 0;
      const spamRate = sent > 0 ? (item.spam_count / sent) * 100 : 0;

      totalSent += sent;
      totalOpened += (item.open_count || 0);
      totalClicked += (item.click_count || 0);
      totalBounced += (item.bounce_count || 0);
      totalSpam += (item.spam_count || 0);

      return {
        inbox_email: item.inbox_email,
        sent_count: sent,
        open_rate: parseFloat(openRate.toFixed(1)),
        click_rate: parseFloat(clickRate.toFixed(1)),
        bounce_rate: parseFloat(bounceRate.toFixed(1)),
        spam_rate: parseFloat(spamRate.toFixed(1)),
        reputation_score: null,
        spf: null,
        dkim: null,
        dmarc: null,
        warmup_status: null,
      };
    });

    const combinedOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const combinedClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    const combinedBounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const combinedSpamRate = totalSent > 0 ? (totalSpam / totalSent) * 100 : 0;

    return NextResponse.json({
      domain: {
        domain_name: domain,
        total_sent: totalSent,
        combined_open_rate: parseFloat(combinedOpenRate.toFixed(1)),
        combined_click_rate: parseFloat(combinedClickRate.toFixed(1)),
        combined_bounce_rate: parseFloat(combinedBounceRate.toFixed(1)),
        combined_spam_rate: parseFloat(combinedSpamRate.toFixed(1)),
        reputation_score: null,
        spf: null,
        dkim: null,
        dmarc: null,
        warmup_status: null,
        inboxes: inboxesList,
      },
    });
  } catch (err: any) {
    console.error("GET domain detail error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
