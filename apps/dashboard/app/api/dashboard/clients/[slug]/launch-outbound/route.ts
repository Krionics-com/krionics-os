import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
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

  const [client] = await sql<{ id: string; outbound_active: boolean }[]>`
    SELECT id, outbound_active FROM clients WHERE slug = ${slug}
  `;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  await sql`
    UPDATE clients
    SET outbound_active = true, outbound_launched_at = NOW()
    WHERE slug = ${slug}
  `;

  return NextResponse.json({ ok: true, outbound_active: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
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

  await sql`UPDATE clients SET outbound_active = false WHERE slug = ${slug}`;
  return NextResponse.json({ ok: true, outbound_active: false });
}
