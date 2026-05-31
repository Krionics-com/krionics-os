import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let operator;
  try {
    operator = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "PENDING_REVIEW";
  const intentParam = searchParams.get("intent");
  const slaParam = searchParams.get("sla");
  const searchParam = searchParams.get("search");
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "25");
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions: any[] = [];

  // Status mapping
  // We can support single string or comma separated values
  const statuses = statusParam.split(",");
  const statusConditions: any[] = [];
  const now = new Date();

  for (const st of statuses) {
    if (st === "PENDING_REVIEW" || st === "PENDING") {
      statusConditions.push(sql`ri.status = 'PENDING_REVIEW'`);
    } else if (st === "SLA_WARNING") {
      // PENDING_REVIEW & SLA Yellow (expires in 0 to 1 hour)
      statusConditions.push(
        sql`ri.status = 'PENDING_REVIEW' AND ri.sla_expires_at > ${now.toISOString()} AND ri.sla_expires_at <= ${(new Date(now.getTime() + 60 * 60 * 1000)).toISOString()}`
      );
    } else if (st === "OVERDUE") {
      // PENDING_REVIEW & SLA Red (expired)
      statusConditions.push(
        sql`ri.status = 'PENDING_REVIEW' AND ri.sla_expires_at <= ${now.toISOString()}`
      );
    } else {
      statusConditions.push(sql`ri.status = ${st}`);
    }
  }

  if (statusConditions.length > 0) {
    let statusOrClause = statusConditions[0];
    for (let i = 1; i < statusConditions.length; i++) {
      statusOrClause = sql`${statusOrClause} OR ${statusConditions[i]}`;
    }
    conditions.push(sql`(${statusOrClause})`);
  }

  // Tenant/Client visibility restrictions
  if (operator.client_access && operator.client_access.length > 0) {
    conditions.push(sql`ri.client_id = ANY(${operator.client_access})`);
  }

  // Intent filter
  if (intentParam) {
    const intents = intentParam.split(",");
    let intentOrClause = sql`rc.intent = ${intents[0]}`;
    for (let i = 1; i < intents.length; i++) {
      intentOrClause = sql`${intentOrClause} OR rc.intent = ${intents[i]}`;
    }
    conditions.push(sql`(${intentOrClause})`);
  }

  // SLA filter from UI
  if (slaParam) {
    const slas = slaParam.split(",");
    const slaConditions: any[] = [];
    for (const s of slas) {
      if (s === "RED") {
        slaConditions.push(sql`ri.sla_expires_at <= ${now.toISOString()}`);
      } else if (s === "YELLOW") {
        slaConditions.push(
          sql`ri.sla_expires_at > ${now.toISOString()} AND ri.sla_expires_at <= ${(new Date(now.getTime() + 60 * 60 * 1000)).toISOString()}`
        );
      } else if (s === "GREEN") {
        slaConditions.push(
          sql`ri.sla_expires_at > ${(new Date(now.getTime() + 60 * 60 * 1000)).toISOString()}`
        );
      }
    }
    if (slaConditions.length > 0) {
      let slaOrClause = slaConditions[0];
      for (let i = 1; i < slaConditions.length; i++) {
        slaOrClause = sql`${slaOrClause} OR ${slaConditions[i]}`;
      }
      conditions.push(sql`(${slaOrClause})`);
    }
  }

  // Search filter
  if (searchParam) {
    const searchLike = `%${searchParam}%`;
    conditions.push(
      sql`(l.email ILIKE ${searchLike} OR l.company ILIKE ${searchLike} OR rr.body_text ILIKE ${searchLike})`
    );
  }

  // Construct final WHERE clause
  let whereClause = sql`TRUE`;
  if (conditions.length > 0) {
    whereClause = conditions[0];
    for (let i = 1; i < conditions.length; i++) {
      whereClause = sql`${whereClause} AND ${conditions[i]}`;
    }
  }

  // Sort: default to SLA ascending (most urgent first)
  const sortColumn = searchParams.get("sort") ?? "sla";
  const sortDirection = searchParams.get("order") ?? "asc";
  let orderByClause = sql`ri.sla_expires_at ASC`;

  if (sortColumn === "lead") {
    orderByClause = sortDirection === "desc" ? sql`l.email DESC` : sql`l.email ASC`;
  } else if (sortColumn === "company") {
    orderByClause = sortDirection === "desc" ? sql`l.company DESC` : sql`l.company ASC`;
  } else if (sortColumn === "intent") {
    orderByClause = sortDirection === "desc" ? sql`rc.intent DESC` : sql`rc.intent ASC`;
  } else if (sortColumn === "confidence") {
    orderByClause = sortDirection === "desc" ? sql`rc.confidence DESC` : sql`rc.confidence ASC`;
  } else if (sortColumn === "received" || sortColumn === "created_at") {
    orderByClause = sortDirection === "desc" ? sql`ri.created_at DESC` : sql`ri.created_at ASC`;
  }

  let rows: any[];
  let countRow: { count: number } | undefined;
  try {
    rows = await sql<any[]>`
      SELECT
        ri.id,
        ri.created_at,
        ri.sla_expires_at,
        l.email as lead_email,
        l.first_name,
        l.last_name,
        l.company,
        l.title,
        rc.intent,
        rc.confidence,
        o.name as assigned_operator_name,
        o.email as assigned_operator_email,
        rr.body_text
      FROM reply_items ri
      LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
      LEFT JOIN leads l ON l.id = ri.lead_id
      LEFT JOIN raw_replies rr ON rr.id = ri.raw_reply_id
      LEFT JOIN operators o ON o.id = ri.assigned_to_operator_id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    [countRow] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count
      FROM reply_items ri
      LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
      LEFT JOIN leads l ON l.id = ri.lead_id
      LEFT JOIN raw_replies rr ON rr.id = ri.raw_reply_id
      WHERE ${whereClause}
    `;
  } catch (err: any) {
    console.error("[review-queue] SQL error:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      status: statusParam,
      intent: intentParam,
      sla: slaParam,
      search: searchParam,
    });
    return NextResponse.json(
      { error: err?.message ?? "Database error loading review queue" },
      { status: 500 }
    );
  }

  const data = rows.map((row) => {
    const expiresAt = new Date(row.sla_expires_at);
    let sla_status: "GREEN" | "YELLOW" | "RED" = "GREEN";
    const diffMs = expiresAt.getTime() - now.getTime();

    if (diffMs <= 0) {
      sla_status = "RED";
    } else if (diffMs <= 60 * 60 * 1000) {
      sla_status = "YELLOW";
    }

    return {
      id: row.id,
      lead: {
        email: row.lead_email,
        name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.lead_email,
        company: row.company || "Unknown",
        title: row.title || ""
      },
      intent: row.intent,
      confidence: row.confidence ? Math.round(Number(row.confidence) * 100) : 0,
      sla_status,
      sla_expires_at: row.sla_expires_at,
      assigned_operator: row.assigned_operator_name || row.assigned_operator_email || null,
      created_at: row.created_at,
      reply_preview: (row.body_text ?? "").slice(0, 80)
    };
  });

  return NextResponse.json({
    data,
    total: countRow?.count ?? 0,
    page
  });
}
