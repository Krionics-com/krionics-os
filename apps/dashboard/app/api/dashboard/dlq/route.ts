import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getQueue, getDLQName } from "@/lib/bull-redis";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  try {
    const q = getQueue(getDLQName());
    const totalCounts = await q.getJobCounts("failed", "waiting", "completed");
    const total = (totalCounts.failed ?? 0) + (totalCounts.waiting ?? 0) + (totalCounts.completed ?? 0);

    // Get failed jobs from the DLQ
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // DLQ jobs are stored as "waiting" since they are added via deadLetterQueue.add()
    // Also check failed in case some were retried and failed again
    const waitingJobs = await q.getWaiting(start, end);
    const failedJobs = await q.getFailed(start, end);
    const allJobs = [...waitingJobs, ...failedJobs];

    const jobs = allJobs.slice(0, limit).map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason ?? job.data?.error?.message ?? "N/A",
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      timestamp: job.timestamp,
      originalQueue: job.data?.originalQueue ?? "unknown",
      status: job.failedReason ? "failed" : "pending",
    }));

    return NextResponse.json({ jobs, total, page, limit });
  } catch (err: any) {
    console.error("DLQ list error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
