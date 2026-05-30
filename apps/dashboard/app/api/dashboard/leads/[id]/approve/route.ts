import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { instantlyPushQueue } from "@/lib/queues";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;

  // Load lead + client
  const [lead] = await sql<{ id: string; client_id: string; review_status: string }[]>`
    SELECT id, client_id, review_status FROM leads WHERE id = ${leadId}::uuid
  `;
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.review_status === "approved") return NextResponse.json({ error: "Already approved" }, { status: 409 });

  // Check operator access
  if (operator.client_access?.length && !operator.client_access.includes(lead.client_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load client instantly_config
  const [client] = await sql<{ instantly_config: { campaign_id?: string } | null }[]>`
    SELECT instantly_config FROM clients WHERE id = ${lead.client_id}::uuid
  `;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const campaignId = client.instantly_config?.campaign_id;
  if (!campaignId) return NextResponse.json({ error: "No Instantly campaign configured for this client" }, { status: 422 });

  // Get the generated sequence for this lead
  const [sequence] = await sql<{ id: string }[]>`
    SELECT id FROM generated_sequences
    WHERE lead_id = ${leadId}::uuid
    ORDER BY created_at DESC LIMIT 1
  `;
  if (!sequence) return NextResponse.json({ error: "No generated sequence found for this lead" }, { status: 422 });

  // Mark lead as approved
  await sql`
    UPDATE leads
    SET review_status = 'approved',
        reviewed_by = ${operator.id}::uuid,
        reviewed_at = NOW(),
        lead_status = 'campaign_ready'
    WHERE id = ${leadId}::uuid
  `;

  // Enqueue instantly push
  await instantlyPushQueue.add("push_sequence", {
    sequenceId: sequence.id,
    clientId: lead.client_id,
    leadId,
    campaignId,
    traceId: crypto.randomUUID()
  }, { jobId: `instantly-push:${sequence.id}` });

  return NextResponse.json({ ok: true });
}
