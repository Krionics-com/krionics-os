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
    const operators = await sql<{ id: string; email: string; name: string; role: string }[]>`
      SELECT id, email, name, role
      FROM operators
      WHERE is_active = true
      ORDER BY name
    `;
    return NextResponse.json({ operators });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
