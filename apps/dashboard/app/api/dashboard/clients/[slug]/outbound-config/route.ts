import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
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
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["apollo_config", "clay_config", "sequence_config", "instantly_config", "review_mode"] as const;
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate review_mode if present
  if (updates.review_mode && !["human", "ai", "auto"].includes(updates.review_mode)) {
    return NextResponse.json({ error: "review_mode must be human, ai, or auto" }, { status: 400 });
  }

  const setClauses = Object.entries(updates).map(([key, val]) => {
    const v = typeof val === "object" ? JSON.stringify(val) : val;
    return sql`${sql(key)} = ${v}`;
  });
  let setClause = setClauses[0];
  for (let i = 1; i < setClauses.length; i++) {
    setClause = sql`${setClause}, ${setClauses[i]}`;
  }

  const [updated] = await sql<any[]>`
    UPDATE clients SET ${setClause}, updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING apollo_config, clay_config, sequence_config, instantly_config, review_mode, outbound_active
  `;
  if (!updated) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  return NextResponse.json({ client: updated });
}
