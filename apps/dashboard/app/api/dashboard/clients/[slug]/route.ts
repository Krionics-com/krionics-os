import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    const [client] = await sql<any[]>`
      SELECT
        c.*,
        c.calendly_link AS calcom_link,
        COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'active')::int AS active_campaigns,
        COALESCE(SUM(ca.emails_sent), 0)::int AS total_emails_sent,
        COALESCE(
          ROUND(SUM(ca.replies_received)::numeric / NULLIF(SUM(ca.emails_sent), 0) * 100, 1),
          0
        )::float AS reply_rate,
        COALESCE(SUM(ca.meetings_booked), 0)::int AS total_meetings_booked
      FROM clients c
      LEFT JOIN campaigns ca ON ca.client_id = c.id
      WHERE c.slug = ${slug}
      GROUP BY c.id
    `;

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Recent reply items for this client
    const recentActivity = await sql<any[]>`
      SELECT ri.id, ri.status, ri.created_at, rc.intent
      FROM reply_items ri
      LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
      WHERE ri.client_id = ${client.id}
      ORDER BY ri.created_at DESC
      LIMIT 5
    `;

    return NextResponse.json({ client, recentActivity });
  } catch (err: any) {
    console.error(`Client detail error [${slug}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const { slug } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required fields if they are being changed
  if (body.company_name !== undefined && !body.company_name) {
    return NextResponse.json({ error: "company_name cannot be empty" }, { status: 400 });
  }
  if (body.contact_email !== undefined && !body.contact_email) {
    return NextResponse.json({ error: "contact_email cannot be empty" }, { status: 400 });
  }
  if (body.contact_name !== undefined && !body.contact_name) {
    return NextResponse.json({ error: "contact_name cannot be empty" }, { status: 400 });
  }

  // Separate JSONB fields from scalar fields
  const { config, crm_config, ...scalars } = body;

  try {
    // Handle JSONB merge for config
    if (config !== undefined) {
      await sql`
        UPDATE clients
        SET config = config || ${JSON.stringify(config)}::jsonb,
            updated_at = NOW()
        WHERE slug = ${slug}
      `;
    }

    // Handle JSONB merge for crm_config
    if (crm_config !== undefined) {
      await sql`
        UPDATE clients
        SET crm_config = crm_config || ${JSON.stringify(crm_config)}::jsonb,
            updated_at = NOW()
        WHERE slug = ${slug}
      `;
    }

    // Handle scalar field updates dynamically
    const allowedScalars = [
      "company_name", "contact_email", "contact_name", "timezone",
      "service_type", "status", "tier", "automation_level",
      "mrr_usd", "setup_fee_usd", "contract_start", "contract_end",
      "crm_type", "sales_lead_name", "service_description",
      "icp_description", "positioning_statement", "calendly_link",
      "slack_webhook_url", "slack_channel_id", "instantly_campaign_id",
      "infrastructure_strategy", "primary_domain", "outbound_domains", "inboxes",
      "mail_provider", "technical_contact", "access_checklist", "setup_checklist", "notes",
    ];

    // Accept calcom_link from the frontend and map it to the DB column name
    if ("calcom_link" in scalars) {
      scalars.calendly_link = scalars.calcom_link;
      delete scalars.calcom_link;
    }

    const updates: Record<string, any> = {};
    for (const key of allowedScalars) {
      if (key in scalars) {
        let val = scalars[key];
        // Safely stringify JSONB objects so postgres library inserts them properly
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          val = JSON.stringify(val);
        }
        updates[key] = val;
      }
    }

    if (Object.keys(updates).length > 0) {
      // Build SET clause dynamically
      const setClauses = Object.entries(updates).map(
        ([key, val]) => sql`${sql(key)} = ${val}`
      );
      let setClause = setClauses[0];
      for (let i = 1; i < setClauses.length; i++) {
        setClause = sql`${setClause}, ${setClauses[i]}`;
      }
      await sql`
        UPDATE clients SET ${setClause}, updated_at = NOW() WHERE slug = ${slug}
      `;
    }

    // Fetch updated client
    const [updated] = await sql<any[]>`SELECT *, calendly_link AS calcom_link FROM clients WHERE slug = ${slug}`;
    return NextResponse.json({ client: updated });
  } catch (err: any) {
    console.error(`Client PATCH error [${slug}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
