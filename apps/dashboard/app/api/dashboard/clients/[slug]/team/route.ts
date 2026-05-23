import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    // Get client id from slug
    const [client] = await sql<{ id: string }[]>`
      SELECT id FROM clients WHERE slug = ${slug}
    `;
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    // Operators with access to all clients (client_access IS NULL)
    // or specifically this client (client_access @> ARRAY[id])
    const operators = await sql<any[]>`
      SELECT id, email, name, role, is_active, client_access, created_at
      FROM operators
      WHERE client_access IS NULL
         OR client_access @> ARRAY[${client.id}]::uuid[]
      ORDER BY name
    `;

    return NextResponse.json({ operators });
  } catch (err: any) {
    console.error(`Client team error [${slug}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
