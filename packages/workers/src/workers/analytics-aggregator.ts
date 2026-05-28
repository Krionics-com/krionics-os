import { Worker } from "bullmq";
import { z } from "zod";
import { sql } from "../db.js";
import { analyticsAggregateQueue, analyticsIntelligenceQueue } from "../queues.js";
import { emitEvent } from "../emit-event.js";
import { getFeatureFlag, getGlobalConfig } from "../config.js";

const AggregateJobSchema = z.object({
  clientId: z.string().uuid().optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  granularity: z.enum(["hourly", "daily", "weekly", "monthly"]).default("daily")
});

type AggregateJob = z.infer<typeof AggregateJobSchema>;

export function createAnalyticsAggregatorWorker(): Worker<AggregateJob> {
  return new Worker(
    analyticsAggregateQueue.name,
    async (job) => {
      const payload = AggregateJobSchema.parse(job.data);

      const granularity = payload.granularity;
      const periodEnd = payload.periodEnd ? new Date(payload.periodEnd) : new Date();
      const periodStart = payload.periodStart
        ? new Date(payload.periodStart)
        : computePeriodStart(periodEnd, granularity);

      // Fetch all active clients (or the specific one)
      const clients = await sql<{ id: string; company_name: string }[]>`
        SELECT id, company_name
        FROM clients
        WHERE deleted_at IS NULL
        ${payload.clientId ? sql`AND id = ${payload.clientId}::uuid` : sql``}
      `;

      const results: Array<{ clientId: string; snapshotId: string }> = [];

      for (const client of clients) {
        const analyticsEnabled = await getFeatureFlag(client.id, "analytics");
        if (!analyticsEnabled) continue;
        const snapshot = await aggregateForClient(
          client.id,
          periodStart,
          periodEnd,
          granularity
        );

        results.push({ clientId: client.id, snapshotId: snapshot.id });

        await emitEvent({
          clientId: client.id,
          eventType: "analytics_snapshot_created",
          metadata: {
            snapshot_id: snapshot.id,
            granularity,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            total_replies: snapshot.totalReplies
          }
        });

        // Enqueue intelligence analysis (AI invocation point 6)
        // Weekly snapshots get analyzed by AI; daily snapshots skip unless forced
        if (granularity === "weekly" || payload.clientId) {
          await analyticsIntelligenceQueue.add(
            "analyze_snapshot",
            { snapshotId: snapshot.id, clientId: client.id },
            { jobId: `intelligence:${snapshot.id}` }
          );
        }
      }

      return { processed: results.length, results };
    },
    { connection: analyticsAggregateQueue.opts.connection }
  );
}

function computePeriodStart(periodEnd: Date, granularity: string): Date {
  const start = new Date(periodEnd);
  switch (granularity) {
    case "hourly":
      start.setHours(start.getHours() - 1);
      break;
    case "daily":
      start.setDate(start.getDate() - 1);
      break;
    case "weekly":
      start.setDate(start.getDate() - 7);
      break;
    case "monthly":
      start.setMonth(start.getMonth() - 1);
      break;
  }
  return start;
}

async function aggregateForClient(
  clientId: string,
  periodStart: Date,
  periodEnd: Date,
  granularity: string
): Promise<{ id: string; totalReplies: number }> {
  // Count total replies in the period
  const [replyStats] = await sql<{
    total_replies: number;
    positive_count: number;
    booking_count: number;
    avg_response_time_hours: number;
  }[]>`
    SELECT
      COUNT(*)::int                                              AS total_replies,
      COUNT(*) FILTER (WHERE intent = 'POSITIVE')::int          AS positive_count,
      COUNT(*) FILTER (WHERE intent = 'BOOKING_INTENT')::int    AS booking_count,
      COALESCE(
        AVG(
          EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600.0
        ) FILTER (WHERE status = 'SENT'),
        0
      )                                                         AS avg_response_time_hours
    FROM reply_items
    WHERE client_id = ${clientId}::uuid
      AND created_at >= ${periodStart.toISOString()}
      AND created_at < ${periodEnd.toISOString()}
  `;

  // Count sequences sent in the period (outbound emails)
  const [seqStats] = await sql<{ sequences_sent: number }[]>`
    SELECT COUNT(*)::int AS sequences_sent
    FROM events
    WHERE client_id = ${clientId}::uuid
      AND event_type = 'reply_sent'
      AND created_at >= ${periodStart.toISOString()}
      AND created_at < ${periodEnd.toISOString()}
  `;

  // Intent breakdown
  const intentRows = await sql<{ intent: string; count: number }[]>`
    SELECT intent, COUNT(*)::int AS count
    FROM reply_items
    WHERE client_id = ${clientId}::uuid
      AND created_at >= ${periodStart.toISOString()}
      AND created_at < ${periodEnd.toISOString()}
      AND intent IS NOT NULL
    GROUP BY intent
  `;

  // Top objections (body text of OBJECTION replies)
  const objectionRows = await sql<{ reply_body: string }[]>`
    SELECT ri.reply_body
    FROM reply_items ri
    JOIN raw_replies rr ON rr.id = ri.raw_reply_id
    WHERE ri.client_id = ${clientId}::uuid
      AND ri.intent = 'OBJECTION'
      AND ri.created_at >= ${periodStart.toISOString()}
      AND ri.created_at < ${periodEnd.toISOString()}
    ORDER BY ri.created_at DESC
    LIMIT 10
  `;

  const total = replyStats?.total_replies ?? 0;
  const sequencesSent = seqStats?.sequences_sent ?? 0;
  const intentBreakdown = Object.fromEntries(
    intentRows.map((r) => [r.intent, r.count])
  );
  const topObjections = objectionRows.map((r) => r.reply_body.slice(0, 200));

  const replyRate = sequencesSent > 0 ? total / sequencesSent : 0;
  const positiveRate = total > 0 ? (replyStats?.positive_count ?? 0) / total : 0;
  const bookingRate = total > 0 ? (replyStats?.booking_count ?? 0) / total : 0;

  const [snapshot] = await sql<{ id: string }[]>`
    INSERT INTO analytics_snapshots (
      client_id, period_start, period_end, granularity,
      total_replies, reply_rate, positive_rate, booking_rate,
      avg_response_time_hours, sequences_sent,
      intent_breakdown, top_objections
    ) VALUES (
      ${clientId}::uuid,
      ${periodStart.toISOString()},
      ${periodEnd.toISOString()},
      ${granularity},
      ${total},
      ${replyRate},
      ${positiveRate},
      ${bookingRate},
      ${replyStats?.avg_response_time_hours ?? 0},
      ${sequencesSent},
      ${JSON.stringify(intentBreakdown)},
      ${topObjections}
    )
    ON CONFLICT (client_id, period_start, period_end, granularity)
    DO UPDATE SET
      total_replies           = EXCLUDED.total_replies,
      reply_rate              = EXCLUDED.reply_rate,
      positive_rate           = EXCLUDED.positive_rate,
      booking_rate            = EXCLUDED.booking_rate,
      avg_response_time_hours = EXCLUDED.avg_response_time_hours,
      sequences_sent          = EXCLUDED.sequences_sent,
      intent_breakdown        = EXCLUDED.intent_breakdown,
      top_objections          = EXCLUDED.top_objections
    RETURNING id
  `;

  return { id: snapshot!.id, totalReplies: total };
}
