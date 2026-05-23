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

  const [row] = await sql<{
    id: string;
    email: string;
    name: string;
    role: string;
    client_access: string[] | null;
    is_active: boolean;
  }[]>`
    SELECT id, email, name, role, client_access, is_active
    FROM operators
    WHERE id = ${operator.sub}
    LIMIT 1
  `;

  if (!row || !row.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    client_access: row.client_access
  });
}
