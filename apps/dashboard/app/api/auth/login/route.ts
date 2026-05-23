import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCookieName, signToken } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const [operator] = await sql<{
    id: string;
    email: string;
    name: string;
    role: string;
    client_access: string[] | null;
    password_hash: string | null;
  }[]>`
    SELECT id, email, name, role, client_access, password_hash
    FROM operators
    WHERE email = ${email} AND is_active = TRUE
  `;

  if (!operator || !operator.password_hash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, operator.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signToken({
    sub: operator.id,
    email: operator.email,
    name: operator.name,
    role: operator.role,
    client_access: operator.client_access || []
  });

  const response = NextResponse.json({
    operator: {
      id: operator.id,
      email: operator.email,
      name: operator.name,
      role: operator.role
    }
  });

  response.cookies.set(getCookieName(), token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}
