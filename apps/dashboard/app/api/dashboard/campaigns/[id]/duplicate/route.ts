import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const [original] = await sql<any[]>`
      SELECT * FROM campaigns WHERE id = ${id}
    `;

    if (!original) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const newName = body.name || `${original.name} (Copy)`;

    const [duplicated] = await sql<any[]>`
      INSERT INTO campaigns (
        client_id, name, status, instantly_campaign_id,
        icp_config, sequence_config, sending_config,
        personalization_prompt_id, reply_policies,
        total_leads, emails_sent, replies_received, positive_replies, meetings_booked
      )
      VALUES (
        ${original.client_id},
        ${newName},
        'draft',
        NULL,
        ${original.icp_config},
        ${original.sequence_config},
        ${original.sending_config},
        ${original.personalization_prompt_id},
        ${original.reply_policies},
        0, 0, 0, 0, 0
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, campaign: duplicated });
  } catch (err: any) {
    console.error("Duplicate campaign error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
