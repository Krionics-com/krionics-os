import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [prompt] = await sql<any[]>`
      SELECT 
        p.*, 
        cl.company_name as client_company_name
      FROM ai_prompts p
      LEFT JOIN clients cl ON cl.id = p.client_id
      WHERE p.id = ${id}
    `;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    return NextResponse.json({ prompt });
  } catch (err: any) {
    console.error("GET prompt error:", err);
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

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowedFields = [
    "system_prompt", "user_template", "model",
    "temperature", "max_tokens", "is_active"
  ];

  const updates: Record<string, any> = {};
  for (const k of allowedFields) {
    if (body[k] !== undefined) {
      updates[k] = body[k];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const setClauses = Object.entries(updates).map(([k, val]) => {
      return sql`${sql(k)} = ${val}`;
    });

    let setClause = setClauses[0];
    for (let i = 1; i < setClauses.length; i++) {
      setClause = sql`${setClause}, ${setClauses[i]}`;
    }

    // Increment version on update
    const [updated] = await sql<any[]>`
      UPDATE ai_prompts
      SET ${setClause}, version = version + 1, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    return NextResponse.json({ prompt: updated });
  } catch (err: any) {
    console.error("PATCH prompt error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
