import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

function getDeterministicMock(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const reputation = 80 + (hash % 19); // 80 to 98
  const spf = (hash % 10) !== 0; 
  const dkim = (hash % 8) !== 0;  
  const dmarc = (hash % 12) !== 0; 

  return {
    reputation_score: reputation,
    spf: spf ? "PASS" : "FAIL",
    dkim: dkim ? "PASS" : "FAIL",
    dmarc: dmarc ? "PASS" : "FAIL",
  };
}

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      WHERE inbox_email IS NOT NULL AND inbox_email != ''
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
      if (!allInboxes.some((x) => x.inbox_email === b.email)) {
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

    // 2. Group by Domain Suffix
    const domainMap: Record<string, {
      domain: string;
      inboxes: string[];
      sent_count: number;
      open_count: number;
      click_count: number;
      bounce_count: number;
      spam_count: number;
    }> = {};

    for (const item of allInboxes) {
      const email = item.inbox_email;
      const parts = email.split("@");
      const domain = parts[1] || "unknown.com";

      if (!domainMap[domain]) {
        domainMap[domain] = {
          domain,
          inboxes: [],
          sent_count: 0,
          open_count: 0,
          click_count: 0,
          bounce_count: 0,
          spam_count: 0
        };
      }

      const d = domainMap[domain];
      d.inboxes.push(email);
      d.sent_count += (item.sent_count || 0);
      d.open_count += (item.open_count || 0);
      d.click_count += (item.click_count || 0);
      d.bounce_count += (item.bounce_count || 0);
      d.spam_count += (item.spam_count || 0);
    }

    // 3. Map to final list & aggregate metrics
    const domains = Object.values(domainMap).map((d) => {
      const sent = d.sent_count;
      const openRate = sent > 0 ? (d.open_count / sent) * 100 : 0;
      const bounceRate = sent > 0 ? (d.bounce_count / sent) * 100 : 0;
      const spamRate = sent > 0 ? (d.spam_count / sent) * 100 : 0;

      const mockData = getDeterministicMock(d.domain);

      return {
        domain: d.domain,
        inbox_count: d.inboxes.length,
        open_rate: parseFloat(openRate.toFixed(1)),
        bounce_rate: parseFloat(bounceRate.toFixed(1)),
        spam_rate: parseFloat(spamRate.toFixed(1)),
        ...mockData
      };
    });

    return NextResponse.json({ domains });
  } catch (err: any) {
    console.error("GET domains error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
