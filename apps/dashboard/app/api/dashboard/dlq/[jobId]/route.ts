import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getQueue, getDLQName } from "@/lib/bull-redis";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  try {
    const q = getQueue(getDLQName());
    const job = await q.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      timestamp: job.timestamp,
      opts: job.opts,
      originalQueue: job.data?.originalQueue ?? "unknown",
    });
  } catch (err: any) {
    console.error(`DLQ job detail error [${jobId}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
