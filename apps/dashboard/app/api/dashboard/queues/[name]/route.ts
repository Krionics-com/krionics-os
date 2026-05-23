import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getQueue } from "@/lib/bull-redis";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
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

  const { name } = await params;

  try {
    const q = getQueue(name);
    const counts = await q.getJobCounts("waiting", "active", "failed", "delayed", "completed");
    const isPaused = await q.isPaused();

    // Get active and failed jobs (up to 20 each)
    const activeJobs = await q.getActive(0, 19);
    const failedJobs = await q.getFailed(0, 19);

    const active = activeJobs.map((j) => ({
      id: j.id,
      name: j.name,
      timestamp: j.timestamp,
      processedOn: j.processedOn,
      elapsedMs: j.processedOn ? Date.now() - j.processedOn : 0,
    }));

    const failed = failedJobs.map((j) => ({
      id: j.id,
      name: j.name,
      failedReason: j.failedReason?.slice(0, 120) ?? "Unknown",
      finishedOn: j.finishedOn,
      attemptsMade: j.attemptsMade,
    }));

    // TODO: Replace with real BullMQ Metrics when a metrics store (e.g. Prometheus) is available.
    // For now, return mock hourly depth data for the last 24 hours.
    const now = Date.now();
    const depthChart = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(now - (23 - i) * 3600_000).toISOString(),
      depth: Math.max(0, Math.floor(Math.random() * 30) + (counts.waiting ?? 0)),
    }));

    return NextResponse.json({
      name,
      counts,
      isPaused,
      activeJobs: active,
      failedJobs: failed,
      depthChart,
    });
  } catch (err: any) {
    console.error(`Queue detail error [${name}]:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
