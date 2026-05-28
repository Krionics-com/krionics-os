import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

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

  const rules = await sql<any[]>`
    SELECT * FROM timing_rules WHERE client_id = ${clientId} ORDER BY intent ASC
  `;
  return NextResponse.json({ rules });
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

  const { intent, delay_min_minutes, delay_max_minutes, enforce_business_hours, business_hours_start, business_hours_end, timezone, send_in_prospect_timezone } = body;

  if (!intent || !VALID_INTENTS.includes(intent)) return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
  if (typeof delay_min_minutes !== "number" || typeof delay_max_minutes !== "number") {
    return NextResponse.json({ error: "delay_min_minutes and delay_max_minutes are required numbers" }, { status: 400 });
  }
  if (delay_min_minutes > delay_max_minutes) {
    return NextResponse.json({ error: "delay_min_minutes cannot exceed delay_max_minutes" }, { status: 400 });
  }

  const [rule] = await sql<any[]>`
    INSERT INTO timing_rules (client_id, intent, delay_min_minutes, delay_max_minutes, enforce_business_hours, business_hours_start, business_hours_end, timezone, send_in_prospect_timezone)
    VALUES (
      ${clientId}, ${intent}, ${delay_min_minutes}, ${delay_max_minutes},
      ${enforce_business_hours ?? true},
      ${business_hours_start ?? "07:00:00"},
      ${business_hours_end ?? "22:00:00"},
      ${timezone ?? "America/New_York"},
      ${send_in_prospect_timezone ?? true}
    )
    ON CONFLICT (client_id, intent) DO UPDATE SET
      delay_min_minutes = EXCLUDED.delay_min_minutes,
      delay_max_minutes = EXCLUDED.delay_max_minutes,
      enforce_business_hours = EXCLUDED.enforce_business_hours,
      business_hours_start = EXCLUDED.business_hours_start,
      business_hours_end = EXCLUDED.business_hours_end,
      timezone = EXCLUDED.timezone,
      send_in_prospect_timezone = EXCLUDED.send_in_prospect_timezone,
      updated_at = NOW()
    RETURNING *
  `;
  return NextResponse.json({ rule }, { status: 201 });
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

  const { intent, delay_min_minutes, delay_max_minutes, enforce_business_hours, business_hours_start, business_hours_end, timezone, send_in_prospect_timezone } = body;
  if (!intent) return NextResponse.json({ error: "intent is required" }, { status: 400 });

  if (delay_min_minutes !== undefined && delay_max_minutes !== undefined && delay_min_minutes > delay_max_minutes) {
    return NextResponse.json({ error: "delay_min_minutes cannot exceed delay_max_minutes" }, { status: 400 });
  }

  const [rule] = await sql<any[]>`
    UPDATE timing_rules SET
      delay_min_minutes = COALESCE(${delay_min_minutes ?? null}, delay_min_minutes),
      delay_max_minutes = COALESCE(${delay_max_minutes ?? null}, delay_max_minutes),
      enforce_business_hours = COALESCE(${enforce_business_hours ?? null}, enforce_business_hours),
      business_hours_start = COALESCE(${business_hours_start ?? null}, business_hours_start),
      business_hours_end = COALESCE(${business_hours_end ?? null}, business_hours_end),
      timezone = COALESCE(${timezone ?? null}, timezone),
      send_in_prospect_timezone = COALESCE(${send_in_prospect_timezone ?? null}, send_in_prospect_timezone),
      updated_at = NOW()
    WHERE client_id = ${clientId} AND intent = ${intent}
    RETURNING *
  `;
  if (!rule) return NextResponse.json({ error: "Timing rule not found" }, { status: 404 });
  return NextResponse.json({ rule });
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

  await sql`DELETE FROM timing_rules WHERE client_id = ${clientId} AND intent = ${intent}`;
  return NextResponse.json({ ok: true });
}
