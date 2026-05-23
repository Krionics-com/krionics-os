import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const operator = await verifyToken(token);
    
    const clientFilter = operator.client_access && operator.client_access.length > 0
      ? sql`AND ri.client_id = ANY(${operator.client_access})`
      : sql``;

    // Pull events from reply_items for status changes.
    const recentItems = await sql`
      SELECT 
        ri.id,
        ri.status,
        ri.created_at,
        ri.updated_at,
        c.intent,
        c.confidence,
        l.name as lead_name,
        l.company as lead_company,
        camp.name as campaign_name
      FROM reply_items ri
      LEFT JOIN reply_classifications c ON ri.id = c.reply_item_id
      LEFT JOIN raw_replies rr ON ri.raw_reply_id = rr.id
      LEFT JOIN leads l ON rr.lead_id = l.id
      LEFT JOIN campaigns camp ON rr.campaign_id = camp.id
      WHERE 1=1 ${clientFilter}
      ORDER BY ri.updated_at DESC
      LIMIT 20
    `;

    const events = recentItems.map(item => {
      let type = 'NEW_REPLY';
      let message = `New reply received: ${item.lead_name || 'Unknown'} (${item.lead_company || 'Unknown'}) — ${item.intent ? item.intent.replace('_', ' ') : 'Unclassified'}`;
      let status = 'info';
      let date = item.created_at;

      if (item.status === 'APPROVED') {
        type = 'APPROVED';
        message = `Reply approved: ${item.lead_name || 'Unknown'} — sent to ${item.campaign_name || 'Sequence'}`;
        status = 'success';
        date = item.updated_at;
      } else if (item.status === 'REJECTED') {
        type = 'REJECTED';
        message = `Reply rejected: ${item.lead_name || 'Unknown'}`;
        status = 'warning';
        date = item.updated_at;
      } else if (item.status === 'SENT') {
        type = 'APPROVED';
        message = `Reply delivered: ${item.lead_name || 'Unknown'}`;
        status = 'success';
        date = item.updated_at;
      } else if (item.status === 'SUPPRESSED') {
        type = 'BOUNCE';
        message = `Reply auto-suppressed: ${item.lead_name || 'Unknown'} (${item.intent || 'Unknown'})`;
        status = 'info';
        date = item.updated_at;
      } else if (item.intent === 'BOOKING_INTENT') {
        type = 'BOOKED';
        message = `🎉 Meeting booked: ${item.lead_name || 'Unknown'} (${item.lead_company || 'Unknown'})`;
        status = 'success';
        date = item.updated_at;
      }

      return {
        id: `${item.id}-${item.status}`,
        type,
        message,
        created_at: date,
        status,
        link: { text: "View Detail", href: `/dashboard/review/${item.id}` }
      };
    });

    // We could union this with bullmq job failures or bounces in a real system.
    
    // Sort by date descending
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ data: events.slice(0, 20) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
