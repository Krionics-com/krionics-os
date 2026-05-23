import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ domain: string }> };

function getDeterministicMock(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const reputation = 80 + (hash % 19); 
  const spf = (hash % 10) !== 0; 
  const dkim = (hash % 8) !== 0;  
  const dmarc = (hash % 12) !== 0; 

  const statuses = ["Not started", "Day 12/30", "Day 24/30", "Complete"];
  const warmup = statuses[hash % statuses.length];

  return {
    reputation_score: reputation,
    spf: spf ? "PASS" : "FAIL",
    dkim: dkim ? "PASS" : "FAIL",
    dmarc: dmarc ? "PASS" : "FAIL",
    warmup_status: warmup
  };
}

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
    // 1. Fetch DB metrics per unique inbox
    const dbInboxes = await sql<any[]>`
      SELECT 
        inbox_email,
        COUNT(id) FILTER (WHERE event_type = 'sent')::int as sent_count,
        COUNT(id) FILTER (WHERE event_type = 'opened')::int as open_count,
        COUNT(id) FILTER (WHERE event_type = 'clicked')::int as click_count,
        COUNT(id) FILTER (WHERE event_type = 'bounced')::int as bounce_count,
        COUNT(id) FILTER (WHERE event_type = 'spam' OR event_type = 'complained')::int as spam_count
      FROM email_events
      WHERE inbox_email ILIKE ${"%" + domain}
      GROUP BY inbox_email
    `;

    // Baseline fallback simulated inboxes to merge
    const baseInboxes = [
      { email: "sales@krionics.com", sent: 480, opened: 360, clicked: 120, bounced: 4, spam: 1 },
      { email: "hello@krionics-biz.com", sent: 1250, opened: 890, clicked: 240, bounced: 12, spam: 2 },
      { email: "outreach@krionics-tech.com", sent: 890, opened: 610, clicked: 180, bounced: 28, spam: 9 },
      { email: "dealflow@krionics-invest.com", sent: 340, opened: 250, clicked: 95, bounced: 2, spam: 0 },
      { email: "contact@krionics.com", sent: 1500, opened: 1120, clicked: 410, bounced: 9, spam: 3 },
      { email: "ops@krionics-sys.com", sent: 90, opened: 60, clicked: 15, bounced: 14, spam: 8 }
    ];

    const allInboxes = [...dbInboxes];
    for (const b of baseInboxes) {
      if (b.email.endsWith(domain) && !allInboxes.some((x) => x.inbox_email === b.email)) {
        allInboxes.push({
          inbox_email: b.email,
          sent_count: b.sent,
          open_count: b.opened,
          click_count: b.clicked,
          bounce_count: b.bounced,
          spam_count: b.spam
        });
      }
    }

    // If still empty (e.g. wildcard search on new domains), make sure it has at least one mock matching
    if (allInboxes.length === 0) {
      allInboxes.push({
        inbox_email: `outbox@${domain}`,
        sent_count: 500,
        open_count: 380,
        click_count: 110,
        bounce_count: 5,
        spam_count: 1
      });
    }

    // 2. Aggregate overall metrics
    let totalSent = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalBounced = 0;
    let totalSpam = 0;

    const inboxesList = allInboxes.map((item) => {
      const email = item.inbox_email;
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

      const mockData = getDeterministicMock(email);

      return {
        inbox_email: email,
        sent_count: sent,
        open_rate: parseFloat(openRate.toFixed(1)),
        click_rate: parseFloat(clickRate.toFixed(1)),
        bounce_rate: parseFloat(bounceRate.toFixed(1)),
        spam_rate: parseFloat(spamRate.toFixed(1)),
        ...mockData
      };
    });

    const combinedOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const combinedClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    const combinedBounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const combinedSpamRate = totalSent > 0 ? (totalSpam / totalSent) * 100 : 0;

    const mockDomainStats = getDeterministicMock(domain);

    return NextResponse.json({
      domain: {
        domain_name: domain,
        total_sent: totalSent,
        combined_open_rate: parseFloat(combinedOpenRate.toFixed(1)),
        combined_click_rate: parseFloat(combinedClickRate.toFixed(1)),
        combined_bounce_rate: parseFloat(combinedBounceRate.toFixed(1)),
        combined_spam_rate: parseFloat(combinedSpamRate.toFixed(1)),
        ...mockDomainStats,
        inboxes: inboxesList
      }
    });
  } catch (err: any) {
    console.error("GET domain detail error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
