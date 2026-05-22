import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8)
});

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null);
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [row] = await sql<{
    id: string;
    password_hash: string | null;
  }[]>`
    SELECT id, password_hash
    FROM operators
    WHERE id = ${operator.sub} AND is_active = TRUE
    LIMIT 1
  `;

  if (!row || !row.password_hash) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await bcrypt.compare(parsed.data.current_password, row.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(parsed.data.new_password, 10);

  await sql`
    UPDATE operators
    SET password_hash = ${newHash}
    WHERE id = ${operator.sub}
  `;

  return NextResponse.json({ ok: true });
}
