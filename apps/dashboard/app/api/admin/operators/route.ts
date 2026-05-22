import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

const CreateOperatorSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "reviewer"]),
  password: z.string().min(8),
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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return auth.error;
  }

  const rows = await sql<{
    id: string;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
    client_access: string[] | null;
    created_at: string;
  }[]>`
    SELECT id, email, name, role, is_active, client_access, created_at
    FROM operators
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return auth.error;
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateOperatorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload: " + JSON.stringify(parsed.error.flatten().fieldErrors) }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const clientAccess = parsed.data.client_access && parsed.data.client_access.length > 0
    ? parsed.data.client_access
    : null;

  try {
    const [row] = await sql<{
      id: string;
      email: string;
      name: string;
      role: string;
      is_active: boolean;
      client_access: string[] | null;
      created_at: string;
    }[]>`
      INSERT INTO operators (email, name, role, is_active, client_access, password_hash)
      VALUES (${parsed.data.email}, ${parsed.data.name}, ${parsed.data.role}, TRUE, ${clientAccess}, ${passwordHash})
      RETURNING id, email, name, role, is_active, client_access, created_at
    `;

    return NextResponse.json({ operator: row });
  } catch (error) {
    return NextResponse.json({ error: "Operator already exists" }, { status: 409 });
  }
}
