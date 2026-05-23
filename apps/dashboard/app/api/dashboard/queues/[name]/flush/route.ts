import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getQueue } from "@/lib/bull-redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
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
  // Flush is super_admin only — extremely destructive
  if (operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden — requires super_admin" }, { status: 403 });
  }

  const { name } = await params;

  try {
    const q = getQueue(name);
    await q.obliterate({ force: true });
    // Log destructive action
    console.error(
      `[AUDIT] Queue "${name}" flushed by operator ${operator.sub} (${operator.email}) at ${new Date().toISOString()}`
    );
    return NextResponse.json({ success: true, queue: name, action: "flushed" });
  } catch (err: any) {
    console.error(`Queue flush error [${name}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
