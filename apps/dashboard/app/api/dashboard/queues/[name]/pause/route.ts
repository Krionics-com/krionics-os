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
  if (operator.role !== "admin" && operator.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await params;

  try {
    const q = getQueue(name);
    await q.pause();
    return NextResponse.json({ success: true, queue: name, action: "paused" });
  } catch (err: any) {
    console.error(`Queue pause error [${name}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
