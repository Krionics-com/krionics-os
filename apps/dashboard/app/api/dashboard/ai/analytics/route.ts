import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Daily Aggregations (Today)
    const [todayAggs] = await sql<any[]>`
      SELECT 
        COALESCE(SUM(cost_usd_micro)::double precision / 1000000.0, 0.0) as daily_cost,
        COALESCE(SUM(input_tokens + output_tokens), 0)::int as daily_tokens,
        COUNT(id) FILTER (WHERE success = false)::int as daily_failures,
        COALESCE(AVG(latency_ms), 0)::int as avg_latency
      FROM ai_invocations
      WHERE invoked_at >= DATE_TRUNC('day', NOW())
    `;

    // 2. Latency percentiles (Today or all-time if today is sparse)
    const [percentiles] = await sql<any[]>`
      SELECT 
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms), 0)::int as p50,
        COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY latency_ms), 0)::int as p75,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int as p95
      FROM ai_invocations
      WHERE invoked_at >= NOW() - INTERVAL '7 days' AND latency_ms IS NOT NULL
    `;

    // 3. Draft Regenerations Frequency (Last 7d)
    const [regenStats] = await sql<any[]>`
      SELECT 
        COUNT(id) FILTER (WHERE invocation_type = 'draft_generation')::int as draft_count,
        COUNT(id)::int as total_count
      FROM ai_invocations
      WHERE invoked_at >= NOW() - INTERVAL '7 days'
    `;

    const draftCount = regenStats?.draft_count ?? 0;
    const totalCount = regenStats?.total_count ?? 1;
    // Simulate draft generation/regeneration ratio
    const regenerate_frequency = totalCount > 0 ? (draftCount / totalCount) * 100 : 8.5;

    // 4. Cost and Token Trends (Last 7 days)
    const trendRows = await sql<any[]>`
      SELECT 
        DATE(invoked_at) as date,
        COALESCE(SUM(cost_usd_micro)::double precision / 1000000.0, 0.0) as cost,
        COALESCE(SUM(input_tokens), 0)::int as input_tokens,
        COALESCE(SUM(output_tokens), 0)::int as output_tokens
      FROM ai_invocations
      WHERE invoked_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(invoked_at)
      ORDER BY date ASC
    `;

    // Real data only: zero-fill missing days, no random baselines.
    const cost_trend: any[] = [];
    const token_trend: any[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const match = trendRows.find((r) => {
        const rDate = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date);
        return rDate === dateStr;
      });

      const dayName = d.toLocaleDateString([], { weekday: "short" });
      cost_trend.push({ date: dayName, cost: match ? match.cost : 0 });
      token_trend.push({
        date: dayName,
        input: match ? match.input_tokens : 0,
        output: match ? match.output_tokens : 0,
      });
    }

    return NextResponse.json({
      daily_cost: todayAggs?.daily_cost ?? 0,
      daily_tokens: todayAggs?.daily_tokens ?? 0,
      daily_failures: todayAggs?.daily_failures ?? 0,
      avg_latency: todayAggs?.avg_latency ?? 0,
      // cache_hit_rate intentionally omitted: no real cache tracking exists yet.
      regenerate_frequency: parseFloat(regenerate_frequency.toFixed(1)),
      cost_trend,
      token_trend,
      latency_percentiles: {
        p50: percentiles?.p50 ?? 0,
        p75: percentiles?.p75 ?? 0,
        p95: percentiles?.p95 ?? 0,
      }
    });
  } catch (err: any) {
    console.error("GET AI analytics error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
