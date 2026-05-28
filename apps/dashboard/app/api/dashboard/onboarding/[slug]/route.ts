import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

// POST /api/dashboard/onboarding/[slug] with action: "complete" | "verify-crm"
export async function POST(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let operator;
  try { operator = await verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  let body: any = {};
  try { body = await req.json(); } catch {}

  const { action } = body;

  const [client] = await sql<any[]>`SELECT * FROM clients WHERE slug = ${slug}`;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (action === "verify-crm") {
    // Light check: does crm_config have required keys?
    const crm = client.crm_config ?? {};
    const type = client.crm_type;
    let ok = false;
    let message = "";

    if (!type || type === "none") {
      ok = true;
      message = "No CRM configured — skipped";
    } else if (type === "hubspot" && crm.access_token) {
      ok = true;
      message = "HubSpot credentials present";
    } else if (type === "pipedrive" && crm.api_key) {
      ok = true;
      message = "Pipedrive credentials present";
    } else {
      ok = false;
      message = `${type} credentials missing or incomplete`;
    }

    return NextResponse.json({ ok, message });
  }

  if (action === "complete") {
    const [updated] = await sql<any[]>`
      UPDATE clients SET status = 'active', updated_at = NOW()
      WHERE slug = ${slug}
      RETURNING id, slug, status, company_name
    `;
    return NextResponse.json({ client: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
