import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Build optional client_access filter
    let rows;
    if (operator.client_access && operator.client_access.length > 0) {
      rows = await sql<any[]>`
        SELECT
          c.id, c.slug, c.company_name, c.contact_email, c.contact_name,
          c.timezone, c.service_type, c.status, c.tier,
          c.automation_level, c.mrr_usd, c.setup_fee_usd,
          c.contract_start, c.contract_end, c.config,
          c.crm_type, c.crm_config,
          c.sales_lead_name, c.service_description, c.icp_description,
          c.positioning_statement, c.calendly_link AS calcom_link,
          c.slack_webhook_url, c.slack_channel_id,
          c.created_at, c.updated_at,
          COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'active')::int AS active_campaigns,
          COALESCE(
            ROUND(SUM(ca.replies_received)::numeric / NULLIF(SUM(ca.emails_sent), 0) * 100, 1),
            0
          )::float AS reply_rate
        FROM clients c
        LEFT JOIN campaigns ca ON ca.client_id = c.id
        WHERE c.id = ANY(${operator.client_access})
        GROUP BY c.id
        ORDER BY c.company_name
      `;
    } else {
      rows = await sql<any[]>`
        SELECT
          c.id, c.slug, c.company_name, c.contact_email, c.contact_name,
          c.timezone, c.service_type, c.status, c.tier,
          c.automation_level, c.mrr_usd, c.setup_fee_usd,
          c.contract_start, c.contract_end, c.config,
          c.crm_type, c.crm_config,
          c.sales_lead_name, c.service_description, c.icp_description,
          c.positioning_statement, c.calendly_link AS calcom_link,
          c.slack_webhook_url, c.slack_channel_id,
          c.created_at, c.updated_at,
          COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'active')::int AS active_campaigns,
          COALESCE(
            ROUND(SUM(ca.replies_received)::numeric / NULLIF(SUM(ca.emails_sent), 0) * 100, 1),
            0
          )::float AS reply_rate
        FROM clients c
        LEFT JOIN campaigns ca ON ca.client_id = c.id
        GROUP BY c.id
        ORDER BY c.company_name
      `;
    }

    const clients = rows.map((r) => ({
      ...r,
      onboarding_stage: deriveOnboardingStage(r),
    }));

    return NextResponse.json({ clients });
  } catch (err: any) {
    console.error("Clients list error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    company_name, contact_email, contact_name, slug, timezone,
    service_type, service_description, positioning_statement, sales_lead_name,
    icp_description, mrr_usd, setup_fee_usd, contract_start, contract_end,
    crm_type, crm_config, calcom_link, slack_webhook_url, slack_channel_id,
    automation_level, tier, config,
  } = body;

  if (!company_name || !contact_email || !contact_name || !slug) {
    return NextResponse.json(
      { error: "company_name, contact_email, contact_name, and slug are required" },
      { status: 400 }
    );
  }

  // Check slug uniqueness
  const [existing] = await sql<{ id: string }[]>`
    SELECT id FROM clients WHERE slug = ${slug}
  `;
  if (existing) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  try {
    const [client] = await sql<any[]>`
      INSERT INTO clients (
        company_name, contact_email, contact_name, slug, timezone,
        service_type, service_description, positioning_statement, sales_lead_name,
        icp_description, mrr_usd, setup_fee_usd, contract_start, contract_end,
        crm_type, crm_config, calendly_link, slack_webhook_url, slack_channel_id,
        automation_level, tier, config
      )
      VALUES (
        ${company_name},
        ${contact_email},
        ${contact_name},
        ${slug},
        ${timezone ?? "America/New_York"},
        ${service_type ?? null},
        ${service_description ?? null},
        ${positioning_statement ?? null},
        ${sales_lead_name ?? null},
        ${icp_description ?? null},
        ${mrr_usd ?? null},
        ${setup_fee_usd ?? null},
        ${contract_start ?? null},
        ${contract_end ?? null},
        ${crm_type ?? null},
        ${crm_config ? JSON.stringify(crm_config) : null},
        ${calcom_link ?? null},
        ${slack_webhook_url ?? null},
        ${slack_channel_id ?? null},
        ${automation_level ?? 1},
        ${tier ?? "growth"},
        ${config ? JSON.stringify(config) : null}
      )
      RETURNING *
    `;
    return NextResponse.json({ client }, { status: 201 });
  } catch (err: any) {
    console.error("Create client error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function deriveOnboardingStage(client: any): string {
  if (client.status !== "onboarding") return client.status;
  const stage = client.config?.onboarding_stage;
  return stage ?? "Onboarding";
}
