import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

const UpdateOperatorSchema = z.object({
  role: z.enum(["admin", "reviewer"]).optional(),
  is_active: z.boolean().optional(),
  name: z.string().min(1).optional(),
  client_access: z.array(z.string().uuid()).nullable().optional()
});

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const operator = await verifyToken(token);
    if (operator.role !== "admin") {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { operator };
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return auth.error;
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateOperatorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updates: ReturnType<typeof sql>[] = [];

  if (parsed.data.role !== undefined) {
    updates.push(sql`role = ${parsed.data.role}`);
  }

  if (parsed.data.is_active !== undefined) {
    updates.push(sql`is_active = ${parsed.data.is_active}`);
  }

  if (parsed.data.name !== undefined) {
    updates.push(sql`name = ${parsed.data.name}`);
  }

  if (parsed.data.client_access !== undefined) {
    const access = parsed.data.client_access && parsed.data.client_access.length > 0
      ? parsed.data.client_access
      : null;
    updates.push(sql`client_access = ${access}`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  let setClause = updates[0];
  for (let i = 1; i < updates.length; i += 1) {
    setClause = sql`${setClause}, ${updates[i]}`;
  }

  const [row] = await sql<{
    id: string;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
    client_access: string[] | null;
    created_at: string;
  }[]>`
    UPDATE operators
    SET ${setClause}
    WHERE id = ${id}
    RETURNING id, email, name, role, is_active, client_access, created_at
  `;

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ operator: row });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return auth.error;
  }

  const { id } = await params;

  await sql`
    UPDATE operators
    SET is_active = FALSE
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true });
}
