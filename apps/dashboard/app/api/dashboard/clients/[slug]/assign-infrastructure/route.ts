import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
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

  const { slug } = await params;

  const [client] = await sql<{ id: string }[]>`SELECT id FROM clients WHERE slug = ${slug}`;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inbox_emails: string[] = body.inbox_emails ?? [];
  const domain_names: string[] = body.domain_names ?? [];

  try {
    if (inbox_emails.length > 0) {
      await sql`
        UPDATE inboxes SET client_id = ${client.id}
        WHERE email = ANY(${inbox_emails}::text[]) AND (client_id IS NULL)
      `;
    }

    if (domain_names.length > 0) {
      await sql`
        UPDATE domains SET client_id = ${client.id}
        WHERE domain = ANY(${domain_names}::text[]) AND (client_id IS NULL)
      `;
    }

    return NextResponse.json({ ok: true, assigned_inboxes: inbox_emails.length, assigned_domains: domain_names.length });
  } catch (err: any) {
    console.error("Assign infrastructure error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
