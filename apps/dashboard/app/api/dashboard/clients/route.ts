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
          c.positioning_statement, c.calcom_link,
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
          c.positioning_statement, c.calcom_link,
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
    // Step 1 — basics
    company_name, contact_email, contact_name, slug, timezone,
    website_url, industry, contact_phone, contact_role,
    service_type, tier, mrr_usd, setup_fee_usd, contract_start, contract_end,
    // Step 2 — business context
    company_description, service_description, positioning_statement,
    value_proposition, sales_lead_name,
    // Step 3 — ICP (stored in config JSONB)
    icp_description,
    // Step 5 — integrations
    crm_type, crm_config, calcom_link, slack_webhook_url, slack_channel_id,
    // Step 6 — AI
    automation_level, ai_tone, ai_knowledge_base, forbidden_claims,
    // Step 4 — infrastructure
    infrastructure_strategy,
    primary_domain, outbound_domains, inboxes, mail_provider,
    technical_contact, access_checklist, setup_checklist, notes,
    // Config JSONB (ICP targets, team, etc.)
    config,
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
        website_url, industry, contact_phone, contact_role,
        service_type, tier, mrr_usd, setup_fee_usd, contract_start, contract_end,
        company_description, service_description, positioning_statement,
        value_proposition, sales_lead_name, icp_description,
        crm_type, crm_config, calcom_link, slack_webhook_url, slack_channel_id,
        automation_level, ai_tone, ai_knowledge_base, forbidden_claims,
        infrastructure_strategy, primary_domain, outbound_domains, inboxes,
        mail_provider, technical_contact, access_checklist, setup_checklist, notes,
        config
      )
      VALUES (
        ${company_name},
        ${contact_email},
        ${contact_name},
        ${slug},
        ${timezone ?? "America/New_York"},
        ${website_url ?? null},
        ${industry ?? null},
        ${contact_phone ?? null},
        ${contact_role ?? null},
        ${service_type ?? null},
        ${tier ?? "growth"},
        ${mrr_usd ?? null},
        ${setup_fee_usd ?? null},
        ${contract_start ?? null},
        ${contract_end ?? null},
        ${company_description ?? null},
        ${service_description ?? null},
        ${positioning_statement ?? null},
        ${value_proposition ?? null},
        ${sales_lead_name ?? null},
        ${icp_description ?? null},
        ${crm_type ?? null},
        ${crm_config ? JSON.stringify(crm_config) : null},
        ${calcom_link ?? null},
        ${slack_webhook_url ?? null},
        ${slack_channel_id ?? null},
        ${automation_level ?? 1},
        ${ai_tone ?? "professional"},
        ${ai_knowledge_base ?? null},
        ${forbidden_claims ?? null},
        ${infrastructure_strategy ?? null},
        ${primary_domain ?? null},
        ${outbound_domains ?? []},
        ${inboxes ?? []},
        ${mail_provider ?? null},
        ${technical_contact ? JSON.stringify(technical_contact) : null},
        ${access_checklist ? JSON.stringify(access_checklist) : null},
        ${setup_checklist ? JSON.stringify(setup_checklist) : null},
        ${notes ?? null},
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
