import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

type ClientRow = {
  id: string;
  outbound_active: boolean;
  calcom_link: string | null;
  config: Record<string, any> | null;
  apollo_config: Record<string, any> | null;
  sequence_config: Record<string, any> | null;
  instantly_config: Record<string, any> | null;
  review_mode: string;
};

type ChecklistItem = { key: string; label: string; ok: boolean };

function buildChecklist(c: ClientRow): ChecklistItem[] {
  const config = c.config ?? {};
  const sequence = c.sequence_config ?? {};
  const instantly = c.instantly_config ?? {};

  const hasIcp =
    !!config.target_titles ||
    (Array.isArray(config.target_industries) && config.target_industries.length > 0) ||
    (Array.isArray(config.target_geographies) && config.target_geographies.length > 0) ||
    (Array.isArray(config.target_company_sizes) && config.target_company_sizes.length > 0);

  const sequenceSteps = Array.isArray(sequence.steps) ? sequence.steps : [];
  const fromEmails = Array.isArray(instantly.from_emails) ? instantly.from_emails : [];

  return [
    { key: "calcom_link", label: "Cal.com link set", ok: !!c.calcom_link },
    { key: "icp", label: "ICP configured (titles, industries, or geographies)", ok: hasIcp },
    { key: "sequence", label: "Sequence has at least 2 steps", ok: sequenceSteps.length >= 2 },
    { key: "instantly_campaign", label: "Instantly Campaign ID set", ok: !!instantly.campaign_id },
    { key: "from_emails", label: "At least one From Email", ok: fromEmails.length > 0 },
    { key: "review_mode", label: "Review mode selected", ok: !!c.review_mode },
  ];
}

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await verifyToken(token); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const [client] = await sql<ClientRow[]>`
    SELECT id, outbound_active, calcom_link, config,
           apollo_config, sequence_config, instantly_config, review_mode
    FROM clients WHERE slug = ${slug}
  `;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const checklist = buildChecklist(client);
  return NextResponse.json({
    outbound_active: client.outbound_active,
    ready: checklist.every((c) => c.ok),
    checklist,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const [client] = await sql<ClientRow[]>`
    SELECT id, outbound_active, calcom_link, config,
           apollo_config, sequence_config, instantly_config, review_mode
    FROM clients WHERE slug = ${slug}
  `;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const checklist = buildChecklist(client);
  const missing = checklist.filter((c) => !c.ok);

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Cannot launch outbound: configuration incomplete",
        missing: missing.map((m) => m.label),
        checklist,
      },
      { status: 400 }
    );
  }

  await sql`
    UPDATE clients
    SET outbound_active = true, outbound_launched_at = NOW()
    WHERE slug = ${slug}
  `;

  return NextResponse.json({ ok: true, outbound_active: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  await sql`UPDATE clients SET outbound_active = false WHERE slug = ${slug}`;
  return NextResponse.json({ ok: true, outbound_active: false });
}
