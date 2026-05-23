import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getQueue, getDLQName } from "@/lib/bull-redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
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

  const { jobId } = await params;

  try {
    const q = getQueue(getDLQName());
    const job = await q.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    await job.retry();
    return NextResponse.json({ success: true, jobId, action: "retried" });
  } catch (err: any) {
    console.error(`DLQ retry error [${jobId}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
