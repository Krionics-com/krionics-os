import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prompts = await sql<any[]>`
      SELECT 
        p.*, 
        cl.company_name as client_company_name
      FROM ai_prompts p
      LEFT JOIN clients cl ON cl.id = p.client_id
      ORDER BY p.name ASC, p.version DESC
    `;

    return NextResponse.json({ prompts });
  } catch (err: any) {
    console.error("GET prompts error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
