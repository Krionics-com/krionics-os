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
    const [log] = await sql<any[]>`
      SELECT 
        i.*,
        i.invoked_at as created_at,
        (i.cost_usd_micro::double precision / 1000000.0) as cost_usd,
        p.name as prompt_name,
        p.system_prompt,
        p.user_template
      FROM ai_invocations i
      LEFT JOIN ai_prompts p ON p.id = i.prompt_id
      WHERE i.id = ${id}
    `;

    if (!log) {
      return NextResponse.json({ error: "Log entry not found" }, { status: 404 });
    }

    return NextResponse.json({ log });
  } catch (err: any) {
    console.error("GET log detail error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
