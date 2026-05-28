import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

const VALID_ACTIONS = ["human_review", "ai_draft_human_review", "ai_send", "suppress", "escalate"];
const VALID_INTENTS = ["POSITIVE", "BOOKING_INTENT", "OBJECTION", "FAQ", "NURTURE", "UNSUBSCRIBE", "NOT_RELEVANT", "BOUNCE_OOO", "HOSTILE", "UNKNOWN"];

async function getClientId(slug: string): Promise<string | null> {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM clients WHERE slug = ${slug}`;
  return row?.id ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { slug } = await params;
  const clientId = await getClientId(slug);
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const policies = await sql<any[]>`
    SELECT * FROM reply_policies WHERE client_id = ${clientId} ORDER BY intent ASC
  `;
  return NextResponse.json({ policies });
}

export async function POST(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const clientId = await getClientId(slug);
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { intent, action_level_1, action_level_2, action_level_3, confidence_threshold, escalation_keywords, auto_suppress_phrases } = body;

  if (!intent || !VALID_INTENTS.includes(intent)) return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
  if (!VALID_ACTIONS.includes(action_level_1) || !VALID_ACTIONS.includes(action_level_2) || !VALID_ACTIONS.includes(action_level_3)) {
    return NextResponse.json({ error: "Invalid action value" }, { status: 400 });
  }

  const threshold = typeof confidence_threshold === "number" ? confidence_threshold : 0.85;

  const [policy] = await sql<any[]>`
    INSERT INTO reply_policies (client_id, intent, action_level_1, action_level_2, action_level_3, confidence_threshold, escalation_keywords, auto_suppress_phrases)
    VALUES (${clientId}, ${intent}, ${action_level_1}, ${action_level_2}, ${action_level_3}, ${threshold}, ${escalation_keywords ?? []}, ${auto_suppress_phrases ?? []})
    ON CONFLICT (client_id, intent) DO UPDATE SET
      action_level_1 = EXCLUDED.action_level_1,
      action_level_2 = EXCLUDED.action_level_2,
      action_level_3 = EXCLUDED.action_level_3,
      confidence_threshold = EXCLUDED.confidence_threshold,
      escalation_keywords = EXCLUDED.escalation_keywords,
      auto_suppress_phrases = EXCLUDED.auto_suppress_phrases,
      updated_at = NOW()
    RETURNING *
  `;
  return NextResponse.json({ policy }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const clientId = await getClientId(slug);
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { intent, action_level_1, action_level_2, action_level_3, confidence_threshold, escalation_keywords, auto_suppress_phrases } = body;

  if (!intent) return NextResponse.json({ error: "intent is required" }, { status: 400 });

  const updates: any = { updated_at: sql`NOW()` };
  if (action_level_1 !== undefined) { if (!VALID_ACTIONS.includes(action_level_1)) return NextResponse.json({ error: "Invalid action_level_1" }, { status: 400 }); }
  if (action_level_2 !== undefined) { if (!VALID_ACTIONS.includes(action_level_2)) return NextResponse.json({ error: "Invalid action_level_2" }, { status: 400 }); }
  if (action_level_3 !== undefined) { if (!VALID_ACTIONS.includes(action_level_3)) return NextResponse.json({ error: "Invalid action_level_3" }, { status: 400 }); }

  const [policy] = await sql<any[]>`
    UPDATE reply_policies SET
      action_level_1 = COALESCE(${action_level_1 ?? null}, action_level_1),
      action_level_2 = COALESCE(${action_level_2 ?? null}, action_level_2),
      action_level_3 = COALESCE(${action_level_3 ?? null}, action_level_3),
      confidence_threshold = COALESCE(${confidence_threshold ?? null}, confidence_threshold),
      escalation_keywords = COALESCE(${escalation_keywords ?? null}, escalation_keywords),
      auto_suppress_phrases = COALESCE(${auto_suppress_phrases ?? null}, auto_suppress_phrases),
      updated_at = NOW()
    WHERE client_id = ${clientId} AND intent = ${intent}
    RETURNING *
  `;
  if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  return NextResponse.json({ policy });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const intent = searchParams.get("intent");
  if (!intent) return NextResponse.json({ error: "intent query param required" }, { status: 400 });

  const clientId = await getClientId(slug);
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  await sql`DELETE FROM reply_policies WHERE client_id = ${clientId} AND intent = ${intent}`;
  return NextResponse.json({ ok: true });
}
