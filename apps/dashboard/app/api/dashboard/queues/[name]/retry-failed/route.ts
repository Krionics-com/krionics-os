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
    const failed = await q.getFailed(0, 999);
    let retried = 0;
    for (const job of failed) {
      try {
        await job.retry();
        retried++;
      } catch {
        // Some jobs may not be retriable
      }
    }
    return NextResponse.json({ success: true, queue: name, retried });
  } catch (err: any) {
    console.error(`Queue retry-failed error [${name}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
