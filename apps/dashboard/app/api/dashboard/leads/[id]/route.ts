import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;

  const [lead] = await sql<any[]>`
    SELECT
      l.*,
      cl.company_name as client_name,
      cl.slug as client_slug,
      ca.name as campaign_name,
      ca.id as campaign_id_val
    FROM leads l
    LEFT JOIN clients cl ON cl.id = l.client_id
    LEFT JOIN campaigns ca ON ca.id = l.campaign_id
    WHERE l.id = ${id}
  `;

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Recent reply items for this lead
  const replyItems = await sql<any[]>`
    SELECT ri.id, ri.status, ri.created_at, ri.sla_expires_at, rc.intent, rc.confidence
    FROM reply_items ri
    LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
    WHERE ri.lead_id = ${id}
    ORDER BY ri.created_at DESC
    LIMIT 10
  `;

  // Generated sequences
  const sequences = await sql<any[]>`
    SELECT id, status, icp_fit_score, model_used, created_at,
      jsonb_array_length(emails) as email_count
    FROM generated_sequences
    WHERE lead_id = ${id}
    ORDER BY created_at DESC
    LIMIT 5
  `;

  // Lead state history
  const history = await sql<any[]>`
    SELECT id, from_state, to_state, transition_reason, triggered_by, transitioned_at
    FROM lead_state_history
    WHERE lead_id = ${id}
    ORDER BY transitioned_at DESC
    LIMIT 20
  `.catch(() => []);

  // Enrichment data
  const [enrichment] = await sql<any[]>`
    SELECT * FROM enriched_leads WHERE lead_id = ${id}
  `.catch(() => [undefined]);

  return NextResponse.json({ lead, replyItems, sequences, history, enrichment });
}
