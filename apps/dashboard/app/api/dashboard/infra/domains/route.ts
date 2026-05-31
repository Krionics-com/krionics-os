import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

// Real data only — no mock fallbacks. Reputation / DNS validity is not
// tracked in DB yet; UI shows "—" until a real domain-monitoring
// integration is in place. See wiki/projects/2026-05-31-audit-fixes.

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
        COUNT(id) FILTER (WHERE event_type = 'spam' OR event_type = 'complained')::int as spam_count
      FROM email_events
      WHERE inbox_email IS NOT NULL AND inbox_email != ''
      GROUP BY inbox_email
    `;

    const domainMap: Record<string, {
      domain: string;
      inboxes: string[];
      sent_count: number;
      open_count: number;
      click_count: number;
      bounce_count: number;
      spam_count: number;
    }> = {};

    for (const item of dbInboxes) {
      const email = item.inbox_email;
      const parts = email.split("@");
      const domain = parts[1];
      if (!domain) continue;

      if (!domainMap[domain]) {
        domainMap[domain] = {
          domain,
          inboxes: [],
          sent_count: 0,
          open_count: 0,
          click_count: 0,
          bounce_count: 0,
          spam_count: 0,
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

    const domains = Object.values(domainMap).map((d) => {
      const sent = d.sent_count;
      const openRate = sent > 0 ? (d.open_count / sent) * 100 : 0;
      const bounceRate = sent > 0 ? (d.bounce_count / sent) * 100 : 0;
      const spamRate = sent > 0 ? (d.spam_count / sent) * 100 : 0;

      return {
        domain: d.domain,
        inbox_count: d.inboxes.length,
        sent_count: sent,
        open_rate: parseFloat(openRate.toFixed(1)),
        bounce_rate: parseFloat(bounceRate.toFixed(1)),
        spam_rate: parseFloat(spamRate.toFixed(1)),
        reputation_score: null,
        spf: null,
        dkim: null,
        dmarc: null,
      };
    });

    return NextResponse.json({ domains });
  } catch (err: any) {
    console.error("GET domains error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
