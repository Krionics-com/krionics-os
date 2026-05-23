import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getQueue, QUEUE_NAMES } from "@/lib/bull-redis";

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

  try {
    const queues = await Promise.all(
      QUEUE_NAMES.map(async (name) => {
        const q = getQueue(name);
        const counts = await q.getJobCounts("waiting", "active", "failed", "delayed");
        const isPaused = await q.isPaused();

        // Get oldest waiting job age
        let oldestAgeMinutes = 0;
        try {
          const waiting = await q.getWaiting(0, 0);
          if (waiting.length > 0 && waiting[0].timestamp) {
            oldestAgeMinutes = Math.round(
              (Date.now() - waiting[0].timestamp) / 60000
            );
          }
        } catch {
          // Queue may be empty
        }

        return {
          name,
          pending: counts.waiting ?? 0,
          active: counts.active ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          oldestAgeMinutes,
          isPaused,
        };
      })
    );

    return NextResponse.json({
      queues,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Queues endpoint error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
