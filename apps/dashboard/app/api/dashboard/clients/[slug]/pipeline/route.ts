import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyToken(token); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  const [client] = await sql<{ id: string; outbound_active: boolean; outbound_launched_at: string | null }[]>`
    SELECT id, outbound_active, outbound_launched_at FROM clients WHERE slug = ${slug}
  `;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Lead counts by status
  const counts = await sql<{ lead_status: string; count: string }[]>`
    SELECT lead_status, COUNT(*)::int AS count
    FROM leads
    WHERE client_id = ${client.id}::uuid
    GROUP BY lead_status
  `;

  // Review queue counts
  const reviewCounts = await sql<{ review_status: string; count: string }[]>`
    SELECT review_status, COUNT(*)::int AS count
    FROM leads
    WHERE client_id = ${client.id}::uuid
      AND lead_status NOT IN ('suppressed', 'rejected', 'opted_out', 'bounced')
    GROUP BY review_status
  `;

  const statusMap = Object.fromEntries(counts.map((r) => [r.lead_status, Number(r.count)]));
  const reviewMap = Object.fromEntries(reviewCounts.map((r) => [r.review_status, Number(r.count)]));

  return NextResponse.json({
    outbound_active: client.outbound_active,
    outbound_launched_at: client.outbound_launched_at,
    pipeline: {
      total: counts.reduce((sum, r) => sum + Number(r.count), 0),
      raw: statusMap["raw_imported"] ?? 0,
      enriching: (statusMap["enrichment_pending"] ?? 0) + (statusMap["enriched"] ?? 0),
      pending_review: reviewMap["pending"] ?? 0,
      approved: reviewMap["approved"] ?? 0,
      sending: (statusMap["queued_for_sending"] ?? 0) + (statusMap["sending_active"] ?? 0),
      replied: statusMap["reply_received"] ?? 0,
      meetings: statusMap["meeting_booked"] ?? 0,
      suppressed:
        (statusMap["suppressed"] ?? 0) +
        (statusMap["opted_out"] ?? 0) +
        (statusMap["bounced"] ?? 0),
    },
  });
}
